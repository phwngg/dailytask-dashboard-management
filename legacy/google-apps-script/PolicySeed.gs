/**
 * phwng.online — Chính sách lương/KPI (seed từ tài liệu "KPI, LƯƠNG, THƯỞNG")
 * Mỗi dòng: [email, code, label, type, input_key, rate, tiers, min, note]
 * Sau khi setup() chạy, bảng này nằm ở tab Policy — sửa trực tiếp trên Sheet, KHÔNG cần sửa code.
 */
var INPUT_KEYS = [
  // Kênh chính / kênh 2 (Sapa hoặc kênh content)
  'videos', 'views', 'followers', 'videos_2', 'views_2', 'followers_2',
  // Tác nghiệp quay (creator)
  'hotel_session', 'extra_location', 'site_day', 'trip_day', 'long_trip_day',
  'booking_job', 'booking_extra_hour', 'voice_video',
  // Livestream
  'live_bridge', 'live_am_90', 'live_am_120', 'live_pm_90', 'live_pm_120', 'live_loc_day2', 'live_loc_day3',
  'live_total', 'live_wrong_timeline', 'live_late',
  // Editor / cameraman
  'edit_pov_paid', 'edit_review_paid', 'late_video', 'edit_ok_channels',
  'cam_session', 'cam_extra', 'cam_day', 'combo_session', 'combo_extra', 'combo_day', 'photo_session', 'photo_extra', 'photo_day',
  // VJ / content / plan
  'vj_video', 'rush_video', 'travel_day', 'partner_plan', 'bep_ngoai', 'sample_sub', 'sample_main', 'post',
  'video_fnb', 'video_service', 'photo_fnb', 'photo_service', 'photo_extra_channel',
  // Account
  'revenue_single', 'revenue_campaign', 'revenue_total', 'contract_value', 'fanpage_post',
  'sample_photo', 'sample_photo_content', 'sample_video_partner', 'sample_tiktok',
  'photo_review_fnb_lt2', 'photo_review_fnb_gt2', 'photo_review_svc_lt2', 'photo_review_svc_gt2'
];

var INPUT_LABELS = {
  videos: 'Số video kênh chính', views: 'View kênh chính', followers: 'Follower tăng (kênh chính)',
  videos_2: 'Số video kênh 2', views_2: 'View kênh 2', followers_2: 'Follower tăng (kênh 2)',
  hotel_session: 'Buổi quay KS/địa điểm', extra_location: 'Địa điểm phát sinh', site_day: 'Ngày quay địa điểm', trip_day: 'Ngày công tác tỉnh khác', long_trip_day: 'Ngày đi dài ngày (Sapa/Côn Đảo)',
  booking_job: 'Job booking', booking_extra_hour: 'Giờ job phát sinh', voice_video: 'Video thu voice',
  live_bridge: 'Live cầu Rồng/Sông Hàn', live_am_90: 'Live sáng 1h30', live_am_120: 'Live sáng 2h', live_pm_90: 'Live tối 1h30', live_pm_120: 'Live tối 2h', live_loc_day2: 'Ngày live địa điểm (2 phiên)', live_loc_day3: 'Ngày live địa điểm (3 phiên)',
  live_total: 'Tổng buổi live', live_wrong_timeline: 'Lần sai timeline', live_late: 'Lần trễ 15 phút',
  edit_pov_paid: 'Video POV tính phí', edit_review_paid: 'Video review/lịch trình tính phí', late_video: 'Video trễ deadline', edit_ok_channels: 'Kênh đủ 36 video không trễ',
  cam_session: 'Buổi quay (cameraman)', cam_extra: 'Địa điểm phát sinh (cam)', cam_day: 'Ngày quay cả ngày (cam)', combo_session: 'Buổi chụp+quay', combo_extra: 'Địa điểm phát sinh (combo)', combo_day: 'Ngày chụp+quay', photo_session: 'Buổi chụp', photo_extra: 'Địa điểm phát sinh (chụp)', photo_day: 'Ngày chụp',
  vj_video: 'Video VJ', rush_video: 'Video sản xuất nhanh', travel_day: 'Ngày di chuyển ngoài ĐN', partner_plan: 'Đối tác (plan marketing)', bep_ngoai: 'Bếp của Ngoại (lần)', sample_sub: 'Mẫu phụ', sample_main: 'Mẫu chính', post: 'Bài viết',
  video_fnb: 'Video F&B', video_service: 'Video dịch vụ', photo_fnb: 'Bộ ảnh F&B', photo_service: 'Bộ ảnh dịch vụ', photo_extra_channel: 'Kênh đăng thêm (ảnh)',
  revenue_single: 'Doanh số job lẻ', revenue_campaign: 'Doanh số job chiến dịch', revenue_total: 'Tổng doanh số', contract_value: 'Giá trị HĐ đối tác trọn gói', fanpage_post: 'Bài fanpage Loca',
  sample_photo: 'Mẫu ảnh', sample_photo_content: 'Mẫu ảnh + content', sample_video_partner: 'Mẫu video đối tác', sample_tiktok: 'Mẫu phụ TikTok',
  photo_review_fnb_lt2: 'Chụp review F&B <2 kênh', photo_review_fnb_gt2: 'Chụp review F&B >2 kênh', photo_review_svc_lt2: 'Chụp review DV <2 kênh', photo_review_svc_gt2: 'Chụp review DV >2 kênh'
};

