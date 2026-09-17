package main

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

type overviewMetrics struct {
	Overdue       int `json:"overdue"`
	Today         int `json:"today"`
	Content7Days  int `json:"content7days"`
	CompletedWeek int `json:"completedWeek"`
}

type overviewProgressPoint struct {
	Date      string `json:"date"`
	Rate      *int   `json:"rate"`
	Completed int    `json:"completed"`
	Total     int    `json:"total"`
}

type overviewProgressWeek struct {
	WeekStart string                  `json:"weekStart"`
	WeekEnd   string                  `json:"weekEnd"`
	Total     int                     `json:"total"`
	Completed int                     `json:"completed"`
	Points    []overviewProgressPoint `json:"points"`
}

type overviewProgressTrend struct {
	Previous overviewProgressWeek `json:"previous"`
	Current  overviewProgressWeek `json:"current"`
}

type overviewProgress struct {
	Total     int                   `json:"total"`
	Completed int                   `json:"completed"`
	Trend     overviewProgressTrend `json:"trend"`
}

type overviewSummary struct {
	Today       string           `json:"today"`
	Through     string           `json:"through"`
	Monday      string           `json:"monday"`
	Sunday      string           `json:"sunday"`
	Metrics     overviewMetrics  `json:"metrics"`
	Progress    overviewProgress `json:"progress"`
	Tasks       []task           `json:"tasks"`
	ContentPlan []plan           `json:"contentPlan"`
	Shoots      []schedule       `json:"shoots"`
	Lives       []schedule       `json:"lives"`
	Meetings    []meeting        `json:"meetings"`
}

func (a *api) overview(w http.ResponseWriter, r *http.Request, me user) {
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		fail(w, err)
		return
	}
	now := time.Now().In(loc)
	today := now.Format("2006-01-02")
	monday := now.AddDate(0, 0, -((int(now.Weekday()) + 6) % 7))
	through := now.AddDate(0, 0, 6).Format("2006-01-02")
	sunday := monday.AddDate(0, 0, 6).Format("2006-01-02")
	assignee := strings.TrimSpace(r.URL.Query().Get("assignee"))
	if !me.IsLeader && !hasCap(me.Caps, "checklist.viewAll") {
		assignee = me.Email
	}
	if assignee != "" {
		var active int
		if err := a.db.QueryRowContext(r.Context(), "SELECT active FROM users WHERE email=?", assignee).Scan(&active); err != nil || active != 1 {
			writeError(w, http.StatusBadRequest, "Thành viên không hợp lệ")
			return
		}
	}
	where, args := overviewAssignee(assignee)
	whereOpen := where + " AND status<>?"
	argsOpen := append(append([]any{}, args...), "done")
	var out overviewSummary
	out.Today, out.Through, out.Monday, out.Sunday = today, through, monday.Format("2006-01-02"), sunday
	queries := []struct {
		target *int
		query  string
		args   []any
	}{
		{&out.Metrics.Overdue, "SELECT count(*) FROM tasks" + whereOpen + " AND due_date<>'' AND due_date<?", append(append([]any{}, argsOpen...), today)},
		{&out.Metrics.Today, "SELECT count(*) FROM tasks" + whereOpen + " AND due_date=?", append(append([]any{}, argsOpen...), today)},
		{&out.Metrics.CompletedWeek, "SELECT count(*) FROM tasks" + where + " AND status='done' AND date(done_at,'+7 hours') BETWEEN ? AND ?", append(append([]any{}, args...), out.Monday, out.Sunday)},
	}
	for _, item := range queries {
		if err := a.db.QueryRowContext(r.Context(), item.query, item.args...).Scan(item.target); err != nil {
			fail(w, err)
			return
		}
	}
	out.Progress.Trend, err = a.overviewProgressTrend(r.Context(), assignee, monday, today)
	if err != nil {
		fail(w, err)
		return
	}
	out.Progress.Total = out.Progress.Trend.Current.Total
	out.Progress.Completed = out.Progress.Trend.Current.Completed
	if me.IsAdmin || hasCap(me.Caps, "plan.view") {
		planWhere, planArgs := overviewAssignee(assignee)
		if err := a.db.QueryRowContext(r.Context(), "SELECT count(*) FROM content_plan"+planWhere+" AND status<>? AND post_date BETWEEN ? AND ?", append(append(append([]any{}, planArgs...), "Đã đăng"), today, through)...).Scan(&out.Metrics.Content7Days); err != nil {
			fail(w, err)
			return
		}
		out.ContentPlan, err = a.overviewPlans(r.Context(), assignee, today, through)
		if err != nil {
			fail(w, err)
			return
		}
	}
	out.Tasks, err = a.overviewTasks(r.Context(), assignee, today)
	if err != nil {
		fail(w, err)
		return
	}
	out.Shoots, out.Lives, err = a.overviewSchedules(r.Context(), assignee, today)
	if err != nil {
		fail(w, err)
		return
	}
	out.Meetings, err = a.overviewMeetings(r.Context(), assignee, today)
	if err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type overviewTrendTask struct {
	DueDate       string
	Status        string
	CompletedDate string
}

