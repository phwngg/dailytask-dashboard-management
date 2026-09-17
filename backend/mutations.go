package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"time"
)

func require(w http.ResponseWriter, u user, caps ...string) bool {
	if u.IsAdmin {
		return true
	}
	for _, cap := range caps {
		if !hasCap(u.Caps, cap) {
			writeError(w, http.StatusForbidden, "Bạn không có quyền thực hiện thao tác này")
			return false
		}
	}
	return true
}

func (a *api) createTask(w http.ResponseWriter, r *http.Request, me user) {
	var p struct {
		Title    string  `json:"title"`
		Assignee string  `json:"assignee"`
		Due      string  `json:"due"`
		DueDate  string  `json:"due_date"`
		Priority string  `json:"priority"`
		KPIKey   string  `json:"kpi_key"`
		Qty      float64 `json:"qty"`
	}
	if decode(r, &p) != nil || strings.TrimSpace(p.Title) == "" {
		writeError(w, http.StatusBadRequest, "Thiếu tiêu đề công việc")
		return
	}
	if p.DueDate != "" {
		if _, err := time.Parse("2006-01-02", p.DueDate); err != nil {
			writeError(w, http.StatusBadRequest, "Ngày đến hạn không hợp lệ")
			return
		}
	}
	assignee := me.Email
	if me.IsLeader && p.Assignee != "" {
		assignee = strings.ToLower(strings.TrimSpace(p.Assignee))
	}
	if !me.IsLeader && p.Assignee != "" && p.Assignee != me.Email {
		writeError(w, http.StatusForbidden, "Không có quyền giao việc cho người khác")
		return
	}
	var active int
	if a.db.QueryRowContext(r.Context(), "SELECT active FROM users WHERE email=?", assignee).Scan(&active) != nil || active != 1 {
		writeError(w, http.StatusBadRequest, "Người nhận việc không hợp lệ")
		return
	}
	if p.Qty <= 0 {
		p.Qty = 1
	}
	if p.Priority == "" {
		p.Priority = "Vừa"
	}
	id := newID("T")
	_, err := a.db.ExecContext(r.Context(), "INSERT INTO tasks(id,title,assignee,due,due_date,priority,kpi_key,qty) VALUES(?,?,?,?,?,?,?,?)", id, strings.TrimSpace(p.Title), assignee, p.Due, p.DueDate, p.Priority, p.KPIKey, p.Qty)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": id})
}

func (a *api) updateTask(w http.ResponseWriter, r *http.Request, me user) {
	id := r.PathValue("id")
	var p struct {
		Status string `json:"status"`
	}
	if decode(r, &p) != nil || (p.Status != "todo" && p.Status != "doing" && p.Status != "done") {
		writeError(w, http.StatusBadRequest, "Trạng thái không hợp lệ")
		return
	}
	var assignee string
	err := a.db.QueryRowContext(r.Context(), "SELECT assignee FROM tasks WHERE id=?", id).Scan(&assignee)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Không tìm thấy công việc")
		return
	}
	if err != nil {
		fail(w, err)
		return
	}
	if !me.IsLeader && !strings.EqualFold(assignee, me.Email) {
		writeError(w, http.StatusForbidden, "Không có quyền sửa công việc này")
		return
	}
	doneAt := ""
	if p.Status == "done" {
		doneAt = time.Now().UTC().Format(time.RFC3339)
	}
	_, err = a.db.ExecContext(r.Context(), "UPDATE tasks SET status=?,done_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", p.Status, doneAt, id)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": id, "status": p.Status})
}

