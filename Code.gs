/**
 * phwng.online — Backend (Google Apps Script)
 * Database: Google Sheets (file chứa script này — Container-bound)
 * Auth: Google Sign-In (ID token) → kiểm tra email trong tab "Users"
 * Phân quyền: leader = thấy tất cả · staff = chỉ thấy dữ liệu của mình
 *
 * CÀI ĐẶT:
 *  1. Tạo Google Sheet mới → Extensions → Apps Script → tạo 3 file: Code.gs, Engine.gs, PolicySeed.gs (dán nội dung tương ứng).
 *  2. Chạy hàm setup() 1 lần (tạo tabs + dữ liệu mẫu). Cấp quyền khi hỏi.
 *  3. Sửa email thật trong tab Users (cột role: leader / staff).
 *  4. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 *  5. Copy URL web app → dán vào app.html (API_URL).
 */

// ===== CẤU HÌNH =====
var CONFIG = {
  // Đăng nhập: 'password' = email + mật khẩu quản lý trong tab Users (KHÔNG cần Google Cloud) · 'google' = Google Sign-In
  AUTH_MODE: 'password',
  SESSION_DAYS: 30,
  // Google OAuth Client ID (chỉ dùng khi AUTH_MODE = 'google'). Để trống = không kiểm tra audience.
  CLIENT_ID: '',
  // Chỉ cho phép email thuộc domain này (vd 'phwng.online'). Để trống = chỉ cần có trong tab Users.
  ALLOWED_DOMAIN: '',
  TIMEZONE: 'Asia/Ho_Chi_Minh'
};

var SHEETS = {
  Users:       ['email','username','name','initials','role','position','color','active','start_date','temp_password','password_hash','salt'],
  Roles:       ['role','label','perms','locked'],   // ma trận quyền (admin = toàn quyền, khoá)
  Tasks:       ['id','title','assignee','due','priority','status','created_at','updated_at','kpi_key','qty','done_at','schedule_id','due_date'],
  ContentPlan: ['id','channel','month','pillar','key','demo_date','post_date','status','message','assignee'],
  Shoots:      ['id','day','time','topic','location','assignee','status','date','kpi_key','qty','done','event_id'],
  Lives:       ['id','day','time','title','location','host','status','date','kpi_key','done','event_id'],
  Channels:    ['email','slot','platform','page_id','page_name','note'],          // map nhân sự ↔ kênh Pancake (slot 1 = kênh chính, 2 = kênh 2)
  ChannelStats:['month','email','slot','videos','views','followers','synced_at','source'],
  Meetings:    ['id','title','day','time','attendees','duration','date','repeat','attendee_emails','event_id'],
  Shifts:      ['week','email','T2','T3','T4','T5','T6','T7','CN'],
  Policy:      ['email','code','label','type','input_key','rate','tiers','min','note','active'],
  Inputs:      ['month','email'],   // + INPUT_KEYS (PolicySeed.gs) được nối thêm trong setup()
  Payroll:     ['month','email','base','fees','bonus','penalty','total','kpi_ok','kpi_met','kpi_total','kpi_rate','kpi_items','breakdown','computed_at'],
  AutoInputs:  ['month','email']    // + INPUT_KEYS — sinh tự động mỗi lần tính lương (Tasks/Lives/Shoots/Pancake)
};

// ===== PHÂN QUYỀN (RBAC) =====
// Danh mục quyền — hiển thị trong ma trận quyền ở trang Quản trị.
var CAPS = [
  { key: 'plan.view',       group: 'Kế hoạch',    label: 'Xem kế hoạch (content plan, lịch quay/live/họp)' },
  { key: 'plan.edit',       group: 'Kế hoạch',    label: 'Thêm/sửa/xoá Content Plan trên web' },
  { key: 'plan.manage',     group: 'Kế hoạch',    label: 'Tạo/sửa lịch quay · livestream (Leader)' },
  { key: 'checklist.viewAll', group: 'Checklist', label: 'Xem checklist của cả team (mặc định chỉ xem của mình)' },
  { key: 'shifts.viewAll',  group: 'Lịch làm việc', label: 'Xem lịch làm việc của cả team' },
  { key: 'shifts.manage',   group: 'Lịch làm việc', label: 'Sửa lịch của người khác (mặc định ai cũng sửa lịch của mình)' },
  { key: 'payroll.viewAll', group: 'Lương thưởng', label: 'Xem lương thưởng của cả team' },
  { key: 'payroll.compute', group: 'Lương thưởng', label: 'Tính lại lương' },
  { key: 'channel.view',    group: 'Chỉ số kênh', label: 'Xem trang Chỉ số kênh (dữ liệu chung của team)' },
  { key: 'users.manage',    group: 'Quản trị',    label: 'Quản lý user & phân quyền (trang Quản trị)' }
];
var ALL_CAPS = CAPS.map(function (c) { return c.key; });
// Vai trò mặc định khi setup (admin = toàn quyền, khoá không xoá được).
var ROLES_SEED = [
  ['admin', 'Quản trị viên', ALL_CAPS.join(','), true],
  ['staff', 'Nhân viên',     'plan.view,plan.edit,channel.view', false]
];
var ADMIN_SEED = { username: 'phwng' }; // tài khoản admin đầu tiên (gắn với Lương Hà Phương)

function seedRoles_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Roles');
  if (sh && sh.getLastRow() <= 1) sh.getRange(2, 1, ROLES_SEED.length, ROLES_SEED[0].length).setValues(ROLES_SEED);
}
/** { role: {label, caps:[...], locked} } — admin luôn toàn quyền dù ma trận sửa gì. */
function rolesMap_() {
  var map = {};
  readSheet_('Roles').forEach(function (r) {
    var role = String(r.role).toLowerCase();
    map[role] = { label: r.label || role, caps: String(r.perms || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean), locked: isTrue_(r.locked) };
  });
  if (!map.admin) map.admin = { label: 'Quản trị viên', caps: ALL_CAPS.slice(), locked: true };
  map.admin.caps = ALL_CAPS.slice(); map.admin.locked = true;               // admin bất biến
  if (!map.staff) map.staff = { label: 'Nhân viên', caps: ['plan.view', 'channel.view'], locked: false };
  return map;
}
function capsOf_(role) { var m = rolesMap_(), r = m[String(role).toLowerCase()]; return r ? r.caps : []; }
function can_(me, cap) { return me && (me.role === 'admin' || (me.caps || []).indexOf(cap) >= 0); }
function need_(me, cap) { if (!can_(me, cap)) throw new Error('Bạn không có quyền thực hiện thao tác này.'); }

// ===== SETUP (chạy 1 lần) =====
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  SHEETS.Inputs = ['month','email'].concat(INPUT_KEYS);
  SHEETS.AutoInputs = ['month','email'].concat(INPUT_KEYS);
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]])
        .setFontWeight('bold').setBackground('#F3EEFF');
      sh.setFrozenRows(1);
    }
  });
  seedDemo_();
  seedPolicy_();
  seedRoles_();
  var adminPassword = seedAdminPassword_();
  secret_();
  var s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  computePayroll('2026-08');
  Logger.log('Setup xong. Admin: ' + ADMIN_SEED.username + (adminPassword ? ' / Mật khẩu tạm: ' + adminPassword : '') + '. Sửa email thật trong tab Users rồi Deploy web app.');
}

/** Tạo mật khẩu tạm ngẫu nhiên cho tài khoản admin đầu tiên; chỉ tạo khi chưa có mật khẩu. */
function seedAdminPassword_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users'), head = SHEETS.Users;
  var u = readSheet_('Users').filter(function (x) { return String(x.role).toLowerCase() === 'admin'; })[0];
  if (!u || u.password_hash) return '';        // không ghi đè mật khẩu đã đặt
  var password = Utilities.getUuid();
  var salt = Utilities.getUuid();
  sh.getRange(u._row, head.indexOf('salt') + 1).setValue(salt);
  sh.getRange(u._row, head.indexOf('password_hash') + 1).setValue(hash_(salt + password));
  sh.getRange(u._row, head.indexOf('temp_password') + 1).setValue('');
  return password;
}

// Menu trong Google Sheet
function onOpen() {
  SpreadsheetApp.getUi().createMenu('phwng')
    .addItem('Tính lương tháng…', 'computePayrollPrompt')
    .addItem('Tạo dòng Inputs cho tháng mới…', 'newInputsMonthPrompt')
    .addItem('Đồng bộ lịch họp/quay/live → Google Calendar', 'syncCalendarNow')
    .addItem('Gửi nhắc lịch ngày mai (test)', 'sendReminders')
    .addItem('Content Plan: TẠO Google Sheet riêng', 'setupContentPlanSheet')
    .addItem('Content Plan: XEM THỬ import từ Sheet cũ (xem log)', 'previewOldPlan')
    .addItem('Content Plan: IMPORT toàn bộ từ Sheet cũ', 'importOldContentPlan')
    .addItem('Đồng bộ Chỉ số kênh (Report Hub) tháng này', 'hubSyncNow')
    .addItem('Pancake: liệt kê page (lấy page_id)', 'pancakeListPages')
    .addItem('Đồng bộ Pancake tháng này', 'pancakeSyncNow')
    .addItem('Test kết nối Pancake (xem log)', 'pancakeTest')
    .addSeparator().addItem('Chạy setup (lần đầu)', 'setup').addToUi();
}
function computePayrollPrompt() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Tính lương', 'Nhập tháng (YYYY-MM):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var n = computePayroll(r.getResponseText().trim());
  ui.alert('Đã tính lương ' + r.getResponseText() + ' cho ' + n + ' nhân sự. Xem tab Payroll.');
}
function newInputsMonthPrompt() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Inputs tháng mới', 'Nhập tháng (YYYY-MM):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var month = r.getResponseText().trim();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Inputs');
  var exist = readSheet_('Inputs').filter(function (x) { return String(x.month) === month; }).map(function (x) { return String(x.email).toLowerCase(); });
  var users = readSheet_('Users').filter(function (u) { return String(u.active) !== 'false' && exist.indexOf(String(u.email).toLowerCase()) < 0; });
  users.forEach(function (u) { sh.appendRow([month, String(u.email).toLowerCase()]); });
  ui.alert('Đã tạo ' + users.length + ' dòng cho tháng ' + month + ' ở tab Inputs. Điền số liệu rồi chạy "Tính lương tháng…".');
}

