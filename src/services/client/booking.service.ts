// ==================== src/services/client/booking.service.ts ====================
// (Giữ nguyên code bạn đã cung cấp)
import { prisma } from "config/client";
import { BookingStatus, RoomStatus } from "@prisma/client"; // <-- THÊM RoomStatus VÀO IMPORT NÀY

interface CreateClientBookingData {
    guestName: string;
    guestPhone: string;
    guestEmail?: string | null;
    guestCount: number;
    roomType: string;
    roomId: number;
    checkInDate: Date;
    checkOutDate: Date;
    specialRequest?: string | null;
    userId: number;
}

const calculateNights = (checkIn: Date, checkOut: Date): number => {
    const msPerDay = 24 * 60 * 60 * 1000;
    // Dùng Math.max để đảm bảo ít nhất là 1 đêm nếu check-in và check-out cùng ngày (tùy logic)
    const diffTime = Math.max(checkOut.getTime() - checkIn.getTime(), 0);
    const nights = Math.ceil(diffTime / msPerDay);
    // Nếu check in = check out, có thể trả về 1 hoặc 0 tùy quy định khách sạn
    return nights === 0 && diffTime > 0 ? 1 : nights; // Hoặc luôn > 0 nếu checkOut > checkIn
};

const validateDates = (checkIn: Date, checkOut: Date) => {
    const now = new Date();
    // So sánh ngày thôi, không cần giờ
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkInDay = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());


    if (checkInDay < today) {
        throw new Error("Ngày nhận phòng không thể là ngày trong quá khứ.");
    }

    if (checkOut <= checkIn) {
        throw new Error("Ngày trả phòng phải sau ngày nhận phòng.");
    }

    const nights = calculateNights(checkIn, checkOut);
    if (nights <= 0) {
         throw new Error("Số đêm đặt phòng phải lớn hơn 0.");
    }
    if (nights > 365) { // Giới hạn số đêm đặt
        throw new Error("Số đêm đặt phòng không được vượt quá 365 đêm.");
    }
};

const isRoomAvailable = async (
    roomId: number,
    checkIn: Date,
    checkOut: Date
): Promise<boolean> => { // Thêm kiểu trả về rõ ràng
    try {
        // Tìm booking đang CONFiRMED hoặc CHECKED_IN có lịch trùng lặp
        // Điều kiện trùng lặp:
        // (booking.checkIn < myCheckout) AND (booking.checkOut > myCheckin)
        const conflictBooking = await prisma.booking.findFirst({ // Query trên Booking thay vì RoomBooking để lấy status
            where: {
                roomId, // Đảm bảo roomId là trường trực tiếp trên Booking hoặc dùng RoomBooking
                status: {
                    in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]
                },
                // Lịch check-in của booking khác kết thúc SAU khi lịch check-in của tôi bắt đầu
                checkOutDate: { gt: checkIn },
                // Lịch check-in của booking khác bắt đầu TRƯỚC khi lịch check-out của tôi kết thúc
                checkInDate: { lt: checkOut },
            }
        });

        // Nếu không tìm thấy booking trùng lịch => phòng trống
        return !conflictBooking;
    } catch (error) {
        console.error("Error checking room availability:", error);
        throw new Error("Lỗi khi kiểm tra tình trạng phòng."); // Ném lỗi chung chung hơn
    }
};

const getRoomTypes = async (): Promise<string[]> => { // Thêm kiểu trả về
    try {
        const types = await prisma.room.findMany({
            where: {
                status: { // Chỉ lấy loại phòng của phòng đang AVAILABLE hoặc CLEANING?
                    notIn: [RoomStatus.MAINTENANCE] // Ví dụ: Loại bỏ phòng đang bảo trì
                }
            },
            select: { type: true },
            distinct: ['type'],
            orderBy: { type: 'asc' }
        });
        return types.map(t => t.type);
    } catch (error) {
        console.error("Error fetching room types:", error);
        throw new Error("Lỗi khi lấy danh sách loại phòng.");
    }
};

