package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	path := os.Getenv("DATABASE_PATH")
	if path == "" {
		path = "./data/dailytask.db"
	}
	db, err := openDB(path, os.Getenv("INITIAL_ADMIN_EMAIL"), os.Getenv("INITIAL_ADMIN_PASSWORD"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	pancakeKey, err := loadPancakePageTokenKey(os.Getenv("PANCAKE_ENCRYPTION_KEY"), path)
	if err != nil {
		log.Fatal(err)
	}

	app := &api{
		db:           db,
		cookieSecure: strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true"),
		pancakeKey:   pancakeKey,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", app.health)
	mux.HandleFunc("POST /api/login", app.login)
	mux.HandleFunc("POST /api/logout", app.protected(app.logout))
	mux.HandleFunc("GET /api/bootstrap", app.protected(app.bootstrap))
	mux.HandleFunc("GET /api/plans", app.protected(app.listPlans))
	mux.HandleFunc("POST /api/tasks", app.protected(app.createTask))
	mux.HandleFunc("PATCH /api/tasks/{id}", app.protected(app.updateTask))
	mux.HandleFunc("POST /api/plans", app.protected(app.createPlan))
	mux.HandleFunc("PATCH /api/plans/{id}", app.protected(app.updatePlan))
	mux.HandleFunc("DELETE /api/plans/{id}", app.protected(app.deletePlan))
	mux.HandleFunc("PUT /api/shifts", app.protected(app.upsertShift))
	mux.HandleFunc("POST /api/schedules", app.protected(app.createSchedule))
	mux.HandleFunc("POST /api/meetings", app.protected(app.createMeeting))
	mux.HandleFunc("GET /api/admin/users", app.protected(app.adminUsers))
	mux.HandleFunc("POST /api/admin/users", app.protected(app.createUser))
	mux.HandleFunc("PATCH /api/admin/users/{email}", app.protected(app.updateUser))
	mux.HandleFunc("POST /api/admin/pancake/connect", app.protected(app.pancakeConnect))
	mux.HandleFunc("POST /api/admin/pancake/sync", app.protected(app.pancakeSync))
	mux.HandleFunc("PUT /api/admin/channels", app.protected(app.mapPancakeChannel))
	mux.HandleFunc("GET /api/payroll", app.protected(app.payroll))
	mux.HandleFunc("POST /api/payroll/compute", app.protected(app.computePayroll))
	mux.Handle("/", staticFiles(env("STATIC_DIR", "../frontend/dist")))

	go app.pancakeAutoSync()

	server := &http.Server{
		Addr:              ":" + env("PORT", "8080"),
		Handler:           securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("API listening on %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Cache-Control", "no-store")
		if r.Method != http.MethodGet {
			origin := r.Header.Get("Origin")
			if origin != "" && !strings.EqualFold(strings.TrimPrefix(origin, "https://"), strings.TrimPrefix(r.Host, "https://")) && !strings.EqualFold(strings.TrimPrefix(origin, "http://"), strings.TrimPrefix(r.Host, "http://")) {
				writeError(w, http.StatusForbidden, "Origin không hợp lệ")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
