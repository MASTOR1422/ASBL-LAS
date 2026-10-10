// Username login proxy. Requires server-only SUPABASE_SERVICE_ROLE_KEY.
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(body);
}
function sameOrigin(req) {
  // Allow only explicitly configured site/deployment origins. Vercel preview URLs
  // differ from APP_BASE_URL, so include Vercel's exact deployment aliases when present.
  const configured = [
    process.env.APP_BASE_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ].filter(Boolean);
  const allowedOrigins = new Set();
  for (const value of configured) {
    try {
      const normalized = /^https?:\/\//i.test(value) ? value : "https://" + value;
      allowedOrigins.add(new URL(normalized).origin);
    } catch (_) {}
  }
  try {
    return !!req.headers.origin && allowedOrigins.has(new URL(req.headers.origin).origin);
  } catch (_) { return false; }
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { message: "Méthode non autorisée." });
  if (!sameOrigin(req)) return json(res, 403, { message: "Requête refusée." });
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secretKey) return json(res, 503, { message: "Service de connexion non configuré." });
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || password.length < 1 || password.length > 1024) {
    return json(res, 400, { message: "Identifiant ou mot de passe incorrect." });
  }
  try {
    const headers = { apikey: secretKey, Authorization: "Bearer " + secretKey };
    const mapResponse = await fetch(url + "/rest/v1/auth_login_map?username=eq." + encodeURIComponent(username) + "&select=user_id,login_email&limit=1", { headers: { ...headers, Accept: "application/json" } });
    if (!mapResponse.ok) return json(res, 503, { message: "Service de connexion temporairement indisponible." });
    const rows = await mapResponse.json();
    if (!Array.isArray(rows) || !rows[0]?.login_email || !rows[0]?.user_id) return json(res, 401, { message: "Identifiant ou mot de passe incorrect." });
    const profileResponse = await fetch(url + "/rest/v1/profiles?id=eq." + encodeURIComponent(rows[0].user_id) + "&select=active&limit=1", { headers: { ...headers, Accept: "application/json" } });
    if (!profileResponse.ok) return json(res, 503, { message: "Service de connexion temporairement indisponible." });
    const profiles = await profileResponse.json();
    if (!profiles?.[0] || profiles[0].active !== true) return json(res, 401, { message: "Identifiant ou mot de passe incorrect." });
    const authResponse = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: rows[0].login_email, password })
    });
    const authData = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok || !authData.access_token || !authData.refresh_token) {
      return json(res, 401, { message: "Identifiant ou mot de passe incorrect." });
    }
    return json(res, 200, {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token
    });
  } catch (_) {
    return json(res, 503, { message: "Service de connexion temporairement indisponible." });
  }
}