func (a *api) overviewProgressTrend(ctx context.Context, assignee string, monday time.Time, today string) (overviewProgressTrend, error) {
	previousMonday := monday.AddDate(0, 0, -7)
	weekEnd := monday.AddDate(0, 0, 6)
	where, args := overviewAssignee(assignee)
	args = append(args, previousMonday.Format("2006-01-02"), weekEnd.Format("2006-01-02"))
	rows, err := a.db.QueryContext(ctx, "SELECT due_date,status,coalesce(date(done_at,'+7 hours'),'') FROM tasks"+where+" AND due_date BETWEEN ? AND ?", args...)
	if err != nil {
		return overviewProgressTrend{}, err
	}
	defer rows.Close()
	tasks := []overviewTrendTask{}
	for rows.Next() {
		var item overviewTrendTask
		if err := rows.Scan(&item.DueDate, &item.Status, &item.CompletedDate); err != nil {
			return overviewProgressTrend{}, err
		}
		tasks = append(tasks, item)
	}
	if err := rows.Err(); err != nil {
		return overviewProgressTrend{}, err
	}
	return overviewProgressTrend{
		Previous: buildOverviewProgressWeek(previousMonday, tasks, false, today),
		Current:  buildOverviewProgressWeek(monday, tasks, true, today),
	}, nil
}

func buildOverviewProgressWeek(start time.Time, tasks []overviewTrendTask, current bool, today string) overviewProgressWeek {
	end := start.AddDate(0, 0, 6)
	startKey, endKey := start.Format("2006-01-02"), end.Format("2006-01-02")
	weekTasks := make([]overviewTrendTask, 0)
	for _, task := range tasks {
		if task.DueDate >= startKey && task.DueDate <= endKey {
			weekTasks = append(weekTasks, task)
		}
	}
	week := overviewProgressWeek{WeekStart: startKey, WeekEnd: endKey, Total: len(weekTasks), Points: make([]overviewProgressPoint, 0, 7)}
	for day := 0; day < 7; day++ {
		date := start.AddDate(0, 0, day).Format("2006-01-02")
		completed := 0
		for _, task := range weekTasks {
			if task.Status == "done" && task.CompletedDate != "" && task.CompletedDate <= date {
				completed++
			}
		}
		point := overviewProgressPoint{Date: date, Completed: completed, Total: week.Total}
		if week.Total > 0 && (!current || date <= today) {
			rate := int((completed*100 + week.Total/2) / week.Total)
			point.Rate = &rate
		}
		week.Points = append(week.Points, point)
	}
	for _, task := range weekTasks {
		if task.Status == "done" && task.CompletedDate != "" && (!current || task.CompletedDate <= today) {
			week.Completed++
		}
	}
	return week
}

func overviewAssignee(assignee string) (string, []any) {
	if assignee == "" {
		return " WHERE 1=1", nil
	}
	return " WHERE assignee=?", []any{assignee}
}

