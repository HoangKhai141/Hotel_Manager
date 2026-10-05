import crypto from "crypto";
import { BookingStatus, PaymentMethod, PaymentStatus, RoomStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "config/client";
import {
    createMoMoPaymentUrl,
    isValidMoMoNotification,
    MoMoNotification,
    MoMoPaymentRejectedError
} from "services/client/momo.service";

const notificationFields: (keyof MoMoNotification)[] = [
    "amount",
    "extraData",
    "message",
    "orderId",
    "orderInfo",
    "orderType",
    "partnerCode",
    "payType",
    "requestId",
    "responseTime",
    "resultCode",
    "transId",
    "signature"
];

const parseNotification = (input: Record<string, unknown>): MoMoNotification | null => {
    const notification: Partial<MoMoNotification> = {};

    for (const field of notificationFields) {
        const value = input[field];
        if (typeof value !== "string" && typeof value !== "number") return null;
        notification[field] = String(value);
    }

    if (
        !/^\d+$/.test(notification.amount ?? "") ||
        !/^\d+$/.test(notification.resultCode ?? "") ||
        !notification.orderId ||
        !notification.signature
    ) {
        return null;
    }

    return notification as MoMoNotification;
};

const updatePaymentResult = async (
    payment: {
        id: number;
        bookingId: number;
        booking: { roomBookings: { roomId: number }[] };
    },
    successful: boolean
) => {
    await prisma.$transaction(async (transaction) => {
        const updatedPayment = await transaction.payment.updateMany({
            where: {
                id: payment.id,
                paymentStatus: PaymentStatus.PENDING
            },
            data: successful
                ? { paymentStatus: PaymentStatus.SUCCESS, paidAt: new Date() }
                : { paymentStatus: PaymentStatus.FAILED }
        });

        if (updatedPayment.count === 0) {
            const current = await transaction.payment.findUnique({
                where: { id: payment.id },
                select: { paymentStatus: true }
            });
            if (successful && current?.paymentStatus === PaymentStatus.SUCCESS) return;
            if (!successful && current?.paymentStatus === PaymentStatus.FAILED) return;
            throw new Error("Payment has already reached a different final status.");
        }

        if (!successful) return;

        const confirmedBooking = await transaction.booking.updateMany({
            where: {
                id: payment.bookingId,
                status: BookingStatus.PENDING
            },
            data: { status: BookingStatus.CONFIRMED }
        });

        if (confirmedBooking.count > 0) {
            const roomIds = payment.booking.roomBookings.map((roomBooking) => roomBooking.roomId);
            if (roomIds.length) {
                await transaction.room.updateMany({
                    where: { id: { in: roomIds } },
                    data: { status: RoomStatus.BOOKED }
                });
            }
        }
    });
};

const applyMoMoResult = async (notification: MoMoNotification) => {
    if (!isValidMoMoNotification(notification)) {
        throw new Error("Invalid MoMo notification signature or partner code.");
    }

    const payment = await prisma.payment.findFirst({
        where: { paymentRef: notification.orderId },
        include: {
            booking: {
                include: { roomBookings: true }
            }
        }
    });

    if (!payment) throw new Error("No payment matches the MoMo order.");
    if (Number(notification.amount) !== payment.totalAmount) {
        throw new Error("MoMo notification amount does not match the payment.");
    }

    const successful = notification.resultCode === "0";
    await updatePaymentResult(payment, successful);

    return { bookingId: payment.bookingId, successful };
};

const mockModeEnabled = (): boolean => {
    const enabled = process.env.MOMO_MODE === "mock";
    if (enabled && process.env.NODE_ENV === "production") {
        throw new Error("Mock MoMo payments are disabled in production.");
    }
    return enabled;
};

export const initiateMoMoPayment = async (req: Request, res: Response) => {
    const rawBookingId = req.body.bookingId;
    const bookingId = typeof rawBookingId === "string" && /^\d+$/.test(rawBookingId)
        ? Number(rawBookingId)
        : NaN;

    if (!Number.isSafeInteger(bookingId) || bookingId <= 0 || !req.user?.id) {
        req.flash("error_msg", "Thông tin đặt phòng không hợp lệ.");
        return res.redirect("/booking");
    }

    let paymentRef: string | undefined;

    try {
        const useMock = mockModeEnabled();
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true }
        });

        if (!booking || booking.userId !== req.user.id) {
            req.flash("error_msg", "Không tìm thấy đặt phòng của bạn.");
            return res.redirect("/booking");
        }

        if (booking.status !== BookingStatus.PENDING) {
            req.flash("error_msg", "Đặt phòng này không còn ở trạng thái chờ thanh toán.");
            return res.redirect(`/booking/success?id=${booking.id}`);
        }

        if (!Number.isSafeInteger(booking.totalPrice) || booking.totalPrice <= 0) {
            throw new Error("Booking amount is invalid.");
        }

        if (booking.payment?.paymentStatus === PaymentStatus.SUCCESS) {
            req.flash("success_msg", "Đặt phòng này đã được thanh toán.");
            return res.redirect(`/booking/success?id=${booking.id}`);
        }

        if (booking.payment?.paymentStatus === PaymentStatus.PENDING) {
            req.flash("error_msg", "Giao dịch trước đang được xử lý. Vui lòng chờ xác nhận trước khi thử lại.");
            return res.redirect(`/booking/success?id=${booking.id}`);
        }

        if (booking.payment && booking.payment.paymentMethod !== PaymentMethod.MOBILE_PAYMENT) {
            req.flash("error_msg", "Đặt phòng này đang sử dụng phương thức thanh toán khác.");
            return res.redirect(`/booking/success?id=${booking.id}`);
        }

        const requestId = crypto.randomUUID();
        paymentRef = `${useMock ? "MOCK-" : ""}${crypto.randomUUID()}`;

        if (booking.payment) {
            const updated = await prisma.payment.updateMany({
                where: {
                    id: booking.payment.id,
                    paymentStatus: PaymentStatus.FAILED,
                    paymentMethod: PaymentMethod.MOBILE_PAYMENT
                },
                data: {
                    paymentStatus: PaymentStatus.PENDING,
                    paymentRef,
                    totalAmount: booking.totalPrice,
                    paidAt: null
                }
            });
            if (updated.count !== 1) {
                throw new Error("Payment attempt changed while a retry was being started.");
            }
        } else {
            await prisma.payment.create({
                data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    totalAmount: booking.totalPrice,
                    paymentMethod: PaymentMethod.MOBILE_PAYMENT,
                    paymentStatus: PaymentStatus.PENDING,
                    paymentRef
                }
            });
        }

        if (useMock) {
            return res.redirect(`/payment/momo/mock?ref=${encodeURIComponent(paymentRef)}`);
        }

        const momoResponse = await createMoMoPaymentUrl(
            booking.id,
            booking.totalPrice,
            paymentRef,
            requestId
        );
        return res.redirect(momoResponse.payUrl);
    } catch (error) {
        console.error("Could not initiate MoMo payment:", error);

        if (paymentRef && error instanceof MoMoPaymentRejectedError) {
            await prisma.payment.updateMany({
                where: { paymentRef, paymentStatus: PaymentStatus.PENDING },
                data: { paymentStatus: PaymentStatus.FAILED }
            });
        }

        req.flash(
            "error_msg",
            error instanceof MoMoPaymentRejectedError
                ? "MoMo từ chối yêu cầu thanh toán. Vui lòng thử lại."
                : "Chưa thể xác nhận trạng thái yêu cầu với MoMo. Vui lòng không thanh toán lại và liên hệ hỗ trợ."
        );
        return res.redirect(`/booking/success?id=${Number.isSafeInteger(bookingId) ? bookingId : ""}`);
    }
};

