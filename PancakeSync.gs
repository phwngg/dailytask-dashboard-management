/**
 * phwng.online — Pancake connector (kéo số liệu kênh → tab ChannelStats → AutoInputs)
 * Endpoint theo tài liệu chính thức docs.pancake.vn/vi/developers/api-reference:
 *   GET  https://pages.fm/api/v1/pages?access_token=…                                  → danh sách page + id
 *   POST https://pages.fm/api/v1/pages/{page_id}/generate_page_access_token?access_token=… → page_access_token
 *   GET  https://pages.fm/api/public_api/v1/pages/{page_id}/statistics/pages?page_access_token=…&date_range=DD/MM/YYYY HH:MM:SS - DD/MM/YYYY HH:MM:SS
 *   GET  https://pages.fm/api/public_api/v1/pages/{page_id}/statistics/customers?…   (khách mới)
 *   GET  https://pages.fm/api/public_api/v1/pages/{page_id}/posts?page_access_token=…&since=…&until=…&page_number=1&page_size=100
 *
 * CÁCH DÙNG (chi tiết trong HUONG-DAN-DEPLOY.md mục "Kết nối Pancake"):
 *  1. Lấy Access Token: https://pages.fm/account → Nâng cao (Advanced) → Access Token → điền PANCAKE.TOKEN.
 *  2. Menu phwng → "Pancake: liệt kê page" → copy id vào tab Channels (cột page_id, platform = 'pancake').
 *  3. Menu phwng → "Test kết nối Pancake" → xem JSON thật → nếu cần sửa PANCAKE.MAP.
 *  4. Menu phwng → "Đồng bộ Pancake tháng này" hoặc chạy installPancakeTrigger() 1 lần.
 *
 * LƯU Ý: API công khai của Pancake có thống kê KHÁCH MỚI / SĐT / HỘI THOẠI và DANH SÁCH BÀI ĐĂNG;
 * KHÔNG có lượt xem video & follower TikTok → 2 cột đó lấy từ trang Chỉ số kênh (file xuất Pancake) hoặc nhập tay.
 */
var PANCAKE = {
  TOKEN: '',
  BASE: 'https://pages.fm/api',
  PAGES_URL:      '{base}/v1/pages?access_token={token}',
  PAGE_TOKEN_URL: '{base}/v1/pages/{page_id}/generate_page_access_token?access_token={token}',
  PAGE_TOKEN_PATH: 'page_access_token',
  STATS_URL:      '{base}/public_api/v1/pages/{page_id}/statistics/pages?page_access_token={page_token}&date_range={date_range}',
  POSTS_URL:      '{base}/public_api/v1/pages/{page_id}/posts?page_access_token={page_token}&since={since_ts}&until={until_ts}&page_number={page_number}&page_size=100',
  // Đường dẫn JSON → chỉ số (mảng theo ngày sẽ tự cộng dồn). Sửa sau khi xem log "Test kết nối Pancake".
  MAP: {
    videos:    '',                        // '' = đếm số bài đăng qua POSTS_URL (khuyên dùng)
    views:     '',                        // Pancake API không có view video → để '' (lấy từ Chỉ số kênh / nhập tay)
    followers: '',                        // Pancake API không có follower → để ''
    new_customers: 'data.new_customer_count',   // tham khảo — đổi theo JSON thật
    phones:        'data.phone_number_count',
    conversations: 'data.new_inbox_count'
  },
  DATE_FMT: 'dd/MM/yyyy HH:mm:ss'
};

