/* Public runtime config loader. The endpoint returns only the browser-safe publishable key. */
window.LAS_SUPABASE_READY = (async function () {
  let config = window.LAS_SUPABASE_CONFIG || null;
  try {
    const response = await fetch("/api/supabase-config", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const remote = await response.json();
      if (remote.url && remote.publishableKey) config = remote;
    }
  } catch (_) {}
  if (!config || !config.url || !config.publishableKey ||
      config.url.includes("VOTRE-PROJET") || config.publishableKey.includes("REMPLACER")) {
    throw new Error("Configuration Supabase absente. Configurez SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY dans l'environnement Vercel.");
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
