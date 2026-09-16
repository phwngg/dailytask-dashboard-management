package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const pancakeAPIBase = "https://pages.fm/api"

var pancakeHTTPClient = &http.Client{Timeout: 20 * time.Second}

// ponytail: global sync lock; use per-page jobs only if sync volume requires it.
var pancakeSyncMu sync.Mutex

type pancakePage struct {
	ID       string
	Name     string
	Platform string
}

type pancakePageState struct {
	PageID           string `json:"page_id"`
	PageName         string `json:"page_name"`
	Platform         string `json:"platform"`
	Status           string `json:"status"`
	Mapped           bool   `json:"mapped"`
	AssignedEmail    string `json:"assigned_email,omitempty"`
	MetricErrorCount int    `json:"metric_error_count"`
	LastSeenAt       string `json:"last_seen_at,omitempty"`
	LastSyncAt       string `json:"last_sync_at,omitempty"`
	LastError        string `json:"last_error,omitempty"`
}

type pancakeStatus struct {
	Pages          []pancakePageState `json:"pages"`
	Configured     int                `json:"configured"`
	Connected      int                `json:"connected"`
	NeedsReconnect int                `json:"needs_reconnect"`
}

type channelStat struct {
	Month     string  `json:"month"`
	Email     string  `json:"email"`
	Slot      int     `json:"slot"`
	Videos    float64 `json:"videos"`
	Views     float64 `json:"views"`
	Followers float64 `json:"followers"`
	SyncedAt  string  `json:"synced_at"`
	Source    string  `json:"source"`
}

type pancakePageMetrics struct {
	PageID   string            `json:"page_id"`
	PageName string            `json:"page_name"`
	Platform string            `json:"platform"`
	Email    string            `json:"email,omitempty"`
	LastSync string            `json:"last_sync_at,omitempty"`
	Metrics  map[string]any    `json:"metrics"`
	Errors   map[string]string `json:"errors,omitempty"`
}

type pancakeAPIError struct{ status int }

func (e *pancakeAPIError) Error() string { return fmt.Sprintf("Pancake HTTP %d", e.status) }

func pancakeRequest(ctx context.Context, method, path string, query url.Values, out any) error {
	u, err := url.Parse(pancakeAPIBase + path)
	if err != nil {
		return err
	}
	u.RawQuery = query.Encode()
	req, err := http.NewRequestWithContext(ctx, method, u.String(), nil)
	if err != nil {
		return err
	}
	res, err := pancakeHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return err
	}
	if res.StatusCode < http.StatusOK || res.StatusCode >= http.StatusMultipleChoices {
		return &pancakeAPIError{status: res.StatusCode}
	}
	if out == nil || len(body) == 0 {
		return nil
	}
	return json.Unmarshal(body, out)
}

func pancakeListPages(ctx context.Context, userToken string) ([]pancakePage, error) {
	var root any
	if err := pancakeRequest(ctx, http.MethodGet, "/v1/pages", url.Values{"access_token": {userToken}}, &root); err != nil {
		return nil, err
	}
	pages := parsePancakePages(root)
	if len(pages) == 0 {
		return nil, errors.New("Pancake không trả về page nào")
	}
	return pages, nil
}

func parsePancakePages(root any) []pancakePage {
	var out []pancakePage
	walkPancakePageLists(root, &out, 0)
	seen := map[string]bool{}
	unique := out[:0]
	for _, page := range out {
		if page.ID == "" || seen[page.ID] {
			continue
		}
		seen[page.ID] = true
		unique = append(unique, page)
	}
	return unique
}

func walkPancakePageLists(value any, out *[]pancakePage, depth int) {
	if depth > 5 || value == nil {
		return
	}
	switch x := value.(type) {
	case []any:
		for _, item := range x {
			if page, ok := pancakePageFromMap(item); ok {
				*out = append(*out, page)
			} else {
				walkPancakePageLists(item, out, depth+1)
			}
		}
	case map[string]any:
		if categorized, ok := x["categorized"]; ok {
			walkPancakePageLists(categorized, out, depth+1)
		}
		for _, key := range []string{"activated", "pages", "data"} {
			if child, ok := x[key]; ok {
				walkPancakePageLists(child, out, depth+1)
			}
		}
	}
}

func pancakePageFromMap(value any) (pancakePage, bool) {
	m, ok := value.(map[string]any)
	if !ok {
		return pancakePage{}, false
	}
	id := stringValue(m["id"])
	if id == "" {
		id = stringValue(m["page_id"])
	}
	if id == "" {
		return pancakePage{}, false
	}
	name := stringValue(m["name"])
	if name == "" {
		name = stringValue(m["page_name"])
	}
	platform := stringValue(m["platform"])
	if platform == "" {
		platform = stringValue(m["type"])
	}
	return pancakePage{ID: id, Name: name, Platform: platform}, true
}

