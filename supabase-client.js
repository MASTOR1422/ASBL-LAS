(function () {
  const config = window.LAS_SUPABASE_CONFIG;
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("La bibliothèque Supabase JS n'a pas été chargée.");
  }
  if (!config || !config.url || !config.publishableKey ||
      config.url.includes("VOTRE-PROJET") ||
      config.publishableKey.includes("REMPLACER")) {
    throw new Error("Configurez supabase-config.js avec les paramètres du projet LAS.");
  }
  window.lasSupabase = window.supabase.createClient(
    config.url,
    config.publishableKey
  );
})();
