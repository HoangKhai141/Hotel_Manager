// ==================== src/services/client/profile.service.ts ====================
import { prisma } from "config/client"; // Đảm bảo đường dẫn đúng
import { User, Prisma, BookingStatus, RoomStatus, PaymentStatus } from "@prisma/client"; // Import các kiểu cần thiết

// --- Interface Data cho Update Profile ---
interface UpdateProfileData {
    fullName?: string;
    phone?: string;
    address?: string;
    avatar?: string | null; // Tên file mới hoặc null để xóa
}

// --- Lấy thông tin user (đơn giản) ---
// Hàm này có thể không cần thiết nếu req.user đã đủ thông tin cần hiển thị
const getUserProfile = async (userId: number): Promise<User | null> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true } // Include role nếu cần
        });
        // Xóa password trước khi trả về
        if (user) {
           delete (user as any).password;
        }
        return user;
    } catch (error) {
        console.error(`[Service] Error fetching profile for user ${userId}:`, error);
        throw new Error("Không thể tải thông tin tài khoản.");
    }
};


// --- Cập nhật Profile ---
const updateUserProfile = async (userId: number, data: UpdateProfileData): Promise<User> => {
    try {
        const updateData: Prisma.UserUpdateInput = {}; // Kiểu dữ liệu để update

        // Chỉ thêm vào updateData nếu giá trị được cung cấp và khác undefined
        if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
        if (data.phone !== undefined) updateData.phone = data.phone.trim() || null;
        if (data.address !== undefined) updateData.address = data.address.trim() || null;
        if (data.avatar !== undefined) updateData.avatar = data.avatar;

        // Thực hiện cập nhật và include role
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            include: {
                role: true // Include role để req.login hoạt động đúng
            }
        });

        // Xóa password trước khi trả về
        delete (updatedUser as any).password;
        return updatedUser;

    } catch (error) {
        console.error(`[Service] Error updating profile for user ${userId}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
             // Ví dụ xử lý lỗi unique constraint cho phone
             if ((error.meta?.target as string[])?.includes('phone')) {
                throw new Error("Số điện thoại này đã được sử dụng.");
             }
             throw new Error("Thông tin nhập vào bị trùng lặp.");
        }
        throw new Error("Không thể cập nhật thông tin tài khoản.");
    }
    
};

// --- Lấy lịch sử đặt phòng ---
const getBookingsByUserId = async (userId: number) => {
    try {
        const bookings = await prisma.booking.findMany({
            where: { userId: userId },
            include: {
                roomBookings: {
                    include: {
                        room: { select: { name: true, type: true, image: true } }
                    }
                },
                payment: { select: { paymentStatus: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return bookings;
    } catch (error) {
        console.error(`[Service] Error fetching bookings for user ${userId}:`, error);
        throw new Error("Không thể tải lịch sử đặt phòng.");
    }
};

// --- Hủy đặt phòng của User ---
const cancelUserBooking = async (bookingId: number, userId: number) => {
    try {
        // Dùng transaction để đảm bảo tính nhất quán
        const cancelledBooking = await prisma.$transaction(async (tx) => {
            // Tìm booking, đảm bảo thuộc user và đang PENDING
            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
                select: { userId: true, status: true } // Chỉ lấy các trường cần kiểm tra
            });

            // Validations
            if (!booking) throw new Error("Không tìm thấy đặt phòng.");
            if (booking.userId !== userId) throw new Error("Bạn không có quyền hủy đặt phòng này.");
            if (booking.status !== BookingStatus.PENDING) throw new Error(`Không thể hủy đặt phòng ở trạng thái ${booking.status}.`);

            // Update booking status thành CANCELLED
            const updatedBooking = await tx.booking.update({
                where: { id: bookingId, userId: userId }, // Re-check userId
                data: { status: BookingStatus.CANCELLED },
            });

            // Optional: Cập nhật payment liên quan (nếu có và đang PENDING) thành FAILED
            await tx.payment.updateMany({
                 where: {
                     bookingId: bookingId,
                     paymentStatus: PaymentStatus.PENDING
                 },
                 data: { paymentStatus: PaymentStatus.FAILED } // Hoặc REFUNDED tùy logic
            });

            // Optional: Cập nhật trạng thái phòng thành AVAILABLE?
            // Lưu ý: Cần kiểm tra xem có booking nào khác đang CONFIRMED/CHECKED_IN
            // cho phòng này không trước khi đổi thành AVAILABLE. Logic này có thể phức tạp.
            // const roomBooking = await tx.roomBooking.findFirst({ where: { bookingId: bookingId }});
            // if(roomBooking) {
            //    // Kiểm tra các booking khác cho roomBooking.roomId...
            //    await tx.room.update({ where: { id: roomBooking.roomId }, data: { status: RoomStatus.AVAILABLE }});
            // }


            return updatedBooking;
        }); // Kết thúc transaction

        return cancelledBooking;

    } catch (error: any) {
        console.error(`[Service] Error cancelling booking ${bookingId} for user ${userId}:`, error);
        if (error.message.includes("Không tìm thấy") || error.message.includes("không có quyền") || error.message.includes("Không thể hủy")) {
            throw error; // Ném lại lỗi validation
        }
        throw new Error("Đã xảy ra lỗi khi hủy đặt phòng."); // Lỗi chung
    }
};


// Export các hàm
export {
    getUserProfile,
    updateUserProfile,
    getBookingsByUserId,
    cancelUserBooking
};