const getAvailableRoomsByType = async (
    roomType: string,
    checkIn: Date,
    checkOut: Date
) => {
    try {
        validateDates(checkIn, checkOut); // Validate ngày trước

        // Lấy tất cả các phòng có loại phòng và trạng thái không phải là MAINTENANCE
        const roomsOfType = await prisma.room.findMany({
            where: {
                type: roomType,
                status: {
                    notIn: [RoomStatus.MAINTENANCE] // Không lấy phòng đang bảo trì
                }
            },
            select: {
                id: true, name: true, type: true, price: true, capacity: true, status: true // Lấy thêm status để kiểm tra
            },
             orderBy: { name: 'asc' } // Sắp xếp theo tên
        });

        if (roomsOfType.length === 0) {
            return []; // Không có phòng nào loại này (hoặc đang bảo trì)
        }

        const availableRooms = [];
        for (const room of roomsOfType) {
             // Kiểm tra thêm status AVAILABLE/CLEANING nếu cần
             // if (room.status !== RoomStatus.AVAILABLE && room.status !== RoomStatus.CLEANING) continue;

            const isAvailable = await isRoomAvailable(room.id, checkIn, checkOut);
            if (isAvailable) {
                availableRooms.push({ // Chỉ trả về các trường cần thiết cho EJS
                     id: room.id,
                     name: room.name,
                     type: room.type,
                     price: room.price,
                     capacity: room.capacity
                });
            }
        }

        return availableRooms;
    } catch (error) {
         // Nếu lỗi từ validateDates, ném lại lỗi đó
         if (error instanceof Error && (error.message.includes("quá khứ") || error.message.includes("sau ngày nhận phòng") || error.message.includes("Số đêm"))) {
             throw error;
         }
        console.error("Error fetching available rooms:", error);
        throw new Error("Lỗi khi tìm phòng trống.");
    }
};

const createClientBooking = async (data: CreateClientBookingData) => {
    // Dùng transaction để đảm bảo tính nhất quán
    return await prisma.$transaction(async (tx) => {
        // Validate input cơ bản (đã làm ở controller, nhưng kiểm tra lại)
        if (!data.guestName || !data.guestPhone || !data.roomId || !data.userId) {
            throw new Error("Thông tin khách hàng hoặc phòng không đầy đủ.");
        }

        // Validate dates
        validateDates(data.checkInDate, data.checkOutDate);

        // Lấy thông tin phòng và khóa bản ghi để tránh race condition (FOR UPDATE)
        const room = await tx.room.findUnique({
            where: { id: data.roomId },
            // select: { id: true, type: true, price: true, status: true, capacity: true } // Chỉ lấy các trường cần thiết
        });

        if (!room) {
            throw new Error(`Phòng với ID ${data.roomId} không tồn tại.`);
        }
        if (room.status === RoomStatus.MAINTENANCE) {
             throw new Error(`Phòng ${room.name} đang được bảo trì.`);
        }
         // Kiểm tra sức chứa
         if (room.capacity < data.guestCount) {
             throw new Error(`Phòng ${room.name} chỉ chứa tối đa ${room.capacity} người.`);
         }


        // Kiểm tra loại phòng khớp (đề phòng client gửi sai)
        if (room.type !== data.roomType) {
            throw new Error(`Loại phòng không khớp. Phòng ${data.roomId} là loại ${room.type}.`);
        }

        // Kiểm tra phòng khả dụng một lần nữa trong transaction
        const isAvailable = await isRoomAvailable(data.roomId, data.checkInDate, data.checkOutDate);
        if (!isAvailable) {
            throw new Error(`Phòng ${room.name} không còn trống trong khoảng thời gian bạn chọn. Vui lòng thử lại.`);
        }

        // Tính giá
        const nights = calculateNights(data.checkInDate, data.checkOutDate);
        if (nights <= 0) throw new Error("Số đêm không hợp lệ."); // Kiểm tra lại
        const totalPrice = room.price * nights;

        // Tạo booking
        const newBooking = await tx.booking.create({
            data: {
                guestName: data.guestName,
                guestPhone: data.guestPhone,
                guestEmail: data.guestEmail,
                guestCount: data.guestCount,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                specialRequest: data.specialRequest,
                totalPrice,
                status: BookingStatus.PENDING, // Trạng thái ban đầu là PENDING
                userId: data.userId,
                roomId: data.roomId, // Lưu trực tiếp roomId nếu schema cho phép
                // Tạo RoomBooking liên quan
                roomBookings: {
                    create: {
                        roomId: data.roomId,
                        price: room.price,
                        quantity: nights // Số đêm
                    }
                }
            },
            include: { // Include để trả về thông tin đầy đủ cho trang success
                roomBookings: { include: { room: true } },
                user: true // Nếu cần thông tin user
            }
        });

         // Cập nhật trạng thái phòng thành BOOKED? (Tùy logic: có thể chờ CONFIRMED mới đổi)
         /*
         await tx.room.update({
             where: { id: data.roomId },
             data: { status: RoomStatus.BOOKED }
         });
         */

        return newBooking;
    }); // Kết thúc transaction
};


export {
    getRoomTypes,
    getAvailableRoomsByType,
    createClientBooking,
    calculateNights, // Có thể không cần export nếu chỉ dùng nội bộ
    validateDates // Có thể không cần export
};