function pancakeSyncNow() {
  var month = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
  var n = pancakeSyncMonth(month);
  try { SpreadsheetApp.getUi().alert('Đã đồng bộ Pancake tháng ' + month + ': ' + n + ' kênh. Xem tab ChannelStats.'); } catch (e) {}
}
/** Cài trigger chạy mỗi ngày 06:00 (chạy 1 lần). */
function installPancakeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'pancakeSyncNow') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('pancakeSyncNow').timeBased().everyDays(1).atHour(6).create();
}
/** Liệt kê page trong tài khoản Pancake → in log + alert để copy page_id vào tab Channels. */
function pancakeListPages() {
  if (!PANCAKE.TOKEN) throw new Error('Chưa điền PANCAKE.TOKEN');
  var res = UrlFetchApp.fetch(fill_(PANCAKE.PAGES_URL.replace('{base}', PANCAKE.BASE), { token: PANCAKE.TOKEN }), { muteHttpExceptions: true });
  var text = res.getContentText(), lines = [];
  try {
    var j = JSON.parse(text), arr = j.categorized && j.categorized.activated ? j.categorized.activated : (j.pages || j.data || []);
    arr.forEach(function (pg) { lines.push((pg.id || pg.page_id) + '  |  ' + (pg.name || '') + '  |  ' + (pg.platform || '')); });
  } catch (e) {}
  var out = lines.length ? lines.join('\n') : text.slice(0, 2000);
  Logger.log('HTTP ' + res.getResponseCode() + '\n' + out);
  try { SpreadsheetApp.getUi().alert('Page trong Pancake (id | tên | nền tảng):\n\n' + out); } catch (e) {}
}
/** In raw JSON thống kê + bài đăng của kênh đầu tiên để dò tên trường. */
function pancakeTest() {
  var ch = readSheet_('Channels').filter(function (c) { return String(c.platform).toLowerCase() !== 'hub' && c.page_id; })[0];
  if (!ch) throw new Error('Tab Channels chưa có dòng platform=pancake với page_id');
  var range = monthRange_(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM'));
  var raw = pancakeFetchRaw_(ch, range);
  Logger.log('STATS URL: ' + raw.url + '\nHTTP ' + raw.code + '\n' + raw.text.slice(0, 4000));
  var posts = pancakeFetchPosts_(ch, range, 1);
  Logger.log('POSTS HTTP ' + posts.code + '\n' + posts.text.slice(0, 3000));
  try { SpreadsheetApp.getUi().alert('STATS HTTP ' + raw.code + '\n' + raw.text.slice(0, 1200) + '\n\nPOSTS HTTP ' + posts.code + '\n' + posts.text.slice(0, 800) + '\n\n(Đầy đủ: Apps Script → Executions)'); } catch (e) {}
}

function pancakeSyncMonth(month) {
  if (!PANCAKE.TOKEN) throw new Error('Chưa điền PANCAKE.TOKEN');
  var channels = readSheet_('Channels').filter(function (c) { return c.page_id && String(c.platform).toLowerCase() !== 'hub'; });
  var range = monthRange_(month);
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('ChannelStats');
  var head = SHEETS.ChannelStats, existing = readSheet_('ChannelStats'), out = 0;
  channels.forEach(function (ch) {
    var raw = pancakeFetchRaw_(ch, range), json = null;
    if (raw.code === 200) { try { json = JSON.parse(raw.text); } catch (e) {} }
    var videos = PANCAKE.MAP.videos ? pickSum_(json, PANCAKE.MAP.videos) : pancakeCountPosts_(ch, range);
    var views = PANCAKE.MAP.views && json ? pickSum_(json, PANCAKE.MAP.views) : '';
    var followers = PANCAKE.MAP.followers && json ? pickSum_(json, PANCAKE.MAP.followers) : '';
    var old = existing.filter(function (r) { return String(r.month) === month && String(r.email).toLowerCase() === String(ch.email).toLowerCase() && String(r.slot) === String(ch.slot || 1); })[0];
    // giữ view/follower cũ (từ Hub hoặc nhập tay) nếu Pancake không trả
    if (old) { if (views === '') views = old.views; if (followers === '') followers = old.followers; }
    var row = [month, String(ch.email).toLowerCase(), String(ch.slot || 1), videos, views, followers, new Date(), 'pancake'];
    if (old) sh.getRange(old._row, 1, 1, head.length).setValues([row]); else sh.appendRow(row);
    out++;
  });
  return out;
}
function pancakeFetchPosts_(ch, range, pageNumber) {
  var vars = pancakeVars_(ch, range); vars.page_number = pageNumber;
  var url = fill_(PANCAKE.POSTS_URL.replace('{base}', PANCAKE.BASE), vars);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return { url: url, code: res.getResponseCode(), text: res.getContentText() };
}
function pancakeCountPosts_(ch, range) {
  var total = 0;
  for (var pn = 1; pn <= 20; pn++) {
    var r = pancakeFetchPosts_(ch, range, pn); if (r.code !== 200) break;
    var j; try { j = JSON.parse(r.text); } catch (e) { break; }
    var arr = j.posts || j.data || [];
    total += arr.length; if (arr.length < 100) break;
  }
  return total;
}
// ---- helpers ----
function monthRange_(month) {
  var y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
  var since = new Date(y, m - 1, 1), until = new Date(y, m, 0, 23, 59, 59);
  var today = new Date(); if (until > today) until = today;
  return {
    since: Utilities.formatDate(since, CONFIG.TIMEZONE, PANCAKE.DATE_FMT), until: Utilities.formatDate(until, CONFIG.TIMEZONE, PANCAKE.DATE_FMT),
    since_ts: Math.floor(since.getTime() / 1000), until_ts: Math.floor(until.getTime() / 1000)
  };
}
function fill_(tpl, vars) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? encodeURIComponent(vars[k]) : ''; }); }
var PAGE_TOKEN_CACHE_ = {};
function pancakeVars_(ch, range) {
  var vars = { page_id: ch.page_id, token: PANCAKE.TOKEN, page_token: PANCAKE.TOKEN,
    since: range.since, until: range.until, since_ts: range.since_ts, until_ts: range.until_ts, date_range: range.since + ' - ' + range.until };
  if (PANCAKE.PAGE_TOKEN_URL) {
    if (!PAGE_TOKEN_CACHE_[ch.page_id]) {
      var u1 = fill_(PANCAKE.PAGE_TOKEN_URL.replace('{base}', PANCAKE.BASE), vars);
      var r1 = UrlFetchApp.fetch(u1, { method: 'post', muteHttpExceptions: true });
      if (r1.getResponseCode() === 200) { try { var pt = pick_(JSON.parse(r1.getContentText()), PANCAKE.PAGE_TOKEN_PATH); if (pt) PAGE_TOKEN_CACHE_[ch.page_id] = pt; } catch (e) {} }
    }
    if (PAGE_TOKEN_CACHE_[ch.page_id]) vars.page_token = PAGE_TOKEN_CACHE_[ch.page_id];
  }
  return vars;
}
function pancakeFetchRaw_(ch, range) {
  var vars = pancakeVars_(ch, range);
  var url = fill_(PANCAKE.STATS_URL.replace('{base}', PANCAKE.BASE), vars);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return { url: url, code: res.getResponseCode(), text: res.getContentText() };
}
/** Lấy giá trị theo đường dẫn "a.b.c". Gặp mảng ở giữa → trả về mảng các giá trị con. */
function pick_(obj, path) {
  if (!path) return null;
  var parts = String(path).split('.'), cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur == null) return null;
    if (Array.isArray(cur)) { var rest = parts.slice(i).join('.'); return cur.map(function (x) { return pick_(x, rest); }); }
    cur = cur[parts[i]];
  }
  return cur;
}
function pickSum_(obj, path) {
  var v = pick_(obj, path);
  var flat = function (x) { return Array.isArray(x) ? x.reduce(function (a, y) { return a.concat(flat(y)); }, []) : [x]; };
  return flat(v).reduce(function (a, y) { var n = Number(y); return a + (isNaN(n) ? 0 : n); }, 0);
}


