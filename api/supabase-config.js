/* Public runtime configuration for the browser client.
 * Only a publishable/anon key may be returned. Never expose service_role.
 */
function json(res, status, body) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(body);
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed." });
  }

  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const publishableKey = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!publishableKey) missing.push("SUPABASE_PUBLISHABLE_KEY");

  if (missing.length) {
    return json(res, 503, {
      error: "Supabase public configuration is unavailable in this deployment environment.",
      missing
    });
  }

  // Refuse to expose a secret/service-role key through this public endpoint.
  let serviceRoleKey = publishableKey.startsWith("sb_secret_");
  try {
    const payload = publishableKey.split(".")[1];
    if (payload) {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      serviceRoleKey = serviceRoleKey || claims.role === "service_role";
    }
  } catch (_) {}

  if (serviceRoleKey) {
    return json(res, 503, {
      error: "The browser configuration contains a secret/service-role key. Use a publishable/anon key."
    });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error("Invalid URL");
    }
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return json(res, 503, { error: "SUPABASE_URL must be the HTTPS URL of the intended Supabase project." });
    }
  } catch (_) {
    return json(res, 503, { error: "SUPABASE_URL is invalid. Use the HTTPS project URL from Supabase." });
  }

  return json(res, 200, { url, publishableKey });
}
