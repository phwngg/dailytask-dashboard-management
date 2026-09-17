package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"testing"
)

func TestPlanPaginationFiltersAndStats(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "admin", "admin123")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, row := range [][]any{
		{"P1", "Channel A", "2026-09", "Travel", "Ăn chơi Đà Nẵng", "", "2026-09-12", "Đã đăng", "", "admin"},
		{"P2", "Channel B", "2026-09", "Behind", "Quay Hạ Long", "", "2026-09-12", "Đang thực hiện", "", "an@example.com"},
		{"P3", "Channel A", "2026-09", "Guide", "Lịch trình Huế", "", "2026-09-10", "Chưa thực hiện", "", "an@example.com"},
	} {
		if _, err := db.Exec("INSERT INTO content_plan(id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee) VALUES(?,?,?,?,?,?,?,?,?,?)", row...); err != nil {
			t.Fatal(err)
		}
	}
	a := &api{db: db}
	first := httptest.NewRecorder()
	a.listPlans(first, httptest.NewRequest(http.MethodGet, "/api/plans?limit=2", nil), user{IsAdmin: true})
	if first.Code != http.StatusOK {
		t.Fatalf("first page: got %d, body %s", first.Code, first.Body.String())
	}
	var page planPage
	if err := json.Unmarshal(first.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 2 || !page.HasMore || page.Total != 3 || page.Stats.Published != 1 || page.Stats.InProgress != 1 || page.Stats.Planned != 1 || page.NextCursor == nil {
		t.Fatalf("unexpected first page: %+v", page)
	}
	groups := map[string]planChannelGroup{}
	for _, group := range page.Groups {
		groups[group.Name] = group
	}
	if groups["Channel A"].Total != 2 || groups["Channel A"].ByStatus["Đã đăng"] != 1 || groups["Channel A"].ByStatus["Chưa thực hiện"] != 1 || groups["Channel B"].Total != 1 || groups["Channel B"].Overdue != 1 {
		t.Fatalf("grouped channels: %+v", groups)
	}
	groupsOnly := httptest.NewRecorder()
	a.listPlans(groupsOnly, httptest.NewRequest(http.MethodGet, "/api/plans?groupsOnly=1", nil), user{IsAdmin: true})
	var summary planPage
	if err := json.Unmarshal(groupsOnly.Body.Bytes(), &summary); err != nil {
		t.Fatal(err)
	}
	if groupsOnly.Code != http.StatusOK || len(summary.Items) != 0 || len(summary.Groups) != 2 || summary.Total != 3 || summary.HasMore {
		t.Fatalf("groups-only response: status %d, page %+v", groupsOnly.Code, summary)
	}
	if page.Items[0].ID != "P2" || page.Items[1].ID != "P1" {
		t.Fatalf("unstable order: %s, %s", page.Items[0].ID, page.Items[1].ID)
	}

	params := url.Values{"limit": {"2"}, "cursorDate": {page.NextCursor.Date}, "cursorID": {page.NextCursor.ID}}
	second := httptest.NewRecorder()
	a.listPlans(second, httptest.NewRequest(http.MethodGet, "/api/plans?"+params.Encode(), nil), user{IsAdmin: true})
	if err := json.Unmarshal(second.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.HasMore || page.Items[0].ID != "P3" {
		t.Fatalf("unexpected next page: %+v", page)
	}

	params = url.Values{"q": {"Quay"}, "channel": {"Channel B"}, "from": {"2026-09-12"}, "to": {"2026-09-12"}, "assignee": {"an@example.com"}, "status": {"Đang thực hiện"}}
	filtered := httptest.NewRecorder()
	a.listPlans(filtered, httptest.NewRequest(http.MethodGet, "/api/plans?"+params.Encode(), nil), user{IsAdmin: true})
	if err := json.Unmarshal(filtered.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if filtered.Code != http.StatusOK || page.Total != 1 || page.Items[0].ID != "P2" || page.Stats.InProgress != 1 {
		t.Fatalf("filters did not combine: status %d, result %+v", filtered.Code, page)
	}

	badDate := httptest.NewRecorder()
	a.listPlans(badDate, httptest.NewRequest(http.MethodGet, "/api/plans?from=tomorrow", nil), user{IsAdmin: true})
	if badDate.Code != http.StatusBadRequest {
		t.Fatalf("invalid date should be rejected, got %d", badDate.Code)
	}
}

func TestPlanChannelGroupingSupportsUnassignedAndTrimmedNames(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "admin", "admin123")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, row := range [][]any{
		{"blank", "", "2026-09", "General", "Không gán kênh", "", "2026-10-01", "Chưa thực hiện", "", "admin"},
		{"spaced", "  Instagram  ", "2026-09", "Social", "Bài Instagram", "", "2026-10-02", "Đang thực hiện", "", "admin"},
	} {
		if _, err := db.Exec("INSERT INTO content_plan(id,channel,month,pillar,content_key,demo_date,post_date,status,message,assignee) VALUES(?,?,?,?,?,?,?,?,?,?)", row...); err != nil {
			t.Fatal(err)
		}
	}
	a := &api{db: db}
	for query, expectedName := range map[string]string{"?channel=__empty": "Chưa gán Kênh", "?channel=Instagram": "Instagram"} {
		w := httptest.NewRecorder()
		a.listPlans(w, httptest.NewRequest(http.MethodGet, "/api/plans"+query, nil), user{IsAdmin: true})
		if w.Code != http.StatusOK {
			t.Fatalf("group filter %s: %d %s", query, w.Code, w.Body.String())
		}
		var page planPage
		if err := json.Unmarshal(w.Body.Bytes(), &page); err != nil {
			t.Fatal(err)
		}
		if len(page.Groups) != 1 || page.Groups[0].Name != expectedName || page.Total != 1 {
			t.Fatalf("group filter %s: %+v", query, page)
		}
	}
}
