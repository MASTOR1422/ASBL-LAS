import express from "express";
import helmet from "helmet";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const dbPath = resolve(process.env.LAS_DB_PATH || resolve(here, "data/asbl-las.sqlite"));
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get()) {
  throw new Error("Base absente. Lancez d'abord : npm run init-db");
}

const app = express();
const host = process.env.LAS_HOST || "127.0.0.1";
const port = Number(process.env.PORT || process.env.LAS_PORT || 3000);
const cookieName = "las_session";
const sessionHours = Math.max(1, Math.min(168, Number(process.env.LAS_SESSION_HOURS || 12)));
const dummyPasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
const isHttps = process.env.LAS_HTTPS === "1";
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "64kb", strict: true }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

const sha = (v) => createHash("sha256").update(v).digest("hex");
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${isHttps ? "; Secure" : ""}`;
const clearCookie = () => `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isHttps ? "; Secure" : ""}`;
const jsonError = (res, status, message) => res.status(status).json({ message });
const roles = { management: ["admin", "tresorier", "secretaire"], finance: ["admin", "tresorier"], admin: ["admin"] };
function sameOrigin(req) {
  const origin = req.get("origin");
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.host === req.get("host") && (u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch { return false; }
}
function requireOrigin(req, res, next) {
  if (!sameOrigin(req)) return jsonError(res, 403, "Requête refusée.");
  next();
}
function authenticate(req, res, next) {
  const raw = String(req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(cookieName + "="))?.slice(cookieName.length + 1);
  if (!raw || raw.length > 256) return jsonError(res, 401, "Session absente ou expirée.");
  const session = db.prepare(`SELECT s.id AS session_id,s.expires_at,u.id,u.username,u.email,u.role,u.member_id,u.active,u.display_name
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') LIMIT 1`).get(sha(raw));
  if (!session || session.active !== 1) return jsonError(res, 401, "Session absente ou expirée.");
  db.prepare("UPDATE sessions SET last_seen_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").run(session.session_id);
  req.user = session;
  next();
}
function allow(...allowed) {
  return (req, res, next) => allowed.includes(req.user.role) ? next() : jsonError(res, 403, "Droits insuffisants.");
}
function audit(table, recordId, action, before, after, actor) {
  db.prepare("INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by) VALUES(?,?,?,?,?,?)")
    .run(table, String(recordId), action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, actor || null);
}
const auditRow = (table, id) => db.prepare("SELECT * FROM " + table + " WHERE id=?").get(id);
const safeMember = (m) => ({ id:m.id,name:m.name,phone:m.phone,email:m.email,profession:m.profession,birthdate:m.birthdate,birthplace:m.birthplace,address:m.address,joined_on:m.joined_on,position:m.position,forum_status:m.forum_status,asbl_status:m.asbl_status,meeting_status:m.meeting_status,status:m.status });
const amount = (v) => Number.isFinite(Number(v)) && Number(v) >= 0;
const intRange = (v,min,max) => Number.isInteger(Number(v)) && Number(v)>=min && Number(v)<=max;

app.post("/api/auth/login", requireOrigin, async (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || !password || password.length > 1024) return jsonError(res, 401, "Nom d'utilisateur ou mot de passe incorrect.");
  const user = db.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE LIMIT 1").get(username);
  const valid = user && user.active === 1 && await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    // Similar response and password hash work for missing users reduce account enumeration.
    if (!user) await bcrypt.compare(password, dummyPasswordHash);
    return jsonError(res, 401, "Nom d'utilisateur ou mot de passe incorrect.");
  }
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionHours * 3600_000).toISOString();
  db.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)").run(randomUUID(), user.id, sha(raw), expires);
  audit("users", user.id, "LOGIN", null, { username:user.username }, user.id);
  res.setHeader("Set-Cookie", cookie(raw, sessionHours * 3600));
  res.json({ user: { id:user.id, username:user.username, display_name:user.display_name || user.username, role:user.role, member_id:user.member_id } });
});
app.get("/api/auth/me", authenticate, (req, res) => res.json({ user: { id:req.user.id, username:req.user.username, email:req.user.email, display_name:req.user.display_name || req.user.username, role:req.user.role, member_id:req.user.member_id } }));
app.post("/api/auth/logout", requireOrigin, authenticate, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE id=?").run(req.user.session_id);
  audit("users", req.user.id, "LOGOUT", null, null, req.user.id);
  res.setHeader("Set-Cookie", clearCookie());
  res.json({ ok:true });
});

