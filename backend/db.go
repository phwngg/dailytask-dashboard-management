package main

import (
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

const schema = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS roles (
  name TEXT PRIMARY KEY, label TEXT NOT NULL, caps TEXT NOT NULL DEFAULT '[]', locked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY COLLATE NOCASE, username TEXT UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL, initials TEXT NOT NULL DEFAULT '', position TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#7657E8', role TEXT NOT NULL REFERENCES roles(name),
  active INTEGER NOT NULL DEFAULT 1, start_date TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, assignee TEXT NOT NULL REFERENCES users(email),
  due TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'Vừa', status TEXT NOT NULL DEFAULT 'todo',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  kpi_key TEXT NOT NULL DEFAULT '', qty REAL NOT NULL DEFAULT 1, done_at TEXT NOT NULL DEFAULT '',
  schedule_id TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS tasks_assignee_status ON tasks(assignee,status);
CREATE INDEX IF NOT EXISTS tasks_done_at ON tasks(done_at);
CREATE TABLE IF NOT EXISTS content_plan (
  id TEXT PRIMARY KEY, channel TEXT NOT NULL DEFAULT '', month TEXT NOT NULL DEFAULT '',
  pillar TEXT NOT NULL DEFAULT '', content_key TEXT NOT NULL DEFAULT '', demo_date TEXT NOT NULL DEFAULT '',
  post_date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Chưa thực hiện',
  message TEXT NOT NULL DEFAULT '', assignee TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS plan_month_channel ON content_plan(month,channel);
CREATE INDEX IF NOT EXISTS plan_post_id ON content_plan(post_date DESC,id DESC);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '', lead TEXT NOT NULL DEFAULT '', attendees TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'Đã lên lịch', kpi_key TEXT NOT NULL DEFAULT '', qty REAL NOT NULL DEFAULT 1,
  done INTEGER NOT NULL DEFAULT 0, brief TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', event_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
  attendees TEXT NOT NULL DEFAULT '[]', duration INTEGER NOT NULL DEFAULT 60,
  repeat TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', event_id TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS shifts (
  week TEXT NOT NULL, email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  mon TEXT NOT NULL DEFAULT '', tue TEXT NOT NULL DEFAULT '', wed TEXT NOT NULL DEFAULT '',
  thu TEXT NOT NULL DEFAULT '', fri TEXT NOT NULL DEFAULT '', sat TEXT NOT NULL DEFAULT '', sun TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(week,email)
);
CREATE TABLE IF NOT EXISTS policies (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL DEFAULT '', code TEXT NOT NULL, label TEXT NOT NULL,
  type TEXT NOT NULL, input_key TEXT NOT NULL DEFAULT '', rate REAL NOT NULL DEFAULT 0,
  tiers TEXT NOT NULL DEFAULT '', minimum REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS inputs (
  month TEXT NOT NULL, email TEXT NOT NULL, values_json TEXT NOT NULL DEFAULT '{}', PRIMARY KEY(month,email)
);
CREATE TABLE IF NOT EXISTS payroll (
  month TEXT NOT NULL, email TEXT NOT NULL, base REAL NOT NULL DEFAULT 0, fees REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0, penalty REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  kpi_ok INTEGER NOT NULL DEFAULT 1, kpi_met REAL NOT NULL DEFAULT 0, kpi_total REAL NOT NULL DEFAULT 0,
  kpi_rate REAL NOT NULL DEFAULT 100, kpi_items TEXT NOT NULL DEFAULT '[]', breakdown TEXT NOT NULL DEFAULT '[]', computed_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(month,email)
);
CREATE TABLE IF NOT EXISTS channels (
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE, slot INTEGER NOT NULL DEFAULT 1,
  platform TEXT NOT NULL DEFAULT '', page_id TEXT NOT NULL DEFAULT '', page_name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '', PRIMARY KEY(email,slot)
);
CREATE TABLE IF NOT EXISTS channel_stats (
  month TEXT NOT NULL, email TEXT NOT NULL, slot INTEGER NOT NULL DEFAULT 1,
  videos REAL NOT NULL DEFAULT 0, views REAL NOT NULL DEFAULT 0, followers REAL NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, source TEXT NOT NULL DEFAULT '', PRIMARY KEY(month,email,slot)
);
CREATE TABLE IF NOT EXISTS pancake_pages (
  page_id TEXT PRIMARY KEY, page_name TEXT NOT NULL DEFAULT '', platform TEXT NOT NULL DEFAULT '',
  page_access_token_enc TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'connected',
  last_seen_at TEXT NOT NULL DEFAULT '', last_sync_at TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pancake_page_assignments (
  page_id TEXT PRIMARY KEY REFERENCES pancake_pages(page_id) ON DELETE CASCADE,
  email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pancake_metric_snapshots (
  page_id TEXT NOT NULL REFERENCES pancake_pages(page_id) ON DELETE CASCADE,
  month TEXT NOT NULL, endpoint TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}',
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, error TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(page_id,month,endpoint)
);
`

func openDB(path, adminEmail, adminPassword string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		return nil, err
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	dsn := (&url.URL{Scheme: "file", Path: abs}).String() + "?_busy_timeout=5000&_journal_mode=WAL&_foreign_keys=on&_synchronous=NORMAL"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(8)
	if err = db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	if _, err = db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	if _, err = db.Exec(`INSERT OR IGNORE INTO pancake_pages(page_id,page_name,platform,status)
		SELECT page_id,page_name,platform,'needs_reconnect' FROM channels
		WHERE lower(platform)='pancake' AND page_id<>''`); err != nil {
		db.Close()
		return nil, err
	}
	if _, err = db.Exec(`INSERT OR IGNORE INTO pancake_page_assignments(page_id,email)
		SELECT page_id,email FROM channels WHERE lower(platform)='pancake' AND page_id<>'' ORDER BY page_id,email,slot`); err != nil {
		db.Close()
		return nil, err
	}
	for _, col := range []struct{ table, name, definition string }{
		{"payroll", "kpi_items", "TEXT NOT NULL DEFAULT '[]'"},
		{"payroll", "computed_at", "TEXT NOT NULL DEFAULT ''"},
		{"schedules", "event_id", "TEXT NOT NULL DEFAULT ''"},
		{"meetings", "event_id", "TEXT NOT NULL DEFAULT ''"},
	} {
		if err = ensureColumn(db, col.table, col.name, col.definition); err != nil {
			db.Close()
			return nil, err
		}
	}
	if err = seed(db, adminEmail, adminPassword); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func ensureColumn(db *sql.DB, table, name, definition string) error {
	rows, err := db.Query("PRAGMA table_info(" + table + ")")
	if err != nil {
		return err
	}
	defer rows.Close()
	var cid, notnull, pk int
	var current, typ string
	var defaultValue any
	for rows.Next() {
		if err := rows.Scan(&cid, &current, &typ, &notnull, &defaultValue, &pk); err != nil {
			return err
		}
		if current == name {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec("ALTER TABLE " + table + " ADD COLUMN " + name + " " + definition)
	return err
}

func seed(db *sql.DB, email, password string) error {
	roles := []struct{ name, label, caps string }{
		{"admin", "Quản trị viên", `[
			"plan.view","plan.edit","plan.manage","checklist.viewAll","shifts.viewAll",
			"shifts.manage","payroll.viewAll","payroll.compute","channel.view","users.manage"]`},
		{"staff", "Nhân viên", `["plan.view","plan.edit","channel.view"]`},
	}
	for _, r := range roles {
		if _, err := db.Exec(`INSERT OR IGNORE INTO roles(name,label,caps,locked) VALUES(?,?,?,?)`, r.name, r.label, r.caps, r.name == "admin"); err != nil {
			return err
		}
	}
	var n int
	if err := db.QueryRow(`SELECT count(*) FROM users`).Scan(&n); err != nil || n != 0 {
		return err
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || len(password) == 0 || len(password) > 72 {
		return fmt.Errorf("database is empty: set INITIAL_ADMIN_EMAIL and an INITIAL_ADMIN_PASSWORD of 1–72 bytes")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	name := "Quản trị viên"
	initials := "QT"
	_, err = db.Exec(`INSERT INTO users(email,username,name,initials,role,password_hash) VALUES(?,?,?,?,?,?)`, email, "admin", name, initials, "admin", string(hash))
	return err
}
