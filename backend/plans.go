package main

import (
	"context"
	"errors"
	"net/http"
	"sort"
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

type planChannelGroup struct {
	Key       string         `json:"key"`
	Name      string         `json:"name"`
	Total     int            `json:"total"`
	Upcoming  int            `json:"upcoming"`
	Overdue   int            `json:"overdue"`
	NextPost  string         `json:"next_post"`
	ByStatus  map[string]int `json:"by_status"`
	Assignees []string       `json:"assignees"`
}

type planPage struct {
	Items      []plan             `json:"items"`
	Total      int                `json:"total"`
	Stats      planStats          `json:"stats"`
	Groups     []planChannelGroup `json:"groups"`
	Channels   []string           `json:"channels"`
	Statuses   []string           `json:"statuses"`
	HasMore    bool               `json:"hasMore"`
	NextCursor *planCursor        `json:"nextCursor"`
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
	out.Groups, err = a.planChannelGroupsForRequest(r, me)
	if err != nil {
		fail(w, err)
		return
	}

	optionScope := ""
	optionArgs := []any{}
	if !me.IsLeader && !me.IsAdmin {
		optionScope = " AND assignee=?"
		optionArgs = append(optionArgs, me.Email)
	}
	channelRows, err := a.db.QueryContext(r.Context(), "SELECT DISTINCT trim(channel) FROM content_plan WHERE trim(channel)<>''"+optionScope+" ORDER BY trim(channel)", optionArgs...)
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
	if r.URL.Query().Get("groupsOnly") == "1" {
		out.Items = []plan{}
		writeJSON(w, http.StatusOK, out)
		return
	}

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
	rows, err := a.db.QueryContext(r.Context(), `SELECT id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee,reviewed_by,reviewed_at,review_note
		FROM content_plan`+pageWhere+" ORDER BY post_date DESC,id DESC LIMIT ?", pageArgs...)
	if err != nil {
		fail(w, err)
		return
	}
	defer rows.Close()
	out.Items = make([]plan, 0, limit)
	for rows.Next() {
		var p plan
		if err := rows.Scan(&p.ID, &p.Channel, &p.Month, &p.Pillar, &p.Key, &p.DemoDate, &p.PostDate, &p.Status, &p.Message, &p.Assignee, &p.ReviewedBy, &p.ReviewedAt, &p.ReviewNote); err != nil {
			fail(w, err)
			return
		}
		out.Items = append(out.Items, p)
	}
	if err := rows.Err(); err != nil {
		fail(w, err)
		return
	}
	if id := strings.TrimSpace(r.URL.Query().Get("id")); id != "" && len(out.Items) == 1 {
		reviews, err := a.planReviews(r.Context(), id)
		if err != nil {
			fail(w, err)
			return
		}
		out.Items[0].Reviews = reviews
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
	for _, item := range []struct{ key, column string }{{"assignee", "assignee"}, {"status", "status"}, {"id", "id"}} {
		if value := strings.TrimSpace(r.URL.Query().Get(item.key)); value != "" {
			if len(value) > 200 {
				return nil, nil, errors.New("Bộ lọc không hợp lệ")
			}
			clauses = append(clauses, item.column+"=?")
			args = append(args, value)
		}
	}
	if value := strings.TrimSpace(r.URL.Query().Get("channel")); value != "" {
		if len(value) > 200 {
			return nil, nil, errors.New("Bộ lọc không hợp lệ")
		}
		if value == "__empty" {
			clauses = append(clauses, "trim(channel)=''")
		} else {
			clauses = append(clauses, "trim(channel)=?")
			args = append(args, value)
		}
	}
	if r.URL.Query().Get("unpublished") == "1" {
		clauses = append(clauses, "status<>?")
		args = append(args, "Đã đăng")
	}
	if r.URL.Query().Get("overdue") == "1" {
		loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
		if err != nil {
			return nil, nil, err
		}
		clauses = append(clauses, "status<>? AND post_date<>? AND post_date<?")
		args = append(args, "Đã đăng", "", time.Now().In(loc).Format("2006-01-02"))
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

func (a *api) planChannelGroupsForRequest(r *http.Request, me user) ([]planChannelGroup, error) {
	clone := r.Clone(r.Context())
	query := clone.URL.Query()
	query.Del("id")
	clone.URL.RawQuery = query.Encode()
	clauses, args, err := planFilter(clone)
	if err != nil {
		return nil, err
	}
	if !me.IsLeader && !me.IsAdmin {
		clauses = append(clauses, "assignee=?")
		args = append(args, me.Email)
	}
	where := ""
	if len(clauses) > 0 {
		where = " WHERE " + strings.Join(clauses, " AND ")
	}
	return a.planChannelGroups(r.Context(), where, args)
}

func (a *api) planChannelGroups(ctx context.Context, where string, args []any) ([]planChannelGroup, error) {
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		return nil, err
	}
	today := time.Now().In(loc).Format("2006-01-02")
	rows, err := a.db.QueryContext(ctx, "SELECT trim(channel),status,post_date,assignee FROM content_plan"+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	groups := map[string]*planChannelGroup{}
	owners := map[string]map[string]bool{}
	for rows.Next() {
		var key, status, postDate, assignee string
		if err := rows.Scan(&key, &status, &postDate, &assignee); err != nil {
			return nil, err
		}
		group := groups[key]
		if group == nil {
			name := key
			if name == "" {
				name = "Chưa gán Kênh"
			}
			group = &planChannelGroup{Key: key, Name: name, ByStatus: map[string]int{}, Assignees: []string{}}
			groups[key] = group
			owners[key] = map[string]bool{}
		}
		group.Total++
		group.ByStatus[status]++
		if assignee != "" && !owners[key][assignee] {
			owners[key][assignee] = true
			group.Assignees = append(group.Assignees, assignee)
		}
		if status != "Đã đăng" && postDate != "" {
			if postDate < today {
				group.Overdue++
			} else {
				group.Upcoming++
				if group.NextPost == "" || postDate < group.NextPost {
					group.NextPost = postDate
				}
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]planChannelGroup, 0, len(groups))
	for _, group := range groups {
		sort.Strings(group.Assignees)
		out = append(out, *group)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].NextPost == "" && out[j].NextPost != "" {
			return false
		}
		if out[i].NextPost != "" && out[j].NextPost == "" {
			return true
		}
		if out[i].NextPost != out[j].NextPost {
			return out[i].NextPost < out[j].NextPost
		}
		if out[i].Total != out[j].Total {
			return out[i].Total > out[j].Total
		}
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (a *api) planReviews(ctx context.Context, planID string) ([]planReview, error) {
	rows, err := a.db.QueryContext(ctx, `SELECT r.id,r.action,r.note,r.actor,coalesce(u.name,r.actor),r.created_at
		FROM content_plan_reviews r LEFT JOIN users u ON u.email=r.actor WHERE r.plan_id=? ORDER BY r.created_at DESC,r.id DESC`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []planReview{}
	for rows.Next() {
		var item planReview
		if err := rows.Scan(&item.ID, &item.Action, &item.Note, &item.Actor, &item.ActorName, &item.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
