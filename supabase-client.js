/* Load browser-safe Supabase configuration from the deployment endpoint. */
window.LAS_SUPABASE_READY = (async function () {
  const isValidConfig = (value) => !!(
    value &&
    typeof value.url === "string" &&
    typeof value.publishableKey === "string" &&
    value.url.startsWith("https://") &&
    value.url.includes(".supabase.co") &&
    value.publishableKey.length > 20 &&
    !value.url.includes("VOTRE-PROJET") &&
    !value.publishableKey.includes("REMPLACER") &&
    !value.publishableKey.startsWith("sb_secret_")
  );

  let config = null;
  let endpointError = "Le point de configuration /api/supabase-config est inaccessible.";

  try {
    const response = await fetch("/api/supabase-config", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    });
    const payload = await response.json().catch(() => ({}));

    if (response.ok && isValidConfig(payload)) {
      config = { url: payload.url, publishableKey: payload.publishableKey };
    } else {
      const missing = Array.isArray(payload.missing) ? payload.missing.join(", ") : "";
      endpointError = missing
        ? "Variables Preview manquantes sur Vercel : " + missing + ". Activez-les pour la branche déployée puis redéployez."
        : (payload.error || ("Le point de configuration a répondu HTTP " + response.status + "."));
    }
  } catch (_) {
    endpointError = "Impossible de joindre /api/supabase-config. Vérifiez le déploiement Vercel et les journaux de fonction.";
  }

  // Permit a valid, intentionally configured public static config as a fallback,
  // but never accept the placeholder values committed in the repository.
  if (!config && isValidConfig(window.LAS_SUPABASE_CONFIG)) {
    config = {
      url: window.LAS_SUPABASE_CONFIG.url,
      publishableKey: window.LAS_SUPABASE_CONFIG.publishableKey
    };
  }

  if (!config) throw new Error(endpointError);

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("La bibliothèque Supabase JS n’a pas été chargée. Vérifiez le chargement du CDN.");
  }

  window.LAS_SUPABASE_CONFIG = config;
  window.lasSupabase = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return true;
})();
