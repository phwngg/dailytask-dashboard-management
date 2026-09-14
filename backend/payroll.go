package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

type policy struct {
	Code, Label, Type, InputKey, Tiers string
	Rate, Min                          float64
}
type tier struct{ threshold, amount, percent float64 }
type breakdownItem struct {
	Code   string `json:"code"`
	Label  string `json:"label"`
	Group  string `json:"group"`
	How    string `json:"how"`
	Amount int64  `json:"amount"`
}
type kpiItem struct {
	Key    string  `json:"key"`
	Label  string  `json:"label"`
	Actual float64 `json:"actual"`
	Min    float64 `json:"min"`
	OK     bool    `json:"ok"`
	Pct    int64   `json:"pct"`
}
type payrollResult struct {
	Base, Fees, Bonus, Penalty, Total float64
	KPIOk                             bool
	KPIMet, KPITotal, KPIRate         float64
	KPIItems, Breakdown               string
}

var digits = regexp.MustCompile(`[^0-9.\-]`)
var percentSuffix = regexp.MustCompile(`\+\s*([\d.]+)%`)

func payrollNumber(v any) float64 {
	var s string
	switch x := v.(type) {
	case nil:
		return 0
	case float64:
		return x
	case int64:
		return float64(x)
	case int:
		return float64(x)
	case json.Number:
		s = x.String()
	default:
		s = fmt.Sprint(v)
	}
	n, err := strconv.ParseFloat(digits.ReplaceAllString(s, ""), 64)
	if err != nil {
		return 0
	}
	return n
}

func parsePolicyTiers(raw string) []tier {
	var out []tier
	for _, item := range strings.Split(raw, ";") {
		left, right, ok := strings.Cut(strings.TrimSpace(item), ":")
		if !ok {
			continue
		}
		amountText := strings.SplitN(right, "+", 2)[0]
		pct := 0.0
		if m := percentSuffix.FindStringSubmatch(right); len(m) == 2 {
			pct, _ = strconv.ParseFloat(m[1], 64)
		}
		out = append(out, tier{payrollNumber(left), payrollNumber(amountText), pct})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].threshold < out[j].threshold })
	return out
}

func fmtMoney(n float64) string {
	v := int64(math.Round(n))
	s := strconv.FormatInt(v, 10)
	start := 0
	if strings.HasPrefix(s, "-") {
		start = 1
	}
	for i := len(s) - 3; i > start; i -= 3 {
		s = s[:i] + "." + s[i:]
	}
	return s
}

func computeOne(rows []policy, input map[string]any, tenure float64) payrollResult {
	r := payrollResult{KPIOk: true, KPIRate: 100, KPIItems: "[]", Breakdown: "[]"}
	var details []breakdownItem
	var items []kpiItem
	for _, p := range rows {
		x := payrollNumber(input[p.InputKey])
		amt, how, include := 0.0, "", true
		isBase := strings.HasPrefix(strings.ToLower(p.Code), "base")
		switch p.Type {
		case "fixed":
			amt, how = p.Rate, fmtMoney(p.Rate)+" đ/tháng"
		case "per_unit":
			if x == 0 {
				continue
			}
			amt, how = p.Rate*x, fmt.Sprintf("%s × %s", fmt.Sprint(x), fmtMoney(p.Rate))
		case "per_unit_tenure":
			if x == 0 {
				continue
			}
			unit := 0.0
			for _, t := range parsePolicyTiers(p.Tiers) {
				if tenure >= t.threshold {
					unit = t.amount
				}
			}
			amt, how = unit*x, fmt.Sprintf("%s × %s (thâm niên %s th)", fmt.Sprint(x), fmtMoney(unit), fmt.Sprint(tenure))
		case "tier":
			var hit *tier
			for _, t := range parsePolicyTiers(p.Tiers) {
				if x >= t.threshold {
					tt := t
					hit = &tt
				}
			}
			if hit == nil {
				continue
			}
			amt = hit.amount + x*hit.percent/100
			how = "đạt " + fmtMoney(x) + " ≥ " + fmtMoney(hit.threshold)
			if hit.percent != 0 {
				how += " → " + fmtMoney(hit.amount) + " + " + fmt.Sprint(hit.percent) + "%"
			}
		case "percent":
			if x == 0 || (p.Min != 0 && x < p.Min) {
				continue
			}
			amt, how = x*p.Rate/100, fmt.Sprint(p.Rate)+"% × "+fmtMoney(x)
		case "penalty_below":
			ok := x >= p.Min
			if ok {
				r.KPIMet++
			}
			r.KPITotal++
			label := strings.TrimSpace(strings.TrimPrefix(p.Label, "Phạt "))
			pct := int64(100)
			if p.Min != 0 {
				pct = int64(math.Min(999, math.Round(x/p.Min*100)))
			}
			items = append(items, kpiItem{Key: p.InputKey, Label: label, Actual: x, Min: p.Min, OK: ok, Pct: pct})
			if ok {
				continue
			}
			amt, how, r.KPIOk = -p.Rate, fmtMoney(x)+" < tối thiểu "+fmtMoney(p.Min), false
		case "penalty_per_unit":
			if x == 0 {
				continue
			}
			amt, how = -p.Rate*x, fmt.Sprintf("%s × %s", fmt.Sprint(x), fmtMoney(p.Rate))
		default:
			include = false
		}
		if !include || amt == 0 {
			continue
		}
		group := "fees"
		if isBase {
			group = "base"
		} else if amt < 0 {
			group = "penalty"
		} else if p.Type == "tier" || strings.HasPrefix(p.Code, "b_") || strings.HasPrefix(strings.ToLower(p.Label), "thưởng") {
			group = "bonus"
		}
		switch group {
		case "base":
			r.Base += amt
		case "fees":
			r.Fees += amt
		case "bonus":
			r.Bonus += amt
		case "penalty":
			r.Penalty += amt
		}
		details = append(details, breakdownItem{p.Code, p.Label, group, how, int64(math.Round(amt))})
	}
	r.Base, r.Fees, r.Bonus, r.Penalty = math.Round(r.Base), math.Round(r.Fees), math.Round(r.Bonus), math.Round(r.Penalty)
	r.Total = r.Base + r.Fees + r.Bonus + r.Penalty
	if r.KPITotal > 0 {
		r.KPIRate = math.Round(r.KPIMet / r.KPITotal * 100)
	}
	if b, err := json.Marshal(details); err == nil {
		r.Breakdown = string(b)
	}
	if b, err := json.Marshal(items); err == nil {
		r.KPIItems = string(b)
	}
	return r
}

