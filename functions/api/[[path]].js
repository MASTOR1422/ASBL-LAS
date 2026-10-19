// ASBL-LAS Cloudflare Pages API — D1-backed implementation.
// All authorization is enforced server-side. D1 secrets are never sent to the browser.
const COOKIE = "las_session";
const SESSION_SECONDS = 12 * 60 * 60;
const MANAGEMENT = ["admin", "tresorier", "secretaire"];
const FINANCE = ["admin", "tresorier"];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extraHeaders
  }});
}
function fail(status, message) { return json({ message }, status); }
function cookieValue(request) {
  const raw = request.headers.get("cookie") || "";
  const item = raw.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  return item ? decodeURIComponent(item.slice(COOKIE.length + 1)) : "";
}
function cookieHeader(value, maxAge = SESSION_SECONDS) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("host");
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.host.toLowerCase() === String(host || "").toLowerCase();
  } catch { return false; }
}
function requireOrigin(request) { return sameOrigin(request); }
function bytesToB64(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToB64(bytes);
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function b64ToBytes(value) {
  let normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
async function hashPassword(password) {
  const salt = randomToken(16);
  const iterations = 210000;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(salt), iterations }, key, 256);
  return `pbkdf2-sha256$${iterations}$${salt}$${bytesToB64(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 600000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: b64ToBytes(parts[2]), iterations }, key, 256);
  return bytesToB64(new Uint8Array(bits)) === parts[3];
}
function validUsername(v) { return /^[a-z0-9._-]{3,80}$/.test(v); }
function amount(v) { return Number.isFinite(Number(v)) && Number(v) >= 0; }
function intRange(v, min, max) { return Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max; }
async function bodyJson(request) { try { return await request.json(); } catch { return null; } }
async function currentUser(request, env) {
  const raw = cookieValue(request);
  if (!raw || raw.length > 256) return null;
  const hash = await sha256(raw);
  const row = await env.DB.prepare(`SELECT s.id AS session_id,s.expires_at,u.id,u.username,u.email,u.role,u.member_id,u.active,u.display_name
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') LIMIT 1`).bind(hash).first();
  if (!row || Number(row.active) !== 1) return null;
  await env.DB.prepare("UPDATE sessions SET last_seen_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(row.session_id).run();
  const profile = await env.DB.prepare("SELECT member_id,active,display_name,role FROM profiles WHERE id=?").bind(row.id).first();
  if (!profile || Number(profile.active) !== 1) return null;
  return { ...row, member_id: row.member_id ?? profile.member_id ?? null, display_name: row.display_name || profile.display_name || row.username, role: profile.role || row.role };
}
async function auth(request, env, roles = []) {
  const user = await currentUser(request, env);
  if (!user) return { response: fail(401, "Session absente ou expirée. Reconnectez-vous.") };
  if (roles.length && !roles.includes(user.role)) return { response: fail(403, "Droits insuffisants.") };
  return { user };
}
async function audit(env, table, id, action, oldData, newData, actor) {
  await env.DB.prepare("INSERT INTO audit_logs(table_name,record_id,action,old_data,new_data,changed_by) VALUES(?,?,?,?,?,?)")
    .bind(table, String(id), action, oldData == null ? null : JSON.stringify(oldData), newData == null ? null : JSON.stringify(newData), actor || null).run();
}
async function sendRecoveryEmail(env, origin, email, token) {
  if (!env.RESEND_API_KEY || !env.LAS_MAIL_FROM) return false;
  const link = new URL("/v2/reset-password.html?token=" + encodeURIComponent(token), origin).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.LAS_MAIL_FROM, to: [email], subject: "Réinitialisation du mot de passe ASBL-LAS",
      text: "Vous avez demandé la réinitialisation du mot de passe ASBL-LAS. Ce lien est valable 30 minutes : " + link + "\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      html: "<p>Vous avez demandé la réinitialisation du mot de passe ASBL-LAS.</p><p><a href=\"" + link + "\">Choisir un nouveau mot de passe</a></p><p>Ce lien expire dans 30 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>"
    })
  });
  return response.ok;
}
async function createRecovery(env, user, origin) {
  const token = randomToken(32);
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)")
    .bind(crypto.randomUUID(), user.id, await sha256(token), expires).run();
  const sent = await sendRecoveryEmail(env, origin, user.email, token);
  if (!sent) {
    await env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(await sha256(token)).run();
    return false;
  }
  return true;
}
const safeMember = m => m ? ({id:m.id,name:m.name,phone:m.phone,email:m.email,profession:m.profession,birthdate:m.birthdate,birthplace:m.birthplace,address:m.address,joined_on:m.joined_on,position:m.position,forum_status:m.forum_status,asbl_status:m.asbl_status,meeting_status:m.meeting_status,status:m.status}) : null;

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";
  const method = request.method.toUpperCase();
  if (!env?.DB) return fail(503, "Base de données indisponible.");
  try {
    if (method === "GET" && path === "/api/public/posts") {
      const { results } = await env.DB.prepare("SELECT id,title,body,category,status,created_at FROM posts WHERE status='published' AND category IN('annonce','evenement') ORDER BY created_at DESC LIMIT 6").all();
      return json(results);
    }
    if (method === "GET" && path === "/api/public/media") {
      const { results } = await env.DB.prepare("SELECT id,media_type,title,description,external_url,published_date,status FROM media_items WHERE status='published' AND external_url IS NOT NULL AND external_url LIKE 'https://%' ORDER BY published_date DESC LIMIT 200").all();
      return json(results);
    }
    if (method === "POST" && path === "/api/auth/login") {
      if (!requireOrigin(request)) return fail(403, "Requête refusée.");
      const body = await bodyJson(request);
      const username = String(body?.username || "").trim().toLowerCase();
      const password = String(body?.password || "");
      if (!validUsername(username) || password.length < 1 || password.length > 1024) return fail(401, "Nom d’utilisateur ou mot de passe incorrect.");
      const row = await env.DB.prepare(`SELECT u.id,u.username,u.email,u.password_hash,u.role,u.member_id,u.active,u.display_name
        FROM auth_login_map a JOIN users u ON u.id=a.user_id WHERE a.username=? COLLATE NOCASE LIMIT 1`).bind(username).first();
      if (!row || Number(row.active) !== 1 || !(await verifyPassword(password, row.password_hash))) return fail(401, "Nom d’utilisateur ou mot de passe incorrect.");
      const token = randomToken(32), tokenHash = await sha256(token), now = Date.now();
      const expires = new Date(now + SESSION_SECONDS * 1000).toISOString();
      await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(), row.id, tokenHash, expires).run();
      await audit(env, "users", row.id, "LOGIN", null, {username:row.username}, row.id);
      return json({user:{id:row.id,username:row.username,email:row.email,role:row.role,member_id:row.member_id,display_name:row.display_name||row.username}},200,{"set-cookie":cookieHeader(token)});
    }
    if (method === "POST" && path === "/api/auth/logout") {
      if (!requireOrigin(request)) return fail(403, "Requête refusée.");
      const raw = cookieValue(request);
      if (raw) {
        const tokenHash = await sha256(raw);
        const session = await env.DB.prepare("SELECT user_id FROM sessions WHERE token_hash=?").bind(tokenHash).first();
        await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(tokenHash).run();
        if (session) await audit(env,"users",session.user_id,"LOGOUT",null,null,session.user_id);
      }
      return json({ok:true},200,{"set-cookie":cookieHeader("",0)});
    }
    if (method === "GET" && path === "/api/auth/me") {
      const result = await auth(request,env); if (result.response) return result.response;
      const u=result.user;
      return json({user:{id:u.id,username:u.username,email:u.email,role:u.role,member_id:u.member_id,display_name:u.display_name}});
    }
    if (method === "POST" && path === "/api/auth/change-password") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env);if(result.response)return result.response;
      const b=await bodyJson(request), current=String(b?.current_password||""), next=String(b?.new_password||"");
      if(next.length<12||next.length>1024)return fail(400,"Le nouveau mot de passe doit contenir au moins 12 caractères.");
      const row=await env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(result.user.id).first();
      if(!row||!(await verifyPassword(current,row.password_hash)))return fail(401,"Mot de passe actuel incorrect.");
      const hash=await hashPassword(next), now=new Date().toISOString();
      await env.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").bind(hash,now,result.user.id).run();
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=? AND id<>?").bind(result.user.id,result.user.session_id).run();
      await audit(env,"users",result.user.id,"PASSWORD_RESET",null,{password_changed:true},result.user.id);
      return json({ok:true,message:"Mot de passe modifié."});
    }
    if (method === "POST" && path === "/api/auth/recover") {
      if (!requireOrigin(request)) return fail(403, "Requête refusée.");
      if (!env.RESEND_API_KEY || !env.LAS_MAIL_FROM) return fail(503, "La récupération par e-mail n’est pas encore configurée. Contactez l’administrateur LAS.");
      const body=await bodyJson(request), username=String(body?.username||"").trim().toLowerCase();
      if (validUsername(username)) {
        const user=await env.DB.prepare("SELECT u.id,u.email,u.active FROM auth_login_map a JOIN users u ON u.id=a.user_id WHERE a.username=? COLLATE NOCASE LIMIT 1").bind(username).first();
        if (user && user.email && Number(user.active)===1) {
          const ok=await createRecovery(env,user,url.origin);
          if (!ok) return fail(503,"Le service d’e-mail est temporairement indisponible. Réessayez plus tard.");
        }
      }
      return json({ok:true,message:"Si le compte est actif, un lien de réinitialisation sera envoyé à l’adresse associée."});
    }
    if (method === "POST" && path === "/api/auth/reset") {
      if (!requireOrigin(request)) return fail(403,"Requête refusée.");
      const body=await bodyJson(request), token=String(body?.token||""), password=String(body?.password||"");
      if (token.length<20 || token.length>200 || password.length<12 || password.length>1024) return fail(400,"Lien invalide ou mot de passe trop court (12 caractères minimum).");
      const tokenHash=await sha256(token);
      const row=await env.DB.prepare("SELECT id,user_id FROM password_reset_tokens WHERE token_hash=? AND used_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now') LIMIT 1").bind(tokenHash).first();
      if (!row) return fail(400,"Le lien est invalide, déjà utilisé ou expiré. Demandez un nouveau lien.");
      const usedAt=new Date().toISOString(), hash=await hashPassword(password);
      const consumed=await env.DB.prepare("UPDATE password_reset_tokens SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')").bind(usedAt,row.id).run();
      if (!consumed.meta?.changes) return fail(400,"Le lien a déjà été utilisé ou a expiré.");
      await env.DB.prepare("UPDATE users SET password_hash=?,updated_at=? WHERE id=?").bind(hash,usedAt,row.user_id).run();
      await env.DB.prepare("UPDATE users SET active=1 WHERE id=?").bind(row.user_id).run();
      await env.DB.prepare("UPDATE profiles SET active=1 WHERE id=?").bind(row.user_id).run();
      await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id).run();
      await audit(env,"users",row.user_id,"PASSWORD_RESET",null,{password_reset:true},row.user_id);
      return json({ok:true,message:"Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe."});
    }
    if (method === "GET" && path === "/api/me") {
      const result=await auth(request,env); if(result.response)return result.response;
      const u=result.user;
      const member=u.member_id ? await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(u.member_id).first() : null;
      return json({user:{id:u.id,username:u.username,email:u.email,role:u.role,member_id:u.member_id,display_name:u.display_name},member:safeMember(member)});
    }
    if (path === "/api/me/contributions" && method === "GET") {
      const result=await auth(request,env); if(result.response)return result.response;
      const u=result.user, memberId=MANAGEMENT.includes(u.role)&&url.searchParams.has("member_id")?Number(url.searchParams.get("member_id")):u.member_id;
      if(!memberId)return json([]);
      const {results}=await env.DB.prepare("SELECT * FROM monthly_contributions WHERE member_id=? ORDER BY contribution_year DESC,contribution_month DESC LIMIT 100").bind(memberId).all();
      return json(results);
    }
    if (path === "/api/me/payments" && method === "GET") {
      const result=await auth(request,env); if(result.response)return result.response;
      const u=result.user, memberId=MANAGEMENT.includes(u.role)&&url.searchParams.has("member_id")?Number(url.searchParams.get("member_id")):u.member_id;
      if(!memberId)return json([]);
      const {results}=await env.DB.prepare("SELECT * FROM member_payments WHERE member_id=? ORDER BY payment_year DESC,payment_month DESC LIMIT 100").bind(memberId).all();
      return json(results);
    }
    if (path === "/api/me/tontine" && method === "GET") {
      const result=await auth(request,env); if(result.response)return result.response;
      if(!result.user.member_id)return json([]);
      const {results}=await env.DB.prepare(`SELECT e.id,e.amount,e.currency,e.status,e.paid_at,e.note,p.title,p.starts_on,p.ends_on,p.status AS period_status
        FROM tontine_entries e JOIN tontine_periods p ON p.id=e.period_id WHERE e.member_id=? ORDER BY e.created_at DESC LIMIT 100`).bind(result.user.member_id).all();
      return json(results);
    }
    if (path === "/api/me/aid" && method === "GET") {
      const result=await auth(request,env); if(result.response)return result.response;
      if(!result.user.member_id)return json([]);
      const {results}=await env.DB.prepare("SELECT id,subject,status,decision_note,created_at,updated_at FROM aid_requests WHERE member_id=? ORDER BY created_at DESC LIMIT 50").bind(result.user.member_id).all();
      return json(results);
    }
    if (path === "/api/me/aid" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env); if(result.response)return result.response;
      if(!result.user.member_id)return fail(400,"Votre compte doit être lié à une fiche membre.");
      const body=await bodyJson(request), subject=String(body?.subject||"").trim(), description=String(body?.description||"").trim();
      if(subject.length<3||subject.length>160||description.length<3||description.length>5000)return fail(400,"Objet ou description invalide.");
      const info=await env.DB.prepare("INSERT INTO aid_requests(member_id,subject,description) VALUES(?,?,?)").bind(result.user.member_id,subject,description).run();

      return json({id:info.meta.last_row_id,ok:true},201);
    }
    if (path === "/api/admin/members" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT id,name,phone,email,profession,joined_on,position,status FROM members ORDER BY name LIMIT 1000").all();return json(results);
    }
    if (path === "/api/admin/members" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), name=String(b?.name||"").trim();
      if(name.length<2||name.length>200)return fail(400,"Nom invalide.");
      const info=await env.DB.prepare("INSERT INTO members(name,phone,email,profession,birthdate,birthplace,address,joined_on,position,asbl_status,meeting_status,forum_status,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
       .bind(name,b.phone||null,b.email||null,b.profession||null,b.birthdate||null,b.birthplace||null,b.address||null,b.joined_on||null,b.position||null,b.asbl_status||"OUI",b.meeting_status||null,b.forum_status||null,b.status||"active").run();

      return json({id:info.meta.last_row_id},201);
    }
    if (path === "/api/admin/payments" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT p.*,m.name AS member_name FROM member_payments p JOIN members m ON m.id=p.member_id ORDER BY p.payment_year DESC,p.payment_month DESC LIMIT 1000").all();return json(results);
    }
    if (path === "/api/admin/contributions" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT c.*,m.name AS member_name FROM monthly_contributions c JOIN members m ON m.id=c.member_id ORDER BY c.contribution_year DESC,c.contribution_month DESC LIMIT 1000").all();return json(results);
    }
    if (path === "/api/admin/contributions" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,FINANCE);if(result.response)return result.response;
      const b=await bodyJson(request), memberId=Number(b?.member_id), year=Number(b?.contribution_year), month=Number(b?.contribution_month), value=Number(b?.amount), currency=String(b?.currency||"CDF");
      if(!Number.isInteger(memberId)||!intRange(year,2000,2200)||!intRange(month,1,12)||!amount(value)||!["CDF","USD"].includes(currency))return fail(400,"Données de cotisation invalides.");
      try {
        const info=await env.DB.prepare("INSERT INTO monthly_contributions(member_id,contribution_year,contribution_month,amount,currency,paid_at,note,recorded_by) VALUES(?,?,?,?,?,?,?,?)").bind(memberId,year,month,value,currency,b.paid_at||new Date().toISOString(),String(b.note||"").slice(0,1000)||null,result.user.id).run();

        return json({id:info.meta.last_row_id},201);
      } catch { return fail(409,"Cette cotisation existe déjà ou le membre est introuvable."); }
    }
    if (path === "/api/admin/aid" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT a.*,m.name AS member_name FROM aid_requests a JOIN members m ON m.id=a.member_id ORDER BY a.created_at DESC LIMIT 300").all();return json(results);
    }
    if (path === "/api/admin/payments" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,FINANCE);if(result.response)return result.response;
      const b=await bodyJson(request), memberId=Number(b?.member_id), year=Number(b?.payment_year), month=Number(b?.payment_month), paid=b?.paid===true||b?.paid===1||b?.paid==="1";
      if(!Number.isInteger(memberId)||!intRange(year,2000,2200)||!intRange(month,1,12))return fail(400,"Données de paiement invalides.");
      const member=await env.DB.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first();if(!member)return fail(404,"Membre introuvable.");
      const id=crypto.randomUUID(), now=new Date().toISOString();
      await env.DB.prepare("INSERT INTO member_payments(id,member_id,payment_year,payment_month,paid,updated_by,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(member_id,payment_year,payment_month) DO UPDATE SET paid=excluded.paid,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(id,memberId,year,month,paid?1:0,result.user.id,now).run();
      return json({ok:true});
    }
    const memberMatch=path.match(/^\/api\/admin\/members\/(\d+)$/);
    if(memberMatch&&method==="PATCH"){
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), old=await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(Number(memberMatch[1])).first();if(!old)return fail(404,"Membre introuvable.");
      const fields=["name","phone","email","profession","birthdate","birthplace","address","joined_on","position","forum_status","asbl_status","meeting_status","note","photo_path","birthday_visible","status"];
      const next={...old};for(const key of fields)if(Object.prototype.hasOwnProperty.call(b||{},key))next[key]=b[key];
      if(String(next.name||"").trim().length<2||String(next.name||"").length>200||!["active","inactive","suspended"].includes(next.status)||!["OUI","NON"].includes(next.asbl_status))return fail(400,"Données membre invalides.");
      if(next.birthday_visible!==0&&next.birthday_visible!==1&&next.birthday_visible!==true&&next.birthday_visible!==false)return fail(400,"Visibilité de l'anniversaire invalide.");
      const now=new Date().toISOString();
      await env.DB.prepare("UPDATE members SET name=?,phone=?,email=?,profession=?,birthdate=?,birthplace=?,address=?,joined_on=?,position=?,forum_status=?,asbl_status=?,meeting_status=?,note=?,photo_path=?,birthday_visible=?,status=?,updated_at=? WHERE id=?").bind(String(next.name).trim(),next.phone||null,next.email||null,next.profession||null,next.birthdate||null,next.birthplace||null,next.address||null,next.joined_on||null,next.position||null,next.forum_status||null,next.asbl_status,next.meeting_status||null,next.note||null,next.photo_path||null,(next.birthday_visible===true||next.birthday_visible===1)?1:0,next.status,now,old.id).run();
      return json({ok:true});
    }
    const aidMatch=path.match(/^\/api\/admin\/aid\/(\d+)$/);
    if(aidMatch&&method==="PATCH"){
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const b=await bodyJson(request), status=String(b?.status||"");
      if(!["pending","approved","rejected","closed","submitted","under_review","declined"].includes(status))return fail(400,"Statut invalide.");
      const old=await env.DB.prepare("SELECT * FROM aid_requests WHERE id=?").bind(Number(aidMatch[1])).first();if(!old)return fail(404,"Demande introuvable.");
      const now=new Date().toISOString();
      await env.DB.prepare("UPDATE aid_requests SET status=?,decision_note=?,decided_by=?,decided_at=?,updated_at=? WHERE id=?").bind(status,String(b?.decision_note||"").slice(0,2000)||null,result.user.id,now,now,old.id).run();
      return json({ok:true});
    }
    if (path === "/api/admin/tontine/periods" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT * FROM tontine_periods ORDER BY starts_on DESC LIMIT 300").all();return json(results);
    }
    if (path === "/api/admin/tontine/periods" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,FINANCE);if(result.response)return result.response;
      const b=await bodyJson(request), title=String(b?.title||"").trim(), start=String(b?.starts_on||""), end=String(b?.ends_on||""), value=Number(b?.contribution_amount), currency=String(b?.currency||"CDF"), status=String(b?.status||"planned");
      if(title.length<2||title.length>160||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||!amount(value)||!["CDF","USD"].includes(currency)||!["planned","open","closed","cancelled"].includes(status))return fail(400,"Données de période invalides.");
      const info=await env.DB.prepare("INSERT INTO tontine_periods(title,starts_on,ends_on,contribution_amount,currency,status,created_by) VALUES(?,?,?,?,?,?,?)").bind(title,start,end,value,currency,status,result.user.id).run();
      return json({id:info.meta.last_row_id},201);
    }
    if (path === "/api/admin/tontine/entries" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT e.*,m.name AS member_name,p.title AS period_title FROM tontine_entries e JOIN members m ON m.id=e.member_id JOIN tontine_periods p ON p.id=e.period_id ORDER BY e.created_at DESC LIMIT 500").all();return json(results);
    }
    if (path === "/api/admin/tontine/entries" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,FINANCE);if(result.response)return result.response;
      const b=await bodyJson(request), periodId=Number(b?.period_id), memberId=Number(b?.member_id), value=Number(b?.amount), currency=String(b?.currency||"CDF"), status=String(b?.status||"due");
      if(!Number.isInteger(periodId)||!Number.isInteger(memberId)||!amount(value)||!["CDF","USD"].includes(currency)||!["due","paid","late","cancelled","waived"].includes(status))return fail(400,"Données de participation invalides.");
      try {const info=await env.DB.prepare("INSERT INTO tontine_entries(period_id,member_id,amount,currency,status,recorded_by) VALUES(?,?,?,?,?,?)").bind(periodId,memberId,value,currency,status,result.user.id).run();return json({id:info.meta.last_row_id},201);}
      catch{return fail(409,"Période ou membre introuvable, ou membre déjà inscrit.");}
    }
    if (path === "/api/admin/posts" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT p.*,u.username AS author_username FROM posts p LEFT JOIN users u ON u.id=p.author_id ORDER BY p.created_at DESC LIMIT 500").all();return json(results);
    }
    if (path === "/api/admin/posts" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), title=String(b?.title||"").trim(), content=String(b?.body||"").trim(), category=String(b?.category||"general"), status=String(b?.status||"draft");
      if(title.length<1||title.length>180||content.length<1||content.length>10000||!["general","annonce","entraide","evenement"].includes(category)||!["draft","published","hidden","archived"].includes(status))return fail(400,"Titre, contenu, catégorie ou statut invalide.");
      const id=crypto.randomUUID(), now=new Date().toISOString();
      await env.DB.prepare("INSERT INTO posts(id,author_id,title,body,category,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,result.user.id,title,content,category,status,now,now).run();
      return json({id},201);
    }
    const postMatch=path.match(/^\/api\/admin\/posts\/([0-9a-f-]{36})$/i);
    if(postMatch&&method==="PATCH"){
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), old=await env.DB.prepare("SELECT * FROM posts WHERE id=?").bind(postMatch[1]).first();if(!old)return fail(404,"Publication introuvable.");
      const title=String(b?.title??old.title).trim(), content=String(b?.body??old.body).trim(), category=String(b?.category??old.category), status=String(b?.status??old.status);
      if(title.length<1||title.length>180||content.length<1||content.length>10000||!["general","annonce","entraide","evenement"].includes(category)||!["draft","published","hidden","archived"].includes(status))return fail(400,"Titre, contenu, catégorie ou statut invalide.");
      await env.DB.prepare("UPDATE posts SET title=?,body=?,category=?,status=?,updated_at=? WHERE id=?").bind(title,content,category,status,new Date().toISOString(),old.id).run();
      return json({ok:true});
    }
    if (path === "/api/admin/media" && method === "GET") {
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT id,media_type,title,description,external_url,published_date,created_at,author_id,status FROM media_items ORDER BY published_date DESC LIMIT 500").all();return json(results);
    }
    if (path === "/api/admin/media" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), type=String(b?.media_type||""), title=String(b?.title||"").trim(), description=String(b?.description||"").trim(), external=String(b?.external_url||"").trim(), status=String(b?.status||"draft");
      if(!["photo","pdf","video","article","link"].includes(type)||title.length<1||title.length>180||description.length>5000||!["draft","published","hidden","archived"].includes(status))return fail(400,"Type, titre, description ou statut invalide.");
      if(external){try{if(new URL(external).protocol!=="https:")return fail(400,"Le lien média doit utiliser HTTPS.");}catch{return fail(400,"URL média invalide.");}}
      const now=new Date().toISOString(), published=String(b?.published_date||now.slice(0,10));
      const info=await env.DB.prepare("INSERT INTO media_items(media_type,title,description,external_url,storage_path,published_date,created_by,author_id,status) VALUES(?,?,?,?,?,?,?,?,?)").bind(type,title,description||null,external||null,null,published,result.user.id,result.user.id,status).run();

      return json({id:info.meta.last_row_id},201);
    }
    const mediaMatch=path.match(/^\/api\/admin\/media\/(\d+)$/);
    if(mediaMatch&&method==="PATCH"){
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), old=await env.DB.prepare("SELECT * FROM media_items WHERE id=?").bind(Number(mediaMatch[1])).first();if(!old)return fail(404,"Média introuvable.");
      const status=String(b?.status??old.status), title=String(b?.title??old.title).trim(), description=String(b?.description??old.description??"").trim(), external=String(b?.external_url??old.external_url??"").trim();
      if(!["draft","published","hidden","archived"].includes(status)||title.length<1||title.length>180||description.length>5000)return fail(400,"Données média invalides.");
      if(external){try{if(new URL(external).protocol!=="https:")return fail(400,"Le lien média doit utiliser HTTPS.");}catch{return fail(400,"URL média invalide.");}}
      await env.DB.prepare("UPDATE media_items SET status=?,title=?,description=?,external_url=? WHERE id=?").bind(status,title,description||null,external||null,old.id).run();
      return json({ok:true});
    }
    const commentsForPost=path.match(/^\/api\/posts\/([0-9a-f-]{36})\/comments$/i);
    if(commentsForPost&&method==="GET"){
      const {results}=await env.DB.prepare("SELECT c.id,c.post_id,c.body,c.created_at,u.display_name,u.username FROM post_comments c LEFT JOIN users u ON u.id=c.author_id WHERE c.post_id=? AND c.status='published' ORDER BY c.created_at ASC LIMIT 200").bind(commentsForPost[1]).all();return json(results);
    }
    if(commentsForPost&&method==="POST"){
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env);if(result.response)return result.response;
      const b=await bodyJson(request), content=String(b?.body||"").trim();
      if(content.length<1||content.length>3000)return fail(400,"Le commentaire doit contenir entre 1 et 3000 caractères.");
      const post=await env.DB.prepare("SELECT id FROM posts WHERE id=? AND status='published'").bind(commentsForPost[1]).first();if(!post)return fail(404,"Publication introuvable.");
      const id=crypto.randomUUID(), now=new Date().toISOString();
      await env.DB.prepare("INSERT INTO post_comments(id,post_id,author_id,body,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(id,post.id,result.user.id,content,"pending",now,now).run();
      return json({id,status:"pending",message:"Commentaire envoyé pour modération."},201);
    }
    if(path==="/api/admin/comments"&&method==="GET"){
      const result=await auth(request,env,MANAGEMENT);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT c.*,p.title AS post_title,u.username AS author_username FROM post_comments c LEFT JOIN posts p ON p.id=c.post_id LEFT JOIN users u ON u.id=c.author_id ORDER BY c.created_at DESC LIMIT 500").all();return json(results);
    }
    const commentMatch=path.match(/^\/api\/admin\/comments\/([0-9a-f-]{36})$/i);
    if(commentMatch&&method==="PATCH"){
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin","secretaire"]);if(result.response)return result.response;
      const b=await bodyJson(request), status=String(b?.status||"");
      if(!["pending","published","hidden"].includes(status))return fail(400,"Statut de commentaire invalide.");
      const old=await env.DB.prepare("SELECT * FROM post_comments WHERE id=?").bind(commentMatch[1]).first();if(!old)return fail(404,"Commentaire introuvable.");
      const now=new Date().toISOString();await env.DB.prepare("UPDATE post_comments SET status=?,updated_at=? WHERE id=?").bind(status,now,old.id).run();
      return json({ok:true});
    }
    if (path === "/api/admin/audit" && method === "GET") {
      const result=await auth(request,env,["admin"]);if(result.response)return result.response;
      const {results}=await env.DB.prepare("SELECT id,table_name,record_id,action,old_data,new_data,changed_by,changed_at FROM audit_logs ORDER BY changed_at DESC LIMIT 500").all();return json(results);
    }
    if (path === "/api/admin/users" && method === "POST") {
      if(!requireOrigin(request))return fail(403,"Requête refusée.");
      const result=await auth(request,env,["admin"]);if(result.response)return result.response;
      const b=await bodyJson(request), username=String(b?.username||"").trim().toLowerCase(), email=String(b?.email||"").trim().toLowerCase(), role=String(b?.role||"membre"), memberId=b?.member_id?Number(b.member_id):null;
      if(!validUsername(username)||!/^\S+@\S+\.\S+$/.test(email)||!["admin","secretaire","tresorier","membre"].includes(role))return fail(400,"Nom d’utilisateur, e-mail ou rôle invalide.");
      if(memberId!==null&&!Number.isInteger(memberId))return fail(400,"Fiche membre invalide.");
      const id=crypto.randomUUID(), now=new Date().toISOString(), display=String(b?.display_name||username).trim().slice(0,180);
      try {
        await env.DB.batch([
          env.DB.prepare("INSERT INTO users(id,username,email,role,member_id,active,display_name,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?)").bind(id,username,email,role,memberId,display,now,now),
          env.DB.prepare("INSERT INTO profiles(id,full_name,role,created_at,display_name,member_id,active) VALUES(?,?,?,?,?,?,1)").bind(id,display,role,now,display,memberId),
          env.DB.prepare("INSERT INTO auth_login_map(user_id,username,login_email,created_at,updated_at) VALUES(?,?,?,?,?)").bind(id,username,email,now,now)
        ]);
      } catch { return fail(409,"Un compte avec ce nom d’utilisateur ou cet e-mail existe déjà, ou la fiche membre est invalide."); }
      await audit(env,"users",id,"INSERT",null,{username,email,role,member_id:memberId},result.user.id);
      const recoverySent=await createRecovery(env,{id,email,active:1},url.origin).catch(()=>false);
      return json({ok:true,id,recovery_email_sent:recoverySent,message:recoverySent?"Compte créé. Un e-mail de création du mot de passe a été envoyé.":"Compte créé, mais l’e-mail de création du mot de passe n’a pas pu être envoyé. Vérifiez la configuration e-mail."},201);
    }
    return fail(404,"API inconnue.");
  } catch (error) {
    console.error("ASBL-LAS API error", path, error?.message || "internal");
    return fail(500,"Erreur interne. Réessayez plus tard.");
  }
}
