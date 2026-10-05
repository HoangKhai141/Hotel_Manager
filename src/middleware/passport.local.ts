import { prisma } from "config/client";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { getUserWithRoleById } from "services/client/auth.service";
import bcrypt from "bcrypt";

const configPassportLocal = () => {
    passport.use(new LocalStrategy({
        passReqToCallback: true,
        usernameField: 'username',
        passwordField: 'password'
    }, async function verify(req, username, password, callback) {
        const { session } = req as any;
        if (session?.messages?.length) {
            session.messages = [];
        }

        console.log(">>> Check username/password:", username);

        try {
            // Check if user exists
            const user = await prisma.user.findUnique({
                where: { username },
                include: { role: true }
            });

            if (!user) {
                return callback(null, false, { message: `Invalid email or password` });
            }

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return callback(null, false, { message: `Invalid email or password` });
            }

            return callback(null, user as any);
        } catch (error) {
            console.error("Login error:", error);
            return callback(error);
        }
    }));

    passport.serializeUser(function (user: any, callback) {
        callback(null, { id: user.id, username: user.username });
    });

    passport.deserializeUser(async function (user: any, callback) {
        const { id } = user;
        try {
            const userInDB: any = await getUserWithRoleById(id);
            return callback(null, { ...userInDB });
        } catch (error) {
            return callback(error);
        }
    });
};

export default configPassportLocal;