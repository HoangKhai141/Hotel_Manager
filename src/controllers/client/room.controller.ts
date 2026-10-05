// ==================== src/controllers/client/room.controller.ts ====================
import { Request, Response } from "express";

import { getRoomById, getRoomsList } from "services/client/room.service"; // Import service vừa tạo
import roomImageUrl from "../../utils/room-image";

const getRoomsPage = async (req: Request, res: Response) => {
    try {
        // Lấy các tham số từ URL (ví dụ: ?page=1&type=Single)
        const query = req.query;

        // Gọi service để lấy dữ liệu
        const data = await getRoomsList(query);

        // Render view
        return res.render("client/room/show.ejs", {
            user: req.user, // Truyền user cho header
            rooms: data.rooms,
            pagination: data.pagination,
            searchParams: query // Truyền lại tham số tìm kiếm để giữ trạng thái form
        });
    } catch (error) {
        console.error("Error getting rooms page:", error);
        // Render trang lỗi hoặc trang trống
        return res.render("client/room/show.ejs", {
            user: req.user,
            rooms: [],
            pagination: { currentPage: 1, totalPages: 0, totalItems: 0, limit: 8 },
            searchParams: {},
            error: "Có lỗi xảy ra khi tải danh sách phòng."
        });
    }
};
export const getRoomDetailPage = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const roomId = parseInt(id);
        if (isNaN(roomId)) return res.redirect('/rooms');

        // Gọi Service lấy thông tin (Service trả về { room, bookingCount })
        const data = await getRoomById(roomId);

        if (!data || !data.room) {
            return res.redirect('/rooms');
        }

        const room = data.room;
        const bookingCount = data.bookingCount || 0;

        // --- XỬ LÝ LOGIC TẠI ĐÂY (Thay vì làm ở View) ---
        
        // 1. Xử lý ảnh chính
        const mainImage = roomImageUrl(room.image);

        // 2. Xử lý mô tả (nếu null thì dùng văn bản mẫu)
        const defaultDesc = "Trải nghiệm không gian nghỉ dưỡng sang trọng và đẳng cấp. Phòng được thiết kế tinh tế với nội thất hiện đại, cửa sổ kính tràn ngắm trọn view thành phố. Hệ thống cách âm tiêu chuẩn quốc tế đảm bảo sự riêng tư tuyệt đối cho kỳ nghỉ của bạn.";
        const description = room.description && room.description.trim() !== "" ? room.description : defaultDesc;

        // 3. Render View (Truyền các biến đã xử lý)
        return res.render("client/room/detail", { // Lưu ý: không có đuôi .ejs
            user: req.user,
            room: room,
            bookingCount: bookingCount,
            mainImage: mainImage,       // Truyền ảnh đã xử lý
            description: description    // Truyền mô tả đã xử lý
        });

    } catch (error) {
        console.error("Error getting room detail page:", error);
        return res.redirect('/rooms');
    }
};
export {
    getRoomsPage
};