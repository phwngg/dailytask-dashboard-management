package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestContentReviewFlowAndTaskDetailMutations(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "owner@example.com", "test-password")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err = db.Exec("INSERT INTO users(email,name,role,password_hash) VALUES('staff@example.com','Staff','staff','unused')"); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("INSERT INTO content_plan(id,pillar,content_key,post_date,status,assignee) VALUES('p1','Pillar','Key','2026-09-18','Đang thực hiện','staff@example.com'),('p2','Pillar 2','Key 2','2026-09-19','Chờ duyệt','staff@example.com')"); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("INSERT INTO tasks(id,title,assignee,status) VALUES('t1','Old title','staff@example.com','todo')"); err != nil {
		t.Fatal(err)
	}
	a := &api{db: db}

	submit := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/api/plans/p1/review", bytes.NewBufferString(`{"action":"submit"}`))
	req.SetPathValue("id", "p1")
	a.reviewPlan(submit, req, user{Email: "staff@example.com"})
	if submit.Code != http.StatusOK {
		t.Fatalf("submit review: %d %s", submit.Code, submit.Body.String())
	}

	approve := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPatch, "/api/plans/p1/review", bytes.NewBufferString(`{"action":"approve"}`))
	req.SetPathValue("id", "p1")
	a.reviewPlan(approve, req, user{Email: "owner@example.com", IsAdmin: true, IsLeader: true})
	if approve.Code != http.StatusOK {
		t.Fatalf("approve review: %d %s", approve.Code, approve.Body.String())
	}

	reviews, err := a.planReviews(context.Background(), "p1")
	if err != nil || len(reviews) != 2 {
		t.Fatalf("review history: %v %v", reviews, err)
	}
	var status string
	if err = db.QueryRow("SELECT status FROM content_plan WHERE id='p1'").Scan(&status); err != nil || status != "Đã duyệt" {
		t.Fatalf("approved status: %q %v", status, err)
	}

	foreign := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPatch, "/api/plans/p1", bytes.NewBufferString(`{"pillar":"Changed","key":"Key"}`))
	req.SetPathValue("id", "p1")
	a.updatePlan(foreign, req, user{Email: "other@example.com", Caps: []string{"plan.edit"}})
	if foreign.Code != http.StatusForbidden {
		t.Fatalf("foreign plan edit: %d", foreign.Code)
	}

	start := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPatch, "/api/tasks/t1", bytes.NewBufferString(`{"status":"doing"}`))
	req.SetPathValue("id", "t1")
	a.updateTask(start, req, user{Email: "staff@example.com"})
	if start.Code != http.StatusOK {
		t.Fatalf("task start: %d %s", start.Code, start.Body.String())
	}

	update := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPatch, "/api/tasks/t1", bytes.NewBufferString(`{"title":"New title","due_date":"2026-09-20","priority":"Cao"}`))
	req.SetPathValue("id", "t1")
	a.updateTask(update, req, user{Email: "staff@example.com"})
	if update.Code != http.StatusOK {
		t.Fatalf("task edit: %d %s", update.Code, update.Body.String())
	}
	var title, due, priority string
	if err = db.QueryRow("SELECT title,due_date,priority FROM tasks WHERE id='t1'").Scan(&title, &due, &priority); err != nil || title != "New title" || due != "2026-09-20" || priority != "Cao" {
		t.Fatalf("task fields: %q %q %q %v", title, due, priority, err)
	}

	deleted := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/api/tasks/t1", nil)
	req.SetPathValue("id", "t1")
	a.deleteTask(deleted, req, user{Email: "owner@example.com", IsAdmin: true, IsLeader: true})
	if deleted.Code != http.StatusNoContent {
		t.Fatalf("task delete: %d", deleted.Code)
	}

	var payload map[string]any
	if err = json.Unmarshal(approve.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
}
