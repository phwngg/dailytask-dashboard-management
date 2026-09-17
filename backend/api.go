package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type api struct {
	db           *sql.DB
	cookieSecure bool
	pancakeKey   []byte
}

type user struct {
	Email     string   `json:"email"`
	Username  string   `json:"username"`
	Name      string   `json:"name"`
	Initials  string   `json:"initials"`
	Position  string   `json:"position"`
	Color     string   `json:"color"`
	Role      string   `json:"role"`
	Active    bool     `json:"active"`
	StartDate string   `json:"start_date"`
	Caps      []string `json:"caps,omitempty"`
	IsAdmin   bool     `json:"isAdmin,omitempty"`
	IsLeader  bool     `json:"isLeader,omitempty"`
}

type task struct {
	ID         string  `json:"id"`
	Title      string  `json:"title"`
	Assignee   string  `json:"assignee"`
	Due        string  `json:"due"`
	DueDate    string  `json:"due_date"`
	Priority   string  `json:"priority"`
	Status     string  `json:"status"`
	KPIKey     string  `json:"kpi_key"`
	Qty        float64 `json:"qty"`
	DoneAt     string  `json:"done_at"`
	ScheduleID string  `json:"schedule_id"`
}

type planReview struct {
	ID        int64  `json:"id"`
	Action    string `json:"action"`
	Note      string `json:"note"`
	Actor     string `json:"actor"`
	ActorName string `json:"actor_name"`
	CreatedAt string `json:"created_at"`
}

type plan struct {
	ID         string       `json:"id"`
	Channel    string       `json:"channel"`
	Month      string       `json:"month"`
	Pillar     string       `json:"pillar"`
	Key        string       `json:"key"`
	DemoDate   string       `json:"demo_date"`
	PostDate   string       `json:"post_date"`
	Status     string       `json:"status"`
	Message    string       `json:"message"`
	Assignee   string       `json:"assignee"`
	ReviewedBy string       `json:"reviewed_by,omitempty"`
	ReviewedAt string       `json:"reviewed_at,omitempty"`
	ReviewNote string       `json:"review_note,omitempty"`
	Reviews    []planReview `json:"reviews,omitempty"`
}

type channelMapping struct {
	Email    string `json:"email"`
	Slot     int    `json:"slot"`
	Platform string `json:"platform"`
	PageID   string `json:"page_id"`
	PageName string `json:"page_name"`
}

type schedule struct {
	ID        string   `json:"id"`
	Kind      string   `json:"kind"`
	Title     string   `json:"title"`
	Date      string   `json:"date"`
	Time      string   `json:"time"`
	Location  string   `json:"location"`
	Lead      string   `json:"lead"`
	Attendees []string `json:"attendees"`
	Status    string   `json:"status"`
	KPIKey    string   `json:"kpi_key"`
	Qty       float64  `json:"qty"`
	Done      bool     `json:"done"`
	Brief     string   `json:"brief"`
}

type shift struct {
	Week  string `json:"week"`
	Email string `json:"email"`
	Mon   string `json:"T2"`
	Tue   string `json:"T3"`
	Wed   string `json:"T4"`
	Thu   string `json:"T5"`
	Fri   string `json:"T6"`
	Sat   string `json:"T7"`
	Sun   string `json:"CN"`
}

type meeting struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Date      string   `json:"date"`
	Time      string   `json:"time"`
	Attendees []string `json:"attendees"`
	Duration  int      `json:"duration"`
	Repeat    string   `json:"repeat"`
	Note      string   `json:"note"`
}

