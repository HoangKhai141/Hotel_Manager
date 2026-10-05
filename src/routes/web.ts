// ==================== src/routes/web.ts ====================
import express, { Express } from "express";
import passport from "passport";
import fileUploadMiddleware from "../middleware/multer";

import { isLogin, isAuthenticated, isAdmin } from "../middleware/auth";
import { getAdminBookingPage, getCreateBookingPage, getViewBookingPage, postCreateBooking, postDeleteBooking, postUpdateBooking } from "controllers/admin/booking.controller";
import { exportDashboardToExcel, getAdminRoomPage, getAdminUserPage, getDashboardPage } from "controllers/admin/dashboard.controller";

import { getRoomDetailPage, getRoomsPage } from "controllers/client/room.controller";
import { getTeamPage } from "controllers/team.controller";
import { getServicePage } from "controllers/service.controller";
import { getLoginPage, getRegisterPage, getSuccessRedirectPage, postLogout, postRegister } from "controllers/client/auth.controller";
import { getBookingPage, getBookingSuccess, postAvailableRooms, postBookingSubmit } from "controllers/client/booking.controller";
import { getCreateUserPage, getViewUser, postCreateUser, postDeleteUser, postUpdateUser } from "controllers/user.controller";
import { getCreateRoomPage, getViewRoom, postCreateRoom, postDeleteRoom, postUpdateRoom } from "controllers/admin/room.controller";
import { cancelMyBooking, getMyBookingsPage, getProfilePage, updateProfile } from "controllers/client/profile.controller";

import { 
    getAdminPaymentPage,
    getViewPaymentPage, 
    postCancelPayment, 
    postConfirmPayment, 
    postCreatePayment,
    postRefundPayment,
    postDeletePayment
} from "controllers/admin/payment.controller";
import { getHomePage } from "controllers/client/homepage.controller";
import {
    getMoMoMockPage,
    handleMoMoCallback,
    handleMoMoIpn,
    initiateMoMoPayment,
    postMoMoMockResult
} from "controllers/client/momo.controller";
import { handleChatRequest } from "controllers/client/chat.controller";


 

const router = express.Router();

