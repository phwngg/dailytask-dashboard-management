# phwng.online — Hướng dẫn đưa vào hoạt động (≈ 20 phút)

Kiến trúc: **Google Sheets (database) → Google Apps Script (API + xác thực) → app.html (giao diện)**
Đăng nhập: **tài khoản + mật khẩu** (mặc định, không cần Google Cloud). Phân quyền theo vai trò (RBAC) + trang **Quản trị** để tạo user, đổi mật khẩu, ma trận quyền — làm ngay trên web. Chế độ Google Sign-In là tuỳ chọn, xem cuối tài liệu.
Phân quyền: `leader` thấy tất cả · `staff` chỉ thấy checklist / ca làm / lương **của mình**. Kế hoạch (content plan, lịch quay, live, họp) mọi người đều thấy.

---

## Bước 1 — Tạo database (Google Sheets) · 5 phút

1. Tạo Google Sheet mới, đặt tên `phwng-database`. Chủ sở hữu = tài khoản Leader.
2. Menu **Extensions → Apps Script**. Xoá code mặc định, dán **`Code.gs`**. Bấm **+ → Script** tạo thêm 3 file: **`Engine.gs`**, **`PolicySeed.gs`**, **`PancakeSync.gs`**, dán nội dung tương ứng. Lưu (Ctrl+S).
3. Chọn hàm **`setup`** ở thanh trên → bấm **Run**. Lần đầu Google hỏi cấp quyền → *Review permissions → chọn tài khoản → Advanced → Go to (unsafe) → Allow*.
4. Quay lại Sheet (F5): đã có 13 tab `Users, Tasks, ContentPlan, Shoots, Lives, Meetings, Shifts, Policy, Inputs, AutoInputs, Payroll, Channels, ChannelStats` kèm dữ liệu mẫu + menu **phwng**. Có thêm 2 thay đổi so với bản cũ: tab **Users** có cột **username** (tên đăng nhập) và tab mới **Roles** (ma trận quyền — không cần sửa tay, chỉnh ở trang Quản trị).
5. **Tab Users — sửa thành email thật** của 9 nhân sự (email dùng làm tên đăng nhập; Calendar/nhắc lịch cũng gửi tới email này). Cột `role`: `leader` / `staff`. Cột `active`: `TRUE`. Cột `start_date`: ngày vào làm (`YYYY-MM-DD`) — dùng để tính bậc thâm niên phí edit (0–3–6 tháng).
6. **Tab Policy** = toàn bộ chính sách lương/KPI theo tài liệu, mỗi dòng 1 khoản. Sửa ngay 3 chỗ tài liệu chưa có: lương cứng **Phương** (leader), lương cứng **Linh Chi**, và xác nhận **Phát** có giữ cả 2 kênh ĐN + Sapa (nếu không → xoá dòng `base_sapa` + các dòng `_2`).

> Dữ liệu mẫu ở các tab khác xoá/sửa thoải mái. Chỉ **không đổi tên tab và dòng tiêu đề**.

## Bước 2 — Deploy API · 3 phút

1. Trong Apps Script: **Deploy → New deployment → ⚙️ chọn Web app**.
2. Cấu hình: *Execute as* = **Me** · *Who has access* = **Anyone**.
3. **Deploy** → copy **Web app URL** (dạng `https://script.google.com/macros/s/…/exec`).
4. Test nhanh: mở `URL?action=ping` trên trình duyệt → thấy `{"ok":true,…}` là được.

> Mỗi lần sửa `Code.gs` sau này: **Deploy → Manage deployments → ✏️ → Version: New → Deploy** (giữ nguyên URL).

## Bước 3 — Tài khoản Admin & phân quyền · 1 phút

Sau `setup`, tài khoản **Admin** là **`phwng`** (gắn với Lương Hà Phương). Lấy mật khẩu tạm trong **Apps Script → Executions/Nhật ký thực thi** của lần chạy `setup`, đăng nhập rồi đổi mật khẩu ngay ở trang **Quản trị → Đổi mật khẩu của tôi**. Mật khẩu tạm được tạo ngẫu nhiên và không bị ghi đè khi chạy `setup` lần nữa.