app.get("/api/public/posts", (req, res) => res.json(db.prepare("SELECT id,title,body,category,created_at FROM posts WHERE status='published' ORDER BY created_at DESC LIMIT 50").all()));
app.get("/api/public/media", (req, res) => res.json(db.prepare("SELECT id,media_type,title,description,external_url,published_date FROM media_items WHERE status='published' AND external_url LIKE 'https://%' ORDER BY published_date DESC LIMIT 100").all()));

app.get("/api/me", authenticate, (req, res) => {
  const member = req.user.member_id ? db.prepare("SELECT * FROM members WHERE id=?").get(req.user.member_id) : null;
  res.json({ user:{ id:req.user.id,username:req.user.username,email:req.user.email,display_name:req.user.display_name,role:req.user.role,member_id:req.user.member_id }, member:member ? safeMember(member) : null });
});
app.get("/api/me/contributions", authenticate, (req, res) => {
  if (!req.user.member_id && !roles.management.includes(req.user.role)) return res.json([]);
  const id = req.user.member_id;
  const rows = roles.management.includes(req.user.role) && req.query.member_id
    ? db.prepare("SELECT * FROM monthly_contributions WHERE member_id=? ORDER BY contribution_year DESC,contribution_month DESC LIMIT 100").all(Number(req.query.member_id))
    : db.prepare("SELECT * FROM monthly_contributions WHERE member_id=? ORDER BY contribution_year DESC,contribution_month DESC LIMIT 100").all(id);
  res.json(rows);
});
app.get("/api/me/payments", authenticate, (req, res) => {
  if (!req.user.member_id && !roles.management.includes(req.user.role)) return res.json([]);
  const memberId = roles.management.includes(req.user.role) && req.query.member_id ? Number(req.query.member_id) : req.user.member_id;
  res.json(db.prepare("SELECT * FROM member_payments WHERE member_id=? ORDER BY payment_year DESC,payment_month DESC LIMIT 100").all(memberId));
});
app.get("/api/me/tontine", authenticate, (req, res) => {
  if (!req.user.member_id) return res.json([]);
  res.json(db.prepare(`SELECT e.id,e.amount,e.currency,e.status,e.paid_at,e.note,p.title,p.starts_on,p.ends_on,p.status AS period_status
    FROM tontine_entries e JOIN tontine_periods p ON p.id=e.period_id WHERE e.member_id=? ORDER BY e.created_at DESC LIMIT 100`).all(req.user.member_id));
});
app.get("/api/me/aid", authenticate, (req, res) => {
  if (!req.user.member_id) return res.json([]);
  res.json(db.prepare("SELECT id,subject,status,decision_note,created_at,updated_at FROM aid_requests WHERE member_id=? ORDER BY created_at DESC LIMIT 50").all(req.user.member_id));
});
app.post("/api/me/aid", requireOrigin, authenticate, (req, res) => {
  if (!req.user.member_id) return jsonError(res, 400, "Votre compte doit être lié à une fiche membre.");
  const subject=String(req.body?.subject||"").trim(), description=String(req.body?.description||"").trim();
  if(subject.length<3||subject.length>160||description.length<3||description.length>5000) return jsonError(res,400,"Objet ou description invalide.");
  const info=db.prepare("INSERT INTO aid_requests(member_id,subject,description) VALUES(?,?,?)").run(req.user.member_id,subject,description);
  db.prepare("UPDATE audit_logs SET changed_by=? WHERE id=(SELECT MAX(id) FROM audit_logs WHERE table_name='aid_requests' AND record_id=? AND action='INSERT')").run(req.user.id,String(info.lastInsertRowid));
  res.status(201).json({id:info.lastInsertRowid,ok:true});
});