func (a *api) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := a.db.PingContext(ctx); err != nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *api) login(w http.ResponseWriter, r *http.Request) {
	var p struct{ Email, Username, Password string }
	if err := decode(r, &p); err != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	id := strings.ToLower(strings.TrimSpace(p.Email))
	if id == "" {
		id = strings.ToLower(strings.TrimSpace(p.Username))
	}
	var u user
	var hash string
	err := a.db.QueryRowContext(r.Context(), "SELECT email,coalesce(username,''),name,initials,position,color,role,active,start_date,password_hash FROM users WHERE email=? OR username=? LIMIT 1", id, id).
		Scan(&u.Email, &u.Username, &u.Name, &u.Initials, &u.Position, &u.Color, &u.Role, &u.Active, &u.StartDate, &hash)
	if err != nil || !u.Active || !passwordMatches(hash, p.Password) {
		writeError(w, http.StatusUnauthorized, "Tài khoản hoặc mật khẩu không đúng")
		return
	}
	if strings.HasPrefix(hash, "legacy-sha256$") {
		upgraded, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Không thể cập nhật thông tin đăng nhập")
			return
		}
		if _, err = a.db.ExecContext(r.Context(), "UPDATE users SET password_hash=? WHERE email=?", string(upgraded), u.Email); err != nil {
			writeError(w, http.StatusInternalServerError, "Không thể cập nhật thông tin đăng nhập")
			return
		}
	}
	if err := a.loadCaps(r.Context(), &u); err != nil {
		writeError(w, http.StatusInternalServerError, "Không tải được quyền truy cập")
		return
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		writeError(w, http.StatusInternalServerError, "Không tạo được phiên đăng nhập")
		return
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	expires := time.Now().Add(30 * 24 * time.Hour)
	if _, err := a.db.ExecContext(r.Context(), "INSERT INTO sessions(token_hash,email,expires_at) VALUES(?,?,?)", hashToken(token), u.Email, expires.Unix()); err != nil {
		writeError(w, http.StatusInternalServerError, "Không lưu được phiên đăng nhập")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "session", Value: token, Path: "/", Expires: expires, MaxAge: int((30 * 24 * time.Hour).Seconds()), HttpOnly: true, Secure: a.cookieSecure, SameSite: http.SameSiteStrictMode})
	writeJSON(w, http.StatusOK, map[string]any{"user": u})
}

func passwordMatches(stored, password string) bool {
	if bcrypt.CompareHashAndPassword([]byte(stored), []byte(password)) == nil {
		return true
	}
	parts := strings.SplitN(stored, "$", 3)
	if len(parts) != 3 || parts[0] != "legacy-sha256" {
		return false
	}
	sum := sha256.Sum256([]byte(parts[1] + password))
	want, err := base64.StdEncoding.DecodeString(parts[2])
	return err == nil && subtle.ConstantTimeCompare(sum[:], want) == 1
}

func (a *api) protected(next func(http.ResponseWriter, *http.Request, user)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie("session")
		if err != nil || c.Value == "" {
			writeError(w, http.StatusUnauthorized, "Phiên đăng nhập đã hết hạn")
			return
		}
		var u user
		var expiry int64
		tokenHash := hashToken(c.Value)
		err = a.db.QueryRowContext(r.Context(), "SELECT u.email,coalesce(u.username,''),u.name,u.initials,u.position,u.color,u.role,u.active,u.start_date,s.expires_at FROM sessions s JOIN users u ON u.email=s.email WHERE s.token_hash=?", tokenHash).
			Scan(&u.Email, &u.Username, &u.Name, &u.Initials, &u.Position, &u.Color, &u.Role, &u.Active, &u.StartDate, &expiry)
		if err != nil || !u.Active || expiry < time.Now().Unix() {
			_, _ = a.db.ExecContext(r.Context(), "DELETE FROM sessions WHERE token_hash=? OR expires_at<?", tokenHash, time.Now().Unix())
			http.SetCookie(w, &http.Cookie{Name: "session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: a.cookieSecure, SameSite: http.SameSiteStrictMode})
			writeError(w, http.StatusUnauthorized, "Phiên đăng nhập đã hết hạn")
			return
		}
		if err := a.loadCaps(r.Context(), &u); err != nil {
			writeError(w, http.StatusInternalServerError, "Không tải được quyền truy cập")
			return
		}
		next(w, r, u)
	}
}

func (a *api) logout(w http.ResponseWriter, r *http.Request, u user) {
	if c, err := r.Cookie("session"); err == nil {
		_, _ = a.db.ExecContext(r.Context(), "DELETE FROM sessions WHERE token_hash=?", hashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: "session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: a.cookieSecure, SameSite: http.SameSiteStrictMode})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *api) loadCaps(ctx context.Context, u *user) error {
	var raw string
	if err := a.db.QueryRowContext(ctx, "SELECT caps FROM roles WHERE name=?", u.Role).Scan(&raw); err != nil {
		return err
	}
	if err := json.Unmarshal([]byte(raw), &u.Caps); err != nil {
		return err
	}
	u.IsAdmin = u.Role == "admin"
	u.IsLeader = u.IsAdmin || u.Role == "leader" || hasCap(u.Caps, "plan.manage")
	return nil
}

func hasCap(caps []string, cap string) bool {
	for _, item := range caps {
		if item == cap {
			return true
		}
	}
	return false
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func decode(r *http.Request, out any) error {
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(out)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func fail(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Không tìm thấy dữ liệu")
		return
	}
	writeError(w, http.StatusInternalServerError, "Có lỗi khi xử lý yêu cầu")
}
