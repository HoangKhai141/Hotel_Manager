import { Request, Response } from "express";
import { prisma } from "../../config/client"; // Đảm bảo đường dẫn import prisma đúng

export const getHomePage = async (req: Request, res: Response) => {
    try {
        // === SỬA LỖI 2: Đổi tên biến 'rooms' thành 'roomCount' ===
        const roomCount = await prisma.room.count();
        
        const userCount = await prisma.user.count({
            where: {
                role: {
                    name: 'USER' // Dùng tên 'USER' an toàn hơn dùng id = 2
                }
            }
        });

        // 3. Render view và truyền dữ liệu
        return res.render("client/home/show", {
            // === SỬA LỖI 1: Thêm 'user: req.user' ===
            user: req.user,       // Truyền user cho header
            roomCount: roomCount, // Truyền số phòng
            userCount: userCount  // Truyền số khách hàng
        });

    } catch (error) {
        console.error("Lỗi khi tải trang chủ:", error);
        // Render với giá trị mặc định nếu lỗi
        return res.render("client/home/show", {
            // === SỬA LỖI 1: Thêm 'user: req.user' ===
            user: req.user,
            roomCount: 0,
            userCount: 0,
            error_msg: ["Không thể tải dữ liệu thống kê"] // Dùng flash msg nếu đã setup
        });
    }
};