const webRoutes = (app: Express) => {
    // ==================== GOOGLE AUTH ROUTES ====================
    
    // 1. Route để bắt đầu đăng nhập
    router.get('/auth/google', 
        passport.authenticate('google', { scope: ['profile', 'email'] })
    );

    // 2. Route callback (Google gọi về sau khi user đồng ý)
    router.get('/auth/google/callback', 
        passport.authenticate('google', { 
            failureRedirect: '/login',
            failureMessage: true 
        }),
        (req, res) => {
            // Đăng nhập thành công -> Chuyển hướng
            res.redirect('/'); // Hoặc '/success-redirect' tùy logic của bạn
        }
    );
    // ==================== PUBLIC ROUTES ====================
    router.get("/", getHomePage); 

    router.get("/room/detail/:id", getRoomDetailPage); 
    router.get("/rooms", getRoomsPage);
    router.get("/team", getTeamPage);
    router.get("/service", getServicePage);
    router.post("/api/chat", handleChatRequest);

    // ==================== AUTH ROUTES ====================
    router.get("/login", isLogin, getLoginPage);
    router.post("/login", passport.authenticate("local", {
        successRedirect: "/success-redirect",
        failureRedirect: "/login",
        failureMessage: true
    }));

    router.get("/register", getRegisterPage);
    router.post("/register", postRegister);
    router.get("/success-redirect", isAuthenticated, getSuccessRedirectPage);
    router.post("/logout", isAuthenticated, postLogout);

    // === MOMO PAYMENT ROUTES ===
    // Route 1: Bắt đầu thanh toán
    router.post("/payment/momo/create", isAuthenticated, initiateMoMoPayment);
    
    // Route 2: Nhận kết quả trả về từ MoMo
    router.get("/payment/momo/callback", handleMoMoCallback);
    router.post("/payment/momo/ipn", handleMoMoIpn);
    router.get("/payment/momo/mock", isAuthenticated, getMoMoMockPage);
    router.post("/payment/momo/mock", isAuthenticated, postMoMoMockResult);

    // ...
    // ==================== CLIENT BOOKING ROUTES ====================
    router.get("/booking", isAuthenticated, getBookingPage);
    router.post("/booking/available-rooms", isAuthenticated, postAvailableRooms);
    router.post("/booking/submit", isAuthenticated, postBookingSubmit);
    router.get("/booking/success", isAuthenticated, getBookingSuccess);

    // ==================== CLIENT PROFILE ROUTES ====================
    router.get("/profile", isAuthenticated, getProfilePage);
    router.post("/profile", isAuthenticated, fileUploadMiddleware("avatar", "images/avatar"), updateProfile);

    // ==================== CLIENT BOOKING HISTORY ====================
    router.get("/my-bookings", isAuthenticated, getMyBookingsPage);
    router.post("/my-bookings/:id/cancel", isAuthenticated, cancelMyBooking);

    // ==================== ADMIN ROUTES ====================
    router.get("/admin", isAuthenticated, isAdmin, getDashboardPage);
    router.get("/admin/export-report", isAuthenticated, isAdmin, exportDashboardToExcel);

    // ===== USER MANAGEMENT =====
    router.get("/admin/user", isAuthenticated, isAdmin, getAdminUserPage);
    router.get("/admin/create-user", isAuthenticated, isAdmin, getCreateUserPage);
    router.post("/admin/handle-create-user", isAuthenticated, isAdmin, fileUploadMiddleware("avatar", "images/avatar"), postCreateUser);
    router.get("/admin/view-user/:id", isAuthenticated, isAdmin, getViewUser);
    router.post("/admin/update-user", isAuthenticated, isAdmin, fileUploadMiddleware("avatar", "images/avatar"), postUpdateUser);
    router.post("/admin/delete-user/:id", isAuthenticated, isAdmin, postDeleteUser);

    // ===== ROOM MANAGEMENT =====
    router.get("/admin/room", isAuthenticated, isAdmin, getAdminRoomPage);
    router.get("/admin/create-room", isAuthenticated, isAdmin, getCreateRoomPage);
    router.post("/admin/handle-create-room", isAuthenticated, isAdmin, fileUploadMiddleware("image", "images/product"), postCreateRoom);
    router.get("/admin/view-room/:id", isAuthenticated, isAdmin, getViewRoom);
    router.post("/admin/update-room", isAuthenticated, isAdmin, fileUploadMiddleware("image", "images/product"), postUpdateRoom);
    router.post("/admin/delete-room/:id", isAuthenticated, isAdmin, postDeleteRoom);

    // ===== BOOKING MANAGEMENT =====
    router.get("/admin/booking", isAuthenticated, isAdmin, getAdminBookingPage);
    router.get("/admin/booking/create", isAuthenticated, isAdmin, getCreateBookingPage);
    router.post("/admin/booking/create", isAuthenticated, isAdmin, postCreateBooking);
    router.get("/admin/booking/detail/:id", isAuthenticated, isAdmin, getViewBookingPage);
    router.post("/admin/booking/update", isAuthenticated, isAdmin, postUpdateBooking);
    router.post("/admin/booking/delete/:id", isAuthenticated, isAdmin, postDeleteBooking);

    // ===== PAYMENT MANAGEMENT =====
    router.get("/admin/payment", isAuthenticated, isAdmin, getAdminPaymentPage);
    router.get("/admin/view-payment/:id", isAuthenticated, isAdmin, getViewPaymentPage);
    router.post("/admin/handle-create-payment", isAuthenticated, isAdmin, postCreatePayment);
    router.post("/admin/confirm-payment/:id", isAuthenticated, isAdmin, postConfirmPayment);
    router.post("/admin/cancel-payment/:id", isAuthenticated, isAdmin, postCancelPayment);
    router.post("/admin/refund-payment/:id", isAuthenticated, isAdmin, postRefundPayment);
    router.post("/admin/payment/delete/:id", isAuthenticated, isAdmin, postDeletePayment); // ✅ SỬA ĐÂY

    // Apply router
    app.use("/", router);
};

export default webRoutes;