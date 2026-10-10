/* Public runtime configuration for the browser client.
 * Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel Project Settings.
 * A publishable/anon key is designed for browser use; never expose service_role.
 */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !publishableKey) {
    res.status(503).json({ error: "Supabase public configuration is missing." });
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
