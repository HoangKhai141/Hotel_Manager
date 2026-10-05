# 🏨 Hotelier - Hệ Thống Quản Lý Khách Sạn Cao Cấp (v3)

[![Node.js Version](https://img.shields.io/badge/node.js-%3E%3D%2018.0.0-blue.svg?style=flat-round&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.0.1-green?style=flat-round&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue?style=flat-round&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.3.0-darkblue?style=flat-round&logo=prisma)](https://www.prisma.io/)
[![MySQL Database](https://img.shields.io/badge/MySQL-8.0-orange?style=flat-round&logo=mysql)](https://www.mysql.com/)
[![MoMo API](https://img.shields.io/badge/MoMo_Payment-Sandbox-pink?style=flat-round)](https://developers.momo.vn/)
[![Groq SDK](https://img.shields.io/badge/Groq_AI-Llama_3.3-violet?style=flat-round)](https://groq.com/)

**Hotelier v3** là hệ thống quản lý khách sạn trực tuyến toàn diện được xây dựng bằng kiến trúc Server-Side Rendering (SSR) hiện đại. Hệ thống tích hợp đầy đủ quy trình từ đặt phòng, chọn dịch vụ đi kèm, thanh toán online tự động cho tới trang quản trị (Admin Dashboard) chuyên nghiệp và **Trợ lý lễ tân ảo AI** hỗ trợ khách hàng theo thời gian thực.

---

## ✨ Tính Năng Nổi Bật

### 🏠 1. Giao Diện Khách Hàng (Client Workspace)
*   **Trang chủ (Homepage)**: Thiết kế hiện đại, responsive, tối ưu trải nghiệm người dùng.
*   **Tìm & Đặt phòng**: Kiểm tra phòng trống theo thời gian thực dựa trên ngày nhận/trả phòng.
*   **Đặt dịch vụ đi kèm**: Lựa chọn các dịch vụ tiện ích như: đưa đón sân bay, Giặt ủi, Spa, Ăn uống ngay khi đặt phòng.
*   **Trang cá nhân (User Profile)**: Quản lý thông tin tài khoản, ảnh đại diện, đổi mật khẩu và xem lịch sử đặt phòng (`Booking History`).

### 🔑 2. Xác Thực & Phân Quyền Bảo Mật
*   Đăng ký và đăng nhập truyền thống bảo mật với mật khẩu băm mã hóa 1 chiều bằng **Bcrypt**.
*   Đăng nhập nhanh an toàn thông qua **Google OAuth 2.0**.
*   Bộ middleware kiểm duyệt chặt chẽ trạng thái đăng nhập và phân quyền thao tác của tài khoản thường (`USER`) và quản trị viên (`ADMIN`).

### 💬 3. Trợ Lý Lễ Tân Ảo AI (Dynamic AI Chatbot)
*   Tích hợp mô hình ngôn ngữ lớn **Llama 3.3 70B** siêu nhanh qua **Groq SDK**.
*   **AI Context RAG**: Chatbot tự động nạp dữ liệu các phòng thực tế từ MySQL vào Prompt hệ thống theo thời gian thực để tư vấn chính xác về giá, diện tích, sức chứa và tình trạng phòng trống hiện tại cho khách hàng.

### 💳 4. Tích Hợp Thanh Toán MoMo (Momo Payment Gateway)
* Chế độ giả lập nội bộ (`MOMO_MODE=mock`) cho phép thử kết quả thành công/thất bại mà không cần tài khoản hay credentials MoMo; không tạo giao dịch thật và bị tắt trong production.
* Ở chế độ MoMo thật, xác minh chữ ký và số tiền; hỗ trợ kết quả chuyển hướng và IPN để đồng bộ trạng thái giao dịch.
* Khi thanh toán thành công, cập nhật trạng thái đơn đặt (`CONFIRMED`) và phòng (`BOOKED`).
* Muốn nhận IPN thật, cấu hình `MOMO_IPN_URL` thành URL HTTPS công khai trỏ tới `/payment/momo/ipn`; MoMo không thể gọi IPN trên `localhost`.

#### Chạy giả lập thanh toán trên máy
1. Thêm `MOMO_MODE=mock` vào file `.env` (không cần credentials MoMo).
2. Chạy `npm run dev`, đăng nhập và tạo một booking.
3. Chọn **Thanh toán ngay qua MoMo**, rồi chọn giả lập thành công hoặc thất bại trên trang mô phỏng.
4. Với kết quả thành công, kiểm tra payment thành `SUCCESS`, booking thành `CONFIRMED` và phòng thành `BOOKED`.

### 📊 5. Trang Quản Trị Hệ Thống (Admin Dashboard)
*   **Thống kê trực quan**: Tổng hợp doanh thu, lượng khách hàng, số lượng đơn hàng và tỉ lệ lấp đầy phòng.
*   **Quản lý tài nguyên chuyên sâu**:
    *   **Quản lý người dùng**: Thêm, sửa, xóa, khóa tài khoản và phân quyền.
    *   **Quản lý phòng**: Cập nhật thông tin phòng, giá tiền, hình ảnh và trạng thái hoạt động.
    *   **Quản lý đặt phòng & Hóa đơn**: Xem chi tiết hóa đơn, xác nhận, hủy đơn hoặc hoàn tiền.
*   **Xuất Báo Cáo Excel**: Xuất báo cáo doanh thu và chi tiết đơn đặt phòng bằng `exceljs` chỉ với 1 click.

---

## 🛠️ Công Nghệ & Thư Viện Sử Dụng

| Thành Phần | Công Nghệ |
| :--- | :--- |
| **Backend & Runtime** | Node.js, Express.js (v5), TypeScript |
| **Giao Diện (Views)** | EJS (Embedded JavaScript templates), CSS (Bootstrap/Vanilla CSS) |
| **Cơ Sở Dữ Liệu** | MySQL, Prisma ORM |
| **Xác thực (Auth)** | Passport.js, passport-local, passport-google-oauth20 |
| **Thanh Toán** | MoMo Payment API (ATM Pay) |
| **AI (Trí Tuệ Nhân Tạo)**| Groq SDK (Llama-3.3-70b-versatile) |
| **Quản Lý Session** | Express Session, Prisma Session Store |
| **Xuất File Báo Cáo** | ExcelJS |

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án

### 📋 Yêu Cầu Hệ Thống
*   Đã cài đặt **Node.js** (Phiên bản `>= 18.0.0`)
*   Đã cài đặt hệ quản trị cơ sở dữ liệu **MySQL**

### 💻 Các Bước Thực Hiện

#### Bước 1: Sao chép dự án về máy
```bash
git clone https://github.com/HaNguyen051/hotel-manager-v3.git
cd hotel-manager-v3
```

#### Bước 2: Cài đặt các thư viện dependencies
```bash
npm install
```

#### Bước 3: Cấu hình biến môi trường
*   Nhân bản file `.env.example` thành `.env` ở thư mục gốc:
    ```bash
    cp .env.example .env
    ```
*   Mở file `.env` và điền đầy đủ các thông tin cấu hình (Database connection, Google Client ID, Momo credentials và Groq API Key).

#### Bước 4: Khởi tạo cơ sở dữ liệu với Prisma
*   Đồng bộ schema Prisma vào MySQL để tạo các bảng cơ sở dữ liệu:
    ```bash
    npx prisma db push
    ```

#### Bước 5: Chạy dự án (Development Mode)
```bash
npm run dev
```

> **Lưu ý**: Khi chạy lệnh khởi động server lần đầu tiên, hệ thống sẽ tự động gọi file seeder để nạp sẵn dữ liệu mẫu bao gồm: 2 Roles, 12 Phòng khách sạn cao cấp, 4 Dịch vụ mẫu và 2 tài khoản thử nghiệm.

---

## 🔑 Tài Khoản Thử Nghiệm Mặc Định

Sau khi khởi chạy ứng dụng thành công, bạn có thể sử dụng các tài khoản mẫu dưới đây để đăng nhập trải nghiệm:

| Quyền | Email đăng nhập | Mật khẩu mặc định |
| :--- | :--- | :--- |
| **ADMIN (Quản trị)** | `admin@hotel.com` | `admin123` |
| **USER (Khách hàng)** | `user@example.com` | `user123` |

---

## 📁 Cấu Trúc Mã Nguồn Chính
```
src/
├── config/             # Cấu hình Passport, Database Client, và Seeder
├── controllers/        # Tầng Controller xử lý logic request (Admin & Client)
├── middleware/         # Tầng trung gian (Kiểm duyệt quyền, Multer upload file)
├── routes/             # Định tuyến API và điều hướng trang
├── services/           # Tầng nghiệp vụ xử lý chính và giao tiếp DB thông qua Prisma
├── types/              # Định nghĩa Type cho TypeScript & Passport Local
├── views/              # Thư mục EJS chứa template HTML động
└── index.ts            # Entry Point chính khởi động Server
```

---