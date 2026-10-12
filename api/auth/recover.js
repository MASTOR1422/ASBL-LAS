// Récupération du mot de passe à partir du prénom ; aucune information sur l'existence du compte n'est révélée.
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).json(body);
}
function sameOrigin(req) {
  const base = process.env.APP_BASE_URL;
  if (!base) return false;
  try { return !!req.headers.origin && new URL(req.headers.origin).origin === new URL(base).origin; }
  catch (_) { return false; }
}
function normalizeName(value) {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function firstName(displayName) {
  return normalizeName(String(displayName || "").trim().split(/\s+/)[0] || "");
}
export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { message: "Méthode non autorisée." });
  if (!sameOrigin(req)) return json(res, 403, { message: "Requête refusée." });
  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.APP_BASE_URL;
  if (!url || !publicKey || !secretKey || !base) return json(res, 503, { message: "Service de récupération non configuré." });
  const first = normalizeName(req.body?.username);
  if (!/^[a-z][a-z'-]{1,79}$/.test(first)) return json(res, 200, { ok: true });
  try {
    const headers = { apikey: secretKey, Authorization: "Bearer " + secretKey, Accept: "application/json" };
    const profileResponse = await fetch(url + "/rest/v1/profiles?select=id,display_name,active&active=eq.true&limit=1000", { headers });
    if (!profileResponse.ok) return json(res, 503, { message: "Service de récupération temporairement indisponible." });
    const profiles = await profileResponse.json();
    if (!Array.isArray(profiles)) return json(res, 503, { message: "Service de récupération temporairement indisponible." });
    const matches = profiles.filter(profile => firstName(profile.display_name) === first);
    // Un prénom partagé par plusieurs comptes ne permet pas d'identifier sûrement le destinataire.
    if (matches.length !== 1) return json(res, 200, { ok: true });
    const mapResponse = await fetch(url + "/rest/v1/auth_login_map?user_id=eq." + encodeURIComponent(matches[0].id) + "&select=login_email&limit=1", { headers });
    if (!mapResponse.ok) return json(res, 503, { message: "Service de récupération temporairement indisponible." });
    const rows = await mapResponse.json();
    if (!Array.isArray(rows) || !rows[0]?.login_email) return json(res, 200, { ok: true });
    const redirect = new URL("/reset-password.html", base).toString();
    await fetch(url + "/auth/v1/recover?redirect_to=" + encodeURIComponent(redirect), {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: rows[0].login_email })
    });
    return json(res, 200, { ok: true });
  } catch (_) {
    return json(res, 503, { message: "Service de récupération temporairement indisponible." });
  }
}