export const getMoMoMockPage = async (req: Request, res: Response) => {
    try {
        if (!mockModeEnabled()) return res.sendStatus(404);

        const paymentRef = typeof req.query.ref === "string" ? req.query.ref : "";
        const payment = await prisma.payment.findFirst({
            where: {
                paymentRef: { equals: paymentRef, startsWith: "MOCK-" },
                userId: req.user?.id,
                paymentStatus: PaymentStatus.PENDING
            },
            include: { booking: true }
        });

        if (!payment) {
            req.flash("error_msg", "Không tìm thấy giao dịch mô phỏng đang chờ.");
            return res.redirect("/booking");
        }

        return res.render("client/booking/momo-mock.ejs", {
            payment,
            user: req.user
        });
    } catch (error) {
        console.error("Could not open MoMo mock page:", error);
        req.flash("error_msg", "Không thể mở trang mô phỏng thanh toán.");
        return res.redirect("/booking");
    }
};

export const postMoMoMockResult = async (req: Request, res: Response) => {
    try {
        if (!mockModeEnabled()) return res.sendStatus(404);

        const paymentRef = typeof req.body.paymentRef === "string" ? req.body.paymentRef : "";
        const result = req.body.result;
        if (!paymentRef.startsWith("MOCK-") || (result !== "success" && result !== "failed")) {
            return res.status(400).send("Thông tin giao dịch mô phỏng không hợp lệ.");
        }

        const payment = await prisma.payment.findFirst({
            where: {
                paymentRef,
                userId: req.user?.id,
                paymentStatus: PaymentStatus.PENDING
            },
            include: {
                booking: {
                    include: { roomBookings: true }
                }
            }
        });

        if (!payment) {
            req.flash("error_msg", "Giao dịch không tồn tại hoặc không còn chờ xử lý.");
            return res.redirect("/booking");
        }

        const successful = result === "success";
        await updatePaymentResult(payment, successful);
        req.flash(
            successful ? "success_msg" : "error_msg",
            successful ? "Giả lập thanh toán thành công." : "Đã giả lập giao dịch thất bại."
        );
        return res.redirect(`/booking/success?id=${payment.bookingId}`);
    } catch (error) {
        console.error("Could not complete MoMo mock payment:", error);
        req.flash("error_msg", "Không thể hoàn tất giao dịch mô phỏng.");
        return res.redirect("/booking");
    }
};