// ===== PAYROLL =====
function seedPolicy_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Policy');
  if (sh.getLastRow() <= 1) {
    var rows = POLICY_SEED.map(function (r) { return r.concat([true]); });
    sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  var si = ss.getSheetByName('Inputs');
  if (si.getLastRow() <= 1) {
    var head = si.getRange(1, 1, 1, si.getLastColumn()).getValues()[0];
    var rows2 = Object.keys(INPUTS_SEED).map(function (email) {
      var inp = INPUTS_SEED[email];
      return head.map(function (h) { return h === 'month' ? '2026-08' : h === 'email' ? email : (inp[h] || ''); });
    });
    si.getRange(2, 1, rows2.length, head.length).setValues(rows2);
  }
}

/** Tính lương 1 tháng cho mọi nhân sự active → ghi đè tab Payroll (tháng đó). Trả về số người. */
function computePayroll(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Tháng phải dạng YYYY-MM');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var users = readSheet_('Users').filter(function (u) { return String(u.active) !== 'false'; });
  var policy = readSheet_('Policy');
  var inputs = buildInputs_(month);
  var sh = ss.getSheetByName('Payroll');
  // xoá dòng cũ của tháng
  var old = readSheet_('Payroll').filter(function (r) { return String(r.month) === month; });
  old.sort(function (a, b) { return b._row - a._row; }).forEach(function (r) { sh.deleteRow(r._row); });
  var out = [], now = new Date();
  users.forEach(function (u) {
    var email = String(u.email).toLowerCase();
    var rows = policy.filter(function (p) { return String(p.email).toLowerCase() === email; });
    var inp = inputs[email] || {};
    var tenure = PayrollEngine.monthsBetween(u.start_date, month);
    var r = PayrollEngine.computeOne(rows, inp, tenure);
    out.push([month, email, r.base, r.fees, r.bonus, r.penalty, r.total, r.kpi_ok, r.kpi.met, r.kpi.total, r.kpi.rate, JSON.stringify(r.kpi.items), JSON.stringify(r.breakdown), now]);
  });
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  return out.length;
}

function seedDemo_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var put = function (name, rows) {
    var sh = ss.getSheetByName(name);
    if (sh.getLastRow() > 1) return; // đã có dữ liệu → bỏ qua
    sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  };
  var G = {
    LP: 'linear-gradient(135deg,#C084FC,#6D28D9)', PP: 'linear-gradient(135deg,#FF9A9E,#FF5E3A)',
    AT: 'linear-gradient(135deg,#38BDF8,#2563EB)', PL: 'linear-gradient(135deg,#34D399,#059669)',
    DD: 'linear-gradient(135deg,#FBBF24,#D97706)', CL: 'linear-gradient(135deg,#F472B6,#DB2777)',
    TH: 'linear-gradient(135deg,#A78BFA,#7C3AED)', LN: 'linear-gradient(135deg,#22D3EE,#0891B2)'
  };
  put('Users', [
    ['phuong@phwng.online','phwng','Lương Hà Phương','LP','admin','Leader Marketing · Admin',G.LP,true,'2026-01-01','','',''],
    ['phat@phwng.online','phat','Phan Hoàng Tấn Phát','PP','staff','Creator ĐN/Sapa · Leader Media',G.PP,true,'2026-03-01','123456','',''],
    ['thu@phwng.online','thu','Đoàn Thị Anh Thư','AT','staff','Content Creator · Leader Livestream',G.AT,true,'2026-03-01','123456','',''],
    ['linh@phwng.online','linh','Phan Đăng Linh Chi','LC','staff','Editor',G.PL,true,'2026-05-01','123456','',''],
    ['duc@phwng.online','duc','Đỗ Hoàng Đức','ĐĐ','staff','Cameraman · Editor · Host live',G.DD,true,'2026-05-01','123456','',''],
    ['ly@phwng.online','ly','Trần Thị Cẩm Ly','CL','staff','VJ · Plan Marketing · Content',G.CL,true,'2026-02-01','123456','',''],
    ['hien@phwng.online','hien','Trần Thuý Hiền','TH','staff','Account · Content Marketing',G.TH,true,'2026-02-01','123456','',''],
    ['ngan@phwng.online','ngan','Lê Thị Ngân','LN','staff','Creator',G.LN,true,'2026-04-01','123456','',''],
    ['thuong@phwng.online','thuong','Hoàng Thị Thương','HT','staff','Content Creator · Cameraman · Đào tạo','linear-gradient(135deg,#FDBA74,#EA580C)',true,'2026-02-01','123456','','']
  ]);
  var now = new Date();
  put('Tasks', [
    ['T001','Lên outline “Ăn chơi Đà Nẵng”','linh@phwng.online','Hạn T4','Cao','todo',now,now,'',1,''],
    ['T002','Chuẩn bị đạo cụ quay Sapa','hien@phwng.online','Hạn T5','Vừa','todo',now,now,'',1,''],
    ['T003','Thumbnail livestream ĐN','thu@phwng.online','Hạn T5','Vừa','todo',now,now,'',1,''],
    ['T004','Quay KS Mường Thanh (buổi)','phat@phwng.online','Hôm nay','Cao','doing',now,now,'hotel_session',1,''],
    ['T005','Viết bài “La cà Đà Nẵng”','ly@phwng.online','Hạn T6','Vừa','doing',now,now,'post',1,''],
    ['T006','Edit clip Sapa v2 (POV)','linh@phwng.online','Hạn T7','Thấp','doing',now,now,'edit_pov_paid',1,''],
    ['T007','Kịch bản livestream tuần','ngan@phwng.online','Xong T2','—','done',now,now,'',1,now],
    ['T008','Bài fanpage Loca tuần 1','hien@phwng.online','Xong T3','—','done',now,now,'fanpage_post',1,now]
  ]);
  // ContentPlan: id, channel, month, pillar, key, demo_date, post_date, status, message, assignee
  put('ContentPlan', [
    ['C01','Thời tiết Đà Nẵng','2026-09','Thời tiết & mẹo du lịch','Dự báo thời tiết ĐN cuối tuần','2026-09-08','2026-09-09','Đã đăng','Cập nhật thời tiết + gợi ý điểm đi chơi khi nắng/mưa.','phat@phwng.online'],
    ['C02','Thời tiết Đà Nẵng','2026-09','Trải nghiệm điểm đến','Top 3 bãi biển đẹp khi trời nắng','2026-09-11','2026-09-13','Đang thực hiện','Gợi ý bãi biển kèm khung giờ đẹp để quay.','phat@phwng.online'],
    ['C03','La cà Đà Nẵng','2026-09','Review quán xá','Quán cà phê view sông Hàn','2026-09-09','2026-09-10','Đã đăng','Series la cà: không gian, giá, món nên thử.','thu@phwng.online'],
    ['C04','La cà Đà Nẵng','2026-09','Ẩm thực đường phố','Ăn vặt chợ Cồn buổi tối','2026-09-12','2026-09-14','Chưa thực hiện','Danh sách món + bản đồ ăn vặt.','thu@phwng.online'],
    ['C05','Hotel in Đà Nẵng','2026-09','Review lưu trú','Khách sạn 3* gần biển < 1 triệu','2026-09-10','2026-09-12','Đang thực hiện','So sánh phòng, tiện ích, ưu đãi combo.','thu@phwng.online'],
    ['C06','Thời tiết Sapa','2026-09','Thời tiết vùng núi','Sapa mùa lúa chín — nên đi giờ nào','2026-09-07','','Dời','Dời sang tuần sau do lịch quay trùng.','phat@phwng.online'],
    ['C07','Côn Đảo','2026-09','Kinh nghiệm di chuyển','Đi Côn Đảo mùa này lưu ý gì','','2026-09-15','Chưa thực hiện','Thời tiết + lịch tàu/bay + lưu ý đặt phòng.','ngan@phwng.online']
  ]);
  put('Shoots', [
    ['S01','T5','09:00','Thời tiết Đà Nẵng','Đà Nẵng','phat@phwng.online','Chuẩn bị','2026-09-10','hotel_session',1,false,''],
    ['S02','T6','08:00','La cà Đà Nẵng','Đà Nẵng','ly@phwng.online','Đã lên lịch','2026-09-11','vj_video',1,false,''],
    ['S03','T7','07:30','Thời tiết Sapa','Sapa','duc@phwng.online','Đã lên lịch','2026-09-12','cam_day',1,false,''],
    ['S04','CN','10:00','Ăn chơi Đà Nẵng','Đà Nẵng','thuong@phwng.online','Dự kiến','2026-09-13','cam_session',1,false,'']
  ]);
  put('Lives', [
    ['L01','T6','20:00','Live thời tiết tối 2h','Đà Nẵng','thu@phwng.online','Sẵn sàng','2026-09-11','live_pm_120',false,''],
    ['L02','T7','06:30','Live cầu Rồng','Đà Nẵng','duc@phwng.online','Chuẩn bị','2026-09-12','live_bridge',false,''],
    ['L03','CN','19:30','Live thời tiết tối 1h30','Sapa','thu@phwng.online','Đã lên lịch','2026-09-13','live_pm_90',false,'']
  ]);
  put('Meetings', [
    ['M01','Họp review tuần','T2','14:00','Cả team','60 phút','2026-09-07','weekly','all',''],
    ['M02','Brief content tuần mới','T3','09:30','Content + Leader','45 phút','2026-09-08','weekly','phuong@phwng.online, ly@phwng.online, thuong@phwng.online, thu@phwng.online',''],
    ['M03','Check tiến độ quay/live','T5','16:00','Media','30 phút','2026-09-10','weekly','phuong@phwng.online, phat@phwng.online, duc@phwng.online, thu@phwng.online','']
  ]);
  put('Shifts', [
    ['2026-09-07','phuong@phwng.online','S','S','S','S','S','Off','Off'],
    ['2026-09-07','phat@phwng.online','Quay','S','S','Quay','Live','S','Off'],
    ['2026-09-07','thu@phwng.online','S','C','S','C','S','Off','Off'],
    ['2026-09-07','linh@phwng.online','S','S','C','S','C','Off','Off'],
    ['2026-09-07','duc@phwng.online','C','Quay','C','S','Quay','C','Off'],
    ['2026-09-07','ly@phwng.online','S','S','S','C','S','Off','Off'],
    ['2026-09-07','hien@phwng.online','C','C','S','Quay','S','Live','Off'],
    ['2026-09-07','ngan@phwng.online','S','S','Live','S','Live','S','Off'],
    ['2026-09-07','thuong@phwng.online','S','Quay','S','S','Quay','Off','Off']
  ]);
  put('Channels', [
    ['phat@phwng.online',1,'hub','thoitiet','Thời tiết Đà Nẵng','KPI/lương của Phan Hoàng Tấn Phát'],
    ['thu@phwng.online',1,'hub','laca','La cà Đà Nẵng','KPI/lương của Đoàn Thị Anh Thư'],
    ['thu@phwng.online',2,'hub','hotel','Hotel in Đà Nẵng','Kênh phụ của Thư'],
    ['phat@phwng.online',2,'tiktok','','Thời tiết Sapa',''],
    ['thuong@phwng.online',1,'tiktok','','Kênh của Thương','']
  ]);
}

