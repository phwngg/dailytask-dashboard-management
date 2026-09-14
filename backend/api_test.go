package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestLoginBootstrapAndLogout(t *testing.T) {
	const email, password = "owner@example.com", "correct-horse-battery"
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), email, password)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	a := &api{db: db}
	bootstrap := a.protected(a.bootstrap)
	unauthorized := httptest.NewRecorder()
	bootstrap.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated bootstrap: got %d", unauthorized.Code)
	}

	login := httptest.NewRecorder()
	a.login(login, httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(`{"email":"owner@example.com","password":"correct-horse-battery"}`)))
	if login.Code != http.StatusOK {
		t.Fatalf("login: got %d, body %s", login.Code, login.Body.String())
	}
	cookie := login.Result().Cookies()[0]
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode {
		t.Fatal("session cookie is missing security attributes")
	}

	request := httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil)
	request.AddCookie(cookie)
	ok := httptest.NewRecorder()
	bootstrap.ServeHTTP(ok, request)
	if ok.Code != http.StatusOK || !strings.Contains(ok.Body.String(), `"contentPlan":[]`) {
		t.Fatalf("bootstrap: got %d, body %s", ok.Code, ok.Body.String())
	}

	logout := httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	request.AddCookie(cookie)
	a.protected(a.logout).ServeHTTP(logout, request)
	request = httptest.NewRequest(http.MethodGet, "/api/bootstrap", nil)
	request.AddCookie(cookie)
	denied := httptest.NewRecorder()
	bootstrap.ServeHTTP(denied, request)
	if denied.Code != http.StatusUnauthorized {
		t.Fatalf("revoked session: got %d", denied.Code)
	}
}

func TestShortInitialPasswordAccepted(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "admin", "admin123")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var hash string
	if err := db.QueryRow("SELECT password_hash FROM users WHERE username='admin'").Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte("admin123")); err != nil {
		t.Fatalf("short initial password was not stored correctly: %v", err)
	}
}

func TestRequireChecksLeaderCapabilities(t *testing.T) {
	w := httptest.NewRecorder()
	if require(w, user{IsLeader: true}, "users.manage") {
		t.Fatal("leader without users.manage was allowed")
	}
	if w.Code != http.StatusForbidden {
		t.Fatalf("missing capability: got %d", w.Code)
	}
	if !require(httptest.NewRecorder(), user{Caps: []string{"users.manage"}}, "users.manage") {
		t.Fatal("user with capability was denied")
	}
}

func TestLegacyPasswordUpgradesOnLogin(t *testing.T) {
	db, err := openDB(filepath.Join(t.TempDir(), "app.db"), "owner@example.com", "correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	const email, salt, password = "member@example.com", "old-salt", "old-temporary-password"
	sum := sha256.Sum256([]byte(salt + password))
	legacy := "legacy-sha256$" + salt + "$" + base64.StdEncoding.EncodeToString(sum[:])
	if _, err := db.Exec("INSERT INTO users(email,name,role,password_hash) VALUES(?,?,?,?)", email, "Member", "staff", legacy); err != nil {
		t.Fatal(err)
	}
	a := &api{db: db}
	w := httptest.NewRecorder()
	a.login(w, httptest.NewRequest(http.MethodPost, "/api/login", bytes.NewBufferString(`{"email":"member@example.com","password":"old-temporary-password"}`)))
	if w.Code != http.StatusOK {
		t.Fatalf("legacy login: got %d, body %s", w.Code, w.Body.String())
	}
	var upgraded string
	if err := db.QueryRow("SELECT password_hash FROM users WHERE email=?", email).Scan(&upgraded); err != nil {
		t.Fatal(err)
	}
	if passwordMatches(upgraded, password) == false || bcrypt.CompareHashAndPassword([]byte(upgraded), []byte(password)) != nil {
		t.Fatal("legacy password was not replaced by bcrypt")
	}
}
