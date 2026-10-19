import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here=dirname(fileURLToPath(import.meta.url));
const dbPath=resolve(process.env.LAS_DB_PATH||resolve(here,"data/asbl-las.sqlite"));
const username=String(process.env.LAS_USERNAME||"").trim().toLowerCase();
const password=String(process.env.LAS_PASSWORD||"");
const email=String(process.env.LAS_EMAIL||"").trim().toLowerCase()||null;
const displayName=String(process.env.LAS_DISPLAY_NAME||username).trim();
const role=String(process.env.LAS_ROLE||"membre");
const memberRaw=String(process.env.LAS_MEMBER_ID||"").trim();
const memberId=memberRaw?Number(memberRaw):null;
if(!/^[a-z0-9._-]{3,80}$/.test(username))throw new Error("LAS_USERNAME invalide (3 à 80 caractères : lettres, chiffres, . _ -).");
if(password.length<12||password.length>128)throw new Error("LAS_PASSWORD doit contenir entre 12 et 128 caractères.");
if(!["admin","tresorier","secretaire","membre"].includes(role))throw new Error("LAS_ROLE invalide.");
if(memberRaw&&!Number.isInteger(memberId))throw new Error("LAS_MEMBER_ID doit être un entier.");
const db=new Database(dbPath);db.pragma("foreign_keys=ON");
if(memberId&&!db.prepare("SELECT id FROM members WHERE id=?").get(memberId))throw new Error("Le membre demandé n’existe pas dans la base locale.");
const existing=db.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").get(username);
const hash=await bcrypt.hash(password,12);
if(existing){
  db.prepare("UPDATE users SET email=?,password_hash=?,role=?,member_id=?,active=1,display_name=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
    .run(email,hash,role,memberId,displayName,existing.id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(existing.id);
  console.log("Compte mis à jour et sessions révoquées :",username);
}else{
  db.prepare("INSERT INTO users(id,username,email,password_hash,role,member_id,active,display_name) VALUES(?,?,?,?,?,?,1,?)")
    .run(randomUUID(),username,email,hash,role,memberId,displayName);
  console.log("Compte local créé :",username);
}
db.close();
