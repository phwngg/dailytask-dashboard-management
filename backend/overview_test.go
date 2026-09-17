package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestOverviewCompleteDatasetAndMemberVisibility(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "owner@example.com", "test-password")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err = db.Exec("INSERT INTO users(email,name,role,password_hash) VALUES('staff@example.com','Staff','staff','unused')"); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 505; i++ {
		if _, err = tx.Exec("INSERT INTO tasks(id,title,assignee,due_date) VALUES(?,?,?,?)", fmt.Sprint(i), "Task", "owner@example.com", "2026-09-17"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = tx.Exec("INSERT INTO tasks(id,title,assignee) VALUES('own','Own task','staff@example.com')"); err != nil {
		t.Fatal(err)
	}
	for _, email := range []string{"owner@example.com", "staff@example.com"} {
		if _, err = tx.Exec("INSERT INTO content_plan(id,assignee,post_date,status) VALUES(?,?,?,?)", email, email, "2026-09-17", "Chưa thực hiện"); err != nil {
			t.Fatal(err)
		}
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	a := &api{db: db}
	admin := user{Email: "owner@example.com", IsAdmin: true, IsLeader: true}
	staff := user{Email: "staff@example.com", Caps: []string{"plan.view"}}
	tasks, err := a.tasks(context.Background(), admin)
	if err != nil || len(tasks) != 506 {
		t.Fatalf("full tasks: %d, %v", len(tasks), err)
	}
	tasks, err = a.tasks(context.Background(), staff)
	if err != nil || len(tasks) != 1 || tasks[0].ID != "own" {
		t.Fatalf("staff tasks: %v, %v", tasks, err)
	}
	plans, err := a.planPreview(context.Background(), staff)
	if err != nil || len(plans) != 1 || plans[0].Assignee != staff.Email {
		t.Fatalf("staff plans: %v, %v", plans, err)
	}
	for _, query := range []string{"?unpublished=1&from=2026-09-17&to=2026-09-23", "?id=owner@example.com"} {
		w := httptest.NewRecorder()
		a.listPlans(w, httptest.NewRequest(http.MethodGet, "/api/plans"+query, nil), staff)
		if w.Code != 200 {
			t.Fatal(w.Body.String())
		}
		var page planPage
		if err = json.Unmarshal(w.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		if query[1:3] == "id" {
			if page.Total != 0 {
				t.Fatal("foreign plan exposed")
			}
		} else if page.Total != len(plans) {
			t.Fatal("overview and destination disagree")
		}
	}
}
