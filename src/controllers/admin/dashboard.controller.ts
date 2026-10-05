// ==================== src/controllers/admin/dashboard.controller.ts ====================
import { Request, Response } from "express";
import { getDashboardInfo } from "../../services/admin/dashboard.service";
import { getAllRooms } from "../../services/admin/room.service";
import { getAllUsers } from "../../services/user.service";
import ExcelJS from "exceljs"; // Import thư viện
import { prisma } from "../../config/client";
/**
 * GET /admin
 * Dashboard tổng quan với thống kê và biểu đồ
 */
const getDashboardPage = async (req: Request, res: Response) => {
    try {
        console.log("[Dashboard Controller] Loading dashboard...");

        // 1. Lấy số liệu thống kê từ Service
        const info = await getDashboardInfo();

        console.log("[Dashboard Controller] Dashboard info:", {
            users: info.countUser,
            rooms: info.countRoom,
            bookings: info.countBooking,
            revenue: info.totalRevenue
        });

        // 2. Render view với dữ liệu
        return res.render("admin/dashboard/show", {
            info,
            user: req.user // Truyền user cho header
        });

    } catch (error: any) {
        console.error("[Dashboard Controller] ❌ Error getting dashboard:", error.message);
        console.error("Stack:", error.stack);
        
        // Render dashboard với dữ liệu rỗng
        return res.render("admin/dashboard/show", {
            info: {
                countUser: 0,
                countRoom: 0,
                countBooking: 0,
                totalRevenue: 0,
                bookingStatusData: {},
                recentBookings: []
            },
            user: req.user,
            error: "Không thể tải dữ liệu thống kê."
        });
    }
};

/**
 * GET /admin/user
 * Trang danh sách User
 */
const getAdminUserPage = async (req: Request, res: Response) => {
    try {
        console.log("[Dashboard Controller] Loading users page...");
        
        const users = await getAllUsers();
        
        console.log(`[Dashboard Controller] Loaded ${users.length} users`);
        
        return res.render("admin/user/show", {
            users,
            user: req.user
        });
    } catch (error: any) {
        console.error("[Dashboard Controller] ❌ Error getting users:", error.message);
        return res.status(500).send("Internal Server Error");
    }
};

/**
 * GET /admin/room
 * Trang danh sách Room
 */
const getAdminRoomPage = async (req: Request, res: Response) => {
    try {
        console.log("[Dashboard Controller] Loading rooms page...");
        
        const rooms = await getAllRooms();
        
        console.log(`[Dashboard Controller] Loaded ${rooms.length} rooms`);
        
        return res.render("admin/room/show", {
            rooms,
            user: req.user
        });
    } catch (error: any) {
        console.error("[Dashboard Controller] ❌ Error getting rooms:", error.message);
        return res.status(500).send("Internal Server Error");
    }
};
const exportDashboardToExcel = async (req: Request, res: Response) => {
    try {
        // 1. Lấy dữ liệu thống kê (Tái sử dụng service)
        const stats = await getDashboardInfo();

        // 2. Lấy thêm danh sách booking chi tiết (để làm báo cáo chi tiết)
        const allBookings = await prisma.booking.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: true,
                roomBookings: { include: { room: true } },
                payment: true
            }
        });

        // 3. Khởi tạo Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Hotelier Admin';
        workbook.created = new Date();

        // ================= SHEET 1: TỔNG QUAN (OVERVIEW) =================
        const sheetOverview = workbook.addWorksheet('Tổng Quan');

        // Định dạng cột
        sheetOverview.columns = [
            { header: 'Chỉ số', key: 'metric', width: 30 },
            { header: 'Giá trị', key: 'value', width: 20 },
        ];

        // Thêm dữ liệu Dashboard
        sheetOverview.addRows([
            { metric: 'Tổng Doanh Thu', value: stats.totalRevenue.toLocaleString('vi-VN') + ' đ' },
            { metric: 'Tổng số Booking', value: stats.countBooking },
            { metric: 'Tổng số Phòng', value: stats.countRoom },
            { metric: 'Tổng số Khách hàng', value: stats.countUser },
            {}, // Dòng trống
            { metric: 'THỐNG KÊ TRẠNG THÁI', value: '' }, // Tiêu đề phụ
        ]);

        // Thêm thống kê trạng thái
        stats.bookingStatusStats.forEach(item => {
            sheetOverview.addRow({ metric: `Đơn ${item.status}`, value: item._count.status });
        });

        // Style cho Header (In đậm, nền xám)
        sheetOverview.getRow(1).font = { bold: true };
        sheetOverview.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFCCCCCC' }
        };

        // ================= SHEET 2: CHI TIẾT BOOKING =================
        const sheetBookings = workbook.addWorksheet('Danh Sách Đơn Đặt');

        sheetBookings.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Khách hàng', key: 'customer', width: 25 },
            { header: 'Phòng', key: 'room', width: 20 },
            { header: 'Ngày Check-in', key: 'checkIn', width: 15 },
            { header: 'Ngày Check-out', key: 'checkOut', width: 15 },
            { header: 'Tổng tiền', key: 'total', width: 15 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Thanh toán', key: 'payment', width: 15 },
        ];

        // Header Style
        sheetBookings.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheetBookings.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007bff' } }; // Màu xanh

        // Đổ dữ liệu
        allBookings.forEach(booking => {
            const roomNames = booking.roomBookings.map(rb => rb.room.name).join(', ');
            
            sheetBookings.addRow({
                id: booking.id,
                customer: booking.user ? booking.user.fullName : booking.guestName,
                room: roomNames,
                checkIn: new Date(booking.checkInDate).toLocaleDateString('vi-VN'),
                checkOut: new Date(booking.checkOutDate).toLocaleDateString('vi-VN'),
                total: booking.totalPrice,
                status: booking.status,
                payment: booking.payment ? booking.payment.paymentStatus : 'Chưa có'
            });
        });

        // Format cột tiền tệ (Cột F - Tổng tiền)
        sheetBookings.getColumn(6).numFmt = '#,##0 "đ"';

        // 4. Thiết lập Response Header để tải file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=BaoCao_DoanhThu_' + new Date().getTime() + '.xlsx');

        // 5. Ghi file ra response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Export Excel Error:", error);
        res.redirect('/admin');
    }
};
export {
    getDashboardPage,
    getAdminUserPage,
    getAdminRoomPage, 
    exportDashboardToExcel
};