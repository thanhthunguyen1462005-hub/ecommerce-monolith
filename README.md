# E-commerce Monolith MVP (P2)

Hệ thống RESTful API cho ứng dụng E-commerce Monolithic xây dựng bằng Node.js, Express, Prisma ORM và PostgreSQL, được đóng gói bằng Docker Compose.

## 1. Công nghệ sử dụng
- **Runtime & Framework**: Node.js 20, Express.js
- **ORM & Database**: Prisma ORM, PostgreSQL 15
- **Authentication**: JWT (JSON Web Token), Bcryptjs
- **DevOps**: Docker, Docker Compose

## 2. Kiến trúc cơ sở dữ liệu
Hệ thống gồm 7 bảng quan hệ:
- `Role`: Phân quyền người dùng.
- `MemberShip`: Quản lý cấp bậc hội viên và điểm thưởng.
- `User`: Thông tin tài khoản và mật khẩu mã hóa.
- `Order`: Đơn hàng liên kết người dùng.
- `OrderDetail`: Chi tiết mặt hàng trong đơn (Composite Primary Key: `[oid, pid]`).
- `Product`: Quản lý thông tin và tồn kho sản phẩm.
- `Shipment`: Trạng thái giao hàng của từng đơn.

## 3. Cấu hình biến môi trường (.env)
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgrespassword@postgres:5432/ecommerce_db?schema=public"
JWT_SECRET="supersecret_jwt_key_2026"
JWT_EXPIRES_IN="1d"