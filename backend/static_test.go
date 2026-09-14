package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStaticFilesServeSPAAndAssets(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("<main>DailyTask</main>"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "assets", "app.js"), []byte("app"), 0644); err != nil {
		t.Fatal(err)
	}
	h := staticFiles(root)
	for _, path := range []string{"/", "/tasks/today"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "DailyTask") {
			t.Fatalf("SPA path %s: status %d, body %s", path, w.Code, w.Body.String())
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/assets/app.js", nil))
	if w.Code != http.StatusOK || w.Header().Get("Cache-Control") == "" {
		t.Fatalf("asset: status %d, cache %q", w.Code, w.Header().Get("Cache-Control"))
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/missing", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("unknown API: got %d", w.Code)
	}
}
