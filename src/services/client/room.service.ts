// ==================== src/services/client/room.service.ts ====================
import { prisma } from "config/client";
import { BookingStatus, RoomStatus } from "@prisma/client";

interface RoomQueryParams {
    page?: string;
    limit?: string;
    type?: string;
    capacity?: string;
    checkIn?: string;
    checkOut?: string;
}

export const getRoomsList = async (params: RoomQueryParams) => {
    const page = parseInt(params.page || '1');
    const limit = parseInt(params.limit || '8'); // Mặc định 8 phòng mỗi trang
    const skip = (page - 1) * limit;

    // 1. Xây dựng điều kiện lọc (Where Clause)
    let whereClause: any = {
        // Chỉ lấy phòng đang AVAILABLE hoặc CLEANING (có thể đặt được)
        // status: { in: [RoomStatus.AVAILABLE, RoomStatus.CLEANING] }
        // Hoặc chỉ đơn giản là không phải bảo trì:
        status: { not: RoomStatus.MAINTENANCE }
    };

    // Lọc theo loại phòng
    if (params.type && params.type !== 'Loại phòng') {
        whereClause.type = params.type;
    }

    // Lọc theo số người
    if (params.capacity && params.capacity !== 'Số người') {
        whereClause.capacity = { gte: parseInt(params.capacity) };
    }

    // (Nâng cao) Lọc theo ngày trống - Logic này phức tạp hơn, tạm thời lọc theo thuộc tính trước
    // Nếu cần lọc chính xác ngày trống, cần join với bảng Booking để loại trừ phòng đã đặt.

    try {
        // 2. Đếm tổng số phòng thỏa mãn điều kiện
        const totalRooms = await prisma.room.count({ where: whereClause });

        // 3. Lấy danh sách phòng phân trang
        const rooms = await prisma.room.findMany({
            where: whereClause,
            take: limit,
            skip: skip,
            orderBy: { price: 'asc' } // Sắp xếp theo giá tăng dần
        });

        // 4. Tính tổng số trang
        const totalPages = Math.ceil(totalRooms / limit);

        return {
            rooms,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems: totalRooms,
                limit
            }
        };
    } catch (error) {
        console.error("Error in getRoomsList service:", error);
        throw error;
    }
};
export const getRoomById = async (id: number) => {
    try {
        // 1. Lấy thông tin phòng
        const room = await prisma.room.findUnique({
            where: { id: id }
        });

        // 2. Đếm số lần phòng này đã được đặt (Tính cả CONFIRMED và CHECKED_IN)
        const bookingCount = await prisma.roomBooking.count({
            where: {
                roomId: id,
                booking: {
                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] }
                }
            }
        });

        // Trả về cả room và count
        return { room, bookingCount }; 
    } catch (error) {
        console.error(`Error fetching room detail for id ${id}:`, error);
        throw error;
    }
};
export const getAllRooms = async () => {
    try {
        return await prisma.room.findMany({
            where: { status: { not: RoomStatus.MAINTENANCE } },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        console.error("Error fetching all rooms:", error);
        return [];
    }
};