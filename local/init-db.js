import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(process.env.LAS_DB_PATH || resolve(here, "data/asbl-las.sqlite"));
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
const schema = readFileSync(resolve(here, "sqlite/schema.sql"), "utf8");
db.exec(schema);
console.log("Base SQLite initialisée :", dbPath);
console.log("Tables :", db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(x => x.name).join(", "));
db.close();