export const handleMoMoCallback = async (req: Request, res: Response) => {
    if (process.env.MOMO_MODE === "mock") {
        req.flash("error_msg", "Callback MoMo thật bị tắt khi đang ở chế độ giả lập.");
        return res.redirect("/booking");
    }

    const notification = parseNotification(req.query as Record<string, unknown>);
    if (!notification) {
        req.flash("error_msg", "Phản hồi thanh toán MoMo không hợp lệ.");
        return res.redirect("/booking");
    }

    try {
        const result = await applyMoMoResult(notification);
        req.flash(
            result.successful ? "success_msg" : "error_msg",
            result.successful
                ? "Thanh toán MoMo thành công!"
                : `Thanh toán MoMo thất bại: ${notification.message}`
        );
        return res.redirect(`/booking/success?id=${result.bookingId}`);
    } catch (error) {
        console.error("MoMo browser callback could not be processed:", error);
        req.flash("error_msg", "Không thể xác minh kết quả thanh toán. Vui lòng tải lại sau.");
        return res.redirect("/booking");
    }
};

export const handleMoMoIpn = async (req: Request, res: Response) => {
    if (process.env.MOMO_MODE === "mock") {
        return res.sendStatus(404);
    }

    const notification = parseNotification(req.body as Record<string, unknown>);
    if (!notification) {
        return res.status(400).json({ resultCode: 1, message: "Invalid notification payload." });
    }

    try {
        await applyMoMoResult(notification);
        return res.status(200).json({ resultCode: 0, message: "Success." });
    } catch (error) {
        console.error("MoMo IPN could not be processed:", error);
        return res.status(400).json({ resultCode: 1, message: "Notification was not accepted." });
    }
};