Toàn bộ quản trị làm **trên web**, không cần đụng Sheet:
- **Trang Quản trị** (chỉ Admin thấy): tạo user (email + tên đăng nhập + vai trò + mật khẩu), đổi mật khẩu bất kỳ ai, bật/tắt hoạt động, xoá (trừ Admin).
- **Ma trận quyền**: mỗi vai trò × quyền (Kế hoạch, Checklist cả team, Lịch, Lương cả team, Chỉ số kênh, Quản trị…). Cột **Admin** luôn toàn quyền (khoá). Mặc định **Nhân viên** chỉ xem checklist/lịch/lương **của mình** + xem Kế hoạch & Chỉ số kênh.

Cột `temp_password`/`password_hash`/`salt` trong tab Users vẫn còn để dự phòng (cấp lại mật khẩu cũng có thể xoá `password_hash`+`salt` và điền `temp_password`), nhưng cách chính là dùng trang Quản trị.

## Bước 4 — Cấu hình app.html · 1 phút

Khối cấu hình nằm ngay **đầu file** (dòng 5–12), không cần tìm trong code:

```html
<!-- ===== CẤU HÌNH — CHỈ SỬA 1 DÒNG DƯỚI ĐÂY ===== -->
<script>
window.PHWNG_CONFIG = {
  API_URL:   'https://script.google.com/macros/s/DAN-ID-VAO-DAY/exec',  // thay DAN-ID-VAO-DAY bằng ID thật
  AUTH:      'password',   // để nguyên
  CLIENT_ID: ''            // để trống
};
</script>
```

Chỉ thay chữ `DAN-ID-VAO-DAY` bằng ID trong Web app URL (Bước 2). Còn chữ `DAN-ID-VAO-DAY` = web chạy chế độ demo.
Tuỳ chọn trong `Code.gs`: `ALLOWED_DOMAIN: 'phwng.online'` → chỉ chấp nhận email @phwng.online.

## Bước 5 — Đưa lên phwng.online · 5–10 phút

App là **1 file HTML tĩnh**: không cần WordPress/PHP/database trên hosting, không cần Next.js hay bước build.

**Cách 1 — GitHub + Vercel (khuyên dùng)**
1. github.com → New repository `phwng-online` (Private) → Upload `app.html` đã đổi tên thành **`index.html`** → Commit.
2. vercel.com → Continue with GitHub → Add New → Project → Import `phwng-online` → Framework Preset *Other* → Deploy → có link `*.vercel.app`.
3. Settings → Domains → thêm `phwng.online` → copy record DNS Vercel đưa (A/CNAME) → dán vào DNS của tên miền (DirectAdmin → DNS Management hoặc nhà đăng ký). HTTPS tự cấp.
4. Cập nhật sau này: sửa/upload đè `index.html` trên GitHub → Vercel tự deploy lại. Lợi thế: kết nối Claude với GitHub để sửa code trực tiếp.

**Cách 2 — DirectAdmin / cPanel**
- File Manager → `public_html` → upload `app.html` → đổi tên **`index.html`**. SSL hosting đã tự bật.

Mở `https://phwng.online` → nhập email + mật khẩu tạm → đặt mật khẩu mới → vào Dashboard.

## Sheet là CMS — luồng dữ liệu 2 chiều

| Chiều | Gì | Khi nào web thấy |
|---|---|---|
| Sheet → web | Users, ContentPlan, Shoots/Lives/Meetings, Shifts, Policy, Channels, ChannelStats, Payroll | Ngay khi bấm **↻** (cạnh nút Thoát) hoặc F5 — web không cache |
| Web → Sheet | Tick/di chuyển task, tạo task, tạo lịch quay/live/họp, đặt mật khẩu | Ghi ngay vào tab tương ứng |
| Tính toán | Payroll, AutoInputs | Chỉ đổi khi chạy menu **phwng → Tính lương tháng…** (hoặc trigger) |

