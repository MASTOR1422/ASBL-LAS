-- ASBL-LAS D1 migration 0002: single-use, hashed password recovery tokens.
-- Email delivery requires RESEND_API_KEY and LAS_MAIL_FROM secrets on Cloudflare Pages.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_expiry ON password_reset_tokens(user_id, expires_at);
