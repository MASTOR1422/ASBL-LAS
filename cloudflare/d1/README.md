# ASBL-LAS — Cloudflare D1

## Migrations

Apply the SQL files in order to the D1 database bound to Pages as `DB`:

1. `migrations/0001_asbl_las_schema.sql`
2. `migrations/0002_password_reset_tokens.sql`
3. `migrations/0003_complete_audit_triggers.sql`
4. `migrations/0004_migration_ledger.sql`

The migrations use `IF NOT EXISTS` / `INSERT OR IGNORE` where appropriate and do not drop tables or erase application records. The current D1 database has already received these migrations. `schema_migrations` records their versions.

## Data model

- `users`, `profiles`, `auth_login_map`, `sessions`, `password_reset_tokens`: accounts, roles, username sign-in, revocable sessions and password recovery.
- `members`: member register, contact details, birthday visibility and statuses.
- `monthly_contributions`, `member_payments`: contribution ledger and monthly paid/unpaid status.
- `posts`, `post_comments`, `media_items`: publications, moderated comments and public media.
- `tontine_periods`, `tontine_entries`: tontine periods and member participation.
- `aid_requests`: confidential requests and decisions.
- `audit_logs`: insert/update/delete and authentication events.

UUID identifiers from Supabase tables are stored as text so their values can be preserved. D1 does not store Supabase password hashes. An imported account with no `password_hash` must set a new password through the recovery flow.

## Pages secrets for recovery email

In Cloudflare Dashboard → Workers & Pages → `asbl-las-api` → Settings → Variables and Secrets, configure for **Preview and Production**:

- `RESEND_API_KEY`: Secret containing the Resend API key.
- `LAS_MAIL_FROM`: verified sender address, for example an address on a domain verified with Resend.

Do not put either value in source code or Git. Until these are configured and tested, email recovery and new-account activation will return a clear configuration error.

## API routes

- Public: `GET /api/health`, `GET /api/public/posts`, `GET /api/public/media`.
- Authentication: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/recover`, `POST /api/auth/reset`, `POST /api/auth/change-password`.
- Member: `GET /api/me`, `GET /api/me/contributions`, `GET /api/me/payments`, `GET /api/me/tontine`, `GET|POST /api/me/aid`.
- Staff/finance: `GET|POST /api/admin/members`, `PATCH /api/admin/members/:id`, `GET|POST /api/admin/contributions`, `GET|POST /api/admin/payments`, aid/tontine management routes.
- Content: `GET|POST /api/admin/posts`, `PATCH /api/admin/posts/:uuid`, `GET|POST /api/admin/media`, `PATCH /api/admin/media/:id`, public comments and staff comment moderation.
- Administration: `POST /api/admin/users`, `GET /api/admin/audit`.

All mutating browser requests require a same-origin HTTPS request. The API uses an HttpOnly, Secure, SameSite=Strict session cookie and enforces roles on the server.

## Rollout caution

This branch is a draft and the existing site root still contains legacy pages that use Supabase. Do not disable Supabase or switch the production site until the root UI and all remaining features have been migrated and end-to-end tests have passed. The existing Supabase database has not been modified or deleted.
