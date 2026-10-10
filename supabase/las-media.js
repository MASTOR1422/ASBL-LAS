/* LAS Media — stockage privé Supabase, métadonnées dans public.media_items. */
window.LASMedia = (() => {
  const db = () => window.lasSupabase;
  const MAX_BYTES = 50 * 1024 * 1024;
  const MIME_BY_EXT = {
    jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp",
    pdf:"application/pdf", mp4:"video/mp4", webm:"video/webm"
  };
  const MIME_BY_TYPE = {
    photo:["image/jpeg","image/png","image/webp"],
    pdf:["application/pdf"],
    video:["video/mp4","video/webm"]
  };

  function fileDetails(file) {
    const ext = String(file?.name || "").split(".").pop().toLowerCase();
    const mime = MIME_BY_EXT[ext] || String(file?.type || "").toLowerCase();
    if (!Object.values(MIME_BY_EXT).includes(mime)) {
      throw new Error("Format non autorisé. Utilisez JPG, PNG, WebP, PDF, MP4 ou WebM.");
    }
    if (file.type && file.type !== "application/octet-stream" && file.type !== mime &&
        !(file.type === "image/jpg" && mime === "image/jpeg")) {
      throw new Error("Le type du fichier ne correspond pas à son extension. Choisissez le bon fichier.");
    }
    return { ext, mime };
  }

  function mapRow(row, url) {
    return {
      id: Number(row.id), type: row.media_type, title: row.title || "",
      desc: row.description || "", url: url || "",
      date: row.published_date || row.created_at?.slice(0,10) || "",
      storagePath: row.storage_path || null
    };
  }

  async function signedUrl(path) {
    const { data, error } = await db().storage.from("las-private-media").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  async function load() {
    if (!db()) throw new Error("Supabase n’est pas initialisé. Rechargez la page.");
    const { data, error } = await db().from("media_items")
      .select("id,media_type,title,description,external_url,storage_path,published_date,created_at,status")
      .eq("status", "published").order("published_date", { ascending: false });
    if (error) throw error;
    return Promise.all((data || []).map(async row => {
      let url = row.external_url || "";
      if (row.storage_path) {
        try { url = await signedUrl(row.storage_path); }
        catch (e) { console.warn("Lien temporaire indisponible pour le média", row.id, e); url = ""; }
      }
      return mapRow(row, url);
    }));
  }

  async function upload(file, metadata) {
    if (!["admin","secretaire"].includes(ROLE)) throw new Error("Seuls l’administrateur et le secrétariat peuvent publier un média.");
    if (!file) throw new Error("Choisissez un fichier depuis votre appareil.");
    if (file.size > MAX_BYTES) throw new Error("Le fichier dépasse la limite de 50 Mo.");
    const { ext, mime } = fileDetails(file);
    if (!(MIME_BY_TYPE[metadata.type] || []).includes(mime)) {
      throw new Error("Le type sélectionné ne correspond pas au fichier. Choisissez Photo, Document PDF ou Vidéo.");
    }
    const title = String(metadata.title || "").trim();
    if (!title) throw new Error("Le titre est obligatoire.");
    const client = db();
    if (!client) throw new Error("Supabase n’est pas initialisé. Rechargez la page.");
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData?.user) throw new Error("Session expirée. Reconnectez-vous.");
    const uuid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const path = "media/" + authData.user.id + "/" + uuid + "." + ext;
    const { error: uploadError } = await client.storage.from("las-private-media")
      .upload(path, file, { contentType: mime, upsert: false });
    if (uploadError) throw new Error("Échec du transfert vers le stockage : " + uploadError.message);
    const { data, error } = await client.from("media_items").insert({
      author_id: authData.user.id,
      title: title.slice(0,180),
      description: String(metadata.description || "").trim() || null,
      media_type: metadata.type,
      storage_path: path,
      external_url: null,
      status: "published"
    }).select("id").single();
    if (error) {
      const cleanup = await client.storage.from("las-private-media").remove([path]);
      if (cleanup.error) console.warn("Le fichier temporaire n’a pas pu être supprimé.", cleanup.error);
      throw new Error("Le fichier a été transféré, mais son inscription au catalogue a échoué : " + error.message);
    }
    return data.id;
  }

  async function remove(id) {
    if (ROLE !== "admin") throw new Error("Seul l’administrateur peut supprimer un média.");
    const mediaId = Number(id);
    if (!Number.isSafeInteger(mediaId) || mediaId <= 0) throw new Error("Identifiant de média invalide.");
    const client = db();
    const { data: row, error: readError } = await client.from("media_items")
      .select("id,storage_path").eq("id", mediaId).single();
    if (readError) throw readError;
    const { error: deleteError } = await client.from("media_items").delete().eq("id", mediaId);
    if (deleteError) throw deleteError;
    if (row.storage_path) {
      const { error: storageError } = await client.storage.from("las-private-media").remove([row.storage_path]);
      if (storageError) console.warn("Le média est retiré du catalogue mais le fichier privé reste à nettoyer.", storageError);
    }
  }

  return { load, upload, remove };
})();