// Bậc thưởng dùng lại
var T_FOLLOW_DN = '2500:300000;3750:550000;5000:650000;8500:1200000';
var T_VIEW_DN   = '3000000:200000;3500000:500000;3700000:700000;4000000:1000000';
var T_FOLLOW_SM = '1000:200000;1500:350000;2000:450000;3500:750000';
var T_VIEW_SM   = '1000000:200000;1500000:500000;2000000:800000;2500000:1000000';
var T_VIDEO_45  = '46:500000;51:1000000;61:1500000';
var T_VIDEO_26  = '26:300000;30:500000';
var T_VIEW_27   = '2700000:100000;3000000:200000;3500000:300000';
var T_EDIT_POV  = '0:50000;3:70000;6:100000';
var T_EDIT_REV  = '0:100000;3:120000;6:150000';

function P(email, code, label, type, key, rate, tiers, min, note) { return [email, code, label, type, key || '', rate || 0, tiers || '', min || 0, note || '']; }
function liveRules(e) {
  return [
    P(e, 'live_bridge', 'Live cầu Rồng/Sông Hàn', 'per_unit', 'live_bridge', 50000),
    P(e, 'live_am_90', 'Live thời tiết sáng 1h30', 'per_unit', 'live_am_90', 70000),
    P(e, 'live_am_120', 'Live thời tiết sáng 2h', 'per_unit', 'live_am_120', 100000),
    P(e, 'live_pm_90', 'Live tối/trong nhà 1h30', 'per_unit', 'live_pm_90', 50000),
    P(e, 'live_pm_120', 'Live tối/trong nhà 2h', 'per_unit', 'live_pm_120', 70000),
    P(e, 'live_loc2', 'Phụ phí live địa điểm (2 phiên/ngày)', 'per_unit', 'live_loc_day2', 200000),
    P(e, 'live_loc3', 'Phụ phí live địa điểm (3 phiên/ngày)', 'per_unit', 'live_loc_day3', 300000),
    P(e, 'live_bonus', 'Thưởng ≥30 buổi live/tháng', 'tier', 'live_total', 0, '30:500000'),
    P(e, 'live_pen_timeline', 'Phạt sai timeline', 'penalty_per_unit', 'live_wrong_timeline', 70000),
    P(e, 'live_pen_late', 'Phạt trễ 15 phút', 'penalty_per_unit', 'live_late', 20000)
  ];
}
function camRules(e, s, x, d) {
  return [
    P(e, 'cam_session', 'Quay KS/địa điểm (buổi)', 'per_unit', 'cam_session', s),
    P(e, 'cam_extra', 'Địa điểm phát sinh (buổi)', 'per_unit', 'cam_extra', x),
    P(e, 'cam_day', 'Quay địa điểm cả ngày', 'per_unit', 'cam_day', d),
    P(e, 'long_trip', 'Đi dài ngày (Sapa, Côn Đảo…)', 'per_unit', 'long_trip_day', 200000)
  ];
}
function editRules(e, from) {
  return [
    P(e, 'edit_pov', 'Edit video POV (từ video thứ ' + from + ')', 'per_unit_tenure', 'edit_pov_paid', 0, T_EDIT_POV, 0, 'Nhập số video ĐƯỢC TÍNH PHÍ (đã trừ ' + (from - 1) + ' video đầu)'),
    P(e, 'edit_review', 'Edit video review/lịch trình', 'per_unit_tenure', 'edit_review_paid', 0, T_EDIT_REV),
    P(e, 'edit_late', 'Phạt gửi trễ deadline', 'penalty_per_unit', 'late_video', 20000)
  ];
}

