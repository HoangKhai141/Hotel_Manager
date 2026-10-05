// ==================== src/controllers/admin/booking.controller.ts (Đã Sửa Dùng Flash) ====================
import { Request, Response } from "express";
import {
    getAllBookings,
    getBookingById,
    createBooking,
    updateBooking,
    deleteBooking,
    getAvailableRooms
} from "../../services/admin/booking.service"; // Đảm bảo đường dẫn service đúng
import { BookingStatus } from "@prisma/client";
import { prisma } from "../../config/client";

// Không cần SessionData hay clearSessionData nữa
// interface SessionData { ... }
// const clearSessionData = (session: SessionData) => { ... };

// ==================== CONTROLLER FUNCTIONS ====================

/**
 * GET /admin/booking
 * Hiển thị trang danh sách booking. Flash messages (success_msg, error_msg) được tự động nạp từ middleware
 */
const getAdminBookingPage = async (req: Request, res: Response) => {
    // Flash messages đã được nạp vào res.locals bởi middleware (index.ts)
    
    try {
        const statusQuery = req.query.status as string | undefined;
        let filterStatus: BookingStatus | 'all' = 'all';

        if (statusQuery && Object.values(BookingStatus).includes(statusQuery as BookingStatus)) {
            filterStatus = statusQuery as BookingStatus;
        }

        const bookings = await getAllBookings(filterStatus !== 'all' ? filterStatus : undefined);

        return res.render("admin/booking/show", {
            bookings,
            filterStatus,
            // messages: [], // Không cần truyền, đã dùng res.locals
            // error: undefined, // Không cần truyền, đã dùng res.locals
            user: req.user
        });
    } catch (error: any) {
        console.error("[Controller] ❌ Error getting admin booking page:", error.message);
        // Render trang với lỗi
        return res.render("admin/booking/show", {
            bookings: [],
            filterStatus: 'all',
            error_msg: [`Lỗi tải danh sách: ${error.message}`], // Gán lỗi trực tiếp cho view
            user: req.user
        });
    }
};

/**
 * GET /admin/booking/create
 * Hiển thị form tạo booking mới, đọc lỗi và oldData từ flash (nếu có redirect)
 */
const getCreateBookingPage = async (req: Request, res: Response) => {
    // Lấy lỗi và dữ liệu cũ từ flash (nếu có)
    const error = req.flash('error_msg')?.[0]; // Lấy lỗi (chỉ lấy 1)
    const oldData = req.flash('oldData')?.[0] || {}; // Lấy dữ liệu cũ (chỉ lấy 1)

    try {
        const [rooms, users] = await Promise.all([
            getAvailableRooms(),
            prisma.user.findMany({
                where: { role: { name: 'USER' } },
                select: { 
                    id: true, 
                    fullName: true, 
                    username: true,
                    phone: true
                }
            })
        ]);

        return res.render("admin/booking/create", {
            rooms,
            users,
            error: error, // Truyền lỗi từ flash
            oldData: oldData, // Truyền dữ liệu cũ từ flash
            user: req.user
        });
    } catch (error: any) {
        console.error("[Controller] ❌ Error getting create booking page:", error.message);
        req.flash('error_msg', `Lỗi tải trang tạo booking: ${error.message}`);
        return res.redirect("/admin/booking");
    }
};

/**
 * POST /admin/booking/handle-create (hoặc /admin/booking/create)
 * Xử lý tạo booking mới
 */
const postCreateBooking = async (req: Request, res: Response) => {
    const {
        guestName, guestPhone, guestEmail, guestCount,
        roomId, checkInDate, checkOutDate, specialRequest, userId
    } = req.body;

    try {
        // Validation
        if (!guestName?.trim() || !guestPhone?.trim() || !roomId || !checkInDate || !checkOutDate || !userId) {
            throw new Error("Vui lòng điền đầy đủ thông tin bắt buộc (*).");
        }

        const parsedUserId = parseInt(userId);
        const parsedRoomId = parseInt(roomId);
        if (isNaN(parsedUserId)) throw new Error("Người dùng không hợp lệ.");
        if (isNaN(parsedRoomId)) throw new Error("Phòng không hợp lệ.");

        // Create booking
        const booking = await createBooking({
            guestName: guestName.trim(),
            guestPhone: guestPhone.trim(),
            guestEmail: guestEmail?.trim() || null,
            guestCount: parseInt(guestCount) || 1,
            roomId: parsedRoomId,
            checkInDate: new Date(checkInDate),
            checkOutDate: new Date(checkOutDate),
            specialRequest: specialRequest?.trim() || null,
            userId: parsedUserId
        });

        // Gửi flash message THÀNH CÔNG
        req.flash('success_msg', `✅ Tạo booking #${booking.id} thành công!`);
        return res.redirect("/admin/booking");

    } catch (error: any) {
        console.error("❌ Error creating booking:", error.message);
        // Gửi flash message LỖI và DỮ LIỆU CŨ
        req.flash('error_msg', `❌ Lỗi tạo booking: ${error.message}`);
        req.flash('oldData', req.body); // Lưu lại dữ liệu đã nhập
        return res.redirect("/admin/booking/create"); // Redirect về trang create
    }
};

