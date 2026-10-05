// ==================== src/services/admin/dashboard.service.ts ====================
import { prisma } from "../../config/client";
import { BookingStatus, PaymentStatus } from "@prisma/client";

/**
 * Lấy tất cả dữ liệu thống kê cho Dashboard
 */
export const getDashboardInfo = async () => {
    try {
        console.log("[Dashboard Service] Fetching dashboard statistics...");

        // 1. Các số liệu đếm cơ bản
        const countUser = await prisma.user.count();
        const countRoom = await prisma.room.count();
        const countBooking = await prisma.booking.count();

        // 2. Tính tổng doanh thu (từ các payment SUCCESS)
        const revenueAggregate = await prisma.payment.aggregate({
            _sum: { totalAmount: true },
            where: { paymentStatus: PaymentStatus.SUCCESS }
        });
        const totalRevenue = revenueAggregate._sum.totalAmount || 0;

        // 3. Thống kê trạng thái booking (cho biểu đồ tròn)
        const bookingStatusStats = await prisma.booking.groupBy({
            by: ['status'],
            _count: { status: true }
        });

        // Convert array to object for easier access in view
        const bookingStatusData: Record<string, number> = {};
        bookingStatusStats.forEach(item => {
            bookingStatusData[item.status] = item._count.status;
        });

        // 4. Lấy 5 booking mới nhất (cho bảng "Recent Bookings")
        const recentBookings = await prisma.booking.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { fullName: true, username: true } }
            }
        });

        console.log("[Dashboard Service] ✅ Statistics:", {
            users: countUser,
            rooms: countRoom,
            bookings: countBooking,
            revenue: totalRevenue,
            statusBreakdown: bookingStatusData
        });

        return {
            countUser,
            countRoom,
            countBooking,
            totalRevenue,
            bookingStatusStats,      // Array format for iteration
            bookingStatusData,       // Object format for chart
            recentBookings
        };
    } catch (error) {
        console.error("[Dashboard Service] ❌ Error fetching dashboard info:", error);
        throw new Error("Không thể tải thông tin dashboard.");
    }
};