///<reference path="./types/index.d.ts" />

import express, {Express} from "express" ;
import 'dotenv/config'
import flash from 'connect-flash';
import session from 'express-session';
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import { PrismaClient } from "@prisma/client";
import passport from "passport";
import configPassportLocal from "./types/passport.local";
import webRoutes from "./routes/web";
import initDatabase from "config/seed"; // Import seeder
import configPassportGoogle from "config/passport.google";
import roomImageUrl from "./utils/room-image";

const app: Express = express();
const port = process.env.PORT || 8000;

// Config view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.locals.roomImageUrl = roomImageUrl;

// Config body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Config static files (phục vụ file trong thư mục 'public')
app.use(express.static('public'));

// Config session
app.use(session({
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    secret: process.env.SESSION_SECRET || 'a-very-strong-secret-key', // Nên dùng biến môi trường
    resave: false,
    saveUninitialized: false,
    store: new PrismaSessionStore(
        new PrismaClient(),
        {
            checkPeriod: 1 * 24 * 60 * 60 * 1000,  // 1 day
            dbRecordIdIsSessionId: true,
            dbRecordIdFunction: undefined,
        }
    )
}));

// Config Passport (Phải sau session)
configPassportLocal();
configPassportGoogle();
app.use(passport.initialize());
app.use(passport.session()); // Dùng .session()

// Config Flash (Phải sau session và passport)
app.use(flash());

//  SỬA: Gộp middleware toàn cục lại thành MỘT khối
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    next();
});

// Config routes
webRoutes(app); 

// 404 Handler (Đặt sau routes chính)
app.use((req, res) => {
  return res.status(404).render('status/404.ejs', { user: req.user }); 
});


// SỬA LỖI: TẠO HÀM ASYNC ĐỂ KHỞI ĐỘNG SERVER
const startServer = async () => {
    try {
        // 1. CHỜ (AWAIT) cho database được seed xong
        console.log(" Bắt đầu kiểm tra và seeding database...");
        await initDatabase();
        console.log(" Database đã sẵn sàng!");

        // 2. CHỈ KHỞI ĐỘNG SERVER SAU KHI SEED XONG
        app.listen(port, () => {
            console.log(` Server đang chạy tại http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Lỗi nghiêm trọng khi khởi động server hoặc seeding:", error);
        process.exit(1); // Thoát nếu có lỗi
    }
};

// Gọi hàm để bắt đầu toàn bộ quá trình
startServer();