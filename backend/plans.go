package main

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type planCursor struct {
	Date string `json:"date"`
	ID   string `json:"id"`
}

type planStats struct {
	Total      int            `json:"total"`
	Published  int            `json:"published"`
	InProgress int            `json:"in_progress"`
	Planned    int            `json:"planned"`
	ByStatus   map[string]int `json:"by_status"`
}

type planPage struct {
	Items      []plan      `json:"items"`
	Total      int         `json:"total"`
	Stats      planStats   `json:"stats"`
	Channels   []string    `json:"channels"`
	Statuses   []string    `json:"statuses"`
	HasMore    bool        `json:"hasMore"`
	NextCursor *planCursor `json:"nextCursor"`
}

func (a *api) listPlans(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "plan.view") {
		return
	}
	limit := 40
	if raw := r.URL.Query().Get("limit"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 100 {
			writeError(w, http.StatusBadRequest, "Số dòng mỗi lần tải phải từ 1 đến 100")
			return
		}
		limit = value
	}
	cursorDate, cursorID := r.URL.Query().Get("cursorDate"), r.URL.Query().Get("cursorID")
	if cursorID == "" && cursorDate != "" {
		writeError(w, http.StatusBadRequest, "Con trỏ phân trang không hợp lệ")
		return
	}
	if cursorID != "" && cursorDate != "" {
		if _, err := time.Parse("2006-01-02", cursorDate); err != nil {
			writeError(w, http.StatusBadRequest, "Con trỏ phân trang không hợp lệ")
			return
		}
	}

	clauses, args, err := planFilter(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !me.IsLeader && !me.IsAdmin {
		clauses = append(clauses, "assignee=?")
		args = append(args, me.Email)
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}
	var out planPage
	out.Stats.ByStatus = map[string]int{}
	statusCounts, err := a.db.QueryContext(r.Context(), "SELECT status,count(*) FROM content_plan"+where+" GROUP BY status ORDER BY status", args...)
	if err != nil {
		fail(w, err)
		return
	}
	for statusCounts.Next() {
		var status string
		var count int
		if err := statusCounts.Scan(&status, &count); err != nil {
			statusCounts.Close()
			fail(w, err)
			return
		}
		out.Stats.ByStatus[status] = count
		out.Total += count
		switch status {
		case "Đã đăng":
			out.Stats.Published = count
		case "Đang thực hiện":
			out.Stats.InProgress = count
		case "Chưa thực hiện":
			out.Stats.Planned = count
		}
	}
	if err := statusCounts.Err(); err != nil {
		statusCounts.Close()
		fail(w, err)
		return
	}
	statusCounts.Close()
	out.Stats.Total = out.Total

	optionScope := ""
	optionArgs := []any{}
	if !me.IsLeader && !me.IsAdmin {
		optionScope = " AND assignee=?"
		optionArgs = append(optionArgs, me.Email)
	}
	channelRows, err := a.db.QueryContext(r.Context(), "SELECT DISTINCT channel FROM content_plan WHERE channel<>''"+optionScope+" ORDER BY channel", optionArgs...)
	if err != nil {
		fail(w, err)
		return
	}
	out.Channels = []string{}
	for channelRows.Next() {
		var channel string
		if err := channelRows.Scan(&channel); err != nil {
			channelRows.Close()
			fail(w, err)
			return
		}
		out.Channels = append(out.Channels, channel)
	}
	if err := channelRows.Err(); err != nil {
		channelRows.Close()
		fail(w, err)
		return
	}
	channelRows.Close()
	statusRows, err := a.db.QueryContext(r.Context(), "SELECT DISTINCT status FROM content_plan WHERE status<>''"+optionScope+" ORDER BY status", optionArgs...)
	if err != nil {
		fail(w, err)
		return
	}
	out.Statuses = []string{}
	for statusRows.Next() {
		var status string
		if err := statusRows.Scan(&status); err != nil {
			statusRows.Close()
			fail(w, err)
			return
		}
		out.Statuses = append(out.Statuses, status)
	}
	if err := statusRows.Err(); err != nil {
		statusRows.Close()
		fail(w, err)
		return
	}
	statusRows.Close()

	pageClauses := append([]string(nil), clauses...)
	pageArgs := append([]any(nil), args...)
	if cursorID != "" {
		pageClauses = append(pageClauses, "(post_date < ? OR (post_date = ? AND id < ?))")
		pageArgs = append(pageArgs, cursorDate, cursorDate, cursorID)
	}
	pageWhere := ""
	if len(pageClauses) > 0 {
		pageWhere = " WHERE " + strings.Join(pageClauses, " AND ")
	}
	pageArgs = append(pageArgs, limit+1)
	rows, err := a.db.QueryContext(r.Context(), `SELECT id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee
		FROM content_plan`+pageWhere+" ORDER BY post_date DESC,id DESC LIMIT ?", pageArgs...)
	if err != nil {
		fail(w, err)
		return
	}
	defer rows.Close()
	out.Items = make([]plan, 0, limit)
	for rows.Next() {
		var p plan
		if err := rows.Scan(&p.ID, &p.Channel, &p.Month, &p.Pillar, &p.Key, &p.DemoDate, &p.PostDate, &p.Status, &p.Message, &p.Assignee); err != nil {
			fail(w, err)
			return
		}
		out.Items = append(out.Items, p)
	}
	if err := rows.Err(); err != nil {
		fail(w, err)
		return
	}
	out.HasMore = len(out.Items) > limit
	if out.HasMore {
		out.Items = out.Items[:limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = &planCursor{Date: last.PostDate, ID: last.ID}
	}
	writeJSON(w, http.StatusOK, out)
}

func planFilter(r *http.Request) ([]string, []any, error) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) > 200 {
		return nil, nil, errors.New("Bộ lọc không hợp lệ")
	}
	clauses, args := []string{}, []any{}
	if q != "" {
		q = strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(q)
		pattern := "%" + q + "%"
		clauses = append(clauses, "(content_key LIKE ? ESCAPE '\\' OR pillar LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\')")
		args = append(args, pattern, pattern, pattern)
	}
	for _, item := range []struct{ key, column string }{{"channel", "channel"}, {"assignee", "assignee"}, {"status", "status"}, {"id", "id"}} {
		if value := strings.TrimSpace(r.URL.Query().Get(item.key)); value != "" {
			if len(value) > 200 {
				return nil, nil, errors.New("Bộ lọc không hợp lệ")
			}
			clauses = append(clauses, item.column+"=?")
			args = append(args, value)
		}
	}
	if r.URL.Query().Get("unpublished") == "1" {
		clauses = append(clauses, "status<>?")
		args = append(args, "Đã đăng")
	}
	from, to := r.URL.Query().Get("from"), r.URL.Query().Get("to")
	for _, item := range []struct{ value, clause string }{{from, "post_date>=?"}, {to, "post_date<=?"}} {
		if item.value != "" {
			if _, err := time.Parse("2006-01-02", item.value); err != nil {
				return nil, nil, errors.New("Ngày lọc không hợp lệ")
			}
			clauses = append(clauses, item.clause)
			args = append(args, item.value)
		}
	}
	if from != "" && to != "" && from > to {
		return nil, nil, errors.New("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc")
	}
	return clauses, args, nil
}