Quy tắc duy nhất: **không đổi tên tab, không sửa dòng tiêu đề**. Thêm/xoá/sửa dòng dữ liệu thoải mái.

---

## Content Plan — nhập trên web + import dữ liệu cũ của team

Content Plan nay dùng đúng bộ trường của team: **Kênh · Tháng · Content Pillar · Key · Ngày gửi demo · Ngày đăng · Trạng thái · Thông điệp truyền tải · Người phụ trách**. Trạng thái chuẩn hoá về 4 giá trị: **Chưa thực hiện · Đang thực hiện · Đã đăng · Dời**.

Trên web (tab **Kế hoạch → Content Plan**):
- **Tra cứu**: lọc theo Kênh / Tháng / Trạng thái + ô tìm nhanh theo Content Pillar / Key.
- **Check tiến độ**: bảng "Tổng quan Content Plan" đếm số bài theo trạng thái cho từng kênh + cảnh báo ⚠ **trễ hạn** (quá ngày đăng mà chưa đăng).
- **Nhập/sửa**: nút **+ Thêm nội dung** — lưu thẳng vào Google Sheets (Sheet chỉ là kho lưu trữ).

### Tách Content Plan ra một Google Sheet riêng (khuyến nghị, chạy 1 lần)

Để team quản lý & check dữ liệu content plan trong một file riêng (không lẫn với dữ liệu hệ thống):

1. Trong Apps Script chọn hàm **`setupContentPlanSheet`** → **Run** (hoặc menu **phwng → Content Plan: TẠO Google Sheet riêng**).
2. Hàm sẽ tạo file **"phwng — Content Plan"**, lưu ID vào ScriptProperties, và tự copy dữ liệu ContentPlan hiện có sang. Link file hiện trong hộp thoại + **View → Logs**.
3. Mở link đó → **Share** cho team quyền xem/sửa. Từ nay web app đọc/ghi content plan vào đúng file này; các thao tác Thêm/Sửa/Xoá trên web và hàm import đều ghi vào file riêng.

*(Bỏ qua bước này thì Content Plan vẫn nằm trong tab ContentPlan của file backend như cũ.)*

### Import toàn bộ lịch sử từ Sheet cũ (chạy 1 lần)

Sau khi đã dán **Code.gs mới** và **Save** (và nên chạy `setupContentPlanSheet` trước để dữ liệu vào file riêng):

1. Trong Apps Script, chọn hàm **`previewOldPlan`** → **Run**. Mở **View → Logs** (hoặc Ctrl+Enter) để xem thử: mỗi tab kênh nhận được bao nhiêu dòng (chưa ghi gì cả). Nếu số dòng hợp lý thì sang bước 2.
2. Chọn hàm **`importOldContentPlan`** → **Run** (hoặc dùng menu **phwng → Content Plan: IMPORT toàn bộ từ Sheet cũ**). Hàm sẽ **xoá dữ liệu ContentPlan hiện có** rồi nạp toàn bộ từ workbook cũ.
3. Mở **phwng.online → Kế hoạch → Content Plan**, bấm **↻** để thấy dữ liệu.