// ===== GOOGLE CALENDAR (lịch họp / quay / live → lịch của từng nhân sự) =====
// Script chạy dưới tài khoản Leader: event tạo trên lịch Leader, mời (guest) email nhân sự → hiện trên Google Calendar của họ + nhận email mời.
var CAL = { CALENDAR_ID: 'primary', SEND_INVITES: true, DEFAULT_MINUTES: 60 };

function syncCalendarNow() {
  var n = syncCalendar();
  try { SpreadsheetApp.getUi().alert('Đã đồng bộ ' + n + ' sự kiện lên Google Calendar (mời đúng nhân sự).'); } catch (e) {}
}
/** Cài trigger tự đồng bộ mỗi giờ (chạy 1 lần). */
function installCalendarTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncCalendar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncCalendar').timeBased().everyHours(1).create();
}
function syncCalendar() {
  var n = 0;
  n += syncSheetToCalendar_('Meetings', function (r) {
    return { title: '🗓 ' + r.title, date: r.date, time: r.time, minutes: parseMinutes_(r.duration), emails: resolveEmails_(r.attendee_emails || r.attendees),
      repeat: String(r.repeat || '').toLowerCase(), desc: 'Lịch họp phwng.online · ' + (r.attendees || '') };
  });
  n += syncSheetToCalendar_('Shoots', function (r) {
    return { title: '🎬 Quay: ' + r.topic, date: r.date, time: r.time, minutes: 180, emails: resolveEmails_(r.assignee), repeat: '', desc: 'Lịch quay · ' + (r.location || '') };
  });
  n += syncSheetToCalendar_('Lives', function (r) {
    return { title: '🔴 Live: ' + r.title, date: r.date, time: r.time, minutes: 120, emails: resolveEmails_(r.host), repeat: '', desc: 'Livestream · ' + (r.location || '') };
  });
  return n;
}
function syncSheetToCalendar_(sheetName, map) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(sheetName);
  if (!sh) return 0;
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], col = head.indexOf('event_id') + 1;
  if (!col) return 0;
  var cal = CalendarApp.getCalendarById(CAL.CALENDAR_ID) || CalendarApp.getDefaultCalendar();
  var n = 0;
  readSheet_(sheetName).forEach(function (r) {
    var ev = map(r); if (!ev.date || !/^\d{4}-\d{2}-\d{2}/.test(String(ev.date))) return;
    var start = new Date(String(ev.date).slice(0, 10) + 'T' + (String(ev.time || '09:00').slice(0, 5)) + ':00');
    if (isNaN(start.getTime())) return;
    var end = new Date(start.getTime() + (ev.minutes || CAL.DEFAULT_MINUTES) * 60000);
    var opts = { description: ev.desc || '', guests: ev.emails.join(','), sendInvites: CAL.SEND_INVITES };
    var existing = null;
    if (r.event_id) { try { existing = cal.getEventById(String(r.event_id)); } catch (e) {} }
    if (existing) {
      existing.setTitle(ev.title); existing.setDescription(ev.desc || '');
      try { existing.setTime(start, end); } catch (e) {}
      var have = existing.getGuestList().map(function (g) { return g.getEmail().toLowerCase(); });
      ev.emails.forEach(function (m) { if (have.indexOf(m) < 0) existing.addGuest(m); });
    } else {
      var created = ev.repeat === 'weekly'
        ? cal.createEventSeries(ev.title, start, end, CalendarApp.newRecurrence().addWeeklyRule(), opts)
        : cal.createEvent(ev.title, start, end, opts);
      sh.getRange(r._row, col).setValue(created.getId());
    }
    n++;
  });
  return n;
}
function parseMinutes_(s) { var m = /(\d+)/.exec(String(s || '')); return m ? Number(m[1]) : CAL.DEFAULT_MINUTES; }
/** 'all' / 'Cả team' → mọi nhân sự active; 'a@x, b@y' → list; tên → tìm theo Users.name */
function resolveEmails_(v) {
  var users = readSheet_('Users').filter(function (u) { return String(u.active) !== 'false'; });
  var all = users.map(function (u) { return String(u.email).toLowerCase(); });
  var s = String(v || '').trim().toLowerCase();
  if (!s || s === 'all' || s.indexOf('cả team') >= 0) return all;
  var out = [];
  s.split(/[,;]/).forEach(function (part) {
    part = part.trim(); if (!part) return;
    if (part.indexOf('@') > 0) { out.push(part); return; }
    users.forEach(function (u) { if (String(u.name).toLowerCase().indexOf(part) >= 0) out.push(String(u.email).toLowerCase()); });
  });
  return out.filter(function (x, i) { return out.indexOf(x) === i; });
}

// ===== HTTP =====
function doGet(e) {
  return handle_(e, (e && e.parameter) || {});
}
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (err) {}
  return handle_(e, body);
}

