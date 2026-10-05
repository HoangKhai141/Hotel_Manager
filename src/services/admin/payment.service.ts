// ==================== src/services/admin/payment.service.ts ====================
import { prisma } from "../../config/client";
import { PaymentStatus, PaymentMethod, BookingStatus, RoomStatus, Prisma } from "@prisma/client";

// ==================== INTERFACES ====================
interface CreatePaymentData {
    bookingId: number;
    paymentMethod: PaymentMethod;
    userId?: number;
}

interface ConfirmPaymentData {
    paymentMethod?: PaymentMethod;
    paymentRef?: string;
    paidAt?: Date;
}

interface RefundPaymentData {
    refundReason: string;
    refundAmount?: number;
}

// ==================== CRUD OPERATIONS ====================

/**
 * Lấy danh sách tất cả payments (có filter theo status)
 */
const getAllPayments = async (statusFilter?: PaymentStatus) => {
    try {
        let where: Prisma.PaymentWhereInput = {};
        if (statusFilter) {
            where = { paymentStatus: statusFilter };
        }

        const payments = await prisma.payment.findMany({
            where,
            include: {
                booking: {
                    include: {
                        user: { select: { id: true, fullName: true, username: true, phone: true } },
                        roomBookings: { 
                            include: { 
                                room: { select: { id: true, name: true, type: true, price: true } } 
                            } 
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`[Payment Service] Loaded ${payments.length} payments${statusFilter ? ` with status ${statusFilter}` : ''}`);
        return payments;
    } catch (error) {
        console.error("[Payment Service] Error fetching payments:", error);
        throw new Error("Không thể tải danh sách thanh toán.");
    }
};

/**
 * Lấy payment theo ID
 */
const getPaymentById = async (id: number) => {
    try {
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                booking: {
                    include: {
                        user: { select: { id: true, fullName: true, username: true, phone: true } },
                        roomBookings: { 
                            include: { 
                                room: true 
                            } 
                        }
                    }
                }
            }
        });
        return payment;
    } catch (error) {
        console.error(`[Payment Service] Error fetching payment ${id}:`, error);
        throw new Error("Không thể tải chi tiết thanh toán.");
    }
};

/**
 * Tạo payment cho booking
 */
const createPayment = async (data: CreatePaymentData) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Payment Service] 🔄 Starting payment creation for booking #${data.bookingId}`);
        console.log(`[Payment Service] Payment data:`, {
            bookingId: data.bookingId,
            paymentMethod: data.paymentMethod,
            userId: data.userId
        });

        // Check booking exists
        const booking = await tx.booking.findUnique({
            where: { id: data.bookingId },
            include: { payment: true }
        });

        console.log(`[Payment Service] Found booking:`, booking ? `#${booking.id} (${booking.status})` : 'NOT FOUND');

        if (!booking) {
            throw new Error("Booking không tồn tại.");
        }

        if (booking.payment) {
            console.log(`[Payment Service] ⚠️ Booking already has payment #${booking.payment.id}`);
            throw new Error("Booking này đã có payment.");
        }

        if (booking.status === BookingStatus.CANCELLED) {
            throw new Error("Không thể tạo payment cho booking đã hủy.");
        }

        console.log(`[Payment Service] Creating payment with totalAmount: ${booking.totalPrice}`);

        // Create payment
        const newPayment = await tx.payment.create({
            data: {
                bookingId: data.bookingId,
                totalAmount: booking.totalPrice,
                paymentMethod: data.paymentMethod,
                paymentStatus: PaymentStatus.PENDING,
                userId: data.userId
            }
        });

        console.log(`[Payment Service] ✅ Successfully created payment #${newPayment.id}`);
        console.log(`[Payment Service] Payment details:`, {
            id: newPayment.id,
            bookingId: newPayment.bookingId,
            totalAmount: newPayment.totalAmount,
            paymentMethod: newPayment.paymentMethod,
            paymentStatus: newPayment.paymentStatus
        });

        return newPayment;
    });
};

/**
 * Xác nhận thanh toán (PENDING → SUCCESS)
 */
const confirmPayment = async (id: number, data: ConfirmPaymentData) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Payment Service] Confirming payment #${id}`);

        const payment = await tx.payment.findUnique({
            where: { id },
            include: { 
                booking: { 
                    include: { 
                        roomBookings: { select: { roomId: true } } 
                    } 
                } 
            }
        });

        if (!payment) {
            throw new Error("Payment không tồn tại.");
        }

        if (payment.paymentStatus !== PaymentStatus.PENDING) {
            throw new Error(`Không thể xác nhận payment ở trạng thái ${payment.paymentStatus}.`);
        }

        if (payment.booking.status === BookingStatus.CANCELLED) {
            throw new Error("Không thể xác nhận payment cho booking đã hủy.");
        }

        const updatedPayment = await tx.payment.update({
            where: { id },
            data: {
                paymentStatus: PaymentStatus.SUCCESS,
                paymentMethod: data.paymentMethod || payment.paymentMethod,
                paymentRef: data.paymentRef,
                paidAt: data.paidAt || new Date()
            }
        });

        if (payment.booking.status === BookingStatus.PENDING) {
            await tx.booking.update({
                where: { id: payment.bookingId },
                data: { status: BookingStatus.CONFIRMED }
            });
            console.log(`[Payment Service] Auto updated booking #${payment.bookingId} to CONFIRMED`);
        }

        console.log(`[Payment Service] ✅ Confirmed payment #${id}`);
        return updatedPayment;
    });
};

