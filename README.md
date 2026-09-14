# DailyTask Dashboard Management

Dashboard quản lý công việc và vận hành nhóm. Giao diện tiếng Việt chạy trên trình duyệt; dữ liệu, API và xác thực dùng Google Sheets cùng Google Apps Script.

## Chức năng

- Checklist và phân công công việc.
- Kế hoạch nội dung, lịch quay, livestream và cuộc họp.
- Lịch làm việc, KPI và tính lương theo chính sách trong Sheet.
- Quản lý tài khoản, vai trò và quyền truy cập.
- Đồng bộ chỉ số kênh từ Pancake; đồng bộ lịch với Google Calendar.

## Cấu trúc dự án

| Tệp | Nội dung |
|---|---|
| `app.html` | Giao diện web độc lập, không cần bước build. |
| `Code.gs` | API, xác thực, phân quyền và thao tác Google Sheets. |
| `Engine.gs` | Tính toán và xử lý dữ liệu. |
| `PolicySeed.gs` | Dữ liệu chính sách và KPI khởi tạo. |
| `PancakeSync.gs` | Đồng bộ số liệu từ Pancake. |
| `HUONG-DAN-DEPLOY.md` | Hướng dẫn cài đặt và triển khai đầy đủ. |

## Chạy thử giao diện

Mở `app.html` trong trình duyệt. Để dùng dữ liệu demo, đặt `API_URL` ở đầu tệp thành chuỗi rỗng hoặc URL giữ chỗ `DAN-ID-VAO-DAY`. Có thể đăng nhập demo bằng `phwng` / `demo123456`, hoặc chọn nhân sự từ các nút demo trên màn hình đăng nhập.

Thông tin đăng nhập demo chỉ dành cho dữ liệu mẫu trong trình duyệt; không dùng làm tài khoản thật.

## Triển khai

Cần một tài khoản Google có quyền tạo Google Sheets và Apps Script. Xem [Hướng dẫn triển khai](HUONG-DAN-DEPLOY.md) để cấu hình database, cấp quyền, deploy API và đưa giao diện lên hosting tĩnh.

Tóm tắt: tạo Google Sheet → thêm các tệp `.gs` vào Apps Script → chạy `setup()` → lấy mật khẩu admin tạm trong nhật ký lần chạy → deploy dưới dạng Web app → cập nhật `API_URL` ở đầu `app.html` → host tệp HTML. Dự án không cần package manager hay bước build.

Sau khi triển khai, đổi mật khẩu tạm của admin. Trước khi dùng với dữ liệu thật, cập nhật người dùng và chính sách trong Sheet; chỉ lưu token tích hợp trong cấu hình riêng, không đưa credential vào mã nguồn.