func stringValue(value any) string {
	s, _ := value.(string)
	return strings.TrimSpace(s)
}

func findString(value any, key string, depth int) string {
	if depth > 6 || value == nil {
		return ""
	}
	switch x := value.(type) {
	case map[string]any:
		if s := stringValue(x[key]); s != "" {
			return s
		}
		for _, child := range x {
			if s := findString(child, key, depth+1); s != "" {
				return s
			}
		}
	case []any:
		for _, child := range x {
			if s := findString(child, key, depth+1); s != "" {
				return s
			}
		}
	}
	return ""
}

func pancakeGeneratePageToken(ctx context.Context, userToken, pageID string) (string, error) {
	var root any
	path := "/v1/pages/" + url.PathEscape(pageID) + "/generate_page_access_token"
	if err := pancakeRequest(ctx, http.MethodPost, path, url.Values{"access_token": {userToken}}, &root); err != nil {
		return "", err
	}
	token := findString(root, "page_access_token", 0)
	if token == "" {
		return "", errors.New("Pancake không trả page_access_token")
	}
	return token, nil
}

func pancakePageTokenKey(raw string) []byte {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

func loadPancakePageTokenKey(configured, databasePath string) ([]byte, error) {
	path := filepath.Join(filepath.Dir(databasePath), "pancake.key")
	key, err := os.ReadFile(path)
	if err == nil {
		if len(key) != 32 {
			return nil, errors.New("khóa Pancake lưu trên server không hợp lệ")
		}
		return key, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	key = pancakePageTokenKey(configured)
	if len(key) == 0 {
		key = make([]byte, 32)
		if _, err = rand.Read(key); err != nil {
			return nil, err
		}
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if errors.Is(err, os.ErrExist) {
		key, err = os.ReadFile(path)
		if err == nil && len(key) != 32 {
			return nil, errors.New("khóa Pancake lưu trên server không hợp lệ")
		}
		return key, err
	}
	if err != nil {
		return nil, err
	}
	if _, err = f.Write(key); err != nil {
		f.Close()
		_ = os.Remove(path)
		return nil, err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		_ = os.Remove(path)
		return nil, err
	}
	if err = f.Close(); err != nil {
		return nil, err
	}
	return key, nil
}

func encryptPancakeToken(key []byte, token string) (string, error) {
	if len(key) == 0 {
		return "", errors.New("khóa mã hóa Pancake chưa sẵn sàng")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(token), nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func decryptPancakeToken(key []byte, encoded string) (string, error) {
	if len(key) == 0 {
		return "", errors.New("khóa mã hóa Pancake chưa sẵn sàng")
	}
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil || len(raw) < gcm.NonceSize() {
		return "", errors.New("page token không hợp lệ")
	}
	plain, err := gcm.Open(nil, raw[:gcm.NonceSize()], raw[gcm.NonceSize():], nil)
	return string(plain), err
}

func pancakeStatusError(err error) string {
	var apiErr *pancakeAPIError
	if errors.As(err, &apiErr) {
		return apiErr.Error()
	}
	return "Không thể đồng bộ Pancake"
}

func (a *api) channelStats(ctx context.Context, month string) ([]channelStat, error) {
	rows, err := a.db.QueryContext(ctx, "SELECT month,email,slot,videos,views,followers,synced_at,source FROM channel_stats WHERE month=? ORDER BY email,slot", month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []channelStat{}
	for rows.Next() {
		var stat channelStat
		if err := rows.Scan(&stat.Month, &stat.Email, &stat.Slot, &stat.Videos, &stat.Views, &stat.Followers, &stat.SyncedAt, &stat.Source); err != nil {
			return nil, err
		}
		out = append(out, stat)
	}
	return out, rows.Err()
}

func (a *api) pancakeStatus(ctx context.Context) (pancakeStatus, error) {
	rows, err := a.db.QueryContext(ctx, `SELECT p.page_id,p.page_name,p.platform,p.status,
		p.last_seen_at,p.last_sync_at,p.last_error,coalesce(a.email,''),
		coalesce(sum(CASE WHEN m.error<>'' THEN 1 ELSE 0 END),0)
		FROM pancake_pages p
		LEFT JOIN pancake_page_assignments a ON a.page_id=p.page_id
		LEFT JOIN pancake_metric_snapshots m ON m.page_id=p.page_id AND m.month=?
		GROUP BY p.page_id ORDER BY p.page_name,p.page_id`, pancakeCurrentMonth())
	if err != nil {
		return pancakeStatus{}, err
	}
	defer rows.Close()
	out := pancakeStatus{Pages: []pancakePageState{}}
	for rows.Next() {
		var page pancakePageState
		if err := rows.Scan(&page.PageID, &page.PageName, &page.Platform, &page.Status, &page.LastSeenAt, &page.LastSyncAt, &page.LastError, &page.AssignedEmail, &page.MetricErrorCount); err != nil {
			return pancakeStatus{}, err
		}
		page.Mapped = page.AssignedEmail != ""
		out.Pages = append(out.Pages, page)
		if page.Status == "connected" {
			out.Connected++
		}
		if page.Status == "needs_reconnect" || page.Status == "error" {
			out.NeedsReconnect++
		}
	}
	out.Configured = len(out.Pages)
	return out, rows.Err()
}

func (a *api) pancakeMetrics(ctx context.Context, month string) ([]pancakePageMetrics, error) {
	rows, err := a.db.QueryContext(ctx, `SELECT p.page_id,p.page_name,p.platform,coalesce(a.email,''),p.last_sync_at
		FROM pancake_pages p LEFT JOIN pancake_page_assignments a ON a.page_id=p.page_id
		ORDER BY p.page_name,p.page_id`)
	if err != nil {
		return nil, err
	}
	out := []pancakePageMetrics{}
	indices := map[string]int{}
	for rows.Next() {
		var page pancakePageMetrics
		if err := rows.Scan(&page.PageID, &page.PageName, &page.Platform, &page.Email, &page.LastSync); err != nil {
			rows.Close()
			return nil, err
		}
		page.Metrics = map[string]any{}
		page.Errors = map[string]string{}
		indices[page.PageID] = len(out)
		out = append(out, page)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	rows, err = a.db.QueryContext(ctx, `SELECT page_id,endpoint,payload_json,error FROM pancake_metric_snapshots
		WHERE month=? ORDER BY page_id,endpoint`, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var pageID, endpoint, raw, metricErr string
		if err := rows.Scan(&pageID, &endpoint, &raw, &metricErr); err != nil {
			return nil, err
		}
		i, ok := indices[pageID]
		if !ok {
			continue
		}
		var payload any
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			return nil, err
		}
		out[i].Metrics[endpoint] = payload
		if metricErr != "" {
			out[i].Errors[endpoint] = metricErr
		}
	}
	return out, rows.Err()
}

type storedPancakePage struct {
	TokenEnc string
	Status   string
}

type pancakeConnectSummary struct {
	Found      int      `json:"found"`
	Reused     int      `json:"reused"`
	Created    int      `json:"created"`
	Refreshed  int      `json:"refreshed"`
	Failed     int      `json:"failed"`
	NotVisible int      `json:"not_visible"`
	Errors     []string `json:"errors,omitempty"`
}

func (a *api) pancakeConnect(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "channel.sync") {
		return
	}
	if len(a.pancakeKey) == 0 {
		writeError(w, http.StatusServiceUnavailable, "Chưa cấu hình khóa mã hóa Pancake trên server")
		return
	}
	var req struct {
		UserAccessToken string `json:"user_access_token"`
	}
	if decode(r, &req) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	userToken := strings.TrimSpace(req.UserAccessToken)
	if userToken == "" || len(userToken) > 4096 {
		writeError(w, http.StatusBadRequest, "User Access Token không hợp lệ")
		return
	}
	pages, err := pancakeListPages(r.Context(), userToken)
	if err != nil {
		var apiErr *pancakeAPIError
		if errors.As(err, &apiErr) && (apiErr.status == http.StatusUnauthorized || apiErr.status == http.StatusForbidden) {
			writeError(w, http.StatusBadRequest, "User Access Token hết hạn hoặc không có quyền truy cập page")
			return
		}
		writeError(w, http.StatusBadGateway, "Không lấy được danh sách page từ Pancake")
		return
	}

	existing := map[string]storedPancakePage{}
	rows, err := a.db.QueryContext(r.Context(), "SELECT page_id,page_access_token_enc,status FROM pancake_pages")
	if err != nil {
		fail(w, err)
		return
	}
	for rows.Next() {
		var pageID, tokenEnc, status string
		if err = rows.Scan(&pageID, &tokenEnc, &status); err != nil {
			rows.Close()
			fail(w, err)
			return
		}
		existing[pageID] = storedPancakePage{TokenEnc: tokenEnc, Status: status}
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		fail(w, err)
		return
	}
	rows.Close()

	now := time.Now().UTC().Format(time.RFC3339)
	seen := map[string]bool{}
	summary := pancakeConnectSummary{Found: len(pages)}
	for _, page := range pages {
		seen[page.ID] = true
		old := existing[page.ID]
		tokenEnc := old.TokenEnc
		refreshToken := tokenEnc == "" || old.Status == "needs_reconnect"
		if !refreshToken {
			_, refreshErr := decryptPancakeToken(a.pancakeKey, tokenEnc)
			refreshToken = refreshErr != nil
		}
		if refreshToken {
			pageToken, tokenErr := pancakeGeneratePageToken(r.Context(), userToken, page.ID)
			if tokenErr != nil {
				summary.Failed++
				summary.Errors = append(summary.Errors, page.ID+": "+pancakeStatusError(tokenErr))
				_, _ = a.db.ExecContext(r.Context(), "INSERT INTO pancake_pages(page_id,page_name,platform,status,last_seen_at,last_error) VALUES(?,?,?,'needs_reconnect',?,?) ON CONFLICT(page_id) DO UPDATE SET page_name=excluded.page_name,platform=excluded.platform,status='needs_reconnect',last_seen_at=excluded.last_seen_at,last_error=excluded.last_error,updated_at=CURRENT_TIMESTAMP", page.ID, page.Name, page.Platform, now, pancakeStatusError(tokenErr))
				continue
			}
			tokenEnc, err = encryptPancakeToken(a.pancakeKey, pageToken)
			if err != nil {
				fail(w, err)
				return
			}
			if old.TokenEnc == "" {
				summary.Created++
			} else {
				summary.Refreshed++
			}
		} else {
			summary.Reused++
		}
		_, err = a.db.ExecContext(r.Context(), "INSERT INTO pancake_pages(page_id,page_name,platform,page_access_token_enc,status,last_seen_at,last_error) VALUES(?,?,?,?,'connected',?,'') ON CONFLICT(page_id) DO UPDATE SET page_name=excluded.page_name,platform=excluded.platform,page_access_token_enc=excluded.page_access_token_enc,status='connected',last_seen_at=excluded.last_seen_at,last_error='',updated_at=CURRENT_TIMESTAMP", page.ID, page.Name, page.Platform, tokenEnc, now)
		if err != nil {
			fail(w, err)
			return
		}
	}

	rows, err = a.db.QueryContext(r.Context(), "SELECT page_id FROM pancake_pages")
	if err != nil {
		fail(w, err)
		return
	}
	var storedPageIDs []string
	for rows.Next() {
		var pageID string
		if err = rows.Scan(&pageID); err != nil {
			rows.Close()
			fail(w, err)
			return
		}
		storedPageIDs = append(storedPageIDs, pageID)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		fail(w, err)
		return
	}
	rows.Close()
	for _, pageID := range storedPageIDs {
		if seen[pageID] {
			continue
		}
		summary.NotVisible++
		_, _ = a.db.ExecContext(r.Context(), "UPDATE pancake_pages SET status='not_visible',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE page_id=?", "Không xuất hiện trong danh sách page của token hiện tại", pageID)
	}
	status, err := a.pancakeStatus(r.Context())
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"summary": summary, "status": status})
}

func (a *api) mapPancakeChannel(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "channel.sync") {
		return
	}
	var req struct {
		PageID   string `json:"page_id"`
		Email    string `json:"email"`
		PageName string `json:"page_name"`
	}
	if decode(r, &req) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	req.PageID = strings.TrimSpace(req.PageID)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.PageName = strings.TrimSpace(req.PageName)
	if req.PageID == "" || req.Email == "" {
		writeError(w, http.StatusBadRequest, "Cần page và nhân sự")
		return
	}
	var n int
	if err := a.db.QueryRowContext(r.Context(), "SELECT count(*) FROM pancake_pages WHERE page_id=?", req.PageID).Scan(&n); err != nil {
		fail(w, err)
		return
	}
	if n == 0 {
		writeError(w, http.StatusBadRequest, "Page chưa được kết nối Pancake")
		return
	}
	if err := a.db.QueryRowContext(r.Context(), "SELECT count(*) FROM users WHERE email=? AND active=1", req.Email).Scan(&n); err != nil || n == 0 {
		writeError(w, http.StatusBadRequest, "Nhân sự không hợp lệ")
		return
	}
	if req.PageName == "" {
		_ = a.db.QueryRowContext(r.Context(), "SELECT page_name FROM pancake_pages WHERE page_id=?", req.PageID).Scan(&req.PageName)
	}
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO pancake_page_assignments(page_id,email) VALUES(?,?)
		ON CONFLICT(page_id) DO UPDATE SET email=excluded.email,updated_at=CURRENT_TIMESTAMP`, req.PageID, req.Email)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "page_id": req.PageID, "email": req.Email, "page_name": req.PageName})
}

func (a *api) unmapPancakeChannel(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "channel.sync") {
		return
	}
	pageID := strings.TrimSpace(r.PathValue("page_id"))
	if pageID == "" {
		writeError(w, http.StatusBadRequest, "Cần page ID")
		return
	}
	if _, err := a.db.ExecContext(r.Context(), "DELETE FROM pancake_page_assignments WHERE page_id=?", pageID); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "page_id": pageID})
}

type mappedPancakePage struct {
	Email    string
	PageID   string
	TokenEnc string
}

type pancakeSyncResult struct {
	Month  string   `json:"month,omitempty"`
	Period string   `json:"period,omitempty"`
	From   string   `json:"from,omitempty"`
	To     string   `json:"to,omitempty"`
	Found  int      `json:"found"`
	Synced int      `json:"synced"`
	Failed int      `json:"failed"`
	Errors []string `json:"errors,omitempty"`
}

type pancakeMetricRequest struct {
	Name  string
	Path  string
	Query url.Values
}

type pancakePageRateLimiter struct{ last time.Time }

func (l *pancakePageRateLimiter) wait(ctx context.Context) error {
	if !l.last.IsZero() {
		if delay := time.Until(l.last.Add(220 * time.Millisecond)); delay > 0 {
			timer := time.NewTimer(delay)
			defer timer.Stop()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-timer.C:
			}
		}
	}
	l.last = time.Now()
	return nil
}

var pancakeLocation = time.FixedZone("Asia/Ho_Chi_Minh", 7*60*60)

func pancakeCurrentMonth() string { return time.Now().In(pancakeLocation).Format("2006-01") }

func pancakeMonthRange(month string, now time.Time) (time.Time, time.Time, error) {
	start, err := time.ParseInLocation("2006-01", month, pancakeLocation)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end := start.AddDate(0, 1, 0).Add(-time.Second)
	now = now.In(pancakeLocation)
	if start.After(now) {
		return time.Time{}, time.Time{}, errors.New("không thể đồng bộ tháng chưa đến")
	}
	if end.After(now) {
		end = now
	}
	return start, end, nil
}

func pancakeReportRange(start, end time.Time) string {
	return start.In(pancakeLocation).Format("02/01/2006 15:04:05") + " - " + end.In(pancakeLocation).Format("02/01/2006 15:04:05")
}

func pancakeFeedbackRanges(start, end time.Time) [][2]time.Time {
	var ranges [][2]time.Time
	for from := start; !from.After(end); {
		until := from.Add(30*24*time.Hour - time.Second)
		if until.After(end) {
			until = end
		}
		ranges = append(ranges, [2]time.Time{from, until})
		from = until.Add(time.Second)
	}
	return ranges
}

func pancakeMetricRequests(start, end time.Time) []pancakeMetricRequest {
	feedbackRanges := pancakeFeedbackRanges(start, end)
	unixQuery := func() url.Values {
		return url.Values{"since": {fmt.Sprint(start.Unix())}, "until": {fmt.Sprint(end.Unix())}}
	}
	longRange := url.Values{"date_range": {pancakeReportRange(start, end)}}
	engagementDaily := longRange.Clone()
	engagementDaily.Set("by_hour", "false")
	engagementHourly := longRange.Clone()
	engagementHourly.Set("by_hour", "true")
	adsByID, adsByTime := unixQuery(), unixQuery()
	adsByID.Set("type", "by_id")
	adsByTime.Set("type", "by_time")
	requests := []pancakeMetricRequest{
		{Name: "pages", Path: "statistics/pages", Query: unixQuery()},
		{Name: "pages_campaigns", Path: "statistics/pages_campaigns", Query: unixQuery()},
		{Name: "ads_by_id", Path: "statistics/ads", Query: adsByID},
		{Name: "ads_by_time", Path: "statistics/ads", Query: adsByTime},
		{Name: "customer_engagements", Path: "statistics/customer_engagements", Query: engagementDaily},
		{Name: "customer_engagements_hourly", Path: "statistics/customer_engagements", Query: engagementHourly},
		{Name: "tags", Path: "statistics/tags", Query: unixQuery()},
		{Name: "users", Path: "statistics/users", Query: longRange},
	}
	for i, span := range feedbackRanges {
		query := url.Values{"since": {fmt.Sprint(span[0].Unix())}, "until": {fmt.Sprint(span[1].Unix())}}
		name := "customer_feedbacks"
		if len(feedbackRanges) > 1 {
			name += fmt.Sprintf("_part_%d", i+1)
		}
		requests = append(requests, pancakeMetricRequest{Name: name, Path: "statistics/customer_feedbacks", Query: query})
	}
	requests = append(requests, pancakeMetricRequest{
		Name: "posts", Path: "posts",
		Query: url.Values{"since": {fmt.Sprint(start.Unix())}, "until": {fmt.Sprint(end.Unix())}},
	})
	return requests
}

func pancakeRangeKey(start, end time.Time) string {
	return start.In(pancakeLocation).Format("2006-01-02") + ".." + end.In(pancakeLocation).Format("2006-01-02")
}

func pancakeFullMonth(from, to string) string {
	start, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(from), pancakeLocation)
	if err != nil || start.Day() != 1 {
		return ""
	}
	end, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(to), pancakeLocation)
	if err != nil || !end.AddDate(0, 0, 1).Equal(start.AddDate(0, 1, 0)) {
		return ""
	}
	return start.Format("2006-01")
}

func pancakeDateRange(from, to string, now time.Time) (time.Time, time.Time, error) {
	start, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(from), pancakeLocation)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Ngày bắt đầu không hợp lệ")
	}
	endDate, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(to), pancakeLocation)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("Ngày kết thúc không hợp lệ")
	}
	if start.After(endDate) {
		return time.Time{}, time.Time{}, errors.New("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")
	}
	now = now.In(pancakeLocation)
	if start.After(now) {
		return time.Time{}, time.Time{}, errors.New("không thể đồng bộ khoảng ngày chưa đến")
	}
	end := endDate.AddDate(0, 0, 1).Add(-time.Second)
	if end.After(now) {
		end = now
	}
	return start, end, nil
}

func (a *api) pancakeMetricsAPI(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "channel.view") {
		return
	}
	from, to := strings.TrimSpace(r.URL.Query().Get("from")), strings.TrimSpace(r.URL.Query().Get("to"))
	period := strings.TrimSpace(r.URL.Query().Get("period"))
	var start, end time.Time
	if from != "" || to != "" {
		if month := pancakeFullMonth(from, to); month != "" {
			var err error
			start, end, err = pancakeMonthRange(month, time.Now())
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			period = month
			from = start.In(pancakeLocation).Format("2006-01-02")
			to = end.In(pancakeLocation).Format("2006-01-02")
		} else {
			var err error
			start, end, err = pancakeDateRange(from, to, time.Now())
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			period = pancakeRangeKey(start, end)
			from = start.In(pancakeLocation).Format("2006-01-02")
			to = end.In(pancakeLocation).Format("2006-01-02")
		}
	}
	if period == "" {
		period = pancakeCurrentMonth()
	}
	metrics, err := a.pancakeMetrics(r.Context(), period)
	if err != nil {
		fail(w, err)
		return
	}
	previous := []pancakePageMetrics{}
	previousPeriod := ""
	if !start.IsZero() && !end.IsZero() {
		days := int(end.In(pancakeLocation).Truncate(24*time.Hour).Sub(start.In(pancakeLocation).Truncate(24*time.Hour)).Hours()/24) + 1
		previousEnd := start.AddDate(0, 0, -1)
		previousStart := previousEnd.AddDate(0, 0, -(days - 1))
		if month := pancakeFullMonth(from, to); month != "" {
			previousPeriod = previousStart.Format("2006-01")
		} else {
			previousPeriod = pancakeRangeKey(previousStart, previousEnd)
		}
		previous, err = a.pancakeMetrics(r.Context(), previousPeriod)
		if err != nil {
			fail(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"period": period, "from": from, "to": to, "metrics": metrics, "previousPeriod": previousPeriod, "previousMetrics": previous})
}

func (a *api) pancakeSync(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "channel.sync") {
		return
	}
	var req struct {
		Month string `json:"month"`
		From  string `json:"from"`
		To    string `json:"to"`
	}
	if r.Body != nil && r.Body != http.NoBody {
		_ = decode(r, &req)
	}
	if strings.TrimSpace(req.From) != "" || strings.TrimSpace(req.To) != "" {
		if month := pancakeFullMonth(req.From, req.To); month != "" {
			result, err := a.syncPancake(r.Context(), month)
			if err != nil {
				fail(w, err)
				return
			}
			writeJSON(w, http.StatusOK, result)
			return
		}
		start, end, err := pancakeDateRange(req.From, req.To, time.Now())
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		result, err := a.syncPancakeRange(r.Context(), pancakeRangeKey(start, end), start, end, false)
		if err != nil {
			fail(w, err)
			return
		}
		result.From = start.In(pancakeLocation).Format("2006-01-02")
		result.To = end.In(pancakeLocation).Format("2006-01-02")
		writeJSON(w, http.StatusOK, result)
		return
	}
	month := strings.TrimSpace(req.Month)
	if month == "" {
		month = pancakeCurrentMonth()
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		writeError(w, http.StatusBadRequest, "Tháng không hợp lệ")
		return
	}
	result, err := a.syncPancake(r.Context(), month)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (a *api) syncPancake(ctx context.Context, month string) (pancakeSyncResult, error) {
	start, end, err := pancakeMonthRange(month, time.Now())
	if err != nil {
		return pancakeSyncResult{Month: month, Period: month}, err
	}
	return a.syncPancakeRange(ctx, month, start, end, true)
}

func (a *api) syncPancakeRange(ctx context.Context, period string, start, end time.Time, updateChannelStats bool) (pancakeSyncResult, error) {
	pancakeSyncMu.Lock()
	defer pancakeSyncMu.Unlock()

	result := pancakeSyncResult{Month: period, Period: period,
		From: start.In(pancakeLocation).Format("2006-01-02"), To: end.In(pancakeLocation).Format("2006-01-02")}
	rows, err := a.db.QueryContext(ctx, `SELECT a.email,p.page_id,p.page_access_token_enc
		FROM pancake_page_assignments a JOIN pancake_pages p ON p.page_id=a.page_id
		ORDER BY a.email,p.page_id`)
	if err != nil {
		return result, err
	}
	var pages []mappedPancakePage
	for rows.Next() {
		var page mappedPancakePage
		if err := rows.Scan(&page.Email, &page.PageID, &page.TokenEnc); err != nil {
			rows.Close()
			return result, err
		}
		pages = append(pages, page)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return result, err
	}
	rows.Close()
	result.Found = len(pages)

	now := time.Now().UTC().Format(time.RFC3339)
	videoCounts := map[string]int{}
	for _, page := range pages {
		token, err := decryptPancakeToken(a.pancakeKey, page.TokenEnc)
		if err != nil {
			message := "Không giải mã được Page Access Token; hãy dùng nút Cập nhật token để cấp lại"
			result.Failed++
			result.Errors = append(result.Errors, page.PageID+": "+message)
			_, _ = a.db.ExecContext(ctx, "UPDATE pancake_pages SET status='needs_reconnect',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE page_id=?", message, page.PageID)
			continue
		}

		authFailed := false
		videoCounts[page.Email] += 0
		rateLimit := &pancakePageRateLimiter{}
		for _, request := range pancakeMetricRequests(start, end) {
			query := request.Query
			query.Set("page_access_token", token)
			var payload any
			if request.Name == "posts" {
				payload, err = pancakeFetchPosts(ctx, page.PageID, token, start.Unix(), end.Unix(), rateLimit)
			} else {
				payload, err = pancakeFetchMetric(ctx, page.PageID, request.Path, query, rateLimit)
			}
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, page.PageID+" / "+request.Name+": "+pancakeStatusError(err))
				var apiErr *pancakeAPIError
				if errors.As(err, &apiErr) && apiErr.status == http.StatusUnauthorized {
					authFailed = true
				}
			}
			if err := a.savePancakeMetric(ctx, page.PageID, period, request.Name, payload, err, now); err != nil {
				return result, err
			}
			if err != nil {
				continue
			}
			result.Synced++
			if request.Name == "posts" {
				videoCounts[page.Email] += pancakeVideoPostCount(payload)
			}
		}

		status, lastError := "connected", ""
		if authFailed {
			status, lastError = "needs_reconnect", "Pancake từ chối page token"
		}
		if _, err := a.db.ExecContext(ctx, "UPDATE pancake_pages SET status=?,last_sync_at=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE page_id=?", status, now, lastError, page.PageID); err != nil {
			return result, err
		}
	}

	if !updateChannelStats {
		return result, nil
	}
	if _, err := a.db.ExecContext(ctx, `UPDATE channel_stats SET videos=0,synced_at=?,source='pancake'
		WHERE month=? AND slot=1 AND source='pancake'`, now, period); err != nil {
		return result, err
	}
	for email, videos := range videoCounts {
		if _, err := a.db.ExecContext(ctx, `INSERT INTO channel_stats(month,email,slot,videos,views,followers,synced_at,source)
			VALUES(?,?,1,?,0,0,?,'pancake') ON CONFLICT(month,email,slot)
			DO UPDATE SET videos=excluded.videos,synced_at=excluded.synced_at,source='pancake'`, period, email, videos, now); err != nil {
			return result, err
		}
	}
	return result, nil
}

func pancakeFetchMetric(ctx context.Context, pageID, endpoint string, query url.Values, rateLimit *pancakePageRateLimiter) (any, error) {
	if err := rateLimit.wait(ctx); err != nil {
		return nil, err
	}
	var root any
	path := "/public_api/v1/pages/" + url.PathEscape(pageID) + "/" + endpoint
	if err := pancakeRequest(ctx, http.MethodGet, path, query, &root); err != nil {
		return nil, err
	}
	if m, ok := root.(map[string]any); ok {
		if success, ok := m["success"].(bool); ok && !success {
			return nil, errors.New("Pancake trả success=false")
		}
	}
	return root, nil
}

func pancakeFetchPosts(ctx context.Context, pageID, pageToken string, since, until int64, rateLimit *pancakePageRateLimiter) (any, error) {
	posts := []any{}
	total := -1
	// ponytail: cap at 30,000 posts/month; raise if a page exceeds that volume.
	for pageNumber := 1; pageNumber <= 1000; pageNumber++ {
		if err := rateLimit.wait(ctx); err != nil {
			return nil, err
		}
		query := url.Values{
			"page_access_token": {pageToken},
			"since":             {fmt.Sprint(since)},
			"until":             {fmt.Sprint(until)},
			"page_number":       {fmt.Sprint(pageNumber)},
			"page_size":         {"30"},
		}
		var root any
		path := "/public_api/v1/pages/" + url.PathEscape(pageID) + "/posts"
		if err := pancakeRequest(ctx, http.MethodGet, path, query, &root); err != nil {
			return nil, err
		}
		if m, ok := root.(map[string]any); ok {
			if success, ok := m["success"].(bool); ok && !success {
				return nil, errors.New("Pancake trả success=false")
			}
			if total < 0 {
				if n, ok := m["total"].(float64); ok {
					total = int(n)
				}
			}
		}
		items := firstArray(root, "posts")
		for _, item := range items {
			posts = append(posts, sanitizePancakePost(item))
		}
		if total >= 0 && len(posts) >= total || len(items) < 30 {
			return map[string]any{"total": len(posts), "posts": posts}, nil
		}
	}
	return nil, errors.New("Pancake trả quá 30000 bài trong kỳ")
}

func sanitizePancakePost(value any) any {
	switch x := value.(type) {
	case map[string]any:
		out := map[string]any{}
		for key, child := range x {
			switch strings.ToLower(key) {
			case "message", "original_message", "from", "customer_name", "email", "phone":
				continue
			}
			out[key] = sanitizePancakePost(child)
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i, child := range x {
			out[i] = sanitizePancakePost(child)
		}
		return out
	default:
		return value
	}
}

func sanitizePancakeFeedback(value any) any {
	m, ok := value.(map[string]any)
	if !ok {
		return value
	}
	feedback, ok := m["customer_feedback"].([]any)
	if !ok {
		return value
	}
	ratingCounts := map[string]int{}
	for _, item := range feedback {
		if row, ok := item.(map[string]any); ok {
			if rating, ok := row["rate"].(float64); ok {
				ratingCounts[strconv.Itoa(int(rating))]++
			}
		}
	}
	clean := make(map[string]any, len(m)+2)
	for key, child := range m {
		if key != "customer_feedback" {
			clean[key] = child
		}
	}
	clean["feedback_count"] = len(feedback)
	clean["feedback_rating_counts"] = ratingCounts
	return clean
}

func (a *api) savePancakeMetric(ctx context.Context, pageID, month, endpoint string, payload any, metricErr error, syncedAt string) error {
	if endpoint == "posts" {
		payload = sanitizePancakePost(payload)
	} else if endpoint == "customer_feedbacks" || strings.HasPrefix(endpoint, "customer_feedbacks_part_") {
		payload = sanitizePancakeFeedback(payload)
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	errorText := ""
	if metricErr != nil {
		errorText = pancakeStatusError(metricErr)
	}
	_, err = a.db.ExecContext(ctx, `INSERT INTO pancake_metric_snapshots(page_id,month,endpoint,payload_json,synced_at,error)
		VALUES(?,?,?,?,?,?) ON CONFLICT(page_id,month,endpoint) DO UPDATE SET
		payload_json=excluded.payload_json,synced_at=excluded.synced_at,error=excluded.error`,
		pageID, month, endpoint, string(raw), syncedAt, errorText)
	return err
}

func pancakeVideoPostCount(value any) int {
	posts := firstArray(value, "posts")
	count := 0
	for _, item := range posts {
		if post, ok := item.(map[string]any); ok && strings.EqualFold(stringValue(post["type"]), "video") {
			count++
		}
	}
	return count
}

func firstArray(value any, keys ...string) []any {
	switch x := value.(type) {
	case map[string]any:
		for _, key := range keys {
			if items, ok := x[key].([]any); ok {
				return items
			}
		}
		for _, child := range x {
			if items := firstArray(child, keys...); len(items) > 0 {
				return items
			}
		}
	case []any:
		for _, child := range x {
			if items := firstArray(child, keys...); len(items) > 0 {
				return items
			}
		}
	}
	return nil
}

func (a *api) pancakeAutoSync() {
	run := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		result, err := a.syncPancake(ctx, pancakeCurrentMonth())
		if err != nil {
			log.Printf("Pancake sync failed: %v", err)
			return
		}
		if result.Found > 0 {
			log.Printf("Pancake sync month %s: %d metrics saved, %d failed across %d pages", result.Month, result.Synced, result.Failed, result.Found)
		}
	}
	run()
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		run()
	}
}
