/* Contenu public uniquement : les droits de lecture sont aussi imposés par RLS et les privilèges SQL. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (s) => document.querySelector(s);
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined && text !== null) n.textContent = String(text); if (cls) n.className = cls; return n; };
  const safeUrl = (raw) => { try { const u = new URL(raw); return u.protocol === "https:" ? u.href : null; } catch (_) { return null; } };
  const link = (label, href) => { const url = safeUrl(href); if (!url) return node("span", label); const a = node("a", label, "text-link"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; return a; };
  const date = (v) => v ? new Date(v + (String(v).length === 10 ? "T12:00:00" : "")).toLocaleDateString("fr-FR") : "";
  const news = $("#public-news"), library = $("#library-content"), photos = $("#photo-content");
  try {
    await window.LAS_SUPABASE_READY;
    const db = window.lasSupabase;
    const [postsResult, mediaResult] = await Promise.all([
      db.from("posts").select("id,title,body,category,created_at").in("category", ["annonce", "evenement"]).eq("status", "published").order("created_at", { ascending: false }).limit(6),
      db.from("media_items").select("id,media_type,title,description,external_url,published_date").eq("status", "published").not("external_url", "is", null).order("published_date", { ascending: false }).limit(50)
    ]);
    if (postsResult.error) news.replaceChildren(node("p", "Les annonces publiques seront affichées après activation des autorisations de lecture publique.", "muted"));
    else if (!postsResult.data?.length) news.replaceChildren(node("p", "Aucune annonce publique n'a été publiée pour le moment.", "muted"));
    else {
      news.replaceChildren(...postsResult.data.map(post => {
        const card = node("article", undefined, "feature-card");
        card.append(node("span", post.category === "evenement" ? "ÉVÉNEMENT" : "ANNONCE", "card-number"), node("h3", post.title), node("p", post.body), node("p", date(post.created_at), "muted"));
        return card;
      }));
    }
    if (mediaResult.error) {
      library.replaceChildren(node("p", "La bibliothèque publique sera disponible après activation des autorisations de lecture publique.", "muted"));
      photos.replaceChildren(node("p", "La photothèque publique sera disponible après activation des autorisations de lecture publique.", "muted"));
      return;
    }
    const items = (mediaResult.data || []).filter(item => safeUrl(item.external_url));
    const docs = items.filter(item => ["pdf", "article", "video"].includes(item.media_type));
    const images = items.filter(item => item.media_type === "photo");
    library.replaceChildren(...(docs.length ? docs.map(item => {
      const row = node("div", undefined, "resource-item"); row.append(node("span", item.media_type.toUpperCase(), "eyebrow"), link(item.title, item.external_url));
      if (item.description) row.append(node("p", item.description, "muted"));
      row.append(node("small", date(item.published_date), "muted")); return row;
    }) : [node("p", "Aucun document public n'est disponible pour le moment.", "muted")]));
    photos.replaceChildren(...(images.length ? images.map(item => {
      const card = node("article", undefined, "media-card"); const a = link("", item.external_url);
      const img = document.createElement("img"); img.src = safeUrl(item.external_url); img.alt = item.title || "Photo ASBL-LAS"; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; a.append(img); card.append(a, node("h3", item.title));
      if (item.description) card.append(node("p", item.description, "muted")); return card;
    }) : [node("p", "Aucune photo publique n'a été publiée pour le moment.", "muted")]));
  } catch (_) {
    news.replaceChildren(node("p", "Les annonces publiques sont temporairement indisponibles.", "muted"));
    library.replaceChildren(node("p", "La bibliothèque publique est temporairement indisponible.", "muted"));
    photos.replaceChildren(node("p", "La photothèque publique est temporairement indisponible.", "muted"));
  }
});