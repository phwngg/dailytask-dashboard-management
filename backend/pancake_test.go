package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestParsePancakePages(t *testing.T) {
	root := map[string]any{
		"categorized": map[string]any{
			"activated": []any{
				map[string]any{"id": "p1", "name": "One", "platform": "tiktok"},
				map[string]any{"page_id": "p2", "page_name": "Two"},
			},
		},
		"pages": []any{map[string]any{"id": "p1", "name": "duplicate"}},
	}
	got := parsePancakePages(root)
	want := []pancakePage{
		{ID: "p1", Name: "One", Platform: "tiktok"},
		{ID: "p2", Name: "Two"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %#v, want %#v", got, want)
	}
}

func TestPancakeTokenEncryption(t *testing.T) {
	key := pancakePageTokenKey("test-key")
	encoded, err := encryptPancakeToken(key, "page-secret")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := decryptPancakeToken(key, encoded); err != nil || got != "page-secret" {
		t.Fatalf("decrypt got %q, err %v", got, err)
	}
	if _, err := decryptPancakeToken(pancakePageTokenKey("other-key"), encoded); err == nil {
		t.Fatal("expected wrong key to fail")
	}
}

type pancakeRoundTrip func(*http.Request) (*http.Response, error)

func (f pancakeRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestPancakePageTokenKeyPersistsAndMigratesConfiguredKey(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "dailytask.db")
	first, err := loadPancakePageTokenKey("", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	second, err := loadPancakePageTokenKey("", dbPath)
	if err != nil || !bytes.Equal(first, second) {
		t.Fatalf("key did not persist: err=%v", err)
	}
	info, err := os.Stat(filepath.Join(filepath.Dir(dbPath), "pancake.key"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("key file permissions = %o, want 600", info.Mode().Perm())
	}

	legacyPath := filepath.Join(t.TempDir(), "dailytask.db")
	legacyKey, err := loadPancakePageTokenKey("legacy-config-key", legacyPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(legacyKey, pancakePageTokenKey("legacy-config-key")) {
		t.Fatal("configured key was not preserved")
	}
	migrated, err := loadPancakePageTokenKey("", legacyPath)
	if err != nil || !bytes.Equal(legacyKey, migrated) {
		t.Fatalf("configured key was not persisted for later deploys: err=%v", err)
	}
}

func TestPancakeConnectReusesPageTokensByID(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "test.db"), "admin@example.com", "password")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	app := &api{db: db, pancakeKey: pancakePageTokenKey("test-key")}

	pagesByToken := map[string][]map[string]string{
		"first": {
			{"id": "p1", "name": "One"},
			{"id": "p2", "name": "Two"},
		},
		"second": {
			{"id": "p1", "name": "One"},
			{"id": "p2", "name": "Two"},
			{"id": "p3", "name": "Three"},
			{"id": "p4", "name": "Four"},
		},
		"third": {
			{"id": "p1", "name": "One"},
			{"id": "p3", "name": "Three"},
			{"id": "p4", "name": "Four"},
		},
	}
	generated := map[string]int{}
	oldClient := pancakeHTTPClient
	defer func() { pancakeHTTPClient = oldClient }()
	pancakeHTTPClient = &http.Client{Transport: pancakeRoundTrip(func(req *http.Request) (*http.Response, error) {
		respond := func(value any) (*http.Response, error) {
			raw, _ := json.Marshal(value)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(string(raw))),
				Header:     make(http.Header),
			}, nil
		}
		if strings.Contains(req.URL.Path, "generate_page_access_token") {
			parts := strings.Split(req.URL.Path, "/")
			pageID := parts[len(parts)-2]
			generated[pageID]++
			return respond(map[string]string{"page_access_token": "token-" + pageID})
		}
		pages, ok := pagesByToken[req.URL.Query().Get("access_token")]
		if !ok {
			return nil, fmt.Errorf("unexpected token")
		}
		return respond(map[string]any{"pages": pages})
	})}

	connect := func(token string) pancakeConnectSummary {
		body, _ := json.Marshal(map[string]string{"user_access_token": token})
		req := httptest.NewRequest(http.MethodPost, "/api/admin/pancake/connect", strings.NewReader(string(body)))
		rr := httptest.NewRecorder()
		app.pancakeConnect(rr, req, user{IsAdmin: true})
		if rr.Code != http.StatusOK {
			t.Fatalf("connect %s returned %d: %s", token, rr.Code, rr.Body.String())
		}
		var result struct {
			Summary pancakeConnectSummary
		}
		if err := json.NewDecoder(rr.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}
		return result.Summary
	}

	first := connect("first")
	if first.Created != 2 || first.Reused != 0 {
		t.Fatalf("first connect summary: %#v", first)
	}
	second := connect("second")
	if second.Created != 2 || second.Reused != 2 || len(generated) != 4 {
		t.Fatalf("second connect summary: %#v, generated %#v", second, generated)
	}
	third := connect("third")
	if third.Created != 0 || third.Reused != 3 || third.NotVisible != 1 {
		t.Fatalf("third connect summary: %#v", third)
	}
	for _, pageID := range []string{"p1", "p2", "p3", "p4"} {
		if generated[pageID] != 1 {
			t.Fatalf("page %s generated %d times", pageID, generated[pageID])
		}
	}
	var status string
	if err := db.QueryRow("SELECT status FROM pancake_pages WHERE page_id='p2'").Scan(&status); err != nil {
		t.Fatal(err)
	}
	if status != "not_visible" {
		t.Fatalf("p2 status = %q", status)
	}
	if _, err := db.Exec("INSERT INTO channels(email,slot,platform,page_id,page_name) VALUES('admin@example.com',1,'hub','legacy','Legacy')"); err != nil {
		t.Fatal(err)
	}
	assign := func(pageID string) {
		body, _ := json.Marshal(map[string]any{"page_id": pageID, "email": "admin@example.com"})
		req := httptest.NewRequest(http.MethodPut, "/api/admin/channels", strings.NewReader(string(body)))
		rr := httptest.NewRecorder()
		app.mapPancakeChannel(rr, req, user{IsAdmin: true})
		if rr.Code != http.StatusOK {
			t.Fatalf("map %s returned %d: %s", pageID, rr.Code, rr.Body.String())
		}
	}
	assign("p1")
	assign("p3")
	var count int
	if err := db.QueryRow("SELECT count(*) FROM pancake_page_assignments WHERE email='admin@example.com'").Scan(&count); err != nil || count != 2 {
		t.Fatalf("same employee should accept multiple page IDs: count=%d err=%v", count, err)
	}
	req := httptest.NewRequest(http.MethodDelete, "/api/admin/pancake/pages/p1/assignment", nil)
	req.SetPathValue("page_id", "p1")
	rr := httptest.NewRecorder()
	app.unmapPancakeChannel(rr, req, user{IsAdmin: true})
	if rr.Code != http.StatusOK {
		t.Fatalf("unmap returned %d: %s", rr.Code, rr.Body.String())
	}
	if err := db.QueryRow("SELECT count(*) FROM pancake_page_assignments WHERE email='admin@example.com'").Scan(&count); err != nil || count != 1 {
		t.Fatalf("unmap should remove one assignment: count=%d err=%v", count, err)
	}
	var platform, pageID string
	if err := db.QueryRow("SELECT platform,page_id FROM channels WHERE email='admin@example.com' AND slot=1").Scan(&platform, &pageID); err != nil {
		t.Fatal(err)
	}
	if platform != "hub" || pageID != "legacy" {
		t.Fatalf("unrelated channel mapping changed = %s/%s", platform, pageID)
	}
	if err := db.QueryRow("SELECT status FROM pancake_pages WHERE page_id='p1'").Scan(&status); err != nil || status != "connected" {
		t.Fatalf("unassign removed the Pancake connection: status=%s err=%v", status, err)
	}
}