function handle_(e, p) {
  var out;
  try {
    if (p.action === 'ping') return json_({ ok: true, time: new Date(), auth: CONFIG.AUTH_MODE });
    if (p.action === 'login') return json_({ ok: true, data: login_(p) });
    var me = auth_(p.token);
    switch (p.action) {
      case 'bootstrap':   out = bootstrap_(me); break;
      case 'updateTask':  out = updateTask_(me, p); break;
      case 'createTask':  out = createTask_(me, p); break;
      case 'createSchedule': need_(me, 'plan.manage'); out = createSchedule_(me, p); break;
      case 'createMeeting':  need_(me, 'plan.view');   out = createMeeting_(me, p); break;
      case 'setPassword':    out = setPassword_(me, p); break;           // đổi mật khẩu lần đầu (chính mình)
      case 'changePassword': out = changePassword_(me, p); break;        // tự đổi mật khẩu
      case 'adminData':      need_(me, 'users.manage'); out = adminData_(me); break;
      case 'createUser':     need_(me, 'users.manage'); out = createUser_(me, p); break;
      case 'updateUser':     need_(me, 'users.manage'); out = updateUser_(me, p); break;
      case 'resetPassword':  need_(me, 'users.manage'); out = resetPassword_(me, p); break;
      case 'deleteUser':     need_(me, 'users.manage'); out = deleteUser_(me, p); break;
      case 'saveRoles':      need_(me, 'users.manage'); out = saveRoles_(me, p); break;
      case 'createPlan':     need_(me, 'plan.edit'); out = createPlan_(me, p); break;
      case 'updatePlan':     need_(me, 'plan.edit'); out = updatePlan_(me, p); break;
      case 'deletePlan':     need_(me, 'plan.edit'); out = deletePlan_(me, p); break;
      case 'upsertShift':    out = upsertShift_(me, p); break;   // tự sửa lịch của mình; sửa người khác cần shifts.manage
      default: throw new Error('Unknown action');
    }
    return json_({ ok: true, data: out });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ===== AUTH =====
// ---- Đăng nhập bằng mật khẩu (không cần Google Cloud) ----
function secret_() {
  var ps = PropertiesService.getScriptProperties(), k = ps.getProperty('SESSION_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); ps.setProperty('SESSION_SECRET', k); }
  return k;
}
function hash_(s) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function hmac_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())); }
function makeSession_(email) {
  var exp = Date.now() + CONFIG.SESSION_DAYS * 86400000, body = Utilities.base64EncodeWebSafe(email + '|' + exp);
  return 'pw.' + body + '.' + hmac_(body);
}
function readSession_(token) {
  var parts = String(token).split('.'); if (parts.length !== 3 || parts[0] !== 'pw') return null;
  if (hmac_(parts[1]) !== parts[2]) throw new Error('Phiên không hợp lệ, đăng nhập lại');
  var raw = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString().split('|');
  if (Number(raw[1]) < Date.now()) throw new Error('Phiên đã hết hạn, đăng nhập lại');
  return raw[0];
}
function login_(p) {
  var id = String(p.email || p.username || '').trim().toLowerCase(), pw = String(p.password || '');
  if (!id || !pw) throw new Error('Nhập tài khoản và mật khẩu');
  var u = readSheet_('Users').filter(function (x) {
    return (String(x.email).toLowerCase() === id || String(x.username || '').toLowerCase() === id) && String(x.active) !== 'false';
  })[0];
  if (!u) throw new Error('Tài khoản không tồn tại hoặc đã bị khoá. Liên hệ Admin.');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users'), head = SHEETS.Users;
  var mustSet = false;
  if (u.password_hash && u.salt) {
    if (hash_(u.salt + pw) !== u.password_hash) throw new Error('Sai mật khẩu');
  } else if (String(u.temp_password || '') !== '') {
    if (String(u.temp_password) !== pw) throw new Error('Sai mật khẩu tạm');
    mustSet = true;
  } else throw new Error('Tài khoản chưa có mật khẩu — nhờ Admin cấp mật khẩu tạm ở trang Quản trị');
  return { token: makeSession_(String(u.email).toLowerCase()), mustSetPassword: mustSet };
}
function setPassword_(me, p) {
  var pw = String(p.newPassword || ''); if (pw.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Users'), head = SHEETS.Users;
  var u = readSheet_('Users').filter(function (x) { return String(x.email).toLowerCase() === me.email; })[0];
  if (!u) throw new Error('Không tìm thấy tài khoản');
  var salt = Utilities.getUuid();
  sh.getRange(u._row, head.indexOf('salt') + 1).setValue(salt);
  sh.getRange(u._row, head.indexOf('password_hash') + 1).setValue(hash_(salt + pw));
  sh.getRange(u._row, head.indexOf('temp_password') + 1).setValue('');
  return { ok: true };
}

// ===== QUẢN LÝ USER & PHÂN QUYỀN (admin) =====
function usersSheet_() { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users'); }
function findUser_(idOrEmail) {
  var id = String(idOrEmail || '').trim().toLowerCase();
  return readSheet_('Users').filter(function (x) { return String(x.email).toLowerCase() === id || String(x.username || '').toLowerCase() === id; })[0];
}
function setCell_(sh, row, col, val) { sh.getRange(row, SHEETS.Users.indexOf(col) + 1).setValue(val); }
function writePassword_(sh, row, pw) {
  var salt = Utilities.getUuid();
  setCell_(sh, row, 'salt', salt);
  setCell_(sh, row, 'password_hash', hash_(salt + pw));
  setCell_(sh, row, 'temp_password', '');
}

/** Chính chủ tự đổi mật khẩu (cần mật khẩu cũ). */
function changePassword_(me, p) {
  var oldPw = String(p.oldPassword || ''), pw = String(p.newPassword || '');
  if (pw.length < 6) throw new Error('Mật khẩu mới tối thiểu 6 ký tự');
  var sh = usersSheet_(), u = readSheet_('Users').filter(function (x) { return String(x.email).toLowerCase() === me.email; })[0];
  if (!u) throw new Error('Không tìm thấy tài khoản');
  if (u.password_hash && u.salt) { if (hash_(u.salt + oldPw) !== u.password_hash) throw new Error('Mật khẩu cũ không đúng'); }
  else if (String(u.temp_password || '') !== '' && String(u.temp_password) !== oldPw) throw new Error('Mật khẩu cũ không đúng');
  writePassword_(sh, u._row, pw);
  return { ok: true };
}

/** Dữ liệu cho trang Quản trị: danh sách user + vai trò + ma trận quyền. */
function adminData_(me) {
  var rm = rolesMap_();
  var users = readSheet_('Users').map(function (u) {
    return { email: String(u.email).toLowerCase(), username: u.username || '', name: u.name, initials: u.initials,
      role: String(u.role || 'staff').toLowerCase(), position: u.position, color: u.color,
      active: String(u.active) !== 'false', start_date: u.start_date,
      hasPassword: !!u.password_hash, tempPassword: (!u.password_hash && u.temp_password) ? String(u.temp_password) : '' };
  });
  var roles = Object.keys(rm).map(function (k) { return { role: k, label: rm[k].label, caps: rm[k].caps, locked: rm[k].locked }; });
  return { users: users, roles: roles, caps: CAPS };
}

function createUser_(me, p) {
  var email = String(p.email || '').trim().toLowerCase();
  var username = String(p.username || '').trim().toLowerCase();
  var name = String(p.name || '').trim();
  var role = String(p.role || 'staff').trim().toLowerCase();
  var pw = String(p.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email không hợp lệ');
  if (!name) throw new Error('Thiếu họ tên');
  if (pw.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  if (!rolesMap_()[role]) throw new Error('Vai trò không tồn tại');
  if (findUser_(email)) throw new Error('Email đã tồn tại');
  if (username && findUser_(username)) throw new Error('Tên đăng nhập đã tồn tại');
  var initials = String(p.initials || name.split(/\s+/).map(function (w) { return w[0]; }).slice(-2).join('')).toUpperCase().slice(0, 2);
  var color = p.color || 'linear-gradient(135deg,#A78BFA,#7C3AED)';
  var sh = usersSheet_();
  var row = SHEETS.Users.map(function (h) {
    return h === 'email' ? email : h === 'username' ? username : h === 'name' ? name : h === 'initials' ? initials
      : h === 'role' ? role : h === 'position' ? (p.position || '') : h === 'color' ? color
      : h === 'active' ? true : h === 'start_date' ? (p.start_date || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd')) : '';
  });
  sh.appendRow(row);
  writePassword_(sh, sh.getLastRow(), pw);
  return { ok: true, email: email };
}

function updateUser_(me, p) {
  var u = findUser_(p.email); if (!u) throw new Error('Không tìm thấy user');
  var sh = usersSheet_(), isAdmin = String(u.role).toLowerCase() === 'admin';
  if (p.role !== undefined) {
    var role = String(p.role).toLowerCase();
    if (!rolesMap_()[role]) throw new Error('Vai trò không tồn tại');
    if (isAdmin && role !== 'admin' && adminCount_() <= 1) throw new Error('Phải còn ít nhất 1 Admin');
    setCell_(sh, u._row, 'role', role);
  }
  if (p.active !== undefined) {
    var act = !!p.active;
    if (isAdmin && !act && adminCount_() <= 1) throw new Error('Không thể khoá Admin cuối cùng');
    if (String(u.email).toLowerCase() === me.email && !act) throw new Error('Không thể tự khoá chính mình');
    setCell_(sh, u._row, 'active', act);
  }
  if (p.name !== undefined && String(p.name).trim()) setCell_(sh, u._row, 'name', String(p.name).trim());
  if (p.position !== undefined) setCell_(sh, u._row, 'position', String(p.position));
  if (p.initials !== undefined && String(p.initials).trim()) setCell_(sh, u._row, 'initials', String(p.initials).trim().toUpperCase().slice(0, 3));
  if (p.username !== undefined) {
    var un = String(p.username).trim().toLowerCase();
    var other = un ? findUser_(un) : null;
    if (other && String(other.email).toLowerCase() !== String(u.email).toLowerCase()) throw new Error('Tên đăng nhập đã dùng');
    setCell_(sh, u._row, 'username', un);
  }
  var result = { ok: true };
  if (p.newEmail !== undefined && String(p.newEmail).trim()) {
    var newEmail = String(p.newEmail).trim().toLowerCase(), oldEmail = String(u.email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) throw new Error('Email không hợp lệ');
    if (newEmail !== oldEmail) {
      var dup = findUser_(newEmail);
      if (dup && String(dup.email).toLowerCase() !== oldEmail) throw new Error('Email đã tồn tại');
      setCell_(sh, u._row, 'email', newEmail);
      renameEmail_(oldEmail, newEmail);            // cập nhật mọi tham chiếu email ở các sheet khác
      result.emailChanged = true;
      result.self = (oldEmail === me.email);       // đổi email của chính mình → cần đăng nhập lại
    }
  }
  return result;
}

/** Đổi email cũ → mới ở mọi nơi tham chiếu (giữ liên kết task/lương/lịch/kênh). */
function renameEmail_(oldE, newE) {
  oldE = String(oldE).toLowerCase(); newE = String(newE).toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // các cột chứa đúng 1 email (ContentPlan xử lý riêng vì có thể ở file khác)
  var single = { Tasks: 'assignee', Shoots: 'assignee', Lives: 'host',
    Shifts: 'email', Policy: 'email', Inputs: 'email', AutoInputs: 'email', Payroll: 'email', Channels: 'email', ChannelStats: 'email' };
  var fixCol = function (sh, field) {
    if (!sh || sh.getLastRow() < 2) return;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], col = head.indexOf(field) + 1;
    if (!col) return;
    var rng = sh.getRange(2, col, sh.getLastRow() - 1, 1), vals = rng.getValues(), changed = false;
    for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).toLowerCase() === oldE) { vals[i][0] = newE; changed = true; }
    if (changed) rng.setValues(vals);
  };
  Object.keys(single).forEach(function (name) { fixCol(ss.getSheetByName(name), single[name]); });
  fixCol(planSheet_(), 'assignee');   // Content Plan (file riêng)
  // cột chứa danh sách email (Meetings.attendee_emails)
  var m = ss.getSheetByName('Meetings');
  if (m && m.getLastRow() >= 2) {
    var mh = m.getRange(1, 1, 1, m.getLastColumn()).getValues()[0], mc = mh.indexOf('attendee_emails') + 1;
    if (mc) {
      var mr = m.getRange(2, mc, m.getLastRow() - 1, 1), mv = mr.getValues(), ch = false;
      for (var j = 0; j < mv.length; j++) {
        var parts = String(mv[j][0]).split(/[,;]/).map(function (s) { return s.trim(); });
        var np = parts.map(function (s) { return s.toLowerCase() === oldE ? newE : s; });
        if (np.join(',') !== parts.join(',')) { mv[j][0] = np.filter(Boolean).join(', '); ch = true; }
      }
      if (ch) mr.setValues(mv);
    }
  }
}

function resetPassword_(me, p) {
  var u = findUser_(p.email); if (!u) throw new Error('Không tìm thấy user');
  var pw = String(p.password || '');
  if (pw.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
  writePassword_(usersSheet_(), u._row, pw);
  return { ok: true };
}

function deleteUser_(me, p) {
  var u = findUser_(p.email); if (!u) throw new Error('Không tìm thấy user');
  if (String(u.role).toLowerCase() === 'admin') throw new Error('Không thể xoá tài khoản Admin');
  if (String(u.email).toLowerCase() === me.email) throw new Error('Không thể tự xoá chính mình');
  usersSheet_().deleteRow(u._row);
  return { ok: true };
}

function adminCount_() {
  return readSheet_('Users').filter(function (u) { return String(u.role).toLowerCase() === 'admin' && String(u.active) !== 'false'; }).length;
}

/** Lưu ma trận quyền (mỗi role → caps). Admin luôn toàn quyền & khoá. */
function saveRoles_(me, p) {
  var roles = p.roles || [];
  if (!roles.length) throw new Error('Thiếu dữ liệu vai trò');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Roles');
  var valid = {}; ALL_CAPS.forEach(function (c) { valid[c] = 1; });
  var rows = roles.map(function (r) {
    var role = String(r.role || '').trim().toLowerCase();
    var caps = (r.caps || []).filter(function (c) { return valid[c]; });
    var locked = role === 'admin';
    if (locked) caps = ALL_CAPS.slice();
    return [role, String(r.label || role), caps.join(','), locked];
  }).filter(function (r) { return r[0]; });
  if (!rows.some(function (r) { return r[0] === 'admin'; })) rows.unshift(['admin', 'Quản trị viên', ALL_CAPS.join(','), true]);
  sh.getRange(2, 1, sh.getMaxRows() - 1, SHEETS.Roles.length).clearContent();
  sh.getRange(2, 1, rows.length, SHEETS.Roles.length).setValues(rows);
  return { ok: true };
}

function auth_(token) {
  if (!token) throw new Error('Chưa đăng nhập');
  var email;
  if (String(token).indexOf('pw.') === 0) email = readSession_(token);
  else if (CONFIG.AUTH_MODE === 'password') throw new Error('Đăng nhập lại');
  else email = googleEmail_(token);
  var user = readSheet_('Users').filter(function (u) { return String(u.email).toLowerCase() === email && String(u.active) !== 'false'; })[0];
  if (!user) throw new Error('Tài khoản chưa được cấp quyền (' + email + '). Liên hệ Admin.');
  user.email = email;
  user.role = String(user.role || 'staff').toLowerCase();
  user.caps = user.role === 'admin' ? ALL_CAPS.slice() : capsOf_(user.role);
  user.isAdmin = user.role === 'admin';
  user.isLeader = user.isAdmin || user.role === 'leader' || can_(user, 'plan.manage'); // tương thích code cũ
  delete user.password_hash; delete user.salt; delete user.temp_password;
  return user;
}
function googleEmail_(token) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('tok_' + token.slice(-40));
  var email;
  if (cached) { email = cached; }
  else {
    var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Token không hợp lệ');
    var info = JSON.parse(res.getContentText());
    if (CONFIG.CLIENT_ID && info.aud !== CONFIG.CLIENT_ID) throw new Error('Sai ứng dụng');
    if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Email chưa xác minh');
    email = String(info.email).toLowerCase();
    cache.put('tok_' + token.slice(-40), email, 1800);
  }
  if (CONFIG.ALLOWED_DOMAIN && email.split('@')[1] !== CONFIG.ALLOWED_DOMAIN) throw new Error('Email ngoài tổ chức');
  return email;
}

// ===== DATA =====
function readSheet_(name) {
  var sh = (name === 'ContentPlan') ? planSheet_() : SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getDataRange().getValues();
  var head = vals.shift();
  return vals.map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j] instanceof Date ? Utilities.formatDate(r[j], CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm') : r[j]; });
    o._empty = r.join('') === '';
    return o;
  }).filter(function (o) { return !o._empty; });
}

