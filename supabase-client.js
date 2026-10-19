/* Le serveur choisit les variables adaptées à l'environnement; pas de repli vers une clé intégrée au dépôt. */
window.LAS_SUPABASE_READY = (async function () {
  let config = null;
  let response;
  try {
    response = await fetch("/api/supabase-config", { cache: "no-store", credentials: "same-origin" });
  } catch (_) {
    throw new Error("Le service de configuration Supabase est indisponible.");
  }
  if (!response.ok) {
    throw new Error("Configuration Supabase absente pour cet environnement. Configurez les variables Preview dédiées.");
  }
  const remote = await response.json().catch(() => ({}));
  if (remote.url && remote.publishableKey) config = remote;
  if (!config || !config.url || !config.publishableKey) {
    throw new Error("Configuration Supabase invalide. Vérifiez les variables d'environnement Vercel.");
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("La bibliothèque Supabase JS n'a pas été chargée.");
  }
  window.LAS_SUPABASE_CONFIG = config;
  window.lasSupabase = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return true;
})();
