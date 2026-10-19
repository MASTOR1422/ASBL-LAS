// ASBL LAS — vérification serveur de la session et du profil.
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Vary", "Origin");
  return res.status(status).json(body);
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Non-browser clients still need a valid bearer token.
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0].trim().toLowerCase();
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.hostname === "localhost") &&
      parsed.host.toLowerCase() === host;
  } catch (_) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { reason: "method-not-allowed", message: "Méthode non autorisée." });
  }
  if (!isSameOrigin(req)) {
    return json(res, 403, { reason: "origin-rejected", message: "Requête refusée." });
  }

  const isPreview = process.env.VERCEL_ENV === "preview";
  const url = String((isPreview ? process.env.SUPABASE_PREVIEW_URL : (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) || "").trim();
  const publicKey = String((isPreview ? process.env.SUPABASE_PREVIEW_PUBLISHABLE_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) || "").trim();
  const serviceKey = String((isPreview ? process.env.SUPABASE_PREVIEW_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY) || "").trim();
  const authHeader = String(req.headers.authorization || "");
  const accessToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!url || !publicKey || !serviceKey) {
    return json(res, 503, { reason: "not-configured", message: "Le service de vérification n’est pas configuré." });
  }
  if (!accessToken || accessToken.length > 8192) {
    return json(res, 401, { reason: "not-authenticated", message: "Session absente ou expirée. Reconnectez-vous." });
  }

  try {
    // Ask Supabase Auth to validate the bearer token; never trust a decoded JWT alone.
    const userResponse = await fetch(url + "/auth/v1/user", {
      method: "GET",
      headers: { apikey: publicKey, Authorization: "Bearer " + accessToken, Accept: "application/json" }
    });
    const user = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !user.id) {
      return json(res, 401, { reason: "not-authenticated", message: "Session absente ou expirée. Reconnectez-vous." });
    }

    // Read the profile server-side so dashboard access does not depend on a browser RLS policy.
    const profileResponse = await fetch(
      url + "/rest/v1/profiles?id=eq." + encodeURIComponent(user.id) +
        "&select=role,member_id,display_name,active&limit=1",
      {
        method: "GET",
        headers: {
          apikey: serviceKey,
          Authorization: "Bearer " + serviceKey,
          Accept: "application/json"
        }
      }
    );
    if (!profileResponse.ok) {
      return json(res, 503, { reason: "profile-check-failed", message: "Le profil LAS ne peut pas être vérifié actuellement." });
    }
    const profiles = await profileResponse.json().catch(() => []);
    const profile = Array.isArray(profiles) && profiles.length === 1 ? profiles[0] : null;
    if (!profile || profile.active !== true) {
      return json(res, 403, { reason: "profile-unavailable", message: "Compte inactif ou profil d’accès absent. Contactez l’administrateur LAS." });
    }
    if (!["admin", "tresorier", "secretaire", "membre"].includes(profile.role)) {
      return json(res, 403, { reason: "invalid-role", message: "Rôle non autorisé. Contactez l’administrateur LAS." });
    }

    return json(res, 200, {
      profile: {
        role: profile.role,
        member_id: profile.member_id || null,
        display_name: profile.display_name || user.email || "Membre LAS",
        active: true
      },
      user: { id: user.id, email: user.email || "" }
    });
  } catch (_) {
    return json(res, 503, { reason: "profile-check-failed", message: "La vérification du compte a échoué. Réessayez." });
  }
}