// ===== CONTENT PLAN Ở FILE GOOGLE SHEET RIÊNG =====
// Điền ID Google Sheet riêng cho Content Plan (hoặc chạy setupContentPlanSheet để tạo tự động).
// Để trống = ContentPlan nằm chung file backend.
var CONTENT_PLAN_SS_ID = '';
function planSSId_() { return PropertiesService.getScriptProperties().getProperty('CONTENT_PLAN_SS_ID') || CONTENT_PLAN_SS_ID || ''; }
/** Spreadsheet chứa Content Plan (file riêng nếu đã cấu hình, ngược lại dùng file backend). */
function planSS_() {
  var id = planSSId_();
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  return SpreadsheetApp.getActiveSpreadsheet();
}
/** Tab ContentPlan trong file riêng — tự tạo header nếu chưa có. */
function planSheet_() {
  var ss = planSS_(), sh = ss.getSheetByName('ContentPlan');
  if (!sh) {
    sh = ss.insertSheet('ContentPlan');
    sh.getRange(1, 1, 1, SHEETS.ContentPlan.length).setValues([SHEETS.ContentPlan]).setFontWeight('bold').setBackground('#F3EEFF');
    sh.setFrozenRows(1);
  }
  return sh;
}
/** Tạo 1 Google Sheet RIÊNG cho Content Plan, lưu ID vào ScriptProperties, copy dữ liệu hiện có sang. Chạy 1 lần. */
function setupContentPlanSheet() {
  var ps = PropertiesService.getScriptProperties();
  var existing = planSSId_();
  var ss;
  if (existing) { try { ss = SpreadsheetApp.openById(existing); } catch (e) {} }
  if (!ss) {
    ss = SpreadsheetApp.create('phwng — Content Plan');
    ps.setProperty('CONTENT_PLAN_SS_ID', ss.getId());
  }
  // header
  var sh = ss.getSheetByName('ContentPlan') || ss.insertSheet('ContentPlan');
  sh.getRange(1, 1, 1, SHEETS.ContentPlan.length).setValues([SHEETS.ContentPlan]).setFontWeight('bold').setBackground('#F3EEFF');
  sh.setFrozenRows(1);
  // copy dữ liệu ContentPlan hiện có trong file backend (nếu có) sang, rồi xoá tab cũ để tránh nhầm
  var old = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ContentPlan');
  if (old && old.getParent().getId() !== ss.getId() && old.getLastRow() > 1 && sh.getLastRow() <= 1) {
    var data = old.getRange(2, 1, old.getLastRow() - 1, SHEETS.ContentPlan.length).getValues();
    sh.getRange(2, 1, data.length, SHEETS.ContentPlan.length).setValues(data);
  }
  var s1 = ss.getSheetByName('Sheet1'); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  var url = ss.getUrl();
  Logger.log('Content Plan sheet riêng: ' + url);
  try { SpreadsheetApp.getUi().alert('Đã tạo/kết nối Google Sheet riêng cho Content Plan.\n\nMở để quản lý & check:\n' + url + '\n\nHãy chia sẻ (Share) quyền xem cho team.'); } catch (e) {}
  return url;
}
function onlyMine_(rows, me, field) {
  if (me.isLeader) return rows;
  return rows.filter(function (r) { return String(r[field]).toLowerCase() === me.email; });
}
/** Lọc theo quyền xem-cả-team: có cap → thấy hết, không thì chỉ của mình. */
function scoped_(rows, me, field, cap) {
  if (can_(me, cap)) return rows;
  return rows.filter(function (r) { return String(r[field]).toLowerCase() === me.email; });
}
function publicUser_(u) {
  return { email: String(u.email).toLowerCase(), name: u.name, initials: u.initials, position: u.position, color: u.color, role: String(u.role || 'staff').toLowerCase() };
}

