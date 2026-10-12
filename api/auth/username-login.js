// ASBL LAS — connexion par nom d’utilisateur et mot de passe.
// La résolution de l’identifiant et la vérification du compte restent côté serveur.
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

function sameOrigin(req) {
  const base = process.env.APP_BASE_URL;
  if (!base) return false;
  try {
    return !!req.headers.origin && new URL(req.headers.origin).origin === new URL(base).origin;
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
    return json(res, 503, { message: "Service de connexion non configuré." });
  }

  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!/^[a-z0-9._-]{3,80}$/.test(username) || password.length < 1 || password.length > 1024) {
    return json(res, 401, { message: "Nom d’utilisateur ou mot de passe incorrect." });
  }

  try {
    const headers = {
      apikey: secretKey,
      Authorization: "Bearer " + secretKey,
      Accept: "application/json"
    };

    // Le nom d’utilisateur est recherché dans la table de correspondance,
    // et non dans profiles.display_name (qui peut contenir un prénom ou un nom complet).
    const mapResponse = await fetch(
      url + "/rest/v1/auth_login_map?username=eq." + encodeURIComponent(username) +
        "&select=user_id,login_email&limit=1",
      { headers }
    );
    if (!mapResponse.ok) {
      return json(res, 503, { message: "Service de connexion temporairement indisponible." });
    }

    const mappings = await mapResponse.json();
    const mapping = Array.isArray(mappings) ? mappings[0] : null;
    if (!mapping?.user_id || !mapping?.login_email) {
      return json(res, 401, { message: "Nom d’utilisateur ou mot de passe incorrect." });
    }

    // Les comptes désactivés ne doivent pas pouvoir obtenir une session.
    const profileResponse = await fetch(
      url + "/rest/v1/profiles?id=eq." + encodeURIComponent(mapping.user_id) +
        "&select=active&limit=1",
      { headers }
    );
    if (!profileResponse.ok) {
      return json(res, 503, { message: "Service de connexion temporairement indisponible." });
    }
    const profiles = await profileResponse.json();
    if (!Array.isArray(profiles) || profiles.length !== 1 || profiles[0].active !== true) {
      return json(res, 401, { message: "Nom d’utilisateur ou mot de passe incorrect." });
    }

    // Supabase Auth vérifie le mot de passe et émet les jetons de session.
    const authResponse = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: publicKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: mapping.login_email, password })
    });
    const authData = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok || !authData.access_token || !authData.refresh_token) {
      return json(res, 401, { message: "Nom d’utilisateur ou mot de passe incorrect." });
    }

    return json(res, 200, {
      access_token: authData.access_token,
      refresh_token: authData.refresh_token
    });
  } catch (_) {
    return json(res, 503, { message: "Service de connexion temporairement indisponible." });
  }
}
