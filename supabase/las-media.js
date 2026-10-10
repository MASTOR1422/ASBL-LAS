/* LAS Media — fichiers privés Supabase Storage, métadonnées dans public.media_items. */
window.LASMedia = (() => {
  const db = () => window.lasSupabase;
  const MAX_BYTES = 10 * 1024 * 1024;
  const allowed = new Set(["image/jpeg","image/png","image/webp","application/pdf","video/mp4","video/webm"]);

  function mapRow(row, url) {
    return {
      id: Number(row.id),
      type: row.media_type,
      title: row.title || "",
      desc: row.description || "",
      url: url || "",
      date: row.published_date || row.created_at?.slice(0,10) || "",
      storagePath: row.storage_path || null
    };
  }

  async function load() {
    const { data, error } = await db().from("media_items")
      .select("id,media_type,title,description,external_url,storage_path,published_date,created_at,status")
      .eq("status", "published")
      .order("published_date", { ascending: false });
    if (error) throw error;
    return Promise.all((data || []).map(async row => {
      let url = row.external_url || "";
      if (row.storage_path) {
        const { data: signed, error: signedError } = await db().storage
          .from("las-private-media").createSignedUrl(row.storage_path, 300);
        if (signedError) {
          console.warn("URL signée indisponible pour le média", row.id, signedError);
          url = "";
        } else {
          url = signed.signedUrl;
        }
      }
      return mapRow(row, url);
    }));
  }

  async function upload(file, metadata) {
    if (!["admin","secretaire"].includes(ROLE)) throw new Error("Seuls l’administrateur et le secrétariat peuvent publier un média.");
    if (!file) throw new Error("Choisissez un fichier.");
    if (!allowed.has(file.type)) throw new Error("Format non autorisé. Utilisez JPG, PNG, WebP, PDF, MP4 ou WebM.");
    if (file.size > MAX_BYTES) throw new Error("Le fichier dépasse la limite de 10 Mo.");
    const title = String(metadata.title || "").trim();
    if (!title) throw new Error("Le titre est obligatoire.");
    const { data: authData, error: authError } = await db().auth.getUser();
    if (authError || !authData?.user) throw new Error("Session expirée. Reconnectez-vous.");
    const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0,8) || "bin";
    const path = "media/" + authData.user.id + "/" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await db().storage.from("las-private-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await db().from("media_items").insert({
      author_id: authData.user.id,
      title: title.slice(0,180),
      description: String(metadata.description || "").trim() || null,
      media_type: metadata.type,
      storage_path: path,
      external_url: null,
      status: "published"
    }).select("id").single();
    if (error) {
      await db().storage.from("las-private-media").remove([path]).catch(() => {});
      throw error;
    }
    return data.id;
  }

  async function remove(id) {
    if (ROLE !== "admin") throw new Error("Seul l’administrateur peut supprimer un média.");
    const mediaId = Number(id);
    if (!Number.isSafeInteger(mediaId) || mediaId <= 0) throw new Error("Identifiant de média invalide.");
    const { data: row, error: readError } = await db().from("media_items")
      .select("id,storage_path").eq("id", mediaId).single();
    if (readError) throw readError;
    const { error: deleteError } = await db().from("media_items").delete().eq("id", mediaId);
    if (deleteError) throw deleteError;
    if (row.storage_path) {
      const { error: storageError } = await db().storage.from("las-private-media").remove([row.storage_path]);
      if (storageError) console.warn("Le média est retiré du catalogue mais le fichier privé reste à nettoyer.", storageError);
    }
  }

  return { load, upload, remove };
})();
