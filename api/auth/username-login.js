// Connexion LAS par prénom. La résolution du prénom reste côté serveur.
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(body);
}
function sameOrigin(req) {
  const base = process.env.APP_BASE_URL;
  if (!base) return false;
  try {
    return !!req.headers.origin && new URL(req.headers.origin).origin === new URL(base).origin;
  } catch (_) { return false; }
}
function normalizeName(value) {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function firstName(displayName) {
  return normalizeName(String(displayName || "").trim().split(/\s+/)[0] || "");
}
async function getUniqueActiveProfile(url, headers, firstNameInput) {
  const response = await fetch(url + "/rest/v1/profiles?select=id,display_name,active&active=eq.true&limit=1000", {
    headers: { ...headers, Accept: "application/json" }
  });
  if (!response.ok) throw new Error("profile_lookup_failed");
  const profiles = await response.json();
  if (!Array.isArray(profiles)) throw new Error("profile_lookup_failed");
  const matches = profiles.filter(profile => firstName(profile.display_name) === firstNameInput);
  // Les prénoms ne sont pas nécessairement uniques : ne jamais choisir arbitrairement.
  return matches.length === 1 ? matches[0] : null;
}
async function getLoginEmail(url, headers, userId) {
  const response = await fetch(url + "/rest/v1/auth_login_map?user_id=eq." + encodeURIComponent(userId) + "&select=user_id,login_email&limit=1", {
    headers: { ...headers, Accept: "application/json" }
  });
  if (!response.ok) throw new Error("login_map_lookup_failed");
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { message: "Méthode non autorisée." });
  if (!sameOrigin(req)) return json(res, 403, { message: "Requête refusée." });
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secretKey) return json(res, 503, { message: "Service de connexion non configuré." });
  const first = normalizeName(req.body?.username);
  const password = String(req.body?.password || "");
  if (!/^[a-z][a-z'-]{1,79}$/.test(first) || password.length < 1 || password.length > 1024) {
    return json(res, 401, { message: "Prénom ou mot de passe incorrect." });
  }
  try {
    const headers = { apikey: secretKey, Authorization: "Bearer " + secretKey };
    const profile = await getUniqueActiveProfile(url, headers, first);
    if (!profile) return json(res, 401, { message: "Prénom ou mot de passe incorrect. Si plusieurs membres partagent ce prénom, contactez l’administrateur." });
    const mappedUser = await getLoginEmail(url, headers, profile.id);
    if (!mappedUser?.login_email) return json(res, 401, { message: "Prénom ou mot de passe incorrect." });
    const authResponse = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: mappedUser.login_email, password })
    });
    const authData = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok || !authData.access_token || !authData.refresh_token) {
      return json(res, 401, { message: "Prénom ou mot de passe incorrect." });
    }
    return json(res, 200, { access_token: authData.access_token, refresh_token: authData.refresh_token });
  } catch (_) {
    return json(res, 503, { message: "Service de connexion temporairement indisponible." });
  }
}
