import { z } from "zod";

const passwordSchema = z
    .string()
    .min(3, { message: "Password tối thiểu 3 ký tự" })
    .max(20, { message: "Password tối đa 20 ký tự" });
    // Có thể thêm các rule khác nếu cần:
    // .refine((password) => /[A-Z]/.test(password), {
    //     message: "Password bao gồm ít nhất 1 ký tự viết hoa",
    // })
    // .refine((password) => /[a-z]/.test(password), {
    //     message: "Password bao gồm ít nhất 1 ký tự viết thường",
    // })
    // .refine((password) => /[0-9]/.test(password), {
    //     message: "Password bao gồm ít nhất 1 chữ số"
    // })
    // .refine((password) => /[!@#$%^&*]/.test(password), {
    //     message: "Password bao gồm ít nhất 1 ký tự đặc biệt",
    // });

const emailSchema = z
    .string()
    .min(1, { message: "Email không được để trống" })
    .email({ message: "Email không đúng định dạng" });

export const RegisterSchema = z.object({
    fullName: z
        .string()
        .trim()
        .min(1, { message: "Tên không được để trống" })
        .max(255, { message: "Tên tối đa 255 ký tự" }),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
})
.refine((data) => data.password === data.confirmPassword, {
    message: "Password confirm không chính xác",
    path: ['confirmPassword'],
});

export type TRegisterSchema = z.infer<typeof RegisterSchema>;