func (a *api) createPlan(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "plan.edit") {
		return
	}
	var p plan
	if decode(r, &p) != nil || (strings.TrimSpace(p.Pillar) == "" && strings.TrimSpace(p.Key) == "") {
		writeError(w, http.StatusBadRequest, "Nhập Content Pillar hoặc Key")
		return
	}
	if p.ID == "" {
		p.ID = newID("C")
	}
	if p.Status == "" {
		p.Status = "Chưa thực hiện"
	}
	if p.Month == "" && len(p.PostDate) >= 7 {
		p.Month = p.PostDate[:7]
	}
	if p.Assignee == "" {
		p.Assignee = me.Email
	}
	_, err := a.db.ExecContext(r.Context(), "INSERT INTO content_plan(id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee) VALUES(?,?,?,?,?,?,?,?,?,?)", p.ID, p.Channel, p.Month, p.Pillar, p.Key, p.DemoDate, p.PostDate, p.Status, p.Message, p.Assignee)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": p.ID})
}

func (a *api) updatePlan(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "plan.edit") {
		return
	}
	id := r.PathValue("id")
	var p plan
	if decode(r, &p) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	res, err := a.db.ExecContext(r.Context(), "UPDATE content_plan SET channel=?,month=?,pillar=?,content_key=?,demo_date=?,post_date=?,status=?,message=?,assignee=? WHERE id=?", p.Channel, p.Month, p.Pillar, p.Key, p.DemoDate, p.PostDate, p.Status, p.Message, p.Assignee, id)
	if err != nil {
		fail(w, err)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "Không tìm thấy nội dung")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *api) deletePlan(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "plan.edit") {
		return
	}
	res, err := a.db.ExecContext(r.Context(), "DELETE FROM content_plan WHERE id=?", r.PathValue("id"))
	if err != nil {
		fail(w, err)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeError(w, http.StatusNotFound, "Không tìm thấy nội dung")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (a *api) upsertShift(w http.ResponseWriter, r *http.Request, me user) {
	var p shift
	if decode(r, &p) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	if p.Week == "" {
		writeError(w, http.StatusBadRequest, "Chọn tuần")
		return
	}
	email := me.Email
	if p.Email != "" && !strings.EqualFold(p.Email, email) {
		if !require(w, me, "shifts.manage") {
			return
		}
		email = strings.ToLower(p.Email)
	}
	_, err := a.db.ExecContext(r.Context(), `INSERT INTO shifts(week,email,mon,tue,wed,thu,fri,sat,sun) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(week,email) DO UPDATE SET mon=excluded.mon,tue=excluded.tue,wed=excluded.wed,thu=excluded.thu,fri=excluded.fri,sat=excluded.sat,sun=excluded.sun`, p.Week, email, p.Mon, p.Tue, p.Wed, p.Thu, p.Fri, p.Sat, p.Sun)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "week": p.Week, "email": email})
}

