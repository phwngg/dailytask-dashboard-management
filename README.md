# DailyTask Dashboard

Dashboard quản lý công việc nhóm được tách thành giao diện React, API Go và SQLite. Giao diện dùng Vite + Tailwind CSS; triển khai bằng một Docker image nhỏ: Go phục vụ SPA đã build và API cùng origin.

## Cấu trúc

- `frontend/`: giao diện React, Vite và Tailwind CSS.
- `backend/`: API Go, xác thực phiên đăng nhập, schema SQLite và nghiệp vụ hiện có.
- `deployment/`: Dockerfile multi-stage, Docker Compose và biến môi trường mẫu.
- `legacy/google-apps-script/`: bản HTML và Apps Script cũ được lưu để tra cứu; không tham gia runtime của app mới.

## Chạy local

Cần Go 1.27+ và Node.js 24 LTS.

Terminal 1:

```sh
cd backend
export INITIAL_ADMIN_EMAIL=admin@example.com
export INITIAL_ADMIN_PASSWORD='change-this-to-a-long-unique-password'
go run .
```

Terminal 2:

```sh
cd frontend
npm ci
npm run dev
```

Mở `http://localhost:5173`. Vite chuyển tiếp `/api` sang Go ở `localhost:8080`. SQLite mặc định được lưu tại `backend/data/dailytask.db`; mật khẩu admin không được để trống và tối đa 72 byte.

## Chạy Docker Compose

```sh
cd deployment
cp .env.example .env
# Sửa INITIAL_ADMIN_EMAIL và INITIAL_ADMIN_PASSWORD trong .env
docker compose up --build -d
```

Mở `http://localhost:8088` (hoặc cổng đặt trong `HTTP_PORT`). Go phục vụ luôn bundle frontend; Compose chỉ cần một service và một image runtime. Dữ liệu nằm trong named volume `dailytask-data`, nên vẫn còn sau khi container được tạo lại. Đặt `COOKIE_SECURE=true` khi phục vụ qua HTTPS. Dừng bằng `docker compose down`; lệnh này không xóa volume. Muốn xóa cả dữ liệu thì dùng `docker compose down -v`.

## API hiện có

- `POST /api/login`, `POST /api/logout`, `GET /api/health`
- `GET /api/bootstrap`
- `POST /api/tasks`, `PATCH /api/tasks/{id}`
- `POST /api/plans`, `PATCH /api/plans/{id}`, `DELETE /api/plans/{id}`
- `PUT /api/shifts`, `POST /api/schedules`, `POST /api/meetings`
- `GET/POST /api/admin/users`, `PATCH /api/admin/users/{email}`
- `GET /api/payroll`, `POST /api/payroll/compute`

Kiểm tra backend bằng `cd backend && go test ./...`; kiểm tra giao diện bằng `cd frontend && npm run build`.

## Dữ liệu và nghiệp vụ đã chuyển

Workbook cũ đã được nhập vào SQLite volume của môi trường đang chạy: người dùng, task, content plan (đã loại 170 dòng placeholder), lịch quay/livestream, cuộc họp, ca làm, policy, inputs, snapshot payroll và cấu hình kênh. Database không nằm trong Git; tài khoản quản trị khởi tạo của app được giữ lại. Mật khẩu cũ chỉ lưu dạng hash tương thích tạm thời và tự nâng lên bcrypt sau lần đăng nhập thành công.

Tính lương và gộp KPI từ Inputs, task/lịch hoàn thành và ChannelStats chạy trong Go; Apps Script chỉ còn bản lưu trữ. Snapshot payroll tháng 2026-08 không khớp kết quả tính lại theo Policy/Inputs hiện có ở 7/9 người. Vì vậy nút tính lại yêu cầu xác nhận trước khi ghi đè. ChannelStats trong workbook trống; đồng bộ Pancake, Google Calendar và email chưa được chuyển. Trang Lịch quay & họp và cấu hình kênh hiển thị dữ liệu đã nhập.

SQLite phù hợp với một backend instance và tải ghi thấp đến vừa; WAL cho phép nhiều reader cùng lúc nhưng vẫn chỉ có một writer. 100 CCU cần được kiểm tra theo tỷ lệ đọc/ghi và tải thực tế; không chạy nhiều backend replica cùng ghi một file SQLite. Nếu cần nhiều instance hoặc ghi đồng thời cao, chuyển DB sang PostgreSQL.
