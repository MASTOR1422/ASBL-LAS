-- ASBL-LAS D1 migration 0004: record migration state in the target database.
CREATE TABLE IF NOT EXISTS schema_migrations (
 version TEXT PRIMARY KEY,
 description TEXT NOT NULL,
 applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT OR IGNORE INTO schema_migrations(version,description) VALUES
 ('0001','Core LAS schema: identity, members, finances, content, tontine, aid and audit'),
 ('0002','Single-use hashed password recovery tokens'),
 ('0003','Complete audit trigger coverage'),
 ('0004','Migration ledger');