var POLICY_SEED = [].concat(
  // ===== 1. PHAN HOÀNG TẤN PHÁT — kênh ĐN + kênh Sapa + Leader Media =====
  [
    P('phat@phwng.online', 'base_dn', 'Lương cứng — kênh Đà Nẵng', 'fixed', '', 9000000),
    P('phat@phwng.online', 'base_sapa', 'Lương cứng — kênh Sapa', 'fixed', '', 6000000, '', 0, 'Giả định: giữ cả 2 kênh. Nếu chỉ 1 kênh → xoá dòng này'),
    P('phat@phwng.online', 'mgmt', 'Cộng tác phí quản lý Leader Media', 'fixed', '', 2000000),
    P('phat@phwng.online', 'travel', 'Cộng tác phí di chuyển', 'fixed', '', 300000),
    P('phat@phwng.online', 'hotel', 'Tác nghiệp KS/địa điểm (buổi)', 'per_unit', 'hotel_session', 100000),
    P('phat@phwng.online', 'extra_loc', 'Địa điểm phát sinh', 'per_unit', 'extra_location', 50000),
    P('phat@phwng.online', 'site_day', 'Địa điểm tham quan (ngày)', 'per_unit', 'site_day', 150000),
    P('phat@phwng.online', 'trip', 'Công tác phí tỉnh khác (ngày)', 'per_unit', 'trip_day', 250000),
    P('phat@phwng.online', 'booking', 'Job booking (≤2h)', 'per_unit', 'booking_job', 400000),
    P('phat@phwng.online', 'booking_h', 'Job booking giờ phát sinh', 'per_unit', 'booking_extra_hour', 100000),
    P('phat@phwng.online', 'b_follow', 'Thưởng follower — kênh ĐN', 'tier', 'followers', 0, T_FOLLOW_DN),
    P('phat@phwng.online', 'b_view', 'Thưởng view — kênh ĐN', 'tier', 'views', 0, T_VIEW_DN, 0, 'Áp dụng 9–12/2026'),
    P('phat@phwng.online', 'b_video', 'Thưởng số video — kênh ĐN', 'tier', 'videos', 0, T_VIDEO_45),
    P('phat@phwng.online', 'pen_video', 'Phạt thiếu video (min 40) — ĐN', 'penalty_below', 'videos', 300000, '', 40),
    P('phat@phwng.online', 'pen_view', 'Phạt thiếu view (min 2M5) — ĐN', 'penalty_below', 'views', 200000, '', 2500000),
    P('phat@phwng.online', 'b_follow2', 'Thưởng follower — kênh Sapa', 'tier', 'followers_2', 0, T_FOLLOW_SM),
    P('phat@phwng.online', 'b_view2', 'Thưởng view — kênh Sapa', 'tier', 'views_2', 0, T_VIEW_SM),
    P('phat@phwng.online', 'b_video2', 'Thưởng số video — kênh Sapa', 'tier', 'videos_2', 0, T_VIDEO_45),
    P('phat@phwng.online', 'pen_video2', 'Phạt thiếu video (min 40) — Sapa', 'penalty_below', 'videos_2', 300000, '', 40),
    P('phat@phwng.online', 'pen_view2', 'Phạt thiếu view (min 800K) — Sapa', 'penalty_below', 'views_2', 200000, '', 800000)
  ],
  // ===== 2. ĐOÀN THỊ ANH THƯ — Content Creator + Leader Livestream =====
  [
    P('thu@phwng.online', 'base', 'Lương cứng', 'fixed', '', 8000000),
    P('thu@phwng.online', 'hotel', 'Tác nghiệp KS/địa điểm (buổi)', 'per_unit', 'hotel_session', 100000),
    P('thu@phwng.online', 'extra_loc', 'Địa điểm phát sinh', 'per_unit', 'extra_location', 50000),
    P('thu@phwng.online', 'site_day', 'Địa điểm tham quan (ngày)', 'per_unit', 'site_day', 200000),
    P('thu@phwng.online', 'trip', 'Công tác phí tỉnh khác (ngày)', 'per_unit', 'trip_day', 250000),
    P('thu@phwng.online', 'voice', 'Thu voice (Hotel in Đà Nẵng)', 'per_unit', 'voice_video', 70000),
    P('thu@phwng.online', 'booking', 'Job booking (≤2h)', 'per_unit', 'booking_job', 400000),
    P('thu@phwng.online', 'booking_h', 'Job booking giờ phát sinh', 'per_unit', 'booking_extra_hour', 100000),
    P('thu@phwng.online', 'travel', 'Cộng tác phí di chuyển', 'fixed', '', 300000),
    P('thu@phwng.online', 'b_follow', 'Thưởng follower', 'tier', 'followers', 0, '1000:200000;1500:350000;2000:430000;3375:752500'),
    P('thu@phwng.online', 'b_view', 'Thưởng view', 'tier', 'views', 0, T_VIEW_SM, 0, 'Áp dụng 9–12/2026'),
    P('thu@phwng.online', 'b_video', 'Thưởng số video', 'tier', 'videos', 0, T_VIDEO_45),
    P('thu@phwng.online', 'pen_video', 'Phạt thiếu video (min 40)', 'penalty_below', 'videos', 300000, '', 40),
    P('thu@phwng.online', 'pen_view', 'Phạt thiếu view (min 800K)', 'penalty_below', 'views', 200000, '', 800000),
    P('thu@phwng.online', 'mgmt_live', 'Cộng tác phí quản lý Leader Livestream', 'fixed', '', 500000)
  ], liveRules('thu@phwng.online'),
  // ===== 3. PHAN ĐĂNG LINH CHI — Editor =====
  [
    P('linh@phwng.online', 'base', 'Lương cứng', 'fixed', '', 0, '', 0, 'Tài liệu chưa ghi — Leader điền')
  ], editRules('linh@phwng.online', 37),
  [
    P('linh@phwng.online', 'edit_bonus', 'Thưởng đủ 36 video/kênh không trễ', 'per_unit', 'edit_ok_channels', 300000)
  ], camRules('linh@phwng.online', 50000, 30000, 100000),
  // ===== 4. ĐỖ HOÀNG ĐỨC — Cameraman + Editor + Host live =====
  [
    P('duc@phwng.online', 'base', 'Lương cứng', 'fixed', '', 1500000),
    P('duc@phwng.online', 'fuel', 'Cộng tác phí xăng xe', 'fixed', '', 300000)
  ], camRules('duc@phwng.online', 50000, 30000, 100000), editRules('duc@phwng.online', 25), liveRules('duc@phwng.online'),
  // ===== 5. TRẦN THỊ CẨM LY — VJ + Plan Marketing + Content Creator =====
  [
    P('ly@phwng.online', 'base', 'Lương cứng', 'fixed', '', 9000000),
    P('ly@phwng.online', 'vj', 'VJ kênh Em Ly Đà Nẵng', 'per_unit', 'vj_video', 100000),
    P('ly@phwng.online', 'rush', 'Sản xuất nhanh', 'per_unit', 'rush_video', 100000),
    P('ly@phwng.online', 'travel', 'Di chuyển ngoài Đà Nẵng (ngày)', 'per_unit', 'travel_day', 100000),
    P('ly@phwng.online', 'b_video', 'Thưởng số video VJ', 'tier', 'videos', 0, T_VIDEO_26),
    P('ly@phwng.online', 'b_view', 'Thưởng view kênh VJ', 'tier', 'views', 0, T_VIEW_27),
    P('ly@phwng.online', 'pen_video', 'Phạt thiếu video VJ (min 25)', 'penalty_below', 'videos', 100000, '', 25),
    P('ly@phwng.online', 'pen_view', 'Phạt thiếu view VJ (min 2M5)', 'penalty_below', 'views', 100000, '', 2500000),
    P('ly@phwng.online', 'plan', 'Plan marketing (đối tác)', 'per_unit', 'partner_plan', 1000000),
    P('ly@phwng.online', 'bep', 'Bếp của Ngoại', 'per_unit', 'bep_ngoai', 500000),
    P('ly@phwng.online', 'sample_sub', 'Mẫu phụ', 'per_unit', 'sample_sub', 70000),
    P('ly@phwng.online', 'sample_main', 'Mẫu chính', 'per_unit', 'sample_main', 100000),
    P('ly@phwng.online', 'post', 'Bài viết content', 'per_unit', 'post', 120000),
    P('ly@phwng.online', 'b_follow2', 'Thưởng follower kênh content', 'tier', 'followers_2', 0, T_FOLLOW_SM),
    P('ly@phwng.online', 'b_view2', 'Thưởng view kênh content', 'tier', 'views_2', 0, '1000000:200000;1500000:500000;2000000:800000'),
    P('ly@phwng.online', 'late', 'Phạt gửi trễ deadline', 'penalty_per_unit', 'late_video', 20000)
  ],
  // ===== 6. LÊ THỊ NGÂN — lương cứng, không KPI =====
  [P('ngan@phwng.online', 'base', 'Lương cứng', 'fixed', '', 7000000, '', 0, 'Không KPI/thưởng')],
  // ===== 7. HOÀNG THỊ THƯƠNG — Content Creator + Đào tạo + Cameraman/Editor =====
  [
    P('thuong@phwng.online', 'base', 'Lương cứng', 'fixed', '', 9000000),
    P('thuong@phwng.online', 'v_fnb', 'Quay + hậu kỳ video F&B', 'per_unit', 'video_fnb', 150000),
    P('thuong@phwng.online', 'v_svc', 'Quay + hậu kỳ video dịch vụ', 'per_unit', 'video_service', 200000),
    P('thuong@phwng.online', 'p_fnb', 'Chụp + hậu kỳ ảnh F&B (bộ)', 'per_unit', 'photo_fnb', 100000),
    P('thuong@phwng.online', 'p_svc', 'Chụp + hậu kỳ ảnh dịch vụ (bộ)', 'per_unit', 'photo_service', 150000),
    P('thuong@phwng.online', 'p_extra', 'Kênh đăng thêm (từ kênh 2)', 'per_unit', 'photo_extra_channel', 50000),
    P('thuong@phwng.online', 'rush', 'Sản xuất nhanh', 'per_unit', 'rush_video', 100000),
    P('thuong@phwng.online', 'travel', 'Di chuyển ngoài Đà Nẵng (ngày)', 'per_unit', 'travel_day', 100000),
    P('thuong@phwng.online', 'b_video', 'Thưởng số video', 'tier', 'videos', 0, T_VIDEO_26),
    P('thuong@phwng.online', 'b_view', 'Thưởng view', 'tier', 'views', 0, T_VIEW_27),
    P('thuong@phwng.online', 'pen_video', 'Phạt thiếu video (min 25)', 'penalty_below', 'videos', 200000, '', 25),
    P('thuong@phwng.online', 'pen_view', 'Phạt thiếu view (min 2M5)', 'penalty_below', 'views', 100000, '', 2500000),
    P('thuong@phwng.online', 'training', 'Hỗ trợ đào tạo', 'fixed', '', 1000000),
    P('thuong@phwng.online', 'cam_session', 'Quay KS/địa điểm (buổi)', 'per_unit', 'cam_session', 70000),
    P('thuong@phwng.online', 'cam_extra', 'Địa điểm phát sinh (quay)', 'per_unit', 'cam_extra', 30000),
    P('thuong@phwng.online', 'cam_day', 'Quay địa điểm (ngày)', 'per_unit', 'cam_day', 120000),
    P('thuong@phwng.online', 'trip', 'Công tác phí tỉnh khác (ngày)', 'per_unit', 'trip_day', 250000),
    P('thuong@phwng.online', 'combo_s', 'Chụp + quay combo (buổi)', 'per_unit', 'combo_session', 200000),
    P('thuong@phwng.online', 'combo_x', 'Địa điểm phát sinh (combo)', 'per_unit', 'combo_extra', 50000),
    P('thuong@phwng.online', 'combo_d', 'Chụp + quay combo (ngày)', 'per_unit', 'combo_day', 300000),
    P('thuong@phwng.online', 'photo_s', 'Chụp (buổi)', 'per_unit', 'photo_session', 70000),
    P('thuong@phwng.online', 'photo_x', 'Địa điểm phát sinh (chụp)', 'per_unit', 'photo_extra', 30000),
    P('thuong@phwng.online', 'photo_d', 'Chụp (ngày)', 'per_unit', 'photo_day', 120000)
  ],
  // ===== 8. TRẦN THUÝ HIỀN — Account + Content Marketing + Photographer =====
  [
    P('hien@phwng.online', 'base', 'Lương cứng', 'fixed', '', 7000000),
    P('hien@phwng.online', 'com_single', 'Hoa hồng job đi bài lẻ', 'percent', 'revenue_single', 5),
    P('hien@phwng.online', 'com_campaign', 'Hoa hồng job chiến dịch', 'percent', 'revenue_campaign', 7),
    P('hien@phwng.online', 'b_revenue', 'Thưởng doanh số', 'tier', 'revenue_total', 0, '150000000:500000;180000000:0+1%;200000000:1000000+1%'),
    P('hien@phwng.online', 'com_partner', 'Hoa hồng đối tác trọn gói', 'percent', 'contract_value', 10),
    P('hien@phwng.online', 'fanpage', 'Content fanpage Loca Media', 'per_unit', 'fanpage_post', 100000),
    P('hien@phwng.online', 'hotel', 'Quay KS/địa điểm (buổi)', 'per_unit', 'hotel_session', 100000),
    P('hien@phwng.online', 'extra_loc', 'Địa điểm phát sinh', 'per_unit', 'extra_location', 50000),
    P('hien@phwng.online', 'site_day', 'Địa điểm 2N1Đ (ngày)', 'per_unit', 'site_day', 150000),
    P('hien@phwng.online', 's_photo', 'Mẫu ảnh (bộ)', 'per_unit', 'sample_photo', 50000),
    P('hien@phwng.online', 's_photo_c', 'Mẫu ảnh + content', 'per_unit', 'sample_photo_content', 70000),
    P('hien@phwng.online', 's_video', 'Mẫu video đối tác trọn gói', 'per_unit', 'sample_video_partner', 70000),
    P('hien@phwng.online', 's_tiktok', 'Mẫu phụ TikTok', 'per_unit', 'sample_tiktok', 70000),
    P('hien@phwng.online', 'pr_fnb1', 'Chụp review F&B (<2 kênh)', 'per_unit', 'photo_review_fnb_lt2', 100000),
    P('hien@phwng.online', 'pr_fnb2', 'Chụp review F&B (>2 kênh)', 'per_unit', 'photo_review_fnb_gt2', 150000),
    P('hien@phwng.online', 'pr_svc1', 'Chụp review dịch vụ (<2 kênh)', 'per_unit', 'photo_review_svc_lt2', 150000),
    P('hien@phwng.online', 'pr_svc2', 'Chụp review dịch vụ (>2 kênh)', 'per_unit', 'photo_review_svc_gt2', 200000)
  ],
  // ===== 9. LƯƠNG HÀ PHƯƠNG — Leader Marketing =====
  [P('phuong@phwng.online', 'base', 'Lương cứng', 'fixed', '', 0, '', 0, 'Không có trong tài liệu — Leader điền')]
);