func tenureMonths(startDate, month string) float64 {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return 0
	}
	parts := strings.Split(month, "-")
	if len(parts) != 2 {
		return 0
	}
	y, e1 := strconv.Atoi(parts[0])
	m, e2 := strconv.Atoi(parts[1])
	if e1 != nil || e2 != nil || m < 1 || m > 12 {
		return 0
	}
	return math.Max(0, float64((y-start.Year())*12+(m-int(start.Month()))))
}

func buildAutoInputs(ctx context.Context, tx *sql.Tx, month string, allowed map[string]bool) (map[string]map[string]float64, error) {
	out := map[string]map[string]float64{}
	add := func(email, key string, qty float64) {
		email, key = strings.ToLower(email), strings.TrimSpace(key)
		if email == "" || !allowed[key] {
			return
		}
		if qty == 0 {
			qty = 1
		}
		if out[email] == nil {
			out[email] = map[string]float64{}
		}
		out[email][key] += qty
	}
	rows, err := tx.QueryContext(ctx, "SELECT assignee,kpi_key,qty,done_at FROM tasks WHERE status='done' AND substr(done_at,1,7)=?", month)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var email, key, doneAt string
		var qty float64
		if err = rows.Scan(&email, &key, &qty, &doneAt); err != nil {
			rows.Close()
			return nil, err
		}
		add(email, key, qty)
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	rows, err = tx.QueryContext(ctx, "SELECT s.id,s.kind,s.date,s.done,s.kpi_key,s.qty,s.lead,EXISTS(SELECT 1 FROM tasks t WHERE t.schedule_id=s.id) FROM schedules s WHERE substr(s.date,1,7)=?", month)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var id, kind, date, key, email string
		var done, hasTasks bool
		var qty float64
		if err = rows.Scan(&id, &kind, &date, &done, &key, &qty, &email, &hasTasks); err != nil {
			rows.Close()
			return nil, err
		}
		if !done {
			continue
		}
		if kind == "live" {
			if key != "" && !hasTasks {
				add(email, key, 1)
			}
			add(email, "live_total", 1)
		} else if key != "" && !hasTasks {
			add(email, key, qty)
		}
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	rows, err = tx.QueryContext(ctx, "SELECT email,slot,videos,views,followers FROM channel_stats WHERE month=?", month)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var email string
		var slot int
		var videos, views, followers sql.NullFloat64
		if err = rows.Scan(&email, &slot, &videos, &views, &followers); err != nil {
			rows.Close()
			return nil, err
		}
		suffix := ""
		if slot == 2 {
			suffix = "_2"
		}
		for _, x := range []struct {
			k string
			v sql.NullFloat64
		}{{"videos", videos}, {"views", views}, {"followers", followers}} {
			if x.v.Valid {
				add(email, x.k+suffix, x.v.Float64)
			}
		}
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	return out, nil
}

