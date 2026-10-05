import { Request, Response, NextFunction } from "express";

// Check if user is logged in
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect("/login");
};

// Check if NOT logged in (for login/register pages)
export const isLogin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
        res.redirect("/");
        return;
    }
    next();
};

// Check if user is Admin - Chỉ Admin mới vào được admin panel
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
        res.redirect("/login");
        return;
    }

    const user = req.user as any;
    if (user?.role?.name === "ADMIN") {
        next();
    } else {
        res.status(403).render("status/403.ejs", {
            message: "Bạn không có quyền truy cập. Chỉ Admin mới có thể vào trang này."
        });
    }
};

// Check if user is regular User (not admin)
export const isUser = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
        res.redirect("/login");
        return;
    }

    const user = req.user as any;
    if (user?.role?.name === "USER") {
        next();
    } else {
        res.status(403).render("status/403.ejs", {
            message: "Trang này dành cho người dùng thông thường."
        });
    }
};