app.get("/api/admin/payments", authenticate, allow(...roles.management), (req,res) => res.json(db.prepare("SELECT p.*,m.name AS member_name FROM member_payments p JOIN members m ON m.id=p.member_id ORDER BY p.payment_year DESC,p.payment_month DESC LIMIT 1000").all()));
app.get("/api/admin/contributions", authenticate, allow(...roles.management), (req,res) => res.json(db.prepare("SELECT c.*,m.name AS member_name FROM monthly_contributions c JOIN members m ON m.id=c.member_id ORDER BY c.contribution_year DESC,c.contribution_month DESC LIMIT 1000").all()));
app.get("/api/admin/members", authenticate, allow(...roles.management), (req,res) => res.json(db.prepare("SELECT id,name,phone,email,profession,joined_on,position,status FROM members ORDER BY name LIMIT 1000").all()));
app.post("/api/admin/members", requireOrigin, authenticate, allow("admin","secretaire"), (req,res) => {
  const name=String(req.body?.name||"").trim();
  if(name.length<2||name.length>200) return jsonError(res,400,"Nom invalide.");
  const info=db.prepare("INSERT INTO members(name,phone,email,profession,birthdate,birthplace,address,joined_on,position,asbl_status,meeting_status,forum_status,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(name,req.body.phone||null,req.body.email||null,req.body.profession||null,req.body.birthdate||null,req.body.birthplace||null,req.body.address||null,req.body.joined_on||null,req.body.position||null,req.body.asbl_status||null,req.body.meeting_status||null,req.body.forum_status||null,req.body.status||"active");
  db.prepare("UPDATE audit_logs SET changed_by=? WHERE id=(SELECT MAX(id) FROM audit_logs WHERE table_name='members' AND record_id=? AND action='INSERT')").run(req.user.id,String(info.lastInsertRowid));
  res.status(201).json({id:info.lastInsertRowid});
});
app.post("/api/admin/contributions", requireOrigin, authenticate, allow(...roles.finance), (req,res) => {
  const memberId=Number(req.body?.member_id), year=Number(req.body?.contribution_year), month=Number(req.body?.contribution_month), value=Number(req.body?.amount), currency=String(req.body?.currency||"CDF");
  if(!Number.isInteger(memberId)||!intRange(year,2000,2200)||!intRange(month,1,12)||!amount(value)||!["CDF","USD"].includes(currency)) return jsonError(res,400,"Données de cotisation invalides.");
  try {
    const info=db.prepare("INSERT INTO monthly_contributions(member_id,contribution_year,contribution_month,amount,currency,paid_at,note,recorded_by) VALUES(?,?,?,?,?,?,?,?)").run(memberId,year,month,value,currency,req.body.paid_at||new Date().toISOString(),String(req.body.note||"").slice(0,1000)||null,req.user.id);
    res.status(201).json({id:info.lastInsertRowid});
  } catch { jsonError(res,409,"Cette cotisation existe déjà ou le membre est introuvable."); }
});
app.get("/api/admin/aid", authenticate, allow(...roles.management), (req,res) => res.json(db.prepare("SELECT a.*,m.name AS member_name FROM aid_requests a JOIN members m ON m.id=a.member_id ORDER BY a.created_at DESC LIMIT 300").all()));
app.patch("/api/admin/aid/:id", requireOrigin, authenticate, allow(...roles.management), (req,res) => {
  const status=String(req.body?.status||"");
  if(!["approved","rejected","closed","pending"].includes(status)) return jsonError(res,400,"Statut invalide.");
  const old=db.prepare("SELECT * FROM aid_requests WHERE id=?").get(Number(req.params.id));
  if(!old) return jsonError(res,404,"Demande introuvable.");
  db.prepare("UPDATE aid_requests SET status=?,decision_note=?,decided_by=?,decided_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
    .run(status,String(req.body?.decision_note||"").slice(0,2000)||null,req.user.id,old.id);
  audit("aid_requests",old.id,"UPDATE",old,db.prepare("SELECT * FROM aid_requests WHERE id=?").get(old.id),req.user.id);
  res.json({ok:true});
});
app.get("/api/admin/tontine/periods", authenticate, allow(...roles.management), (req,res) => res.json(db.prepare("SELECT * FROM tontine_periods ORDER BY starts_on DESC LIMIT 300").all()));
app.post("/api/admin/tontine/periods", requireOrigin, authenticate, allow(...roles.finance), (req,res) => {
  const title=String(req.body?.title||"").trim(), start=String(req.body?.starts_on||""), end=String(req.body?.ends_on||""), value=Number(req.body?.contribution_amount), currency=String(req.body?.currency||"CDF"), status=String(req.body?.status||"planned");
  if(title.length<2||title.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||!amount(value)||!["CDF","USD"].includes(currency)||!["planned","open","closed"].includes(status)) return jsonError(res,400,"Données de période invalides.");
  const info=db.prepare("INSERT INTO tontine_periods(title,starts_on,ends_on,contribution_amount,currency,status,created_by) VALUES(?,?,?,?,?,?,?)").run(title,start,end,value,currency,status,req.user.id);
  audit("tontine_periods",info.lastInsertRowid,"INSERT",null,{title,start,end,value,currency,status},req.user.id);
  res.status(201).json({id:info.lastInsertRowid});
});
app.get("/api/admin/tontine/entries", authenticate, allow(...roles.management), (req,res) => res.json(db.prepare("SELECT e.*,m.name AS member_name,p.title AS period_title FROM tontine_entries e JOIN members m ON m.id=e.member_id JOIN tontine_periods p ON p.id=e.period_id ORDER BY e.created_at DESC LIMIT 500").all()));
app.post("/api/admin/tontine/entries", requireOrigin, authenticate, allow(...roles.finance), (req,res) => {
  const periodId=Number(req.body?.period_id), memberId=Number(req.body?.member_id), value=Number(req.body?.amount), currency=String(req.body?.currency||"CDF"), status=String(req.body?.status||"due");
  if(!Number.isInteger(periodId)||!Number.isInteger(memberId)||!amount(value)||!["CDF","USD"].includes(currency)||!["due","paid","late","cancelled"].includes(status)) return jsonError(res,400,"Données de participation invalides.");
  try { const info=db.prepare("INSERT INTO tontine_entries(period_id,member_id,amount,currency,status,recorded_by) VALUES(?,?,?,?,?,?)").run(periodId,memberId,value,currency,status,req.user.id); res.status(201).json({id:info.lastInsertRowid}); }
  catch { jsonError(res,409,"Période ou membre introuvable, ou membre déjà inscrit."); }
});
app.get("/api/admin/audit", authenticate, allow("admin"), (req,res) => res.json(db.prepare("SELECT id,table_name,record_id,action,old_data,new_data,changed_by,changed_at FROM audit_logs ORDER BY changed_at DESC LIMIT 500").all()));

app.use(express.static(resolve(repo, "v2"), { index: "index.html", dotfiles:"deny", fallthrough:true, setHeaders(res){res.setHeader("X-Content-Type-Options","nosniff");} }));
app.use((req,res,next) => {
  if(req.path.startsWith("/api/")) return jsonError(res,404,"API inconnue.");
  res.sendFile(resolve(repo,"v2/index.html"), err => { if(err) next(err); });
});
app.use((err,req,res,next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  console.error("Erreur serveur LAS :", err?.message || "erreur interne");
  return jsonError(res,500,"Erreur interne. Consultez les journaux du serveur.");
});

app.listen(port, host, () => console.log(`ASBL-LAS local écoute sur http://${host}:${port} — SQLite: ${dbPath}`));