/**
 * Hủy thanh toán (→ FAILED)
 */
const cancelPayment = async (id: number, reason?: string) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Payment Service] Cancelling payment #${id}`);

        const payment = await tx.payment.findUnique({
            where: { id },
            include: { 
                booking: { 
                    include: { 
                        roomBookings: { select: { roomId: true } } 
                    } 
                } 
            }
        });

        if (!payment) {
            throw new Error("Payment không tồn tại.");
        }

        if (payment.paymentStatus !== PaymentStatus.PENDING) {
            throw new Error(`Không thể hủy payment ở trạng thái ${payment.paymentStatus}.`);
        }

        if (payment.booking.status === BookingStatus.CHECKED_IN || 
            payment.booking.status === BookingStatus.CHECKED_OUT) {
            throw new Error("Không thể hủy payment sau khi đã check-in.");
        }

        const updatedPayment = await tx.payment.update({
            where: { id },
            data: {
                paymentStatus: PaymentStatus.FAILED,
                paymentRef: reason ? `CANCELLED: ${reason}` : 'CANCELLED'
            }
        });

        await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: BookingStatus.CANCELLED }
        });

        const roomId = payment.booking.roomBookings[0]?.roomId;
        if (roomId) {
            const otherBookings = await tx.booking.findFirst({
                where: {
                    roomId: roomId,
                    id: { not: payment.bookingId },
                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }
                }
            });

            if (!otherBookings) {
                await tx.room.update({
                    where: { id: roomId },
                    data: { status: RoomStatus.AVAILABLE }
                });
                console.log(`[Payment Service] Auto freed room ${roomId}`);
            }
        }

        console.log(`[Payment Service] ✅ Cancelled payment #${id} and booking #${payment.bookingId}`);
        return updatedPayment;
    });
};

/**
 * Hoàn tiền (SUCCESS → REFUNDED)
 */
const refundPayment = async (id: number, data: RefundPaymentData) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Payment Service] Refunding payment #${id}`);

        const payment = await tx.payment.findUnique({
            where: { id },
            include: { 
                booking: { 
                    include: { 
                        roomBookings: { select: { roomId: true } } 
                    } 
                } 
            }
        });

        if (!payment) {
            throw new Error("Payment không tồn tại.");
        }

        if (payment.paymentStatus !== PaymentStatus.SUCCESS) {
            throw new Error(`Chỉ hoàn tiền được khi payment đã SUCCESS.`);
        }

        const refundAmount = data.refundAmount || payment.totalAmount;
        if (refundAmount > payment.totalAmount) {
            throw new Error("Số tiền hoàn không thể lớn hơn tổng tiền.");
        }

        const updatedPayment = await tx.payment.update({
            where: { id },
            data: {
                paymentStatus: PaymentStatus.REFUNDED,
                paymentRef: `REFUNDED: ${data.refundReason} (${refundAmount.toLocaleString('vi-VN')}đ)`
            }
        });

        if (payment.booking.status !== BookingStatus.CANCELLED) {
            await tx.booking.update({
                where: { id: payment.bookingId },
                data: { status: BookingStatus.CANCELLED }
            });
            console.log(`[Payment Service] Auto cancelled booking #${payment.bookingId}`);
        }

        const roomId = payment.booking.roomBookings[0]?.roomId;
        if (roomId) {
            const otherBookings = await tx.booking.findFirst({
                where: {
                    roomId: roomId,
                    id: { not: payment.bookingId },
                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }
                }
            });

            if (!otherBookings) {
                await tx.room.update({
                    where: { id: roomId },
                    data: { status: RoomStatus.AVAILABLE }
                });
                console.log(`[Payment Service] Auto freed room ${roomId}`);
            }
        }

        console.log(`[Payment Service] ✅ Refunded payment #${id}`);
        return updatedPayment;
    });
};

/**
 * Xóa payment (chỉ khi PENDING hoặc FAILED)
 */
const deletePayment = async (id: number) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Payment Service] Deleting payment #${id}`);

        const payment = await tx.payment.findUnique({
            where: { id },
            select: { paymentStatus: true, bookingId: true }
        });

        if (!payment) {
            throw new Error("Payment không tồn tại.");
        }

        if (payment.paymentStatus === PaymentStatus.SUCCESS || 
            payment.paymentStatus === PaymentStatus.REFUNDED) {
            throw new Error(`Không thể xóa payment ở trạng thái ${payment.paymentStatus}.`);
        }

        await tx.payment.delete({ where: { id } });

        console.log(`[Payment Service] ✅ Deleted payment #${id}`);
        return true;
    });
};

// ==================== EXPORTS ====================
export {
    getAllPayments,
    getPaymentById,
    createPayment,
    confirmPayment,
    cancelPayment,
    refundPayment,
    deletePayment
};