func (a *api) createSchedule(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "plan.manage") {
		return
	}
	var p schedule
	if decode(r, &p) != nil || p.Title == "" || p.Date == "" || p.Time == "" {
		writeError(w, http.StatusBadRequest, "Thiếu tiêu đề, ngày hoặc giờ")
		return
	}
	if p.Kind != "live" {
		p.Kind = "shoot"
	}
	if len(p.Attendees) == 0 {
		writeError(w, http.StatusBadRequest, "Chọn ít nhất một nhân sự")
		return
	}
	if p.Lead == "" {
		p.Lead = p.Attendees[0]
	}
	if p.Qty <= 0 {
		p.Qty = 1
	}
	p.ID = newID(map[bool]string{true: "L", false: "S"}[p.Kind == "live"])
	p.Status = "Đã lên lịch"
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	raw, _ := json.Marshal(p.Attendees)
	_, err = tx.ExecContext(r.Context(), "INSERT INTO schedules(id,kind,title,date,time,location,lead,attendees,status,kpi_key,qty,brief,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", p.ID, p.Kind, p.Title, p.Date, p.Time, p.Location, p.Lead, string(raw), p.Status, p.KPIKey, p.Qty, p.Brief, me.Email)
	if err != nil {
		fail(w, err)
		return
	}
	for _, email := range p.Attendees {
		email = strings.ToLower(strings.TrimSpace(email))
		var n int
		if err = tx.QueryRowContext(r.Context(), "SELECT count(*) FROM users WHERE email=? AND active=1", email).Scan(&n); err != nil || n == 0 {
			writeError(w, http.StatusBadRequest, "Có nhân sự không hợp lệ")
			return
		}
		title := "🎬 Quay: " + p.Title
		if p.Kind == "live" {
			title = "🔴 Live: " + p.Title
		}
		_, err = tx.ExecContext(r.Context(), "INSERT INTO tasks(id,title,assignee,due,priority,status,kpi_key,qty,schedule_id,due_date) VALUES(?,?,?,?,?,?,?,?,?,?)", newID("T"), title, email, p.Date+" "+p.Time, "Cao", "todo", p.KPIKey, p.Qty, p.ID, p.Date)
		if err != nil {
			fail(w, err)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": p.ID, "calendar": false, "mail": false, "warn": "Calendar/email chưa được cấu hình trong bản Go."})
}

func (a *api) createMeeting(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "plan.view") {
		return
	}
	var p meeting
	if decode(r, &p) != nil || p.Title == "" || p.Date == "" || p.Time == "" {
		writeError(w, http.StatusBadRequest, "Thiếu tiêu đề, ngày hoặc giờ")
		return
	}
	if p.Duration <= 0 {
		p.Duration = 60
	}
	if p.Attendees == nil {
		p.Attendees = []string{me.Email}
	}
	if p.Repeat != "weekly" {
		p.Repeat = ""
	}
	p.ID = newID("M")
	raw, _ := json.Marshal(p.Attendees)
	_, err := a.db.ExecContext(r.Context(), "INSERT INTO meetings(id,title,date,time,attendees,duration,repeat,note,created_by) VALUES(?,?,?,?,?,?,?,?,?)", p.ID, p.Title, p.Date, p.Time, string(raw), p.Duration, p.Repeat, p.Note, me.Email)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": p.ID, "calendar": false, "mail": false, "warn": "Calendar/email chưa được cấu hình trong bản Go."})
}

func (a *api) adminUsers(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "users.manage") {
		return
	}
	rows, err := a.db.QueryContext(r.Context(), "SELECT email,coalesce(username,''),name,initials,position,color,role,active,start_date FROM users ORDER BY name LIMIT 500")
	if err != nil {
		fail(w, err)
		return
	}
	defer rows.Close()
	out := []user{}
	for rows.Next() {
		var u user
		if err = rows.Scan(&u.Email, &u.Username, &u.Name, &u.Initials, &u.Position, &u.Color, &u.Role, &u.Active, &u.StartDate); err != nil {
			fail(w, err)
			return
		}
		out = append(out, u)
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": out})
}

func (a *api) createUser(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "users.manage") {
		return
	}
	var p struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Name     string `json:"name"`
		Role     string `json:"role"`
		Password string `json:"password"`
		Position string `json:"position"`
	}
	if decode(r, &p) != nil || !strings.Contains(p.Email, "@") || strings.TrimSpace(p.Name) == "" || len(p.Password) == 0 || len(p.Password) > 72 {
		writeError(w, http.StatusBadRequest, "Kiểm tra email, tên và mật khẩu (1–72 byte)")
		return
	}
	p.Email = strings.ToLower(strings.TrimSpace(p.Email))
	p.Username = strings.ToLower(strings.TrimSpace(p.Username))
	if p.Role == "" {
		p.Role = "staff"
	}
	var roleExists int
	if a.db.QueryRowContext(r.Context(), "SELECT count(*) FROM roles WHERE name=?", p.Role).Scan(&roleExists) != nil || roleExists == 0 {
		writeError(w, http.StatusBadRequest, "Vai trò không tồn tại")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
	if err != nil {
		fail(w, err)
		return
	}
	initials := ""
	for _, word := range strings.Fields(p.Name) {
		runes := []rune(word)
		if len(runes) > 0 {
			initials += string(runes[0])
		}
	}
	runes := []rune(initials)
	if len(runes) > 2 {
		initials = string(runes[len(runes)-2:])
	}
	var username any
	if p.Username != "" {
		username = p.Username
	}
	_, err = a.db.ExecContext(r.Context(), "INSERT INTO users(email,username,name,initials,position,role,password_hash) VALUES(?,?,?,?,?,?,?)", p.Email, username, p.Name, initials, p.Position, p.Role, string(hash))
	if err != nil {
		writeError(w, http.StatusConflict, "Email hoặc tên đăng nhập đã tồn tại")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"email": p.Email})
}