Ghi chú:
- **Hỗ trợ 2 kiểu bảng**: bản mới nhận cả tab đầy đủ (Content Pillar · Trạng thái · ngày) lẫn tab gọn (Khách sạn/Địa điểm · Key · Thông điệp) → các kênh La cà ĐN, Thời tiết Sapa, Côn Đảo, Loca Travel, Lịch trình tour sẽ vào đủ. Nếu trước đó các kênh này hiện 0: dán lại **Code.gs mới → Save → Deploy** rồi chạy lại **`importOldContentPlan`** (hàm tự xoá & nạp lại toàn bộ).
- Nguồn đọc là workbook cũ (ID đã cài sẵn trong Code.gs: `OLD_PLAN_SOURCE_ID`). Tài khoản chạy Apps Script phải có quyền xem workbook đó.
- Các tab không phải kênh (LƯU Ý SẢN XUẤT, LIVESTREAM, LỊCH QUAY, TIMELINE) tự động bị bỏ qua.
- Map kênh → người phụ trách mặc định: **Thời tiết Đà Nẵng → Phan Hoàng Tấn Phát**, **La cà Đà Nẵng / Hotel → Đoàn Thị Anh Thư** (khớp với gán KPI/lương). Sửa lại trong bảng `OLD_PLAN_CHANNELS` ở Code.gs nếu cần.
- Muốn import **thêm** mà không xoá dữ liệu cũ: chạy `importOldContentPlan(false)` trong Apps Script.

---

## Số liệu tháng tự động chảy vào KPI (không nhập tay)

Số liệu (`Inputs`) được gom **tự động từ 4 nguồn** mỗi lần tính lương, ghi vào tab `AutoInputs` để Leader đối chiếu:

| Nguồn | Cách hoạt động | Ai làm gì |
|---|---|---|
| **Checklist (Tasks)** | Task có cột `kpi_key` + `qty`. Khi nhân sự bấm **Xong ✓** trên web → `done_at` = hôm nay → cộng `qty` vào KPI đó của tháng | Leader tạo task chọn "Tính vào KPI" (VD: *Buổi quay KS/địa điểm*, *Bài viết*, *Video POV tính phí*…) |
| **Lịch livestream (Lives)** | Dòng có `date`, `kpi_key` (loại live: `live_bridge`, `live_am_120`, `live_pm_90`…) và `done` = TRUE → cộng 1 vào loại đó + `live_total` | Host/Leader tick `done` sau buổi live |
| **Lịch quay (Shoots)** | Dòng có `date`, `kpi_key` (`hotel_session`, `cam_session`, `cam_day`…), `qty`, `done` = TRUE → cộng vào KPI | Người quay/Leader tick `done` |
| **Pancake API + Chỉ số kênh (ChannelStats)** | Tab `Channels` map nhân sự ↔ kênh (slot 1 = kênh chính, 2 = kênh 2). Pancake API đếm **số video** đăng trong tháng; trang Chỉ số kênh cấp **view**; follower nhập tay → tab `ChannelStats` → thành `videos, views, followers` (slot 2 → `_2`) | Cài 1 lần, tự chạy mỗi ngày |

**Quy tắc gộp:** ô nào Leader **nhập tay** ở tab `Inputs` → ưu tiên; ô để trống → lấy số tự động. Web hiển thị số đang tích luỹ ở tab Lương thưởng (nhân viên thấy của mình, Leader thấy cả team).

### Kết nối Pancake API (1 lần, ~15 phút)

**Pancake API lấy được gì?** (theo tài liệu chính thức docs.pancake.vn)

| Lấy tự động được | KHÔNG có trong API |
|---|---|
| Danh sách page/kênh + `page_id` · **Số bài/video đăng** trong kỳ (`/posts`) · Thống kê **khách mới, SĐT mới, hội thoại mới** (`/statistics/pages`, `/statistics/customers`) | **Lượt xem video** và **follower** TikTok → lấy từ trang **Chỉ số kênh** (file xuất Pancake, menu *Đồng bộ Chỉ số kênh*) hoặc nhập tay ở tab `Inputs` |

Hai nguồn bổ nhau: Pancake API tự đếm **số video/tháng**, Chỉ số kênh cấp **view**; script tự gộp (không ghi đè nhau).