function bootstrap_(me) {
  var users = readSheet_('Users').filter(function (u) { return String(u.active) !== 'false'; }).map(publicUser_);
  var tasks = readSheet_('Tasks');
  var shifts = readSheet_('Shifts');
  var latestWeek = shifts.reduce(function (m, s) { return String(s.week) > m ? String(s.week) : m; }, '');
  var payroll = readSheet_('Payroll');
  var latestMonth = payroll.reduce(function (m, s) { return String(s.month) > m ? String(s.month) : m; }, '');
  var mePub = publicUser_(me); mePub.caps = me.caps; mePub.isAdmin = me.isAdmin;
  var planView = can_(me, 'plan.view');
  return {
    me: mePub,
    users: users,
    tasks: scoped_(tasks, me, 'assignee', 'checklist.viewAll'),
    contentPlan: planView ? readSheet_('ContentPlan') : [],
    shoots: planView ? readSheet_('Shoots') : [],
    lives: planView ? readSheet_('Lives') : [],
    meetings: planView ? readSheet_('Meetings') : [],
    shifts: scoped_(shifts.filter(function (s) { return String(s.week) === latestWeek; }), me, 'email', 'shifts.viewAll'),
    shiftsWeek: latestWeek,
    payroll: scoped_(payroll.filter(function (s) { return String(s.month) === latestMonth; }), me, 'email', 'payroll.viewAll').map(function (r) {
      var b = [], ki = []; try { b = JSON.parse(r.breakdown || '[]'); } catch (e) {} try { ki = JSON.parse(r.kpi_items || '[]'); } catch (e) {}
      return { month: r.month, email: r.email, base: r.base, fees: r.fees, bonus: r.bonus, penalty: r.penalty, total: r.total, kpi_ok: String(r.kpi_ok) !== 'false',
        kpi: { met: Number(r.kpi_met) || 0, total: Number(r.kpi_total) || 0, rate: r.kpi_rate === '' ? 100 : Number(r.kpi_rate), items: ki }, breakdown: b };
    }),
    payrollMonth: latestMonth,
    autoInputs: scoped_(autoInputsRows_(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM')), me, 'email', 'payroll.viewAll'),
    currentMonth: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM'),
    inputLabels: INPUT_LABELS,
    serverTime: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm')
  };
}

// ===== AUTO INPUTS (Tasks / Lives / Shoots / Pancake → số liệu tháng) =====
function monthOf_(v) { var s = String(v || ''); return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : ''; }
function isTrue_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }

/** Trả về [{email, key: value…}] cho tháng — gộp mọi nguồn tự động. */
function autoInputsRows_(month) {
  var acc = {};
  var add = function (email, key, qty) {
    email = String(email || '').toLowerCase(); if (!email || !key) return;
    if (INPUT_KEYS.indexOf(key) < 0) return;
    acc[email] = acc[email] || { email: email };
    acc[email][key] = (acc[email][key] || 0) + (Number(qty) || 1);
  };
  // 1) Tasks hoàn thành trong tháng có kpi_key
  readSheet_('Tasks').forEach(function (t) {
    if (t.status === 'done' && monthOf_(t.done_at) === month && t.kpi_key) add(t.assignee, t.kpi_key, t.qty || 1);
  });
  // 2) Lives đã live (done = TRUE) trong tháng → theo loại + tổng buổi
  readSheet_('Lives').forEach(function (l) {
    if (isTrue_(l.done) && monthOf_(l.date) === month) { if (l.kpi_key && !l.task_ids) add(l.host, l.kpi_key, 1); add(l.host, 'live_total', 1); }
  });
  // 3) Shoots đã quay (done = TRUE) trong tháng
  readSheet_('Shoots').forEach(function (s) {
    if (isTrue_(s.done) && monthOf_(s.date) === month && s.kpi_key && !s.task_ids) add(s.assignee, s.kpi_key, s.qty || 1);
  });
  // 4) Pancake → ChannelStats (slot 1 = kênh chính, slot 2 = kênh 2)
  readSheet_('ChannelStats').forEach(function (c) {
    if (String(c.month) !== month) return;
    var sfx = String(c.slot) === '2' ? '_2' : '';
    ['videos', 'views', 'followers'].forEach(function (k) { if (c[k] !== '' && c[k] != null) add(c.email, k + sfx, Number(c[k]) || 0); });
  });
  return Object.keys(acc).map(function (e) { return acc[e]; });
}

/** Ghi tab AutoInputs cho tháng (để Leader đối chiếu) và trả về map email → inputs đã gộp (manual ưu tiên nếu có nhập). */
function buildInputs_(month) {
  var auto = autoInputsRows_(month), autoMap = {};
  auto.forEach(function (r) { autoMap[r.email] = r; });
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('AutoInputs');
  if (sh) {
    var head = ['month', 'email'].concat(INPUT_KEYS);
    if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#F3EEFF'); sh.setFrozenRows(1); }
    readSheet_('AutoInputs').filter(function (r) { return String(r.month) === month; }).sort(function (a, b) { return b._row - a._row; }).forEach(function (r) { sh.deleteRow(r._row); });
    if (auto.length) sh.getRange(sh.getLastRow() + 1, 1, auto.length, head.length).setValues(auto.map(function (r) { return head.map(function (h) { return h === 'month' ? month : h === 'email' ? r.email : (r[h] || ''); }); }));
  }
  var manual = {};
  readSheet_('Inputs').filter(function (r) { return String(r.month) === month; }).forEach(function (r) { manual[String(r.email).toLowerCase()] = r; });
  var merged = {};
  Object.keys(autoMap).concat(Object.keys(manual)).forEach(function (email) {
    var m = manual[email] || {}, a = autoMap[email] || {}, out = {};
    INPUT_KEYS.forEach(function (k) { out[k] = (m[k] !== '' && m[k] != null) ? m[k] : (a[k] || 0); });
    merged[email] = out;
  });
  return merged;
}

function updateTask_(me, p) {
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
    var rows = readSheet_('Tasks');
    var t = rows.filter(function (r) { return r.id === p.id; })[0];
    if (!t) throw new Error('Không tìm thấy task');
    if (!me.isLeader && String(t.assignee).toLowerCase() !== me.email) throw new Error('Không có quyền');
    var head = SHEETS.Tasks;
    if (p.status) {
      sh.getRange(t._row, head.indexOf('status') + 1).setValue(p.status);
      sh.getRange(t._row, head.indexOf('done_at') + 1).setValue(p.status === 'done' ? new Date() : '');
    }
    sh.getRange(t._row, head.indexOf('updated_at') + 1).setValue(new Date());
    return { id: p.id, status: p.status };
  } finally { lock.releaseLock(); }
}

function createTask_(me, p) {
  if (!p.title) throw new Error('Thiếu tiêu đề');
  var assignee = me.isLeader && p.assignee ? String(p.assignee).toLowerCase() : me.email;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  var id = 'T' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MMddHHmmss');
  var now = new Date();
  var kpi = INPUT_KEYS.indexOf(p.kpi_key) >= 0 ? p.kpi_key : '';
  sh.appendRow([id, p.title, assignee, p.due || '', p.priority || 'Vừa', 'todo', now, now, kpi, Number(p.qty) || 1, '', p.schedule_id || '', p.due_date || '']);
  return { id: id, kpi_key: kpi, qty: Number(p.qty) || 1 };
}

