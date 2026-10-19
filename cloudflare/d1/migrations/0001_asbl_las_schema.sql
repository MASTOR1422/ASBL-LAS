-- ASBL-LAS Cloudflare D1 schema, derived from Supabase and reviewed V2 feature model.
-- Additive and repeatable. UUID IDs remain TEXT for faithful migration.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS members (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, profession TEXT, birthdate TEXT, birthplace TEXT, address TEXT, joined_on TEXT, position TEXT,
 forum_status TEXT CHECK(forum_status IS NULL OR forum_status IN('OUI','NON','PARTIEL','OCCASIONEL','SOUVENT','PARFOIS')),
 asbl_status TEXT NOT NULL DEFAULT 'OUI' CHECK(asbl_status IN('OUI','NON')),
 meeting_status TEXT CHECK(meeting_status IS NULL OR meeting_status IN('OUI','NON','EXEMPTER','EXEMPTE')),
 note TEXT, photo_path TEXT, birthday_visible INTEGER NOT NULL DEFAULT 1 CHECK(birthday_visible IN(0,1)),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','inactive','suspended')),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, email TEXT UNIQUE COLLATE NOCASE, password_hash TEXT,
 role TEXT NOT NULL DEFAULT 'membre' CHECK(role IN('admin','secretaire','tresorier','membre')),
 member_id INTEGER REFERENCES members(id) ON DELETE SET NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)), display_name TEXT,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS profiles (
 id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, full_name TEXT,
 role TEXT NOT NULL DEFAULT 'membre' CHECK(role IN('admin','secretaire','tresorier','membre')),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), display_name TEXT,
 member_id INTEGER REFERENCES members(id) ON DELETE SET NULL, active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1))
);
CREATE TABLE IF NOT EXISTS auth_login_map (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(username=lower(username) AND length(username) BETWEEN 3 AND 80 AND username NOT GLOB '*[^a-z0-9._-]*'),
 login_email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), last_seen_at TEXT
);
CREATE TABLE IF NOT EXISTS monthly_contributions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
 contribution_year INTEGER NOT NULL CHECK(contribution_year BETWEEN 2000 AND 2200), contribution_month INTEGER NOT NULL CHECK(contribution_month BETWEEN 1 AND 12),
 amount NUMERIC NOT NULL DEFAULT 0 CHECK(amount>=0), currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN('USD','CDF')),
 paid_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), note TEXT, recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(member_id,contribution_year,contribution_month,currency)
);
CREATE TABLE IF NOT EXISTS member_payments (
 id TEXT PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
 payment_year INTEGER NOT NULL CHECK(payment_year BETWEEN 2000 AND 2200), payment_month INTEGER NOT NULL CHECK(payment_month BETWEEN 1 AND 12),
 paid INTEGER NOT NULL DEFAULT 0 CHECK(paid IN(0,1)), updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(member_id,payment_year,payment_month)
);
CREATE TABLE IF NOT EXISTS posts (
 id TEXT PRIMARY KEY, author_id TEXT REFERENCES users(id) ON DELETE SET NULL, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 180),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000), category TEXT NOT NULL DEFAULT 'general' CHECK(category IN('general','annonce','entraide','evenement')),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN('draft','published','hidden','archived')),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS media_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT, media_type TEXT NOT NULL CHECK(media_type IN('photo','pdf','video','article','link')), title TEXT NOT NULL,
 description TEXT, external_url TEXT, storage_path TEXT, published_date TEXT NOT NULL DEFAULT(date('now')),
 created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 legacy_id TEXT, author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN('published','hidden','draft','archived'))
);
CREATE TABLE IF NOT EXISTS post_comments (
 id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 3000), status TEXT NOT NULL DEFAULT 'published' CHECK(status IN('published','hidden','pending')),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS tontine_periods (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160), starts_on TEXT NOT NULL, ends_on TEXT NOT NULL,
 contribution_amount NUMERIC NOT NULL DEFAULT 0 CHECK(contribution_amount>=0), currency TEXT NOT NULL DEFAULT 'CDF' CHECK(currency IN('CDF','USD')),
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN('planned','open','closed','cancelled')),
 created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), CHECK(ends_on>=starts_on)
);
CREATE TABLE IF NOT EXISTS tontine_entries (
 id INTEGER PRIMARY KEY AUTOINCREMENT, period_id INTEGER NOT NULL REFERENCES tontine_periods(id) ON DELETE RESTRICT,
 member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT, amount NUMERIC NOT NULL DEFAULT 0 CHECK(amount>=0),
 currency TEXT NOT NULL DEFAULT 'CDF' CHECK(currency IN('CDF','USD')), status TEXT NOT NULL DEFAULT 'due' CHECK(status IN('due','paid','late','cancelled','waived')),
 paid_at TEXT, note TEXT, recorded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(period_id,member_id)
);
CREATE TABLE IF NOT EXISTS aid_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT, member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
 subject TEXT NOT NULL CHECK(length(subject) BETWEEN 3 AND 160), description TEXT NOT NULL CHECK(length(description) BETWEEN 3 AND 5000),
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','under_review','approved','declined','closed','pending','rejected')),
 decision_note TEXT, decided_by TEXT REFERENCES users(id) ON DELETE SET NULL, decided_at TEXT,
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, record_id TEXT,
 action TEXT NOT NULL CHECK(action IN('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','PASSWORD_RESET')),
 old_data TEXT, new_data TEXT, changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 changed_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE INDEX IF NOT EXISTS idx_users_member_id ON users(member_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_contributions_member_period ON monthly_contributions(member_id,contribution_year DESC,contribution_month DESC);
CREATE INDEX IF NOT EXISTS idx_member_payments_member_period ON member_payments(member_id,payment_year DESC,payment_month DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status_date ON posts(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_status_date ON media_items(status,published_date DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_date ON post_comments(post_id,created_at);
CREATE INDEX IF NOT EXISTS idx_tontine_entries_member ON tontine_entries(member_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aid_member_status ON aid_requests(member_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_logs(table_name,record_id,changed_at DESC);
CREATE TRIGGER IF NOT EXISTS audit_members_insert AFTER INSERT ON members BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data) VALUES('members',CAST(NEW.id AS TEXT),'INSERT',json_object('name',NEW.name,'status',NEW.status,'email',NEW.email)); END;
CREATE TRIGGER IF NOT EXISTS audit_members_update AFTER UPDATE ON members BEGIN INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data) VALUES('members',CAST(NEW.id AS TEXT),'UPDATE',json_object('name',OLD.name,'status',OLD.status,'email',OLD.email),json_object('name',NEW.name,'status',NEW.status,'email',NEW.email)); END;
CREATE TRIGGER IF NOT EXISTS audit_members_delete AFTER DELETE ON members BEGIN INSERT INTO audit_logs(table_name,record_id,action,old_data) VALUES('members',CAST(OLD.id AS TEXT),'DELETE',json_object('name',OLD.name,'status',OLD.status,'email',OLD.email)); END;
CREATE TRIGGER IF NOT EXISTS audit_contributions_insert AFTER INSERT ON monthly_contributions BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by) VALUES('monthly_contributions',CAST(NEW.id AS TEXT),'INSERT',json_object('member_id',NEW.member_id,'year',NEW.contribution_year,'month',NEW.contribution_month,'amount',NEW.amount,'currency',NEW.currency),NEW.recorded_by); END;
CREATE TRIGGER IF NOT EXISTS audit_contributions_update AFTER UPDATE ON monthly_contributions BEGIN INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by) VALUES('monthly_contributions',CAST(NEW.id AS TEXT),'UPDATE',json_object('amount',OLD.amount,'currency',OLD.currency,'paid_at',OLD.paid_at),json_object('amount',NEW.amount,'currency',NEW.currency,'paid_at',NEW.paid_at),NEW.recorded_by); END;
CREATE TRIGGER IF NOT EXISTS audit_payments_insert AFTER INSERT ON member_payments BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by) VALUES('member_payments',NEW.id,'INSERT',json_object('member_id',NEW.member_id,'year',NEW.payment_year,'month',NEW.payment_month,'paid',NEW.paid),NEW.updated_by); END;
CREATE TRIGGER IF NOT EXISTS audit_payments_update AFTER UPDATE ON member_payments BEGIN INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by) VALUES('member_payments',NEW.id,'UPDATE',json_object('paid',OLD.paid),json_object('paid',NEW.paid),NEW.updated_by); END;
CREATE TRIGGER IF NOT EXISTS audit_posts_insert AFTER INSERT ON posts BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by) VALUES('posts',NEW.id,'INSERT',json_object('title',NEW.title,'category',NEW.category,'status',NEW.status),NEW.author_id); END;
CREATE TRIGGER IF NOT EXISTS audit_posts_update AFTER UPDATE ON posts BEGIN INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by) VALUES('posts',NEW.id,'UPDATE',json_object('title',OLD.title,'status',OLD.status),json_object('title',NEW.title,'status',NEW.status),NEW.author_id); END;
CREATE TRIGGER IF NOT EXISTS audit_comments_insert AFTER INSERT ON post_comments BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by) VALUES('post_comments',NEW.id,'INSERT',json_object('post_id',NEW.post_id,'status',NEW.status),NEW.author_id); END;
CREATE TRIGGER IF NOT EXISTS audit_tontine_insert AFTER INSERT ON tontine_entries BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by) VALUES('tontine_entries',CAST(NEW.id AS TEXT),'INSERT',json_object('period_id',NEW.period_id,'member_id',NEW.member_id,'amount',NEW.amount,'currency',NEW.currency,'status',NEW.status),NEW.recorded_by); END;
CREATE TRIGGER IF NOT EXISTS audit_aid_insert AFTER INSERT ON aid_requests BEGIN INSERT INTO audit_logs(table_name,record_id,action,new_data,changed_by) VALUES('aid_requests',CAST(NEW.id AS TEXT),'INSERT',json_object('member_id',NEW.member_id,'subject',NEW.subject,'status',NEW.status),NEW.decided_by); END;