**Bước 1 — Lấy Access Token (2 phút)**
1. Đăng nhập Pancake bằng tài khoản **chủ sở hữu/quản trị** các page (token kế thừa quyền của tài khoản này).
2. Mở **https://pages.fm/account** → mục **Nâng cao (Advanced)** → dòng **Access Token** → *Sao chép*.
3. Mở Apps Script → file `PancakeSync.gs` → dán vào `PANCAKE.TOKEN: '…'` → Lưu.
   - Token này là chìa khoá vào toàn bộ page — **không gửi qua chat/nhóm**, chỉ dán vào Apps Script (chỉ Leader thấy).

**Bước 2 — Lấy `page_id` từng kênh (3 phút)**
1. Menu **phwng → Pancake: liệt kê page (lấy page_id)** → hộp thoại hiện `id | tên page | nền tảng`.
   (Cách khác: mở page trong Pancake, `page_id` nằm trên URL `…/pages/<page_id>/…`.)
2. Tab `Channels`: mỗi kênh 1 dòng — `email` nhân sự phụ trách, `slot` (1 = kênh chính, 2 = kênh 2), `platform` = `pancake`, `page_id` vừa copy.
   Giữ nguyên các dòng `platform = hub` (đó là map cho trang Chỉ số kênh).

**Bước 3 — Test (2 phút)**
1. Menu **phwng → Test kết nối Pancake** → hộp thoại hiện HTTP code + JSON thật của `statistics/pages` và `posts` cho kênh đầu tiên.
2. `HTTP 200` + JSON có dữ liệu → xong. Nếu `401/403` → token sai hoặc tài khoản không có quyền page đó. Nếu `404` → sai `page_id`.
3. (Tuỳ chọn) Muốn lấy thêm khách mới / SĐT / hội thoại: nhìn JSON, sửa tên trường trong `PANCAKE.MAP` (`new_customers`, `phones`, `conversations`) cho khớp — không đụng code khác.

**Bước 4 — Chạy tự động (1 phút)**
- Menu **phwng → Đồng bộ Pancake tháng này** → tab `ChannelStats` có dòng `source = pancake` với `videos` = số bài đăng tháng này.
- Chạy hàm **`installPancakeTrigger`** 1 lần → tự đồng bộ **06:00 hằng ngày**. Kèm `installHubTrigger` để view từ Chỉ số kênh cũng tự cập nhật.
- Từ đó `videos` (Pancake) + `views` (Chỉ số kênh) tự chảy vào KPI mỗi lần **Tính lương tháng**.

**Nếu Pancake đổi API:** mọi URL nằm trong khối `PANCAKE` đầu file `PancakeSync.gs` (`PAGES_URL`, `PAGE_TOKEN_URL`, `STATS_URL`, `POSTS_URL`) — sửa 1 dòng, không cần sửa logic. Định dạng `date_range` Pancake dùng: `DD/MM/YYYY HH:MM:SS - DD/MM/YYYY HH:MM:SS` (script tự tạo).

## Lịch họp / quay / live → Google Calendar của từng nhân sự

Script chạy dưới tài khoản Leader → event nằm trên lịch Leader, **mời (guest) đúng email nhân sự** → hiện trên Google Calendar của họ + email mời + nhắc lịch.

| Tab | Cột cần có | Ai được mời |
|---|---|---|
| `Meetings` | `date` (YYYY-MM-DD, buổi đầu), `time`, `duration` ("60 phút"), `repeat` = `weekly` hoặc để trống, `attendee_emails` = `all` / danh sách email cách nhau dấu phẩy / tên | Theo `attendee_emails` (`all` = cả team) |
| `Shoots` | `date`, `time`, `assignee` | Người quay |
| `Lives` | `date`, `time`, `host` | Host |

- Menu **phwng → Đồng bộ lịch họp/quay/live → Google Calendar**. Lần đầu Google hỏi cấp quyền Calendar → Allow.
- Cột `event_id` tự điền; chạy lại chỉ **cập nhật** (đổi giờ/tiêu đề/thêm người), không tạo trùng.
- Muốn tự động: chạy hàm `installCalendarTrigger` 1 lần → đồng bộ mỗi giờ.
- Web hiện badge "📅 Đã lên Google Calendar" ở tab Lịch họp cho dòng đã đồng bộ.