// ===== CONTENT PLAN (nhập/sửa trực tiếp trên web → ghi Sheet) =====
var PLAN_STATUSES = ['Chưa thực hiện', 'Đang thực hiện', 'Đã đăng', 'Dời'];
/** Chuẩn hoá trạng thái về 1 trong 4 giá trị chuẩn của team. */
function normStatus_(s) {
  var t = String(s || '').trim().toLowerCase();
  if (!t) return 'Chưa thực hiện';
  if (/đã\s*đăng|hoàn thành|xong|done|published/.test(t)) return 'Đã đăng';
  if (/đang|doing|in progress|thực hiện$/.test(t) && !/chưa/.test(t)) return 'Đang thực hiện';
  if (/dời|hoãn|delay|postpone/.test(t)) return 'Dời';
  if (/chưa|to ?do|nháp|draft|mới/.test(t)) return 'Chưa thực hiện';
  return 'Chưa thực hiện';
}
/** Chuẩn hoá ngày về YYYY-MM-DD (rỗng nếu không parse được). */
function normDate_(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var s = String(v).trim(); if (!s) return '';
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/.exec(s);   // dd/mm(/yyyy)
  if (m) { var y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(new Date().getFullYear());
    return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
  return '';
}
function createPlan_(me, p) {
  if (!p.pillar && !p.key) throw new Error('Nhập ít nhất Content Pillar hoặc Key');
  var sh = planSheet_();
  var id = 'C' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var post = normDate_(p.post_date);
  var month = String(p.month || '').slice(0, 7) || (post ? post.slice(0, 7) : Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM'));
  sh.appendRow([id, p.channel || '', month, p.pillar || '', p.key || '', normDate_(p.demo_date), post,
    normStatus_(p.status), p.message || '', String(p.assignee || '').toLowerCase()]);
  return { id: id };
}
function updatePlan_(me, p) {
  var sh = planSheet_(), head = SHEETS.ContentPlan;
  var r = readSheet_('ContentPlan').filter(function (x) { return String(x.id) === String(p.id); })[0];
  if (!r) throw new Error('Không tìm thấy nội dung');
  var set = function (f, v) { sh.getRange(r._row, head.indexOf(f) + 1).setValue(v); };
  ['channel', 'pillar', 'key', 'message'].forEach(function (f) { if (p[f] !== undefined) set(f, p[f]); });
  if (p.month !== undefined) set('month', String(p.month).slice(0, 7));
  if (p.demo_date !== undefined) set('demo_date', normDate_(p.demo_date));
  if (p.post_date !== undefined) {
    var post = normDate_(p.post_date); set('post_date', post);
    if (p.month === undefined && post) set('month', post.slice(0, 7));
  }
  if (p.status !== undefined) set('status', normStatus_(p.status));
  if (p.assignee !== undefined) set('assignee', String(p.assignee).toLowerCase());
  return { ok: true };
}
function deletePlan_(me, p) {
  var sh = planSheet_();
  var r = readSheet_('ContentPlan').filter(function (x) { return String(x.id) === String(p.id); })[0];
  if (!r) throw new Error('Không tìm thấy nội dung');
  sh.deleteRow(r._row);
  return { ok: true };
}

// ===== IMPORT CONTENT PLAN từ workbook Google Sheet cũ của team =====
// ID workbook cũ (tab: 0.THỜI TIẾT SAPA, 1.CÔN ĐẢO, 1.HOTEL, 2.THỜI TIẾT ĐN, 3.LA CÀ ĐN, ...).
var OLD_PLAN_SOURCE_ID = '1YUbZ55SxO_x6TO0uLhuYhk0ZKQnGrRjfx1ADk7gtO3w';
// Tên tab (đã bỏ số & khoảng trắng, viết thường) → tên kênh lưu trong app + email phụ trách mặc định.
var OLD_PLAN_CHANNELS = {
  'thoitietsapa':  { channel: 'Thời tiết Sapa',    assignee: 'phat@phwng.online' },
  'condao':        { channel: 'Côn Đảo',           assignee: 'ngan@phwng.online' },
  'hotel':         { channel: 'Hotel in Đà Nẵng',  assignee: 'thu@phwng.online' },
  'thoitietdn':    { channel: 'Thời tiết Đà Nẵng', assignee: 'phat@phwng.online' },
  'lacadn':        { channel: 'La cà Đà Nẵng',     assignee: 'thu@phwng.online' },
  'acdanang':      { channel: 'AC Đà Nẵng',        assignee: '' },
  'fanpage':       { channel: 'Fanpage Loca',      assignee: 'hien@phwng.online' },
  'locatravel':    { channel: 'Loca Travel',       assignee: 'thu@phwng.online' },
  'lichtrinhtour': { channel: 'Lịch trình tour',   assignee: '' }
};
function normName_(s) {
  return String(s || '').toLowerCase()
    .replace(/^[\s\d.\-]+/, '')                 // bỏ tiền tố "2. "
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // bỏ dấu
    .replace(/[đĐ]/g, 'd').replace(/[^a-z0-9]/g, '');
}
function planTabInfo_(sheetName) {
  var k = normName_(sheetName);
  if (OLD_PLAN_CHANNELS[k]) return OLD_PLAN_CHANNELS[k];
  // dò gần đúng theo từ khoá
  for (var key in OLD_PLAN_CHANNELS) if (k.indexOf(key) >= 0 || key.indexOf(k) >= 0) return OLD_PLAN_CHANNELS[key];
  return null;
}
/** Một dòng có phải tiêu đề content-plan không (có 'key' + ('thông điệp'|'content pillar'|'trạng thái')). */
function isPlanHeaderRow_(low) {
  var hasKey = low.some(function (c) { return c === 'key' || c.indexOf('key') >= 0; });
  var other = low.some(function (c) {
    return c.indexOf('thông điệp') >= 0 || c.indexOf('thong diep') >= 0 || c.indexOf('pillar') >= 0 ||
      c.indexOf('trạng thái') >= 0 || c.indexOf('trang thai') >= 0;
  });
  return hasKey && other;
}
/** Map cột từ 1 dòng tiêu đề (đã lowercase). Hỗ trợ cả layout đầy đủ lẫn layout gọn (Khách sạn/Địa điểm · Key · Thông điệp). */
function mapPlanCols_(low) {
  var cols = {}, keyIdx = -1;
  for (var j = 0; j < low.length; j++) { if (low[j] === 'key') { keyIdx = j; break; } }
  if (keyIdx < 0) for (var j2 = 0; j2 < low.length; j2++) { if (low[j2].indexOf('key') >= 0) { keyIdx = j2; break; } }
  low.forEach(function (c, j) {
    if (cols.pillar == null && c.indexOf('pillar') >= 0) cols.pillar = j;
    else if (cols.demo == null && c.indexOf('demo') >= 0) cols.demo = j;
    else if (cols.post == null && (c.indexOf('ngày đăng') >= 0 || c.indexOf('ngay dang') >= 0)) cols.post = j;
    else if (cols.status == null && (c.indexOf('trạng thái') >= 0 || c.indexOf('trang thai') >= 0)) cols.status = j;
    else if (cols.message == null && (c.indexOf('thông điệp') >= 0 || c.indexOf('thong diep') >= 0)) cols.message = j;
    else if (cols.month == null && (c.indexOf('tháng') >= 0 || c.indexOf('thang') >= 0 || c.indexOf('stt') >= 0)) cols.month = j;
  });
  cols.key = keyIdx >= 0 ? keyIdx : null;
  // pillar dự phòng: cột danh mục ngay trước Key (VD "Khách sạn"/"Địa điểm") nếu chưa có "Content Pillar"
  if (cols.pillar == null && keyIdx > 0) { var p = keyIdx - 1; if (p !== cols.month) cols.pillar = p; }
  return cols;
}
function monthFromCell_(v, lastYear) {
  var s = String(v || '').trim(); if (!s) return '';
  var d = normDate_(s); if (d) return d.slice(0, 7);
  // chỉ nhận khi có chữ "tháng"/"thang" — KHÔNG coi số STT trơ (1,2,3…) là tháng
  var m = /th[aá]ng\s*(\d{1,2})/i.exec(s.toLowerCase());
  if (m) { var mo = Number(m[1]); if (mo >= 1 && mo <= 12) return (lastYear || new Date().getFullYear()) + '-' + ('0' + mo).slice(-2); }
  return '';
}
/** Đọc 1 tab kênh → mảng bản ghi ContentPlan. Nhận diện lại cột ở MỖI dòng tiêu đề (tab có nhiều section, layout đổi). */
function readOldPlanTab_(sheet, info) {
  if (sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var out = [], cols = null, curMonth = '', lastYear = new Date().getFullYear();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var low = row.map(function (x) { return String(x == null ? '' : x).toLowerCase().trim(); });
    if (isPlanHeaderRow_(low)) {                          // dòng tiêu đề (kể cả tiêu đề lặp giữa tab)
      cols = mapPlanCols_(low);
      var mh = monthFromCell_(low[cols.month != null ? cols.month : 0], lastYear);
      if (mh) curMonth = mh;
      continue;
    }
    if (!cols) continue;                                  // chưa gặp tiêu đề nào
    if (cols.post != null) { var dp = normDate_(row[cols.post]); if (dp) lastYear = Number(dp.slice(0, 4)); }
    if (cols.demo != null) { var dd = normDate_(row[cols.demo]); if (dd) lastYear = Number(dd.slice(0, 4)); }
    if (cols.month != null) { var mc = monthFromCell_(row[cols.month], lastYear); if (mc) curMonth = mc; }
    var pillar = cols.pillar != null ? String(row[cols.pillar] || '').trim() : '';
    var key = cols.key != null ? String(row[cols.key] || '').trim() : '';
    if (!pillar && !key) continue;                        // dòng trống / phân cách
    if (String(key).toLowerCase() === 'key') continue;    // an toàn: bỏ dòng tiêu đề lọt lưới
    var post = cols.post != null ? normDate_(row[cols.post]) : '';
    var demo = cols.demo != null ? normDate_(row[cols.demo]) : '';
    var month = (post ? post.slice(0, 7) : (demo ? demo.slice(0, 7) : curMonth)) || curMonth;
    out.push([info.channel, month, pillar, key, demo, post,
      normStatus_(cols.status != null ? row[cols.status] : ''),
      cols.message != null ? String(row[cols.message] || '').trim() : '', info.assignee]);
  }
  return out;
}
/** XEM THỬ cấu trúc (không ghi gì): log số dòng nhận được mỗi tab. Chạy hàm này trước khi import. */
function previewOldPlan() {
  var src = SpreadsheetApp.openById(OLD_PLAN_SOURCE_ID);
  var total = 0, lines = [];
  src.getSheets().forEach(function (sh) {
    var info = planTabInfo_(sh.getName());
    if (!info) { lines.push('— bỏ qua: "' + sh.getName() + '"'); return; }
    var rows = readOldPlanTab_(sh, info);
    total += rows.length;
    lines.push('✓ "' + sh.getName() + '" → kênh "' + info.channel + '": ' + rows.length + ' dòng' + (rows[0] ? ' | vd: ' + rows[0][2] : ''));
  });
  Logger.log('XEM THỬ IMPORT CONTENT PLAN — tổng ' + total + ' dòng:\n' + lines.join('\n'));
  return total;
}
/** IMPORT: đọc workbook cũ → ghi vào tab ContentPlan. replace=true (mặc định) xoá dữ liệu cũ trước. */
function importOldContentPlan(replace) {
  if (replace === undefined) replace = true;
  var sh = planSheet_();   // ghi vào file Content Plan riêng (nếu đã cấu hình)
  // đảm bảo header đúng schema mới
  sh.getRange(1, 1, 1, SHEETS.ContentPlan.length).setValues([SHEETS.ContentPlan]).setFontWeight('bold').setBackground('#F3EEFF');
  sh.setFrozenRows(1);
  if (replace && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  var src = SpreadsheetApp.openById(OLD_PLAN_SOURCE_ID);
  var all = [], stamp = Date.now(), seq = 0;
  src.getSheets().forEach(function (s) {
    var info = planTabInfo_(s.getName()); if (!info) return;
    readOldPlanTab_(s, info).forEach(function (r) { all.push(['C' + stamp.toString(36) + (seq++)].concat(r)); });
  });
  if (all.length) sh.getRange(sh.getLastRow() + 1, 1, all.length, SHEETS.ContentPlan.length).setValues(all);
  Logger.log('Đã import ' + all.length + ' dòng content plan từ workbook cũ.');
  try { SpreadsheetApp.getUi().alert('Đã import ' + all.length + ' dòng Content Plan từ Sheet cũ vào app. Mở phwng.online để kiểm tra.'); } catch (e) {}
  return all.length;
}

// ===== LỊCH LÀM VIỆC (nhân sự tự thêm/sửa ca của mình) =====
function upsertShift_(me, p) {
  var email = String(p.email || me.email).toLowerCase();
  if (email !== me.email) need_(me, 'shifts.manage');
  var week = String(p.week || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('Thiếu tuần (YYYY-MM-DD, thứ Hai đầu tuần)');
  var days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Shifts'), head = SHEETS.Shifts;
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var row = readSheet_('Shifts').filter(function (x) { return String(x.week).slice(0, 10) === week && String(x.email).toLowerCase() === email; })[0];
    var vals = head.map(function (h) {
      if (h === 'week') return week; if (h === 'email') return email;
      return p[h] !== undefined ? String(p[h]) : (row ? row[h] : '');
    });
    if (row) sh.getRange(row._row, 1, 1, head.length).setValues([vals]);
    else sh.appendRow(vals);
    return { ok: true, week: week, email: email };
  } finally { lock.releaseLock(); }
}

// ===== LỊCH QUAY / LIVESTREAM từ web (Leader) → Sheet + Calendar + Email + Task cho từng người =====
var DAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
function dayLabel_(dateStr) { var d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00'); return isNaN(d.getTime()) ? '' : DAY_VI[d.getDay()]; }
function fmtDateVi_(dateStr) { var p = String(dateStr).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : dateStr; }

function createSchedule_(me, p) {
  if (!me.isLeader) throw new Error('Chỉ Leader được tạo lịch quay/live');
  var type = p.type === 'live' ? 'live' : 'shoot';
  if (!p.title || !p.date || !p.time) throw new Error('Thiếu tiêu đề / ngày / giờ');
  var users = readSheet_('Users').filter(function (u) { return String(u.active) !== 'false'; });
  var valid = users.map(function (u) { return String(u.email).toLowerCase(); });
  var people = String(p.people || '').toLowerCase().split(/[,;\s]+/).filter(function (e) { return valid.indexOf(e) >= 0; });
  if (!people.length) throw new Error('Chọn ít nhất 1 nhân sự');
  var lead = String(p.lead || people[0]).toLowerCase(); if (people.indexOf(lead) < 0) lead = people[0];
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = type === 'live' ? 'Lives' : 'Shoots', sh = ss.getSheetByName(sheetName);
  var id = (type === 'live' ? 'L' : 'S') + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MMddHHmmss');
  var kpi = INPUT_KEYS.indexOf(p.kpi_key) >= 0 ? p.kpi_key : '', qty = Number(p.qty) || 1;
  // 1) Task cho từng người (KPI tính qua task khi bấm Xong)
  var tsh = ss.getSheetByName('Tasks'), now = new Date(), taskIds = [];
  people.forEach(function (email) {
    var tid = 'T' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    var title = (type === 'live' ? '🔴 Live: ' : '🎬 Quay: ') + p.title + (p.location ? ' · ' + p.location : '');
    tsh.appendRow([tid, title, email, fmtDateVi_(p.date) + ' ' + String(p.time).slice(0, 5), 'Cao', 'todo', now, now, (email === lead ? kpi : ''), (email === lead ? qty : 1), '', id, String(p.date).slice(0, 10)]);
    taskIds.push(tid);
  });
  // 2) Dòng lịch
  var row = type === 'live'
    ? [id, dayLabel_(p.date), String(p.time).slice(0, 5), p.title, p.location || '', lead, 'Đã lên lịch', String(p.date).slice(0, 10), kpi, false, '', p.brief || '', people.join(', '), taskIds.join(','), me.email]
    : [id, dayLabel_(p.date), String(p.time).slice(0, 5), p.title, p.location || '', lead, 'Đã lên lịch', String(p.date).slice(0, 10), kpi, qty, false, '', p.brief || '', people.join(', '), taskIds.join(','), me.email];
  sh.appendRow(row);
  // 3) Google Calendar (mời tất cả) + 4) Email thông báo
  var calOk = false, mailOk = false, err = '';
  try { syncCalendar(); calOk = true; } catch (e) { err += 'Calendar: ' + e.message + '. '; }
  try {
    var subject = (type === 'live' ? '[Livestream] ' : '[Lịch quay] ') + p.title + ' — ' + fmtDateVi_(p.date) + ' ' + String(p.time).slice(0, 5);
    var body = htmlSchedule_(type, p, people, lead, me);
    MailApp.sendEmail({ to: people.join(','), subject: subject, htmlBody: body, name: 'phwng.online' });
    mailOk = true;
  } catch (e) { err += 'Email: ' + e.message + '. '; }
  return { id: id, task_ids: taskIds, calendar: calOk, mail: mailOk, warn: err };
}
function htmlSchedule_(type, p, people, lead, me) {
  var names = readSheet_('Users').filter(function (u) { return people.indexOf(String(u.email).toLowerCase()) >= 0; }).map(function (u) { return u.name; }).join(', ');
  var rows = [['Nội dung', p.title], ['Thời gian', fmtDateVi_(p.date) + ' · ' + String(p.time).slice(0, 5) + ' (' + dayLabel_(p.date) + ')'], ['Địa điểm', p.location || '—'], ['Có mặt', names], ['Phụ trách chính', userName_(lead)]];
  if (p.brief) rows.push(['Brief', String(p.brief).replace(/\n/g, '<br>')]);
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1E1B2E"><h2 style="color:#6D28D9;margin:0 0 12px">' + (type === 'live' ? '🔴 Lịch livestream mới' : '🎬 Lịch quay mới') + '</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' + rows.map(function (r) { return '<tr><td style="color:#6B6580;vertical-align:top;white-space:nowrap"><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' +
    '<p style="margin-top:14px">Việc đã được thêm vào <b>Checklist</b> của bạn trên phwng.online — làm xong nhớ bấm <b>Xong ✓</b> để tính KPI. Lịch cũng đã được mời vào Google Calendar.</p>' +
    '<p style="color:#6B6580;font-size:12px">Tạo bởi ' + me.name + ' · phwng.online</p></div>';
}
function userName_(email) { var u = readSheet_('Users').filter(function (x) { return String(x.email).toLowerCase() === email; })[0]; return u ? u.name : email; }

// ===== LỊCH HỌP từ web (mọi nhân sự) =====
function createMeeting_(me, p) {
  if (!p.title || !p.date || !p.time) throw new Error('Thiếu tiêu đề / ngày / giờ');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Meetings');
  var id = 'M' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MMddHHmmss');
  var emails = resolveEmails_(p.attendees || 'all');
  if (emails.indexOf(me.email) < 0) emails.push(me.email);
  var label = String(p.attendees || '').toLowerCase() === 'all' ? 'Cả team' : emails.map(function (e) { return userName_(e).split(' ').pop(); }).join(', ');
  sh.appendRow([id, p.title, dayLabel_(p.date), String(p.time).slice(0, 5), label, (Number(p.minutes) || 60) + ' phút', String(p.date).slice(0, 10), p.repeat === 'weekly' ? 'weekly' : '', emails.join(', '), '', me.email, p.note || '']);
  var calOk = false, mailOk = false, err = '';
  try { syncCalendar(); calOk = true; } catch (e) { err += 'Calendar: ' + e.message + '. '; }
  try {
    MailApp.sendEmail({ to: emails.join(','), subject: '[Họp] ' + p.title + ' — ' + fmtDateVi_(p.date) + ' ' + String(p.time).slice(0, 5), name: 'phwng.online',
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px"><h2 style="color:#6D28D9;margin:0 0 12px">🗓 Lịch họp mới</h2><p><b>' + p.title + '</b><br>' + fmtDateVi_(p.date) + ' · ' + String(p.time).slice(0, 5) + ' · ' + (Number(p.minutes) || 60) + ' phút' + (p.repeat === 'weekly' ? ' · lặp hằng tuần' : '') + '</p>' + (p.note ? '<p>' + String(p.note).replace(/\n/g, '<br>') + '</p>' : '') + '<p style="color:#6B6580;font-size:12px">Tạo bởi ' + me.name + ' · đã mời vào Google Calendar</p></div>' });
    mailOk = true;
  } catch (e) { err += 'Email: ' + e.message + '. '; }
  return { id: id, calendar: calOk, mail: mailOk, warn: err };
}

// ===== NHẮC LỊCH TRƯỚC 1 NGÀY (trigger 18:00 hằng ngày) =====
function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(18).create();
}
function sendReminders() {
  var tomorrow = Utilities.formatDate(new Date(Date.now() + 86400000), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var byEmail = {};
  var push = function (emails, line) { emails.forEach(function (e) { e = String(e).trim().toLowerCase(); if (!e) return; (byEmail[e] = byEmail[e] || []).push(line); }); };
  readSheet_('Shoots').forEach(function (r) { if (String(r.date).slice(0, 10) === tomorrow && !isTrue_(r.done)) push(String(r.attendees || r.assignee).split(/[,;]/), '🎬 ' + r.time + ' · Quay: ' + r.topic + (r.location ? ' · ' + r.location : '') + (r.brief ? '<br><span style="color:#6B6580">Brief: ' + String(r.brief).replace(/\n/g, ' ') + '</span>' : '')); });
  readSheet_('Lives').forEach(function (r) { if (String(r.date).slice(0, 10) === tomorrow && !isTrue_(r.done)) push(String(r.attendees || r.host).split(/[,;]/), '🔴 ' + r.time + ' · Live: ' + r.title + (r.location ? ' · ' + r.location : '')); });
  readSheet_('Meetings').forEach(function (r) {
    var d = String(r.date).slice(0, 10); if (!d) return;
    var hit = d === tomorrow || (String(r.repeat) === 'weekly' && d <= tomorrow && new Date(d + 'T00:00:00').getDay() === new Date(tomorrow + 'T00:00:00').getDay());
    if (hit) push(resolveEmails_(r.attendee_emails || r.attendees), '🗓 ' + r.time + ' · Họp: ' + r.title + ' (' + r.duration + ')');
  });
  readSheet_('Tasks').forEach(function (t) { if (String(t.due_date).slice(0, 10) === tomorrow && t.status !== 'done' && !t.schedule_id) push([t.assignee], '✅ Hạn task: ' + t.title); });
  var n = 0;
  Object.keys(byEmail).forEach(function (e) {
    MailApp.sendEmail({ to: e, subject: '[Nhắc lịch] Ngày mai ' + fmtDateVi_(tomorrow) + ' bạn có ' + byEmail[e].length + ' việc', name: 'phwng.online',
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px"><h2 style="color:#6D28D9;margin:0 0 12px">Lịch ngày mai — ' + fmtDateVi_(tomorrow) + '</h2><ul>' + byEmail[e].map(function (l) { return '<li style="margin-bottom:8px">' + l + '</li>'; }).join('') + '</ul><p style="color:#6B6580;font-size:12px">Xem chi tiết trên phwng.online</p></div>' });
    n++;
  });
  Logger.log('Đã gửi nhắc cho ' + n + ' người');
  return n;
}
