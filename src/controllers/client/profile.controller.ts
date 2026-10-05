// ==================== src/controllers/client/profile.controller.ts (Hoàn Chỉnh) ====================
import { Request, Response } from "express";
import {
    // getUserProfile, // Có thể không cần nếu req.user đủ thông tin
    updateUserProfile,
    getBookingsByUserId,
    cancelUserBooking
} from "services/client/profile.service"; // Import service functions
import { prisma } from "config/client"; // Import Prisma để re-fetch user
import fs from 'fs'; // Module xử lý file system
import path from 'path'; // Module xử lý đường dẫn

// --- Controller hiển thị trang Profile (GET /profile) ---
const getProfilePage = async (req: Request, res: Response) => {
     // Flash messages (success_msg, error_msg) đã được middleware gán vào res.locals
     const user = req.user as any; // Lấy user từ session

     if (!user) {
         req.flash('error_msg', 'Vui lòng đăng nhập để xem trang cá nhân.');
         return res.redirect('/login');
     }

     // Render trang profile, truyền user data
     res.render("client/profile/show", {
         user: user
         // success_msg và error_msg tự động có từ middleware flash
     });
};

// --- Controller xử lý cập nhật Profile (POST /profile) ---
const updateProfile = async (req: Request, res: Response) => {
    const user = req.user as any;
    const { fullName, phone, address } = req.body;
    const avatarFile = req.file;

    if (!user || !user.id) {
        req.flash('error_msg', 'Phiên đăng nhập không hợp lệ.');
        return res.redirect('/login');
    }

    try {
        const updateData: any = { fullName, phone, address };
        let oldAvatarToDelete: string | null = null;

        // Xử lý file avatar mới
        if (avatarFile) {
            updateData.avatar = avatarFile.filename;
            if (user.avatar) {
                oldAvatarToDelete = user.avatar;
            }
        }
        // Optional: Xử lý xóa avatar nếu người dùng chọn (ví dụ: qua checkbox req.body.deleteAvatar)
        // else if (req.body.deleteAvatar === 'true' && user.avatar) {
        //     updateData.avatar = null; // Gán null để xóa trong DB
        //     oldAvatarToDelete = user.avatar; // Đánh dấu file cũ để xóa
        // }

        // Bước 1: Gọi service cập nhật DB
        await updateUserProfile(user.id, updateData);

        // Bước 2: Lấy lại user đầy đủ từ DB để cập nhật session
        const refreshedUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: { role: true } // Quan trọng cho req.login
        });

        if (!refreshedUser) {
             throw new Error("Không thể tải lại thông tin người dùng sau khi cập nhật.");
        }

        // Bước 3: Cập nhật session bằng req.login
        req.login(refreshedUser, (loginErr) => { // Không cần async nếu không await save
            if (loginErr) {
                 console.error("[Controller] Lỗi cập nhật user trong session:", loginErr);
                 req.flash('error_msg', "Đã cập nhật thông tin, nhưng có lỗi làm mới phiên. Đăng nhập lại nếu cần.");
                 return res.redirect('/profile');
            }

             // Bước 4: Xóa avatar cũ (nếu có) sau khi mọi thứ thành công
             if (oldAvatarToDelete) {
                 const oldAvatarPath = path.join(__dirname, '../../../public/images/avatar', oldAvatarToDelete);
                 fs.unlink(oldAvatarPath, (unlinkErr) => { // Xóa bất đồng bộ
                     if (unlinkErr && unlinkErr.code !== 'ENOENT') { // Bỏ qua lỗi không tìm thấy file
                        console.error("[Controller] Lỗi xóa avatar cũ:", oldAvatarPath, unlinkErr);
                     } else if (!unlinkErr) {
                        console.log("[Controller] Đã xóa avatar cũ:", oldAvatarPath);
                     }
                 });
             }

             // Đặt flash thành công và redirect
             req.flash('success_msg', '✅ Cập nhật thông tin tài khoản thành công!');
             return res.redirect('/');
        });

    } catch (error: any) {
        console.error("[Controller] Lỗi update profile:", error);
        // Đặt flash lỗi và redirect
        req.flash('error_msg', `❌ Lỗi cập nhật: ${error.message}`);
        return res.redirect('/profile');
    }
};


// --- Controller hiển thị trang Lịch sử đặt phòng (GET /my-bookings) ---
const getMyBookingsPage = async (req: Request, res: Response) => {
    const user = req.user as any;
    // Flash messages đã có trong res.locals

    if (!user || !user.id) {
        req.flash('error_msg', 'Vui lòng đăng nhập để xem lịch sử.');
        return res.redirect('/login');
    }

    try {
        // Lấy danh sách booking
        const bookings = await getBookingsByUserId(user.id);

        // Render view
        res.render("client/profile/bookings", {
            bookings: bookings,
            user: user
            // success_msg, error_msg tự động có
        });
    } catch (error: any) {
        console.error("[Controller] Lỗi tải lịch sử đặt phòng:", error);
        // Render lại trang booking history với thông báo lỗi
        res.render("client/profile/bookings", {
            bookings: [],
            user: user,
            error_msg: ["Không thể tải lịch sử đặt phòng. Vui lòng thử lại sau."] // Truyền lỗi trực tiếp
        });
    }
};

// --- Controller xử lý hủy đặt phòng (POST /my-bookings/:id/cancel) ---
const cancelMyBooking = async (req: Request, res: Response) => {
    const user = req.user as any;
    const { id } = req.params; // Lấy booking ID từ URL

    if (!user || !user.id) {
        req.flash('error_msg', 'Vui lòng đăng nhập lại.');
        return res.redirect('/login');
    }
    // Validate ID
    if (!id || isNaN(parseInt(id))) {
         req.flash('error_msg', 'Mã đặt phòng không hợp lệ.');
        return res.redirect('/my-bookings');
    }

    const bookingIdNum = parseInt(id);

    try {
        // Gọi service để hủy
        await cancelUserBooking(bookingIdNum, user.id);

        // Đặt flash thành công và redirect
        req.flash('success_msg', `✅ Đã hủy thành công đặt phòng #${bookingIdNum}.`);
        return res.redirect('/my-bookings');

    } catch (error: any) {
        console.error(`[Controller] Lỗi hủy booking ${bookingIdNum}:`, error);
        // Đặt flash lỗi và redirect
        req.flash('error_msg', `❌ Lỗi khi hủy đặt phòng #${bookingIdNum}: ${error.message}`);
        return res.redirect('/my-bookings');
    }
};

// Export các controller functions
export {
    getProfilePage,
    updateProfile,
    getMyBookingsPage,
    cancelMyBooking
};