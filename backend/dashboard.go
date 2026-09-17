package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

type payrollRow struct {
	Month     string  `json:"month"`
	Email     string  `json:"email"`
	Base      float64 `json:"base"`
	Fees      float64 `json:"fees"`
	Bonus     float64 `json:"bonus"`
	Penalty   float64 `json:"penalty"`
	Total     float64 `json:"total"`
	KPIOk     bool    `json:"kpi_ok"`
	KPIMet    float64 `json:"kpi_met"`
	KPITotal  float64 `json:"kpi_total"`
	KPIRate   float64 `json:"kpi_rate"`
	KPIItems  string  `json:"kpi_items"`
	Breakdown string  `json:"breakdown"`
}

func (a *api) bootstrap(w http.ResponseWriter, r *http.Request, me user) {
	ctx := r.Context()
	users, err := a.users(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	tasks, err := a.tasks(ctx, me)
	if err != nil {
		fail(w, err)
		return
	}
	plans, err := a.planPreview(ctx, me)
	if err != nil {
		fail(w, err)
		return
	}
	pendingPlanCount := 0
	for _, p := range plans {
		if p.Status != "Đã đăng" {
			pendingPlanCount++
		}
	}
	shoots, lives, err := a.schedules(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	meetings, err := a.meetings(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	if !me.IsLeader && !hasCap(me.Caps, "checklist.viewAll") {
		allowed := func(lead string, attendees []string) bool {
			if lead == me.Email {
				return true
			}
			for _, email := range attendees {
				if email == me.Email {
					return true
				}
			}
			return false
		}
		ownShoots, ownLives, ownMeetings := []schedule{}, []schedule{}, []meeting{}
		for _, item := range shoots {
			if allowed(item.Lead, item.Attendees) {
				ownShoots = append(ownShoots, item)
			}
		}
		for _, item := range lives {
			if allowed(item.Lead, item.Attendees) {
				ownLives = append(ownLives, item)
			}
		}
		for _, item := range meetings {
			if allowed("", item.Attendees) {
				ownMeetings = append(ownMeetings, item)
			}
		}
		shoots, lives, meetings = ownShoots, ownLives, ownMeetings
	}
	channels, err := a.channels(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	week := time.Now().AddDate(0, 0, -((int(time.Now().Weekday()) + 6) % 7)).Format("2006-01-02")
	var latestWeek sql.NullString
	if err = a.db.QueryRowContext(ctx, "SELECT max(week) FROM shifts WHERE week<=?", week).Scan(&latestWeek); err != nil {
		fail(w, err)
		return
	}
	if latestWeek.Valid {
		week = latestWeek.String
	}
	shifts, err := a.shifts(ctx, me, week)
	if err != nil {
		fail(w, err)
		return
	}
	payroll, month, err := a.payrollRows(ctx, me)
	if err != nil {
		fail(w, err)
		return
	}
	currentMonth := pancakeCurrentMonth()
	channelStats, err := a.channelStats(ctx, currentMonth)
	if err != nil {
		fail(w, err)
		return
	}
	pancake, err := a.pancakeStatus(ctx)
	if err != nil {
		fail(w, err)
		return
	}
	pancakeMetrics, err := a.pancakeMetrics(ctx, currentMonth)
	if err != nil {
		fail(w, err)
		return
	}
	mePub := me
	mePub.Caps = me.Caps
	writeJSON(w, http.StatusOK, map[string]any{
		"me": mePub, "users": users, "tasks": tasks, "contentPlan": plans, "pendingPlanCount": pendingPlanCount,
		"shoots": shoots, "lives": lives, "meetings": meetings, "channels": channels,
		"shifts": shifts, "shiftsWeek": week, "payroll": payroll,
		"payrollMonth": month, "currentMonth": currentMonth, "channelStats": channelStats, "pancake": pancake, "pancakeMetrics": pancakeMetrics,
		"autoInputs": []any{}, "inputLabels": map[string]string{},
		"serverTime": time.Now().Format("2006-01-02 15:04"),
	})
}

func (a *api) users(ctx context.Context) ([]user, error) {
	rows, err := a.db.QueryContext(ctx, "SELECT email,coalesce(username,''),name,initials,position,color,role,active,start_date FROM users WHERE active=1 ORDER BY name LIMIT 500")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []user{}
	for rows.Next() {
		var u user
		if err := rows.Scan(&u.Email, &u.Username, &u.Name, &u.Initials, &u.Position, &u.Color, &u.Role, &u.Active, &u.StartDate); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (a *api) tasks(ctx context.Context, me user) ([]task, error) {
	query := "SELECT id,title,assignee,due,due_date,priority,status,kpi_key,qty,done_at,schedule_id FROM tasks ORDER BY created_at DESC"
	args := []any{}
	if !me.IsLeader && !hasCap(me.Caps, "checklist.viewAll") {
		query = "SELECT id,title,assignee,due,due_date,priority,status,kpi_key,qty,done_at,schedule_id FROM tasks WHERE assignee=? ORDER BY created_at DESC"
		args = append(args, me.Email)
	}
	rows, err := a.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []task{}
	for rows.Next() {
		var t task
		if err := rows.Scan(&t.ID, &t.Title, &t.Assignee, &t.Due, &t.DueDate, &t.Priority, &t.Status, &t.KPIKey, &t.Qty, &t.DoneAt, &t.ScheduleID); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// ponytail: load the complete small-workspace dataset; use aggregate queries and pagination when payload size grows.
func (a *api) planPreview(ctx context.Context, me user) ([]plan, error) {
	if !me.IsAdmin && !hasCap(me.Caps, "plan.view") {
		return []plan{}, nil
	}
	query := "SELECT id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee FROM content_plan"
	args := []any{}
	if !me.IsLeader {
		query += " WHERE assignee=?"
		args = append(args, me.Email)
	}
	rows, err := a.db.QueryContext(ctx, query+" ORDER BY post_date,id", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []plan{}
	for rows.Next() {
		var p plan
		if err := rows.Scan(&p.ID, &p.Channel, &p.Month, &p.Pillar, &p.Key, &p.DemoDate, &p.PostDate, &p.Status, &p.Message, &p.Assignee); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (a *api) schedules(ctx context.Context) ([]schedule, []schedule, error) {
	rows, err := a.db.QueryContext(ctx, "SELECT id,kind,title,date,time,location,lead,attendees,status,kpi_key,qty,done,brief FROM schedules ORDER BY date DESC,time DESC")
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	shoots, lives := []schedule{}, []schedule{}
	for rows.Next() {
		var s schedule
		var attendees string
		if err := rows.Scan(&s.ID, &s.Kind, &s.Title, &s.Date, &s.Time, &s.Location, &s.Lead, &attendees, &s.Status, &s.KPIKey, &s.Qty, &s.Done, &s.Brief); err != nil {
			return nil, nil, err
		}
		_ = jsonUnmarshal(attendees, &s.Attendees)
		if s.Kind == "live" {
			lives = append(lives, s)
		} else {
			shoots = append(shoots, s)
		}
	}
	return shoots, lives, rows.Err()
}

func (a *api) channels(ctx context.Context) ([]channelMapping, error) {
	rows, err := a.db.QueryContext(ctx, "SELECT email,slot,platform,page_id,page_name FROM channels WHERE lower(platform)<>'pancake' ORDER BY email,slot")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []channelMapping{}
	for rows.Next() {
		var c channelMapping
		if err := rows.Scan(&c.Email, &c.Slot, &c.Platform, &c.PageID, &c.PageName); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (a *api) meetings(ctx context.Context) ([]meeting, error) {
	rows, err := a.db.QueryContext(ctx, "SELECT id,title,date,time,attendees,duration,repeat,note FROM meetings ORDER BY date DESC,time DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []meeting{}
	for rows.Next() {
		var m meeting
		var attendees string
		if err := rows.Scan(&m.ID, &m.Title, &m.Date, &m.Time, &attendees, &m.Duration, &m.Repeat, &m.Note); err != nil {
			return nil, err
		}
		_ = jsonUnmarshal(attendees, &m.Attendees)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (a *api) shifts(ctx context.Context, me user, week string) ([]shift, error) {
	query := "SELECT week,email,mon,tue,wed,thu,fri,sat,sun FROM shifts WHERE week=? ORDER BY email"
	args := []any{week}
	if !me.IsLeader && !hasCap(me.Caps, "shifts.viewAll") {
		query = "SELECT week,email,mon,tue,wed,thu,fri,sat,sun FROM shifts WHERE week=? AND email=?"
		args = append(args, me.Email)
	}
	rows, err := a.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []shift{}
	for rows.Next() {
		var s shift
		if err := rows.Scan(&s.Week, &s.Email, &s.Mon, &s.Tue, &s.Wed, &s.Thu, &s.Fri, &s.Sat, &s.Sun); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (a *api) payrollRows(ctx context.Context, me user) ([]payrollRow, string, error) {
	var month sql.NullString
	if err := a.db.QueryRowContext(ctx, "SELECT max(month) FROM payroll").Scan(&month); err != nil {
		return nil, "", err
	}
	if !month.Valid {
		return []payrollRow{}, "", nil
	}
	query := "SELECT month,email,base,fees,bonus,penalty,total,kpi_ok,kpi_met,kpi_total,kpi_rate,kpi_items,breakdown FROM payroll WHERE month=?"
	args := []any{month.String}
	if !me.IsLeader && !hasCap(me.Caps, "payroll.viewAll") {
		query += " AND email=?"
		args = append(args, me.Email)
	}
	query += " ORDER BY email"
	rows, err := a.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()
	out := []payrollRow{}
	for rows.Next() {
		var p payrollRow
		if err := rows.Scan(&p.Month, &p.Email, &p.Base, &p.Fees, &p.Bonus, &p.Penalty, &p.Total, &p.KPIOk, &p.KPIMet, &p.KPITotal, &p.KPIRate, &p.KPIItems, &p.Breakdown); err != nil {
			return nil, "", err
		}
		out = append(out, p)
	}
	return out, month.String, rows.Err()
}

func jsonUnmarshal(raw string, out any) error {
	if raw == "" {
		raw = "[]"
	}
	return json.Unmarshal([]byte(raw), out)
}
