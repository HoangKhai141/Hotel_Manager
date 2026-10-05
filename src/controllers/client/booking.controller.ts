import { Request, Response } from "express";
import {
    getRoomTypes,
    getAvailableRoomsByType,
    createClientBooking,
    calculateNights // Import hàm tính số đêm
} from "services/client/booking.service";
import { prisma } from "config/client"; // Đảm bảo đường dẫn import prisma đúng

// --- Interface Helper cho Session ---
interface SessionData {
    messages?: string[];
    [key: string]: any; // Cho phép các thuộc tính khác nếu có
}

// --- Controller để hiển thị trang đặt phòng ---
const getBookingPage = async (req: Request, res: Response) => {
    const session = (req.session as SessionData) || {}; // Lấy session an toàn
    let messages = session.messages ?? []; // Lấy messages hoặc mảng rỗng
    let errorFromSession = session.error ?? undefined; // Lấy lỗi từ session nếu có (ví dụ: redirect từ submit lỗi)
    let oldDataFromSession = session.oldData ?? {}; // Lấy dữ liệu cũ từ session

    // Xóa messages, error, oldData khỏi session sau khi lấy
    delete session.messages;
    delete session.error;
    delete session.oldData;
    // Lưu session nếu cần (tùy session store)
    // await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    try {
        const roomTypes = await getRoomTypes();

        return res.render("client/booking/show.ejs", {
            roomTypes,
            messages: messages, // Truyền messages đã lấy từ session
            error: errorFromSession, // Truyền lỗi đã lấy từ session
            oldData: oldDataFromSession, // Truyền dữ liệu cũ
            user: req.user // Truyền user cho header/footer
        });
    } catch (error: any) {
        console.error("Error getting booking page:", error);
        // Render trang với thông báo lỗi chung
        return res.render("client/booking/show.ejs", {
            roomTypes: [],
            messages: [],
            error: `Lỗi tải trang đặt phòng: ${error.message}`,
            oldData: {}, // Không có dữ liệu cũ khi lỗi tải trang ban đầu
            user: req.user
        });
    }
};

// --- Controller API để lấy phòng trống (cho JavaScript phía client) ---
const postAvailableRooms = async (req: Request, res: Response) => {
    const { roomType, checkInDate, checkOutDate } = req.body;

    try {
        // Validate input
        if (!roomType || !checkInDate || !checkOutDate) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng cung cấp đủ loại phòng, ngày nhận và ngày trả."
            });
        }

        // Validate dates format
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);

        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Định dạng ngày không hợp lệ."
            });
        }

        // Gọi service để lấy phòng trống
        const rooms = await getAvailableRoomsByType(roomType, checkIn, checkOut);

        return res.json({
            success: true,
            rooms,
            message: rooms.length === 0 ? "Không còn phòng trống loại này trong khoảng ngày đã chọn." : "OK"
        });
    } catch (error: any) {
        console.error("Error fetching available rooms:", error);
        return res.status(500).json({
            success: false,
            // Trả về lỗi từ service (ví dụ: lỗi validate ngày) hoặc lỗi chung
            message: error.message || "Lỗi hệ thống khi tìm phòng trống."
        });
    }
};