## Lịch quay / livestream / họp tạo ngay trên web

| Ai | Làm gì | Hệ thống tự làm |
|---|---|---|
| **Leader** | Tab Kế hoạch → **Lịch quay** / **Livestream** → *+ Thêm* → nhập nội dung, ngày giờ, địa điểm, **tick nhân sự có mặt**, chọn *Phụ trách chính* (người được tính KPI), loại KPI, **Brief** | 1) Lưu vào Sheet · 2) Mời Google Calendar tất cả người có mặt · 3) **Gửi email** (kèm brief) · 4) **Tạo task trong Checklist** cho từng người (hạn = ngày quay/live) · 5) **Nhắc lại 18:00 hôm trước** qua email |
| **Mọi nhân sự** | Tab Kế hoạch → **Lịch họp** → *+ Thêm lịch họp* → tên, ngày giờ, thời lượng, cả team hoặc chọn người, lặp hằng tuần, agenda | Lưu + mời Calendar + email + nhắc trước 1 ngày |

- Nhân sự làm xong buổi quay/live → bấm **Xong ✓** trên task trong Checklist → KPI tự cộng (task của *Phụ trách chính* mang KPI; người phụ chỉ có task theo dõi).
- Brief hiển thị ngay dưới dòng lịch (bấm tab Lịch quay) và trong email.
- Bật nhắc tự động: chạy hàm **`installReminderTrigger`** 1 lần (18:00 hằng ngày, gửi cho ai có lịch quay/live/họp/hạn task ngày mai). Test ngay bằng menu **phwng → Gửi nhắc lịch ngày mai (test)**.
- Email gửi từ tài khoản Leader qua Gmail (giới hạn Google: 100 mail/ngày tài khoản thường, 1.500 với Workspace — đủ dùng).

## Trang Chỉ số kênh (TikTok Report Hub)

- Nhúng nguyên trang Report Hub (3 kênh Thời tiết ĐN / La cà ĐN / Hotel in ĐN): tổng quan, nội dung, khách & tin nhắn, gợi ý nội dung, **nhập số liệu từ file xuất Pancake**, xuất PDF/PNG. Hub vẫn dùng Apps Script + Sheet riêng của nó (URL trong source), không cần cấu hình thêm.
- **Nối vào KPI:** tab `Channels` đã map `thoitiet → Phát`, `laca → Ly`, `hotel → Thư` (platform = `hub`). Menu **phwng → Đồng bộ Chỉ số kênh (Report Hub) tháng này** → đếm số video + tổng view của tháng từ dữ liệu Hub → tab `ChannelStats` → tự thành `videos / views` trong KPI. Chạy `installHubTrigger` 1 lần để tự đồng bộ mỗi ngày 06:00. Follower vẫn nhập tay (Hub không có).
- Đổi map kênh ↔ nhân sự: sửa cột `email` ở tab `Channels`.

## KPI: tỉ lệ hoàn thành

Mỗi KPI tối thiểu trong chính sách (dòng `penalty_below` ở tab Policy: video tối thiểu, view tối thiểu…) được chấm **đạt / không đạt** riêng. Web hiển thị:
- Cột **KPI** = `đạt/tổng · %` (VD `1/2 · 50%`), màu xanh khi đạt hết, vàng khi đạt một phần, đỏ khi không đạt cái nào; "Không KPI" cho người không có chỉ tiêu (Ngân).
- Bấm vào dòng → thanh tiến độ từng chỉ tiêu: **thực tế / tối thiểu · %** (VD 24/25 video · 96% → đỏ vì chưa chạm mốc).
- Leader thấy **Tỉ lệ hoàn thành KPI team** = tổng chỉ tiêu đạt / tổng chỉ tiêu, kèm số người đạt / chưa đạt.
- Tab `Payroll` có thêm cột `kpi_met`, `kpi_total`, `kpi_rate`, `kpi_items` để lọc/xuất báo cáo.

