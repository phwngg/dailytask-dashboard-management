package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func staticFiles(root string) http.Handler {
	files := http.FileServer(http.Dir(root))
	index := filepath.Join(root, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") || r.URL.Path == "/api" {
			http.NotFound(w, r)
			return
		}
		clean := strings.TrimPrefix(filepath.Clean("/"+r.URL.Path), "/")
		info, err := os.Stat(filepath.Join(root, clean))
		if os.IsNotExist(err) && filepath.Ext(clean) == "" {
			http.ServeFile(w, r, index)
			return
		}
		if os.IsNotExist(err) || (err == nil && info.IsDir() && clean != "") {
			http.NotFound(w, r)
			return
		}
		if err == nil && !info.IsDir() && strings.HasPrefix(clean, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		files.ServeHTTP(w, r)
	})
}
