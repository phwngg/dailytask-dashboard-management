package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestComputeOne(t *testing.T) {
	rows := []policy{
		{Code: "base_salary", Label: "Lương cơ bản", Type: "fixed", Rate: 5000000},
		{Code: "unit", Label: "Sản lượng", Type: "per_unit", InputKey: "units", Rate: 100},
		{Code: "b_bonus", Label: "Thưởng mốc", Type: "tier", InputKey: "views", Tiers: "10:100+2%;20:200"},
		{Code: "p_posts", Label: "Phạt bài đăng", Type: "penalty_below", InputKey: "posts", Rate: 300, Min: 5},
	}
	got := computeOne(rows, map[string]any{"units": "2", "views": 15, "posts": 3}, 0)
	if got.Base != 5000000 || got.Fees != 200 || got.Bonus != 100 || got.Penalty != -300 || got.Total != 5000000 || got.KPIOk || got.KPIRate != 0 {
		t.Fatalf("unexpected result: %+v", got)
	}
	var items []map[string]any
	if err := json.Unmarshal([]byte(got.KPIItems), &items); err != nil || len(items) != 1 || items[0]["key"] != "posts" {
		t.Fatalf("invalid KPI detail JSON: %s", got.KPIItems)
	}
}

func TestTenureMonths(t *testing.T) {
	if got := tenureMonths("2024-02-15", "2026-08"); got != 30 {
		t.Fatalf("tenure=%v want 30", got)
	}
	if got := tenureMonths("2026-09-01", "2026-08"); got != 0 {
		t.Fatalf("future start tenure=%v want 0", got)
	}
}

func TestBuildAutoInputs(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "owner@example.com", "correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, q := range []string{
		`INSERT INTO tasks(id,title,assignee,status,kpi_key,qty,done_at,schedule_id) VALUES('t1','done','owner@example.com','done','posts',2,'2026-08-03','')`,
		`INSERT INTO tasks(id,title,assignee,status,kpi_key,qty,done_at,schedule_id) VALUES('t2','linked','owner@example.com','todo','live_bridge',1,'','L1')`,
		`INSERT INTO schedules(id,kind,title,date,time,lead,done,kpi_key,qty) VALUES('L1','live','linked','2026-08-04','09:00','owner@example.com',1,'live_bridge',1)`,
		`INSERT INTO schedules(id,kind,title,date,time,lead,done,kpi_key,qty) VALUES('L2','live','standalone','2026-08-05','09:00','owner@example.com',1,'live_bridge',1)`,
		`INSERT INTO schedules(id,kind,title,date,time,lead,done,kpi_key,qty) VALUES('S1','shoot','shoot','2026-08-06','09:00','owner@example.com',1,'photo_session',3)`,
		`INSERT INTO channel_stats(month,email,slot,videos,views,followers,source) VALUES('2026-08','owner@example.com',2,6,20,3,'test')`,
	} {
		if _, err := db.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	got, err := buildAutoInputs(t.Context(), tx, "2026-08", map[string]bool{"posts": true, "live_bridge": true, "live_total": true, "photo_session": true, "videos_2": true, "views_2": true, "followers_2": true})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]float64{"posts": 2, "live_bridge": 1, "live_total": 2, "photo_session": 3, "videos_2": 6, "views_2": 20, "followers_2": 3}
	if !reflect.DeepEqual(got["owner@example.com"], want) {
		t.Fatalf("auto inputs mismatch: got %v", got)
	}
}

func TestPayrollPolicyAPIAllowsManagerToSaveFormula(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "admin@example.com", "password")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	app := &api{db: db}
	body := `{"email":"admin@example.com","code":"video_fee","label":"Phí video","type":"per_unit","input_key":"videos","rate":100000,"active":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/payroll/policies", strings.NewReader(body))
	rr := httptest.NewRecorder()
	app.createPayrollPolicy(rr, req, user{IsAdmin: true})
	if rr.Code != http.StatusCreated {
		t.Fatalf("create returned %d: %s", rr.Code, rr.Body.String())
	}
	var created struct {
		ID int `json:"id"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&created); err != nil || created.ID == 0 {
		t.Fatalf("create response = %#v, err=%v", created, err)
	}
	req = httptest.NewRequest(http.MethodGet, "/api/payroll/policies", nil)
	rr = httptest.NewRecorder()
	app.payrollPolicies(rr, req, user{IsAdmin: true})
	if rr.Code != http.StatusOK || !strings.Contains(rr.Body.String(), "video_fee") {
		t.Fatalf("list returned %d: %s", rr.Code, rr.Body.String())
	}
	updated := `{"email":"admin@example.com","code":"video_fee","label":"Phí video mới","type":"per_unit","input_key":"videos","rate":120000,"active":true}`
	req = httptest.NewRequest(http.MethodPut, "/api/payroll/policies/"+fmt.Sprint(created.ID), strings.NewReader(updated))
	req.SetPathValue("id", fmt.Sprint(created.ID))
	rr = httptest.NewRecorder()
	app.updatePayrollPolicy(rr, req, user{IsAdmin: true})
	if rr.Code != http.StatusOK {
		t.Fatalf("update returned %d: %s", rr.Code, rr.Body.String())
	}
}

func TestUpdatePayrollBreakdownRecalculatesTotal(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "admin@example.com", "password")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`INSERT INTO payroll(month,email,base,fees,bonus,penalty,total) VALUES('2026-08','admin@example.com',0,0,0,0,0)`); err != nil {
		t.Fatal(err)
	}
	app := &api{db: db}
	body := `{"month":"2026-08","email":"admin@example.com","items":[{"code":"base","label":"Lương cơ bản","group":"base","amount":1000},{"code":"extra","label":"Phụ cấp","group":"fees","amount":200},{"code":"fine","label":"Phạt","group":"penalty","amount":-50}]}`
	req := httptest.NewRequest(http.MethodPut, "/api/payroll/breakdown", strings.NewReader(body))
	rr := httptest.NewRecorder()
	app.updatePayrollBreakdown(rr, req, user{IsAdmin: true})
	if rr.Code != http.StatusOK {
		t.Fatalf("update returned %d: %s", rr.Code, rr.Body.String())
	}
	var total int64
	if err := db.QueryRow(`SELECT total FROM payroll WHERE month='2026-08' AND email='admin@example.com'`).Scan(&total); err != nil {
		t.Fatal(err)
	}
	if total != 1150 {
		t.Fatalf("total=%d want 1150", total)
	}
}