func TestPancakeSyncStoresDocumentedMetricsByPageAndKeepsPartialErrors(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "test.db"), "admin@example.com", "password")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	app := &api{db: db, pancakeKey: pancakePageTokenKey("test-key")}
	token, err := encryptPancakeToken(app.pancakeKey, "page-token")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(`INSERT INTO pancake_pages(page_id,page_name,platform,page_access_token_enc,status)
		VALUES('p1','Page One','facebook',?,'connected')`, token); err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("INSERT INTO pancake_page_assignments(page_id,email) VALUES('p1','admin@example.com')"); err != nil {
		t.Fatal(err)
	}

	oldClient := pancakeHTTPClient
	defer func() { pancakeHTTPClient = oldClient }()
	requests := 0
	pancakeHTTPClient = &http.Client{Transport: pancakeRoundTrip(func(req *http.Request) (*http.Response, error) {
		requests++
		respond := func(status int, value any) (*http.Response, error) {
			body, _ := json.Marshal(value)
			return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(string(body))), Header: make(http.Header)}, nil
		}
		if strings.HasSuffix(req.URL.Path, "/statistics/ads") {
			typeParam := req.URL.Query().Get("type")
			if typeParam != "by_id" && typeParam != "by_time" {
				t.Fatalf("ads type = %q", typeParam)
			}
			if typeParam == "by_id" {
				return respond(http.StatusForbidden, map[string]any{"error": "reports permission required"})
			}
			return respond(http.StatusOK, []any{map[string]any{"impressions": 10}})
		}
		if strings.HasSuffix(req.URL.Path, "/posts") {
			if req.URL.Query().Get("page_size") != "30" || req.URL.Query().Get("page_number") != "1" {
				t.Fatalf("posts pagination = %#v", req.URL.Query())
			}
			return respond(http.StatusOK, map[string]any{"success": true, "total": 2, "posts": []any{
				map[string]any{"id": "v1", "type": "video", "message": "private post text", "comment_count": 3, "phone_number_count": 1, "reactions": map[string]any{"like_count": 5}},
				map[string]any{"id": "p1", "type": "photo", "comment_count": 2, "reactions": map[string]any{"like_count": 1}},
			}})
		}
		if strings.Contains(req.URL.Path, "statistics/") {
			name := req.URL.Path[strings.LastIndex(req.URL.Path, "/")+1:]
			switch name {
			case "pages", "pages_campaigns", "tags", "customer_feedbacks":
				if req.URL.Query().Get("since") == "" || req.URL.Query().Get("until") == "" {
					t.Fatalf("%s missing unix date range", name)
				}
			case "customer_engagements":
				if !strings.Contains(req.URL.Query().Get("date_range"), " - ") || req.URL.Query().Get("by_hour") == "" {
					t.Fatalf("%s missing date_range/by_hour", name)
				}
			case "users":
				if !strings.Contains(req.URL.Query().Get("date_range"), " - ") {
					t.Fatalf("%s missing local date_range", name)
				}
			}
			if name == "pages" {
				return respond(http.StatusOK, map[string]any{"success": true, "data": []any{map[string]any{"new_customer_count": 4, "new_inbox_count": 2, "phone_number_count": 3}}})
			}
			if name == "customer_feedbacks" {
				return respond(http.StatusOK, map[string]any{"success": true, "customer_feedback": []any{map[string]any{"rate": 5, "customer_name": "private", "message": "private"}}, "customer_average_feedback": []any{}})
			}
			return respond(http.StatusOK, map[string]any{"success": true, "data": map[string]any{}})
		}
		return nil, fmt.Errorf("unexpected request %s", req.URL.Path)
	})}

	result, err := app.syncPancake(context.Background(), "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if requests != 10 || result.Found != 1 || result.Synced != 9 || result.Failed != 1 {
		t.Fatalf("sync result=%#v requests=%d", result, requests)
	}
	var status string
	if err := db.QueryRow("SELECT status FROM pancake_pages WHERE page_id='p1'").Scan(&status); err != nil || status != "connected" {
		t.Fatalf("an ads permission failure should not disconnect the page: status=%q err=%v", status, err)
	}
	var videos, views, followers float64
	if err := db.QueryRow("SELECT videos,views,followers FROM channel_stats WHERE month='2026-02' AND email='admin@example.com' AND slot=1").Scan(&videos, &views, &followers); err != nil {
		t.Fatal(err)
	}
	if videos != 1 || views != 0 || followers != 0 {
		t.Fatalf("channel summary = %v/%v/%v", videos, views, followers)
	}
	var snapshots int
	if err := db.QueryRow("SELECT count(*) FROM pancake_metric_snapshots WHERE page_id='p1' AND month='2026-02'").Scan(&snapshots); err != nil || snapshots != 10 {
		t.Fatalf("snapshots=%d err=%v", snapshots, err)
	}
	var postsRaw, feedbackRaw, adError string
	if err := db.QueryRow("SELECT payload_json FROM pancake_metric_snapshots WHERE page_id='p1' AND month='2026-02' AND endpoint='posts'").Scan(&postsRaw); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(postsRaw, "private post text") || strings.Contains(postsRaw, "message") {
		t.Fatalf("post content was persisted: %s", postsRaw)
	}
	if err := db.QueryRow("SELECT payload_json FROM pancake_metric_snapshots WHERE page_id='p1' AND month='2026-02' AND endpoint='customer_feedbacks'").Scan(&feedbackRaw); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(feedbackRaw, "customer_name") || strings.Contains(feedbackRaw, "private\"") || !strings.Contains(feedbackRaw, "feedback_rating_counts") {
		t.Fatalf("feedback privacy/summary = %s", feedbackRaw)
	}
	if err := db.QueryRow("SELECT error FROM pancake_metric_snapshots WHERE page_id='p1' AND month='2026-02' AND endpoint='ads_by_id'").Scan(&adError); err != nil || adError != "Pancake HTTP 403" {
		t.Fatalf("ads endpoint error=%q err=%v", adError, err)
	}
	metrics, err := app.pancakeMetrics(context.Background(), "2026-02")
	if err != nil || len(metrics) != 1 || metrics[0].Email != "admin@example.com" || metrics[0].Metrics["pages"] == nil {
		t.Fatalf("loaded metrics=%#v err=%v", metrics, err)
	}
}
