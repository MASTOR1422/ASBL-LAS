import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const here=dirname(fileURLToPath(import.meta.url));
const temp=mkdtempSync(join(tmpdir(),"las-sqlite-test-"));
const db=new Database(join(temp,"test.sqlite"));
try {
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(resolve(here,"sqlite/schema.sql"),"utf8"));
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
  for(const name of ["members","users","sessions","monthly_contributions","member_payments","posts","media_items","post_comments","tontine_periods","tontine_entries","aid_requests","audit_logs"]) assert.ok(tables.includes(name),`table missing: ${name}`);
  const memberId=db.prepare("INSERT INTO members(name,email) VALUES(?,?)").run("Membre test","test@example.org").lastInsertRowid;
  const userId=randomUUID();
  db.prepare("INSERT INTO users(id,username,password_hash,role,member_id,active) VALUES(?,?,?,'admin',?,1)").run(userId,"testadmin","$2b$12$not-a-real-hash-for-schema-test",memberId);
  db.prepare("INSERT INTO monthly_contributions(member_id,contribution_year,contribution_month,amount,currency,recorded_by) VALUES(?,2026,10,1000,'CDF',?)").run(memberId,userId);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE table_name='members' AND action='INSERT'").get().n,1,"member insertion must be audited");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE table_name='monthly_contributions' AND action='INSERT'").get().n,1,"contribution insertion must be audited");
  assert.throws(()=>db.prepare("INSERT INTO monthly_contributions(member_id,contribution_year,contribution_month,amount,currency) VALUES(?,2026,10,1000,'CDF')").run(memberId),/UNIQUE constraint failed/);
  assert.throws(()=>db.prepare("INSERT INTO tontine_periods(title,starts_on,ends_on,contribution_amount,currency,status) VALUES('Erreur','2026-11-30','2026-11-01',0,'CDF','planned')").run(),/CHECK constraint failed/);
  assert.throws(()=>db.prepare("INSERT INTO users(id,username,password_hash,role,active) VALUES(?,?,?,'root',1)").run(randomUUID(),"badrole","hash"),/CHECK constraint failed/);
  console.log("SQLite tests OK : tables, relations, contraintes, unicité et audit.");
} finally {
  db.close();
  rmSync(temp,{recursive:true,force:true});
}
