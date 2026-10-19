import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.LAS_DB_PATH || resolve(here, "data/asbl-las.sqlite"));
const username = String(process.env.LAS_ADMIN_USERNAME || "").trim().toLowerCase();
const password = String(process.env.LAS_ADMIN_PASSWORD || "");
const email = String(process.env.LAS_ADMIN_EMAIL || "").trim().toLowerCase() || null;
if (!/^[a-z0-9._-]{3,80}$/.test(username)) throw new Error("Définissez LAS_ADMIN_USERNAME (3 à 80 caractères : lettres, chiffres, . _ -).");
if (password.length < 12 || password.length > 128) throw new Error("LAS_ADMIN_PASSWORD doit contenir entre 12 et 128 caractères.");
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
const hash = await bcrypt.hash(password, 12);
const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
if (existing) {
  db.prepare("UPDATE users SET password_hash=?, email=COALESCE(?,email), role='admin', active=1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(hash, email, existing.id);
  console.log("Compte administrateur réinitialisé :", username);
} else {
  db.prepare("INSERT INTO users(id,username,email,password_hash,role,active,display_name) VALUES(?,?,?,?, 'admin',1,?)")
    .run(randomUUID(), username, email, hash, username);
  console.log("Compte administrateur créé :", username);
}
db.close();
