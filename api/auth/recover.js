// ASBL LAS — récupération du mot de passe par nom d’utilisateur.
// La réponse ne révèle jamais si un compte existe.
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.hostname === "localhost") && parsed.host.toLowerCase() === host;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { message: "Méthode non autorisée." });
  if (!sameOrigin(req)) return json(res, 403, { message: "Requête refusée." });

  const url = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secretKey) {
    return json(res, 503, { message: "Service de récupération non configuré." });
  }

  const username = String(req.body?.username || "").trim().toLowerCase();
  // Même réponse neutre pour un identifiant invalide ou inexistant.
  if (!/^[a-z0-9._-]{3,80}$/.test(username)) return json(res, 200, { ok: true });

  try {
    const headers = {
      apikey: secretKey,
      Authorization: "Bearer " + secretKey,
      Accept: "application/json"
    };

    const mapResponse = await fetch(
      url + "/rest/v1/auth_login_map?username=eq." + encodeURIComponent(username) +
        "&select=user_id,login_email&limit=1",
      { headers }
    );
    if (!mapResponse.ok) {
      return json(res, 503, { message: "Service de récupération temporairement indisponible." });
    }

    const mappings = await mapResponse.json();
    const mapping = Array.isArray(mappings) ? mappings[0] : null;
    if (!mapping?.user_id || !mapping?.login_email) return json(res, 200, { ok: true });

    const profileResponse = await fetch(
      url + "/rest/v1/profiles?id=eq." + encodeURIComponent(mapping.user_id) +
        "&select=active&limit=1",
      { headers }
    );
    if (!profileResponse.ok) {
      return json(res, 503, { message: "Service de récupération temporairement indisponible." });
    }
    const profiles = await profileResponse.json();
    if (!Array.isArray(profiles) || profiles.length !== 1 || profiles[0].active !== true) {
      return json(res, 200, { ok: true });
    }

    const redirect = new URL("/reset-password.html", req.headers.origin).toString();
    const recoveryResponse = await fetch(
      url + "/auth/v1/recover?redirect_to=" + encodeURIComponent(redirect),
      {
        method: "POST",
        headers: { apikey: publicKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: mapping.login_email })
      }
    );

    // Ne pas divulguer si le compte existe ni les détails internes de Supabase.
    // Une réponse non-OK est traitée comme indisponibilité technique, sans révéler le compte.
    if (!recoveryResponse.ok) {
      return json(res, 200, { ok: true });
    }
    return json(res, 200, { ok: true });
  } catch (_) {
    return json(res, 503, { message: "Service de récupération temporairement indisponible." });
  }
}