func (a *api) overviewTasks(ctx context.Context, assignee, today string) ([]task, error) {
	where, args := overviewAssignee(assignee)
	query := `SELECT id,title,assignee,due,due_date,priority,status,kpi_key,qty,done_at,schedule_id FROM tasks` + where + ` AND status<>? ORDER BY CASE WHEN due_date<>'' AND due_date<? THEN 0 WHEN due_date=? THEN 1 ELSE 2 END, CASE priority WHEN 'Cao' THEN 0 WHEN 'Vừa' THEN 1 ELSE 2 END, due_date,id LIMIT 5`
	args = append(args, "done", today, today)
	return queryTasks(ctx, a.db, query, args...)
}

func queryTasks(ctx context.Context, db *sql.DB, query string, args ...any) ([]task, error) {
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []task{}
	for rows.Next() {
		var item task
		if err := rows.Scan(&item.ID, &item.Title, &item.Assignee, &item.Due, &item.DueDate, &item.Priority, &item.Status, &item.KPIKey, &item.Qty, &item.DoneAt, &item.ScheduleID); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (a *api) overviewPlans(ctx context.Context, assignee, today, through string) ([]plan, error) {
	where, args := overviewAssignee(assignee)
	query := `SELECT id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee,reviewed_by,reviewed_at,review_note FROM content_plan` + where + ` AND status<>? AND post_date BETWEEN ? AND ? ORDER BY post_date,id LIMIT 5`
	args = append(args, "Đã đăng", today, through)
	rows, err := a.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []plan{}
	for rows.Next() {
		var item plan
		if err := rows.Scan(&item.ID, &item.Channel, &item.Month, &item.Pillar, &item.Key, &item.DemoDate, &item.PostDate, &item.Status, &item.Message, &item.Assignee, &item.ReviewedBy, &item.ReviewedAt, &item.ReviewNote); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (a *api) overviewSchedules(ctx context.Context, assignee, today string) ([]schedule, []schedule, error) {
	where := " WHERE date>=? AND done=0"
	args := []any{today}
	if assignee != "" {
		where += " AND (lead=? OR attendees LIKE ?)"
		args = append(args, assignee, "%"+assignee+"%")
	}
	rows, err := a.db.QueryContext(ctx, "SELECT id,kind,title,date,time,location,lead,attendees,status,kpi_key,qty,done,brief FROM schedules"+where+" ORDER BY date,time LIMIT 10", args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	shoots, lives := []schedule{}, []schedule{}
	for rows.Next() {
		var item schedule
		var attendees string
		if err := rows.Scan(&item.ID, &item.Kind, &item.Title, &item.Date, &item.Time, &item.Location, &item.Lead, &attendees, &item.Status, &item.KPIKey, &item.Qty, &item.Done, &item.Brief); err != nil {
			return nil, nil, err
		}
		_ = jsonUnmarshal(attendees, &item.Attendees)
		if item.Kind == "live" {
			lives = append(lives, item)
		} else {
			shoots = append(shoots, item)
		}
	}
	return shoots, lives, rows.Err()
}

func (a *api) overviewMeetings(ctx context.Context, assignee, today string) ([]meeting, error) {
	where := " WHERE date>=?"
	args := []any{today}
	if assignee != "" {
		where += " AND attendees LIKE ?"
		args = append(args, "%"+assignee+"%")
	}
	rows, err := a.db.QueryContext(ctx, "SELECT id,title,date,time,attendees,duration,repeat,note FROM meetings"+where+" ORDER BY date,time LIMIT 10", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []meeting{}
	for rows.Next() {
		var item meeting
		var attendees string
		if err := rows.Scan(&item.ID, &item.Title, &item.Date, &item.Time, &attendees, &item.Duration, &item.Repeat, &item.Note); err != nil {
			return nil, err
		}
		_ = jsonUnmarshal(attendees, &item.Attendees)
		out = append(out, item)
	}
	return out, rows.Err()
}