// --- Controller xử lý khi người dùng submit form đặt phòng ---
const postBookingSubmit = async (req: Request, res: Response) => {
    const {
        guestName, guestPhone, guestEmail, guestCount,
        roomType, roomId, checkInDate, checkOutDate, specialRequest
    } = req.body;

    const session = (req.session as SessionData) || {}; // Lấy session

    try {
        // Validation cơ bản (Controller nên validate input trước khi gọi service)
        if (!guestName || !guestPhone || !roomId || !checkInDate || !checkOutDate || !roomType || !guestCount) {
             throw new Error("Vui lòng điền đầy đủ thông tin bắt buộc (*).");
        }

        // Lấy User ID (quan trọng)
        const user = req.user as any; // Ép kiểu nếu bạn chắc chắn req.user có tồn tại và có id
        if (!user || !user.id) {
             throw new Error("Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
        }
        const userId = user.id;

        // Parse và Validate dữ liệu
        const parsedRoomId = parseInt(roomId);
        const parsedGuestCount = parseInt(guestCount);
        const checkInDate_parsed = new Date(checkInDate);
        const checkOutDate_parsed = new Date(checkOutDate);

        if (isNaN(parsedRoomId) || parsedRoomId <= 0) throw new Error("Phòng không hợp lệ.");
        if (isNaN(parsedGuestCount) || parsedGuestCount < 1) throw new Error("Số lượng khách phải lớn hơn 0.");
        if (isNaN(checkInDate_parsed.getTime()) || isNaN(checkOutDate_parsed.getTime())) throw new Error("Ngày nhận/trả phòng không hợp lệ.");
        // Service sẽ validate thêm về logic ngày (quá khứ, checkout > checkin)

        // Gọi service để tạo booking
        const booking = await createClientBooking({
            guestName: guestName.trim(),
            guestPhone: guestPhone.trim(),
            guestEmail: guestEmail?.trim() || null,
            guestCount: parsedGuestCount,
            roomType,
            roomId: parsedRoomId,
            checkInDate: checkInDate_parsed,
            checkOutDate: checkOutDate_parsed,
            specialRequest: specialRequest?.trim() || null,
            userId
        });

        // Đặt phòng thành công -> Lưu message vào session và redirect
        session.messages = [
             `✅ Đặt phòng thành công! Mã đặt phòng #${booking.id}. Vui lòng chờ xác nhận từ khách sạn.`
        ];
        // await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve())); // Dùng save nếu cần

        return res.redirect(`/booking/success?id=${booking.id}`);

    } catch (error: any) {
        console.error("Booking submission error:", error);
        // Có lỗi xảy ra -> Lưu lỗi và dữ liệu cũ vào session, redirect về trang booking
        session.error = `Lỗi đặt phòng: ${error.message}`;
        session.oldData = req.body; // Lưu lại dữ liệu người dùng đã nhập
        // await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve())); // Dùng save nếu cần

        // Redirect về trang booking, hàm getBookingPage sẽ đọc lỗi và oldData từ session
        return res.redirect('/booking');
    }
};

// --- Controller hiển thị trang đặt phòng thành công ---
const getBookingSuccess = async (req: Request, res: Response) => {
    const { id } = req.query;

    try {
        if (!id || isNaN(parseInt(id as string))) {
            console.warn("Invalid or missing booking ID for success page.");
            return res.redirect("/booking"); // ID không hợp lệ, quay về trang đặt phòng
        }

        const bookingIdNum = parseInt(id as string);

        // Lấy thông tin booking vừa tạo kèm theo phòng
        const booking = await prisma.booking.findUnique({
            where: { id: bookingIdNum },
            include: {
                roomBookings: { // Bao gồm cả roomBookings
                    include: {
                        room: true,
                        // Và thông tin phòng trong đó
                    }
                },
                payment : true
                // user: true // Include user nếu cần hiển thị tên user
            }
        });

        if (!booking) {
            console.warn(`Booking not found for ID: ${bookingIdNum}`);
            // Không tìm thấy booking -> hiển thị trang 404
            return res.status(404).render("status/404", { // Giả sử có file views/status/404.ejs
                message: `Không tìm thấy thông tin đặt phòng với mã #${bookingIdNum}.`,
                user: req.user
            });
        }

        if (booking.userId !== req.user?.id) {
            return res.status(404).render("status/404", {
                message: "Không tìm thấy thông tin đặt phòng.",
                user: req.user
            });
        }

        // Tính số đêm để truyền cho view
        let nights = 0;
        try {
            nights = calculateNights(booking.checkInDate, booking.checkOutDate);
        } catch (e) {
            console.error(`Error calculating nights for booking ${bookingIdNum}:`, e);
            // Có thể gán giá trị mặc định hoặc không truyền nights nếu lỗi
        }

        // Render trang success
        return res.render("client/booking/success.ejs", {
            booking,
            nights, // Truyền số đêm đã tính
            user: req.user // Truyền user
        });
    } catch (error: any) {
        console.error(`Error fetching booking success page for ID ${id}:`, error);
        // Lỗi server -> hiển thị trang lỗi chung
        return res.status(500).render("status/error", { // Giả sử có file views/status/error.ejs
            message: "Lỗi hệ thống khi hiển thị thông tin đặt phòng.",
            user: req.user
        });
    }
};

export {
    getBookingPage,
    postAvailableRooms,
    postBookingSubmit,
    getBookingSuccess
};