/**
 * GET /admin/booking/detail/:id
 * Hiển thị form chi tiết và sửa booking
 */
const getViewBookingPage = async (req: Request, res: Response) => {
    const { id } = req.params;
    // Lấy lỗi từ flash (nếu có redirect từ POST update)
    const error = req.flash('error_msg')?.[0];

    try {
        const bookingIdNum = parseInt(id);
        if (isNaN(bookingIdNum)) throw new Error("ID booking không hợp lệ.");

        const [booking, rooms, bookingStatuses] = await Promise.all([
            getBookingById(bookingIdNum),
            getAvailableRooms(),
            Promise.resolve(Object.values(BookingStatus))
        ]);

        if (!booking) {
            req.flash('error_msg', `Không tìm thấy booking với ID #${id}.`);
            return res.redirect("/admin/booking");
        }

        return res.render("admin/booking/detail", {
            booking,
            rooms,
            bookingStatuses,
            error: error, // Truyền lỗi từ flash (nếu có)
            user: req.user
        });
    } catch (error: any) {
        console.error("[Controller] ❌ Error viewing booking:", error.message);
        req.flash('error_msg', `Lỗi tải chi tiết booking #${id}: ${error.message}`);
        return res.redirect("/admin/booking");
    }
};

/**
 * POST /admin/booking/update
 * Xử lý cập nhật booking
 */
const postUpdateBooking = async (req: Request, res: Response) => {
    const {
        id, guestName, guestPhone, guestEmail, guestCount,
        roomId, checkInDate, checkOutDate, specialRequest, status
    } = req.body;

    try {
        if (!id) throw new Error("Thiếu ID booking.");
        const bookingIdNum = parseInt(id);
        if (isNaN(bookingIdNum)) throw new Error("ID booking không hợp lệ.");

        const updateData: any = {};
        if (guestName !== undefined) updateData.guestName = guestName?.trim();
        if (guestPhone !== undefined) updateData.guestPhone = guestPhone?.trim();
        if (guestEmail !== undefined) updateData.guestEmail = guestEmail?.trim() || null;
        if (guestCount) updateData.guestCount = parseInt(guestCount);
        if (roomId) updateData.roomId = parseInt(roomId);
        if (checkInDate) updateData.checkInDate = new Date(checkInDate);
        if (checkOutDate) updateData.checkOutDate = new Date(checkOutDate);
        if (specialRequest !== undefined) updateData.specialRequest = specialRequest?.trim() || null;
        if (status) updateData.status = status as BookingStatus;

        await updateBooking(bookingIdNum, updateData);

        // Gửi flash message THÀNH CÔNG
        req.flash('success_msg', `✅ Cập nhật booking #${id} thành công!`);
        return res.redirect("/admin/booking");

    } catch (error: any) {
        console.error("❌ Error updating booking:", error.message);
        // Gửi flash message LỖI
        req.flash('error_msg', `❌ Lỗi cập nhật: ${error.message}`);
        return res.redirect(`/admin/booking/detail/${id}`); // Redirect về trang detail
    }
};

/**
 * POST /admin/booking/delete/:id
 * Xử lý xóa booking
 */
const postDeleteBooking = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const bookingIdNum = parseInt(id);
        if (isNaN(bookingIdNum)) throw new Error("ID booking không hợp lệ.");

        await deleteBooking(bookingIdNum);
        
        // Gửi flash message THÀNH CÔNG
        req.flash('success_msg', `✅ Xóa booking #${id} thành công!`);
        return res.redirect("/admin/booking");

    } catch (error: any) {
        console.error("❌ Error deleting booking:", error.message);
        // Gửi flash message LỖI
        req.flash('error_msg', `❌ Lỗi xóa booking #${id}: ${error.message}`);
        return res.redirect("/admin/booking");
    }
};

// ==================== EXPORTS ====================
export {
    getAdminBookingPage,
    getCreateBookingPage,
    postCreateBooking,
    getViewBookingPage,
    postUpdateBooking,
    postDeleteBooking
};