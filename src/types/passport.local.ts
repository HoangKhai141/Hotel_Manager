import { prisma } from "config/client";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { getUserWithRoleById } from "services/client/auth.service";
import bcrypt from "bcrypt";

const configPassportLocal = () => {
    passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    }, async function verify(username, password, callback) {
        try {
            console.log(">>> LocalStrategy verify - username:", username);

            // Check user exists
            const user = await prisma.user.findUnique({
                where: { username },
                include: { role: true }
            });

            if (!user) {
                console.log(">>> User not found");
                return callback(null, false, { message: `Invalid Username/password` });
            }

            console.log(">>> User found, checking password");

            // Compare password - ✅ UNCOMMENT
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                console.log(">>> Password mismatch");
                return callback(null, false, { message: `Invalid Username/password` });
            }

            console.log(">>> Login success, returning user");
            return callback(null, user as any); // ✅ UNCOMMENT
        } catch (error) {
            console.error(">>> Login error:", error);
            return callback(error);
        }
    }));

    // ✅ Serialize: chỉ lưu user.id
    passport.serializeUser(function (user: any, callback) {
        console.log(">>> serializeUser - id:", user.id);
        callback(null, user.id);
    });

    // ✅ Deserialize: lấy user từ db với role
    passport.deserializeUser(async function (id: any, callback) {
        try {
            console.log(">>> deserializeUser - id:", id);
            const userInDB = await getUserWithRoleById(id);
            console.log(">>> User deserialized:", userInDB ? "YES" : "NO");
            callback(null, {...userInDB});
        } catch (error) {
            console.error(">>> Deserialize error:", error);
            callback(error);
        }
    });
};

export default configPassportLocal;