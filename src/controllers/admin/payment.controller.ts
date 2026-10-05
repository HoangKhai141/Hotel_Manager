// ==================== src/controllers/admin/payment.controller.ts (Đã Sửa) ====================
import { Request, Response } from "express";
import {
    getAllPayments,
    getPaymentById,
    createPayment,
    confirmPayment,
    cancelPayment,
    refundPayment,
    deletePayment
} from "../../services/admin/payment.service"; // Đảm bảo đường dẫn service đúng
import { PaymentStatus, PaymentMethod } from "@prisma/client";

// --- Controller hiển thị trang danh sách Payment (GET /admin/payment) ---
const getAdminPaymentPage = async (req: Request, res: Response) => {
    try {
        const statusQuery = req.query.status as string | undefined;
        let filterStatus: PaymentStatus | 'all' = 'all';

        if (statusQuery && Object.values(PaymentStatus).includes(statusQuery as PaymentStatus)) {
            filterStatus = statusQuery as PaymentStatus;
        }

        const payments = await getAllPayments(filterStatus !== 'all' ? filterStatus : undefined);

        return res.render("admin/payment/show", {
            payments,
            filterStatus,
            user: req.user
        });
    } catch (error: any) {
        console.error("[Payment Controller] ❌ Error getting payment page:", error.message);
        return res.render("admin/payment/show", {
            payments: [],
            filterStatus: 'all',
            error_msg: [`Lỗi tải danh sách: ${error.message}`],
            user: req.user
        });
    }
};

// --- Controller hiển thị chi tiết Payment (GET /admin/view-payment/:id) ---
const getViewPaymentPage = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const paymentIdNum = parseInt(id);
        if (isNaN(paymentIdNum)) throw new Error("ID payment không hợp lệ.");

        const payment = await getPaymentById(paymentIdNum);
        if (!payment) {
            req.flash('error_msg', `Không tìm thấy payment với ID #${id}.`);
            return res.redirect("/admin/payment");
        }
        
        const paymentMethods = Object.values(PaymentMethod);

        return res.render("admin/payment/detail", {
            payment,
            paymentMethods,
            user: req.user
        });
    } catch (error: any) {
        console.error("[Payment Controller] ❌ Error viewing payment:", error.message);
        req.flash('error_msg', `Lỗi tải chi tiết payment #${id}: ${error.message}`);
        return res.redirect("/admin/payment");
    }
};

// --- Controller tạo Payment (POST /admin/handle-create-payment) ---
// ✅ SỬA LỖI LỒNG FORM TẠI ĐÂY
const postCreatePayment = async (req: Request, res: Response) => {
    // Đọc 'id' (từ hidden input của form chính) và 'paymentMethod'
    const { id, paymentMethod } = req.body; 
    const adminUserId = (req.user as any)?.id; // Lấy ID admin đang đăng nhập

    // Gán 'id' vào bookingId để dễ đọc
    const bookingId = id; 

    try {
        // Kiểm tra 'bookingId' (lấy từ 'id')
        if (!bookingId || !paymentMethod) {
            throw new Error("Thiếu thông tin booking (ID) hoặc phương thức thanh toán.");
        }

        const bookingIdNum = parseInt(bookingId);
        if (isNaN(bookingIdNum)) throw new Error("Booking ID không hợp lệ.");

        const payment = await createPayment({
            bookingId: bookingIdNum, // Truyền bookingId đã parse
            paymentMethod: paymentMethod as PaymentMethod,
            userId: adminUserId 
        });

        req.flash('success_msg', `✅ Tạo payment #${payment.id} cho Booking #${bookingIdNum} thành công!`);
        return res.redirect(`/admin/booking/detail/${bookingIdNum}`); // Quay lại trang chi tiết booking

    } catch (error: any) {
        console.error("❌ Error creating payment:", error.message);
        req.flash('error_msg', `❌ Lỗi tạo payment: ${error.message}`);
        // Quay lại trang chi tiết booking nơi nút bấm được nhấn
        return res.redirect(`/admin/booking/detail/${bookingId}`); 
    }
};
// === KẾT THÚC SỬA ===

// --- Controller xác nhận Payment (POST /admin/confirm-payment/:id) ---
const postConfirmPayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { paymentMethod, paymentRef } = req.body;

    try {
        const paymentIdNum = parseInt(id);
        if (isNaN(paymentIdNum)) throw new Error("ID payment không hợp lệ.");

        await confirmPayment(paymentIdNum, {
            paymentMethod: paymentMethod as PaymentMethod,
            paymentRef: paymentRef?.trim() || undefined,
            paidAt: new Date()
        });

        req.flash('success_msg', `✅ Xác nhận thanh toán #${id} thành công!`);
        return res.redirect(`/admin/view-payment/${id}`);
    } catch (error: any) {
        console.error("❌ Error confirming payment:", error.message);
        req.flash('error_msg', `❌ Lỗi xác nhận: ${error.message}`);
        return res.redirect(`/admin/view-payment/${id}`);
    }
};

// --- Controller hủy Payment (POST /admin/cancel-payment/:id) ---
const postCancelPayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const paymentIdNum = parseInt(id);
        if (isNaN(paymentIdNum)) throw new Error("ID payment không hợp lệ.");

        await cancelPayment(paymentIdNum, reason || "Cancelled by Admin");

        req.flash('success_msg', `✅ Hủy thanh toán #${id} thành công (chuyển sang FAILED)!`);
        return res.redirect(`/admin/view-payment/${id}`);
    } catch (error: any) {
        console.error("❌ Error cancelling payment:", error.message);
        req.flash('error_msg', `❌ Lỗi hủy thanh toán: ${error.message}`);
        return res.redirect(`/admin/view-payment/${id}`);
    }
};

// --- Controller hoàn tiền (POST /admin/refund-payment/:id) ---
const postRefundPayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { refundReason, refundAmount } = req.body;

    try {
        const paymentIdNum = parseInt(id);
        if (isNaN(paymentIdNum)) throw new Error("ID payment không hợp lệ.");
        if (!refundReason?.trim()) {
            throw new Error("Vui lòng nhập lý do hoàn tiền.");
        }

        await refundPayment(paymentIdNum, {
            refundReason: refundReason.trim(),
            refundAmount: refundAmount ? parseInt(refundAmount) : undefined
        });

        req.flash('success_msg', `✅ Hoàn tiền #${id} thành công!`);
        return res.redirect(`/admin/view-payment/${id}`);
    } catch (error: any) {
        console.error("❌ Error refunding payment:", error.message);
        req.flash('error_msg', `❌ Lỗi hoàn tiền: ${error.message}`);
        return res.redirect(`/admin/view-payment/${id}`);
    }
};

// --- Controller xóa Payment (POST /admin/payment/delete/:id) ---
const postDeletePayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const paymentIdNum = parseInt(id);
        if (isNaN(paymentIdNum)) throw new Error("ID payment không hợp lệ.");
        
        await deletePayment(paymentIdNum);
                
        req.flash('success_msg', `✅ Xóa payment #${id} thành công!`);
        return res.redirect("/admin/payment");
    } catch (error: any) {
        console.error("❌ Error deleting payment:", error.message);
        req.flash('error_msg', `❌ Lỗi xóa payment #${id}: ${error.message}`);
        return res.redirect("/admin/payment");
    }
};

// ==================== EXPORTS ====================
export {
    getAdminPaymentPage,
    getViewPaymentPage,
    postCreatePayment,
    postConfirmPayment,
    postCancelPayment,
    postRefundPayment,
    postDeletePayment
};