// Số liệu mẫu tháng 2026-08 (để demo tính thử) — { email: { key: value } }
var INPUTS_SEED = {
  'phat@phwng.online':   { videos: 48, views: 3600000, followers: 4100, videos_2: 41, views_2: 1200000, followers_2: 900, hotel_session: 6, extra_location: 2, booking_job: 1 },
  'thu@phwng.online':    { videos: 42, views: 1550000, followers: 1600, voice_video: 12, hotel_session: 4, live_am_120: 10, live_pm_90: 8, live_bridge: 6, live_total: 24, live_late: 1 },
  'linh@phwng.online':   { edit_pov_paid: 8, edit_review_paid: 3, late_video: 1, edit_ok_channels: 1, cam_session: 3 },
  'duc@phwng.online':    { cam_session: 10, cam_extra: 3, cam_day: 2, long_trip_day: 3, edit_pov_paid: 5, live_bridge: 8, live_pm_120: 6, live_total: 14 },
  'ly@phwng.online':     { videos: 27, views: 2900000, vj_video: 27, rush_video: 3, partner_plan: 1, sample_sub: 2, post: 6, followers_2: 1100, views_2: 950000 },
  'ngan@phwng.online':   {},
  'thuong@phwng.online': { videos: 24, views: 2650000, video_fnb: 5, video_service: 3, photo_fnb: 2, photo_extra_channel: 1, cam_session: 4, combo_day: 1 },
  'hien@phwng.online':   { revenue_single: 60000000, revenue_campaign: 130000000, revenue_total: 190000000, contract_value: 20000000, fanpage_post: 4, sample_photo: 3, photo_review_fnb_lt2: 2 },
  'phuong@phwng.online': {}
};