func (a *api) updateUser(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "users.manage") {
		return
	}
	var p struct {
		Name     *string `json:"name"`
		Position *string `json:"position"`
		Active   *bool   `json:"active"`
		Role     string  `json:"role"`
		Password string  `json:"password"`
	}
	if decode(r, &p) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	if p.Password != "" && (len(p.Password) < 8 || len(p.Password) > 72) {
		writeError(w, http.StatusBadRequest, "Mật khẩu phải từ 8 đến 72 ký tự")
		return
	}
	email := strings.ToLower(r.PathValue("email"))
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	var role string
	var active bool
	if err = tx.QueryRowContext(r.Context(), "SELECT role,active FROM users WHERE email=?", email).Scan(&role, &active); err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "Không tìm thấy tài khoản")
		return
	} else if err != nil {
		fail(w, err)
		return
	}
	if p.Active != nil && email == me.Email && !*p.Active {
		writeError(w, http.StatusConflict, "Không thể khoá chính mình")
		return
	}
	newRole, newActive := role, active
	if p.Role != "" {
		var n int
		if err = tx.QueryRowContext(r.Context(), "SELECT count(*) FROM roles WHERE name=?", p.Role).Scan(&n); err != nil {
			fail(w, err)
			return
		}
		if n == 0 {
			writeError(w, http.StatusBadRequest, "Vai trò không tồn tại")
			return
		}
		newRole = p.Role
	}
	if p.Active != nil {
		newActive = *p.Active
	}
	if role == "admin" && active && (!newActive || newRole != "admin") {
		var n int
		if err = tx.QueryRowContext(r.Context(), "SELECT count(*) FROM users WHERE role='admin' AND active=1").Scan(&n); err != nil {
			fail(w, err)
			return
		}
		if n <= 1 {
			writeError(w, http.StatusConflict, "Phải còn ít nhất một Admin đang hoạt động")
			return
		}
	}
	if p.Name != nil {
		if strings.TrimSpace(*p.Name) == "" {
			writeError(w, http.StatusBadRequest, "Tên không được để trống")
			return
		}
		if _, err = tx.ExecContext(r.Context(), "UPDATE users SET name=? WHERE email=?", strings.TrimSpace(*p.Name), email); err != nil {
			fail(w, err)
			return
		}
	}
	if p.Position != nil {
		if _, err = tx.ExecContext(r.Context(), "UPDATE users SET position=? WHERE email=?", strings.TrimSpace(*p.Position), email); err != nil {
			fail(w, err)
			return
		}
	}
	if p.Active != nil {
		if _, err = tx.ExecContext(r.Context(), "UPDATE users SET active=? WHERE email=?", *p.Active, email); err != nil {
			fail(w, err)
			return
		}
		if !*p.Active {
			if _, err = tx.ExecContext(r.Context(), "DELETE FROM sessions WHERE email=?", email); err != nil {
				fail(w, err)
				return
			}
		}
	}
	if p.Role != "" {
		if _, err = tx.ExecContext(r.Context(), "UPDATE users SET role=? WHERE email=?", p.Role, email); err != nil {
			fail(w, err)
			return
		}
	}
	if p.Password != "" {
		hash, hashErr := bcrypt.GenerateFromPassword([]byte(p.Password), bcrypt.DefaultCost)
		if hashErr != nil {
			fail(w, hashErr)
			return
		}
		if _, err = tx.ExecContext(r.Context(), "UPDATE users SET password_hash=? WHERE email=?", string(hash), email); err != nil {
			fail(w, err)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (a *api) payroll(w http.ResponseWriter, r *http.Request, me user) {
	rows, month, err := a.payrollRows(r.Context(), me)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"month": month, "rows": rows})
}
