import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { prisma } from "./client"; // Đường dẫn tới prisma client của bạn

const configPassportGoogle = () => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            // 1. Kiểm tra xem user có email này đã tồn tại chưa
            // Google trả về array emails, lấy cái đầu tiên
            const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
            
            if (!email) {
                return done(new Error("Không tìm thấy email từ tài khoản Google"), false);
            }

            // Tìm user trong DB (ưu tiên tìm theo googleId trước, sau đó là email)
            let user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { googleId: profile.id },
                        { username: email }
                    ]
                }
                ,include: { role: true } // <--- THÊM DÒNG NÀY
            });

            if (user) {
                // Nếu user tồn tại nhưng chưa có googleId (đk bằng email/pass trước đó) -> Cập nhật googleId
                if (!user.googleId) {
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { googleId: profile.id, accountType: 'GOOGLE_LINKED' } , 
                        include: { role: true } // <--- VÀ THÊM CẢ DÒNG NÀY NỮA
                    });
                }
                return done(null, user);
            } 
            
            // 2. Nếu user chưa tồn tại -> Tạo mới
            
            // Lấy role mặc định (USER)
            const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
            if (!userRole) return done(new Error("System Error: Role USER not found"), false);

            const newUser = await prisma.user.create({
                data: {
                    username: email,
                    googleId: profile.id,
                    fullName: profile.displayName,
                    // password: để null
                    accountType: 'GOOGLE',
                    roleId: userRole.id,
                    avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null
                }, 
                include: {
                    role : true 
                }
            });

            return done(null, newUser);

        } catch (error) {
            console.error("Google Auth Error:", error);
            return done(error, false);
        }
    }));
};

export default configPassportGoogle;