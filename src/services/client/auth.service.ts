import { prisma } from "config/client";
import { ACCOUNT_TYPE } from "config/constant";
import bcrypt from "bcrypt";

const saltRounds = 10;

const hashPassword = async (plainText: string) => {
    return await bcrypt.hash(plainText, saltRounds);
};

const isEmailExist = async (email: string) => {
    const user = await prisma.user.findUnique({
        where: { username: email }
    });
    return !!user;
};

const registerNewUser = async (
    fullName: string,
    email: string,
    password: string
) => {
    const hashedPassword = await hashPassword(password);

    // Find USER or CUSTOMER role
    let userRole = await prisma.role.findUnique({
        where: { name: "USER" }
    });

    // If USER role doesn't exist, try CUSTOMER
    if (!userRole) {
        userRole = await prisma.role.findUnique({
            where: { name: "CUSTOMER" }
        });
    }

    if (!userRole) {
        throw new Error("User Role does not exist.");
    }

    await prisma.user.create({
        data: {
            username: email,
            password: hashedPassword,
            fullName: fullName,
            accountType: ACCOUNT_TYPE.SYSTEM,
            roleId: userRole.id
        }
    });
};

const getUserWithRoleById = async (id: number | string) => {
    const user = await prisma.user.findUnique({
        where: { id: typeof id === 'string' ? +id : id },
        include: {
            role: true
        },
        omit: {
            password: true
        },
    });
    return user;
};

export {
    registerNewUser,
    isEmailExist,
    getUserWithRoleById,
    hashPassword
};