## Tính lương hằng tháng (2 bước, ~5 phút)

1. (Tuỳ chọn) Menu **phwng → Tạo dòng Inputs cho tháng mới…** → nhập `2026-09` → điền tay những ô muốn **ghi đè** số tự động (doanh số account, job booking, mẫu ảnh… những thứ không đi qua task).
2. Menu **phwng → Tính lương tháng…** → nhập `2026-09` → tab `AutoInputs` (số gom tự động) và tab `Payroll` (kết quả: lương cứng / cộng tác phí / thưởng / phạt / thực nhận + `breakdown`). Web tự hiển thị tháng mới nhất, nhân viên bấm vào dòng của mình để xem chi tiết.

Muốn đổi đơn giá/bậc thưởng → sửa tab `Policy` rồi chạy lại "Tính lương tháng…". Không cần đụng code.

**Cột Inputs quan trọng** (tên cột = `input_key` trong Policy):

| Cột | Nghĩa | Ai dùng |
|---|---|---|
| `videos` / `views` / `followers` | Số video, view, follower tăng của **kênh chính** trong tháng | Phát (ĐN), Thư, Ly (VJ), Thương |
| `videos_2` / `views_2` / `followers_2` | Như trên cho **kênh 2** (Phát: Sapa · Ly: kênh content) | Phát, Ly |
| `hotel_session`, `extra_location`, `site_day`, `trip_day` | Buổi quay KS/địa điểm, địa điểm phát sinh, ngày quay cả ngày, ngày công tác tỉnh | Creator |
| `booking_job`, `booking_extra_hour` | Số job booking, số giờ phát sinh quá 2h | Phát, Thư |
| `live_*` | Số phiên live theo loại (cầu/sáng 1h30/sáng 2h/tối…), `live_total` tổng buổi, `live_wrong_timeline`, `live_late` | Thư, Đức |
| `edit_pov_paid`, `edit_review_paid` | Số video edit **được tính phí** (đã trừ 36 video đầu với Linh Chi, 24 với Đức) | Linh Chi, Đức |
| `late_video` | Số video gửi trễ deadline | Editor, Ly |
| `cam_session`, `cam_extra`, `cam_day`, `long_trip_day` | Buổi/ngày quay của cameraman | Linh Chi, Đức, Thương |
| `vj_video`, `rush_video`, `travel_day`, `partner_plan`, `bep_ngoai`, `sample_sub`, `sample_main`, `post` | VJ / plan marketing / content | Ly |
| `video_fnb`, `video_service`, `photo_fnb`, `photo_service`, `photo_extra_channel`, `combo_*`, `photo_*` | Sản xuất video/ảnh F&B & dịch vụ | Thương |
| `revenue_single`, `revenue_campaign`, `revenue_total`, `contract_value`, `fanpage_post`, `sample_*`, `photo_review_*` | Doanh số & hoa hồng account | Hiền |

Kiểu khoản trong Policy (cột `type`): `fixed` cố định/tháng · `per_unit` đơn giá × số lượng · `per_unit_tenure` đơn giá theo thâm niên · `tier` thưởng bậc (đạt ngưỡng cao nhất) · `percent` % doanh số · `penalty_below` phạt khi dưới mức tối thiểu · `penalty_per_unit` phạt × số lần.

## Vận hành hằng ngày