func (a *api) computePayroll(w http.ResponseWriter, r *http.Request, me user) {
	if !require(w, me, "payroll.compute") {
		return
	}
	var req struct {
		Month string `json:"month"`
	}
	if decode(r, &req) != nil {
		writeError(w, http.StatusBadRequest, "Yêu cầu không hợp lệ")
		return
	}
	if len(req.Month) != 7 || req.Month[4] != '-' {
		writeError(w, http.StatusBadRequest, "Tháng phải có dạng YYYY-MM")
		return
	}
	if _, err := time.Parse("2006-01", req.Month); err != nil {
		writeError(w, http.StatusBadRequest, "Tháng không hợp lệ")
		return
	}
	ctx := r.Context()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		fail(w, err)
		return
	}
	defer tx.Rollback()
	manual := map[string]map[string]any{}
	rows, err := tx.QueryContext(ctx, "SELECT email,values_json FROM inputs WHERE month=? ORDER BY email", req.Month)
	if err != nil {
		fail(w, err)
		return
	}
	for rows.Next() {
		var email, raw string
		var values map[string]any
		if err = rows.Scan(&email, &raw); err != nil {
			rows.Close()
			fail(w, err)
			return
		}
		if err = json.Unmarshal([]byte(raw), &values); err != nil {
			rows.Close()
			writeError(w, http.StatusUnprocessableEntity, "Dữ liệu đầu vào không hợp lệ")
			return
		}
		manual[strings.ToLower(email)] = values
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		fail(w, err)
		return
	}
	rows.Close()
	allowed := map[string]bool{}
	for _, values := range manual {
		for key := range values {
			allowed[key] = true
		}
		break
	}
	auto, err := buildAutoInputs(ctx, tx, req.Month, allowed)
	if err != nil {
		fail(w, err)
		return
	}
	combined := map[string]map[string]any{}
	for email, values := range auto {
		combined[email] = map[string]any{}
		for k, v := range values {
			combined[email][k] = v
		}
	}
	for email, values := range manual {
		if combined[email] == nil {
			combined[email] = map[string]any{}
		}
		for k, v := range values {
			if v != nil && v != "" {
				combined[email][k] = v
			}
		}
	}
	if len(combined) == 0 {
		writeError(w, http.StatusNotFound, "Không có dữ liệu đầu vào cho tháng này")
		return
	}
	emails := make([]string, 0, len(combined))
	for email := range combined {
		emails = append(emails, email)
	}
	sort.Strings(emails)
	computed := time.Now().UTC().Format(time.RFC3339)
	for _, email := range emails {
		var startDate string
		if err = tx.QueryRowContext(ctx, "SELECT start_date FROM users WHERE email=? AND active=1", email).Scan(&startDate); err != nil {
			fail(w, err)
			return
		}
		policies := []policy{}
		pr, err := tx.QueryContext(ctx, "SELECT code,label,type,input_key,rate,tiers,minimum FROM policies WHERE email=? AND active=1 ORDER BY id", email)
		if err != nil {
			fail(w, err)
			return
		}
		for pr.Next() {
			var p policy
			if err = pr.Scan(&p.Code, &p.Label, &p.Type, &p.InputKey, &p.Rate, &p.Tiers, &p.Min); err != nil {
				pr.Close()
				fail(w, err)
				return
			}
			policies = append(policies, p)
		}
		if err = pr.Err(); err != nil {
			pr.Close()
			fail(w, err)
			return
		}
		pr.Close()
		values := combined[email]
		for key := range allowed {
			if _, ok := values[key]; !ok {
				values[key] = float64(0)
			}
		}
		result := computeOne(policies, values, tenureMonths(startDate, req.Month))
		_, err = tx.ExecContext(ctx, `INSERT INTO payroll(month,email,base,fees,bonus,penalty,total,kpi_ok,kpi_met,kpi_total,kpi_rate,kpi_items,breakdown,computed_at)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(month,email) DO UPDATE SET base=excluded.base,fees=excluded.fees,bonus=excluded.bonus,penalty=excluded.penalty,total=excluded.total,kpi_ok=excluded.kpi_ok,kpi_met=excluded.kpi_met,kpi_total=excluded.kpi_total,kpi_rate=excluded.kpi_rate,kpi_items=excluded.kpi_items,breakdown=excluded.breakdown,computed_at=excluded.computed_at`, req.Month, email, result.Base, result.Fees, result.Bonus, result.Penalty, result.Total, result.KPIOk, result.KPIMet, result.KPITotal, result.KPIRate, result.KPIItems, result.Breakdown, computed)
		if err != nil {
			fail(w, err)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"month": req.Month, "computed": len(emails)})
}
