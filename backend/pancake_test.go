package main

import (
	"bytes"
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
	body, _ := json.Marshal(map[string]any{"page_id": "p1", "email": "admin@example.com", "slot": 1})
	req := httptest.NewRequest(http.MethodPut, "/api/admin/channels", strings.NewReader(string(body)))
	rr := httptest.NewRecorder()
	app.mapPancakeChannel(rr, req, user{IsAdmin: true})
	if rr.Code != http.StatusOK {
		t.Fatalf("hub mapping returned %d: %s", rr.Code, rr.Body.String())
	}
	var platform, pageID string
	if err := db.QueryRow("SELECT platform,page_id FROM channels WHERE email='admin@example.com' AND slot=1").Scan(&platform, &pageID); err != nil {
		t.Fatal(err)
	}
	if platform != "pancake" || pageID != "p1" {
		t.Fatalf("mapping = %s/%s", platform, pageID)
	}
}
