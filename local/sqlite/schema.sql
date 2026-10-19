PRAGMA foreign_keys = ON;

-- ASBL-LAS local SQLite schema.
-- This schema is additive and is intended for a separate local database file.
-- Never point this migration at, or overwrite, the production Supabase database.

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  profession TEXT,
  birthdate TEXT,
  birthplace TEXT,
  address TEXT,
  joined_on TEXT,
  position TEXT,
  forum_status TEXT,
  asbl_status TEXT,
  meeting_status TEXT,
  note TEXT,
  photo_path TEXT,
  birthday_visible INTEGER NOT NULL DEFAULT 0 CHECK (birthday_visible IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Local identity is independent from Supabase Auth. Passwords are stored as
-- strong password hashes, never as plaintext. Session tokens are hashed too.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'membre'
    CHECK (role IN ('admin','tresorier','secretaire','membre')),
  member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS monthly_contributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  contribution_year INTEGER NOT NULL CHECK (contribution_year BETWEEN 2000 AND 2200),
  contribution_month INTEGER NOT NULL CHECK (contribution_month BETWEEN 1 AND 12),
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'CDF' CHECK (currency IN ('CDF','USD')),
  paid_at TEXT,
  note TEXT,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(member_id, contribution_year, contribution_month, currency)
);

CREATE TABLE IF NOT EXISTS member_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  payment_year INTEGER NOT NULL CHECK (payment_year BETWEEN 2000 AND 2200),
  payment_month INTEGER NOT NULL CHECK (payment_month BETWEEN 1 AND 12),
  paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0,1)),
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(member_id, payment_year, payment_month)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_type TEXT NOT NULL DEFAULT 'link',
  title TEXT NOT NULL,
  description TEXT,
  external_url TEXT,
  storage_path TEXT,
  published_date TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  legacy_id TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived'))
);

CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending','published','hidden')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS tontine_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  contribution_amount NUMERIC NOT NULL DEFAULT 0 CHECK (contribution_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'CDF' CHECK (currency IN ('CDF','USD')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','open','closed')),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS tontine_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES tontine_periods(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'CDF' CHECK (currency IN ('CDF','USD')),
  status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due','paid','late','cancelled')),
  paid_at TEXT,
  note TEXT,
  recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(period_id, member_id)
);

CREATE TABLE IF NOT EXISTS aid_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','closed')),
  decision_note TEXT,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','PASSWORD_RESET')),
  old_data TEXT,
  new_data TEXT,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_contributions_member_period ON monthly_contributions(member_id, contribution_year DESC, contribution_month DESC);
CREATE INDEX IF NOT EXISTS idx_member_payments_member_period ON member_payments(member_id, payment_year DESC, payment_month DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_date ON posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_status_date ON media_items(status, published_date DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_date ON post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tontine_entries_member ON tontine_entries(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aid_member_status ON aid_requests(member_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name, record_id, changed_at DESC);

-- Audit triggers record row snapshots. The API must set the current actor ID
-- for each request using a request-scoped connection/temporary actor context;
-- until that API layer is enabled, changed_by remains NULL.
CREATE TRIGGER IF NOT EXISTS audit_members_insert AFTER INSERT ON members BEGIN
  INSERT INTO audit_logs(table_name,record_id,action,new_data)
  VALUES ('members',CAST(NEW.id AS TEXT),'INSERT',json_object('name',NEW.name,'status',NEW.status,'email',NEW.email));
END;
CREATE TRIGGER IF NOT EXISTS audit_members_update AFTER UPDATE ON members BEGIN
  INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data)
  VALUES ('members',CAST(NEW.id AS TEXT),'UPDATE',json_object('name',OLD.name,'status',OLD.status,'email',OLD.email),json_object('name',NEW.name,'status',NEW.status,'email',NEW.email));
END;
CREATE TRIGGER IF NOT EXISTS audit_contributions_insert AFTER INSERT ON monthly_contributions BEGIN
  INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by)
  VALUES ('monthly_contributions',CAST(NEW.id AS TEXT),'INSERT',json_object('member_id',NEW.member_id,'year',NEW.contribution_year,'month',NEW.contribution_month,'amount',NEW.amount,'currency',NEW.currency),NEW.recorded_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_contributions_update AFTER UPDATE ON monthly_contributions BEGIN
  INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by)
  VALUES ('monthly_contributions',CAST(NEW.id AS TEXT),'UPDATE',json_object('amount',OLD.amount,'currency',OLD.currency,'paid_at',OLD.paid_at),json_object('amount',NEW.amount,'currency',NEW.currency,'paid_at',NEW.paid_at),NEW.recorded_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_insert AFTER INSERT ON tontine_entries BEGIN
  INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by)
  VALUES ('tontine_entries',CAST(NEW.id AS TEXT),'INSERT',json_object('period_id',NEW.period_id,'member_id',NEW.member_id,'amount',NEW.amount,'currency',NEW.currency,'status',NEW.status),NEW.recorded_by);
END;
CREATE TRIGGER IF NOT EXISTS audit_aid_insert AFTER INSERT ON aid_requests BEGIN
  INSERT INTO audit_logs(table_name,record_id,action,new_data)
  VALUES ('aid_requests',CAST(NEW.id AS TEXT),'INSERT',json_object('member_id',NEW.member_id,'subject',NEW.subject,'status',NEW.status));
END;