| Việc | Ai làm | Ở đâu |
|---|---|---|
| Thêm/sửa content plan, lịch quay, live, họp | Leader / Content | Sửa trực tiếp trên Sheet (tab tương ứng) — web cập nhật khi F5 |
| Xếp ca tuần mới | Leader | Tab `Shifts`: thêm 9 dòng với `week` = ngày Thứ 2 của tuần (`YYYY-MM-DD`). Web luôn hiển thị tuần mới nhất |
| Tính lương tháng | Leader | Xem mục "Tính lương hằng tháng" ở trên (Inputs → menu phwng → Payroll) |
| Giao việc | Leader | Trên web: **+ Thêm việc** → chọn **Tính vào KPI** + số lượng (ghi thẳng vào Sheet) hoặc nhập tay tab `Tasks` (cột `kpi_key`, `qty`) |
| Đổi trạng thái việc | Nhân viên | Trên web: nút *Bắt đầu / Xong / Mở lại* trên thẻ — bấm Xong là KPI tự cộng |
| Tick live/quay đã xong | Host / Leader | Tab `Lives` / `Shoots`: đặt `done` = TRUE (nhớ có `date` + `kpi_key`) |
| Thêm/khoá nhân sự | Leader | Tab `Users`: thêm dòng, hoặc đặt `active` = `FALSE` |

Giá trị cột `status` tab Tasks: `todo` · `doing` · `done`. Cột `priority`: `Cao` · `Vừa` · `Thấp`.
Ca làm tab Shifts: `S` (Sáng) · `C` (Chiều) · `Quay` · `Live` · `Off`.

## Lỗi thường gặp

- **"Email chưa được cấp quyền"** → email không có trong tab Users hoặc `active` = FALSE.
- **"Tài khoản chưa có mật khẩu"** → `temp_password` trống và chưa từng đặt mật khẩu → Leader điền `temp_password`.
- **"Phiên đã hết hạn"** → quá 30 ngày hoặc `SESSION_SECRET` đã đổi → đăng nhập lại.
- **(Chế độ Google) Nút Google không hiện** → sai `CLIENT_ID`, hoặc domain chưa thêm vào *Authorized JavaScript origins*, hoặc đang mở bằng http.
- **"Token không hợp lệ"** → đăng nhập lại (token hết hạn sau 1 giờ).
- **Web không thấy dữ liệu mới** → F5. Apps Script đọc trực tiếp Sheet, không cache dữ liệu (chỉ cache token 30 phút).
- **Sửa Sheet nhưng web không đổi** → bấm ↻ / F5; kiểm tra không sửa nhầm dòng 1 hoặc tên tab; lương/AutoInputs cần chạy *Tính lương*.
- **Sửa Code.gs xong không có tác dụng** → quên tạo *New version* khi deploy (xem ghi chú Bước 2).

## Nâng cấp sau này (khi cần)

- Nút "Đã live / Đã quay" ngay trên web (thay vì tick trong Sheet) — thêm 2 action nhỏ trong Code.gs.
- Thông báo Telegram/Zalo khi task trễ: thêm trigger `time-driven` trong Apps Script.
- Form sửa ContentPlan ngay trên web (hiện sửa trong Sheet).
- Chuyển database sang **Supabase** khi cần phân quyền chi tiết / nhiều team: giữ nguyên app.html, chỉ thay lớp API (`api()` trong app + bảng Postgres cùng tên tab).

---

## Tuỳ chọn — Chế độ đăng nhập Google (cần Google Cloud)

Chỉ làm nếu muốn nút "Đăng nhập với Google" thay cho mật khẩu.

1. https://console.cloud.google.com → Project mới `phwng-online`.
2. **APIs & Services → OAuth consent screen**: *Internal* (Google Workspace) hoặc *External* (thêm 9 email vào *Test users* hoặc *Publish app*) → tên app `phwng.online`.
3. **Credentials → Create credentials → OAuth client ID → Web application**: *Authorized JavaScript origins* = `https://phwng.online` (+ `https://www.phwng.online`) → copy **Client ID**.
4. `Code.gs`: `AUTH_MODE: 'google'`, `CLIENT_ID: 'xxxx.apps.googleusercontent.com'` → Deploy → New version.
5. `app.html`: `AUTH: 'google'`, `CLIENT_ID: 'xxxx.apps.googleusercontent.com'` → upload lại.
6. Bắt buộc HTTPS. Email đăng nhập Google phải trùng cột `email` tab Users.