// ===== REPORT HUB (trang Chỉ số kênh) → ChannelStats =====
// Trang Chỉ số kênh đã có Apps Script riêng trả về các bản ghi nhập từ Pancake (GET → { status:'ok', entries:[...] }).
// Map kênh của Hub ↔ nhân sự ở tab Channels: cột page_id = key kênh của Hub ('thoitiet' | 'laca' | 'hotel'), platform = 'hub'.
var HUB = { URL: 'https://script.google.com/macros/s/AKfycbznW_0kYnwwoHIVUqX9GL5t03dolr7pj3q3P2aYP7rX4vqH6kkgiIyxYBgPA1KZbiYmUg/exec' };

function hubSyncNow() {
  var month = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM');
  var n = hubSyncMonth(month);
  try { SpreadsheetApp.getUi().alert('Đã lấy số video/view tháng ' + month + ' từ Chỉ số kênh cho ' + n + ' kênh.'); } catch (e) {}
}
function hubSyncMonth(month) {
  var res = UrlFetchApp.fetch(HUB.URL, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('Hub HTTP ' + res.getResponseCode());
  var json = JSON.parse(res.getContentText());
  var agg = {};
  (json.entries || []).forEach(function (row) {
    if (row['Loại dữ liệu'] !== 'tuong_tac') return;
    var ch = row['Kênh'], d = String(row['Ngày đăng video'] || '').slice(0, 7);
    if (!ch || d !== month) return;
    agg[ch] = agg[ch] || { videos: 0, views: 0 };
    agg[ch].videos++; agg[ch].views += Number(row['Lượt xem']) || 0;
  });
  var channels = readSheet_('Channels').filter(function (c) { return String(c.platform).toLowerCase() === 'hub' && agg[c.page_id]; });
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('ChannelStats'), existing = readSheet_('ChannelStats'), n = 0;
  channels.forEach(function (ch) {
    var a = agg[ch.page_id];
    var row = [month, String(ch.email).toLowerCase(), String(ch.slot || 1), a.videos, a.views, '', new Date(), 'hub'];
    var old = existing.filter(function (r) { return String(r.month) === month && String(r.email).toLowerCase() === row[1] && String(r.slot) === row[2]; })[0];
    if (old) { row[5] = old.followers; sh.getRange(old._row, 1, 1, SHEETS.ChannelStats.length).setValues([row]); } else sh.appendRow(row);
    n++;
  });
  return n;
}
function installHubTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'hubSyncNow') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('hubSyncNow').timeBased().everyDays(1).atHour(6).create();
}
