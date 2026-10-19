/* Public runtime configuration for the browser client.
 * Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel Project Settings.
 * A publishable/anon key is designed for browser use; never expose service_role.
 */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const isPreview = process.env.VERCEL_ENV === "preview";
  const url = (isPreview ? process.env.SUPABASE_PREVIEW_URL : (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) || "";
  const publishableKey = (isPreview ? process.env.SUPABASE_PREVIEW_PUBLISHABLE_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) || "";
  if (!url || !publishableKey) {
    res.status(503).json({ error: "Supabase public configuration is missing." });
    return;
  }
  // Refuse to expose a Supabase secret/service-role key through this public endpoint.
  let serviceRoleKey = publishableKey.startsWith("sb_secret_");
  try {
    const payload = publishableKey.split(".")[1];
    if (payload) {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      serviceRoleKey = serviceRoleKey || claims.role === "service_role";
    }
  } catch (_) {}
  if (serviceRoleKey) {
    res.status(503).json({ error: "A secret/service-role key cannot be used as browser configuration." });
    return;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname) throw new Error("Invalid Supabase URL");
  } catch (_) {
    res.status(503).json({ error: "Supabase URL configuration is invalid." });
    return;
  }
  res.status(200).json({ url, publishableKey });
}
