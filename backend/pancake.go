package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
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
	PageID     string `json:"page_id"`
	PageName   string `json:"page_name"`
	Platform   string `json:"platform"`
	Status     string `json:"status"`
	Mapped     bool   `json:"mapped"`
	LastSeenAt string `json:"last_seen_at,omitempty"`
	LastSyncAt string `json:"last_sync_at,omitempty"`
	LastError  string `json:"last_error,omitempty"`
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
	mapped := map[string]bool{}
	rows, err := a.db.QueryContext(ctx, "SELECT page_id FROM channels WHERE lower(platform)='pancake' AND page_id<>''")
	if err != nil {
		return pancakeStatus{}, err
	}
	for rows.Next() {
		var pageID string
		if err := rows.Scan(&pageID); err != nil {
			rows.Close()
			return pancakeStatus{}, err
		}
		mapped[pageID] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return pancakeStatus{}, err
	}
	rows.Close()

	rows, err = a.db.QueryContext(ctx, "SELECT page_id,page_name,platform,status,last_seen_at,last_sync_at,last_error FROM pancake_pages ORDER BY page_name,page_id")
	if err != nil {
		return pancakeStatus{}, err
	}
	defer rows.Close()
	out := pancakeStatus{Pages: []pancakePageState{}}
	for rows.Next() {
		var page pancakePageState
		if err := rows.Scan(&page.PageID, &page.PageName, &page.Platform, &page.Status, &page.LastSeenAt, &page.LastSyncAt, &page.LastError); err != nil {
			return pancakeStatus{}, err
		}
		page.Mapped = mapped[page.PageID]
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
		if tokenEnc == "" || old.Status == "needs_reconnect" {
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
		Slot     int    `json:"slot"`
		PageName string `json:"page_name"`
	}
	if decode(r, &req) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	req.PageID = strings.TrimSpace(req.PageID)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.PageName = strings.TrimSpace(req.PageName)
	if req.PageID == "" || req.Email == "" || (req.Slot != 1 && req.Slot != 2) {
		writeError(w, http.StatusBadRequest, "Cần page, nhân sự và slot 1 hoặc 2")
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
	var oldPageID, oldPlatform string
	err := a.db.QueryRowContext(r.Context(), "SELECT page_id,platform FROM channels WHERE email=? AND slot=?", req.Email, req.Slot).Scan(&oldPageID, &oldPlatform)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	if err == nil && oldPageID != "" && oldPageID != req.PageID && !strings.EqualFold(oldPlatform, "hub") {
		writeError(w, http.StatusConflict, "Slot này đã có page Pancake khác")
		return
	}
	var otherEmail string
	var otherSlot int
	err = a.db.QueryRowContext(r.Context(), "SELECT email,slot FROM channels WHERE lower(platform)='pancake' AND page_id=? AND NOT(email=? AND slot=?)", req.PageID, req.Email, req.Slot).Scan(&otherEmail, &otherSlot)
	if err == nil {
		writeError(w, http.StatusConflict, "Page này đã được gán cho "+otherEmail+" slot "+fmt.Sprint(otherSlot))
		return
	}
	if !errors.Is(err, sql.ErrNoRows) {
		fail(w, err)
		return
	}
	if req.PageName == "" {
		_ = a.db.QueryRowContext(r.Context(), "SELECT page_name FROM pancake_pages WHERE page_id=?", req.PageID).Scan(&req.PageName)
	}
	_, err = a.db.ExecContext(r.Context(), "INSERT INTO channels(email,slot,platform,page_id,page_name) VALUES(?,?,'pancake',?,?) ON CONFLICT(email,slot) DO UPDATE SET platform='pancake',page_id=excluded.page_id,page_name=excluded.page_name", req.Email, req.Slot, req.PageID, req.PageName)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "page_id": req.PageID, "email": req.Email, "slot": req.Slot})
}

type mappedPancakePage struct {
	Email    string
	Slot     int
	PageID   string
	TokenEnc string
}

type pancakeSyncResult struct {
	Month  string   `json:"month"`
	Found  int      `json:"found"`
	Synced int      `json:"synced"`
	Failed int      `json:"failed"`
	Errors []string `json:"errors,omitempty"`
}

