export async function onRequestGet({ env }) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };

  if (!env || !env.DB) {
    return new Response(
      JSON.stringify({
        ok: false,
        service: "asbl-las-api",
        database: "not_configured",
      }),
      { status: 503, headers }
    );
  }

  try {
    await env.DB.prepare("SELECT 1 AS ok").first();

    return new Response(
      JSON.stringify({
        ok: true,
        service: "asbl-las-api",
        database: "connected",
      }),
      { status: 200, headers }
    );
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        service: "asbl-las-api",
        database: "query_failed",
      }),
      { status: 503, headers }
    );
  }
}