func (a *api) pancakeSync(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "channel.sync") {
		return
	}
	var req struct {
		Month string `json:"month"`
	}
	if r.Body != nil && r.Body != http.NoBody {
		_ = decode(r, &req)
	}
	month := strings.TrimSpace(req.Month)
	if month == "" {
		month = time.Now().Format("2006-01")
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
	pancakeSyncMu.Lock()
	defer pancakeSyncMu.Unlock()

	result := pancakeSyncResult{Month: month}
	rows, err := a.db.QueryContext(ctx, "SELECT c.email,c.slot,c.page_id,p.page_access_token_enc FROM channels c JOIN pancake_pages p ON p.page_id=c.page_id WHERE lower(c.platform)='pancake' AND c.page_id<>'' ORDER BY c.email,c.slot")
	if err != nil {
		return result, err
	}
	var pages []mappedPancakePage
	for rows.Next() {
		var page mappedPancakePage
		if err := rows.Scan(&page.Email, &page.Slot, &page.PageID, &page.TokenEnc); err != nil {
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

	start, _ := time.ParseInLocation("2006-01", month, time.UTC)
	end := start.AddDate(0, 1, 0).Add(-time.Second)
	if end.After(time.Now()) {
		end = time.Now()
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, page := range pages {
		token, err := decryptPancakeToken(a.pancakeKey, page.TokenEnc)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, page.PageID+": Không đọc được page token")
			_, _ = a.db.ExecContext(ctx, "UPDATE pancake_pages SET status='error',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE page_id=?", "Không đọc được page token", page.PageID)
			continue
		}
		videos, err := pancakeCountPosts(ctx, page.PageID, token, start.Unix(), end.Unix())
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, page.PageID+": "+pancakeStatusError(err))
			status := "error"
			var apiErr *pancakeAPIError
			if errors.As(err, &apiErr) && (apiErr.status == http.StatusUnauthorized || apiErr.status == http.StatusForbidden) {
				status = "needs_reconnect"
			}
			_, _ = a.db.ExecContext(ctx, "UPDATE pancake_pages SET status=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE page_id=?", status, pancakeStatusError(err), page.PageID)
			continue
		}
		_, err = a.db.ExecContext(ctx, "INSERT INTO channel_stats(month,email,slot,videos,views,followers,synced_at,source) VALUES(?,?,?,?,0,0,?,'pancake') ON CONFLICT(month,email,slot) DO UPDATE SET videos=excluded.videos,synced_at=excluded.synced_at,source='pancake'", month, page.Email, page.Slot, videos, now)
		if err != nil {
			return result, err
		}
		_, err = a.db.ExecContext(ctx, "UPDATE pancake_pages SET status='connected',last_sync_at=?,last_error='',updated_at=CURRENT_TIMESTAMP WHERE page_id=?", now, page.PageID)
		if err != nil {
			return result, err
		}
		result.Synced++
	}
	return result, nil
}

func pancakeCountPosts(ctx context.Context, pageID, pageToken string, since, until int64) (int, error) {
	total := 0
	for pageNumber := 1; pageNumber <= 20; pageNumber++ {
		var root any
		query := url.Values{
			"page_access_token": {pageToken},
			"since":             {fmt.Sprint(since)},
			"until":             {fmt.Sprint(until)},
			"page_number":       {fmt.Sprint(pageNumber)},
			"page_size":         {"100"},
		}
		if err := pancakeRequest(ctx, http.MethodGet, "/public_api/v1/pages/"+url.PathEscape(pageID)+"/posts", query, &root); err != nil {
			return total, err
		}
		items := firstArray(root, "posts", "data")
		if len(items) == 0 {
			break
		}
		total += len(items)
		if len(items) < 100 {
			break
		}
	}
	return total, nil
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
		result, err := a.syncPancake(ctx, time.Now().Format("2006-01"))
		if err != nil {
			log.Printf("Pancake sync failed: %v", err)
			return
		}
		if result.Found > 0 {
			log.Printf("Pancake sync month %s: %d/%d pages", result.Month, result.Synced, result.Found)
		}
	}
	run()
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		run()
	}
}
