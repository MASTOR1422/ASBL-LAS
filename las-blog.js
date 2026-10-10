/* Blog communautaire LAS — seuls les comptes actifs peuvent lire et publier. */
window.LASBlog = (() => {
  const db=()=>window.lasSupabase;
  const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  async function load() {
    const host=document.getElementById("community-blog-list"); if(!host) return;
    host.innerHTML='<p class="text-xs text-slate-500">Chargement des échanges…</p>';
    const {data:posts,error}=await db().from("posts").select("id,title,body,category,author_id,created_at,profiles(display_name)").eq("status","published").order("created_at",{ascending:false}).limit(50);
    if(error){host.innerHTML='<p class="text-xs text-rose-600">Impossible de charger les échanges. Vérifiez les politiques RLS et la configuration Supabase.</p>';return;}
    if(!posts?.length){host.innerHTML='<p class="text-sm text-slate-500 py-4">Aucune publication pour le moment. Lancez la conversation !</p>';return;}
    host.innerHTML=posts.map(p=>`<article class="border border-slate-200 rounded-xl p-4 bg-white space-y-2"><div class="flex items-center justify-between gap-2"><span class="text-xs font-extrabold text-las-800">${esc(p.profiles?.display_name||"Membre LAS")}</span><span class="text-[10px] text-slate-400">${new Date(p.created_at).toLocaleString("fr-FR")}</span></div><h3 class="font-bold text-slate-900">${esc(p.title)}</h3><p class="text-sm text-slate-700 whitespace-pre-wrap break-words">${esc(p.body)}</p><div class="pt-2 border-t border-slate-100"><div id="comments-${p.id}" class="space-y-2 mb-2 text-xs text-slate-600">Chargement des commentaires…</div><form onsubmit="LASBlog.comment(event,'${p.id}')" class="flex gap-2"><input name="body" maxlength="3000" required placeholder="Répondre à cette publication…" class="flex-1 min-w-0 px-3 py-2 border rounded-lg text-xs"><button class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Répondre</button></form></div></article>`).join("");
    await Promise.all(posts.map(p=>loadComments(p.id)));
  }
  async function loadComments(postId){
    const el=document.getElementById("comments-"+postId); if(!el) return;
    const {data,error}=await db().from("post_comments").select("id,body,created_at,profiles(display_name)").eq("post_id",postId).eq("status","published").order("created_at").limit(100);
    if(error){el.textContent="Commentaires momentanément indisponibles.";return;}
    el.innerHTML=(data||[]).map(c=>`<p class="bg-slate-50 rounded-lg px-3 py-2"><strong>${esc(c.profiles?.display_name||"Membre")}</strong> · ${esc(c.body)}</p>`).join("")||'<p class="text-slate-400">Aucune réponse pour le moment.</p>';
  }
  async function publish(e){
    e.preventDefault(); const form=e.currentTarget, msg=document.getElementById("blog-message");
    const title=form.title.value.trim(), body=form.body.value.trim(), category=form.category.value;
    const {data:{user}}=await db().auth.getUser();
    if(!user){msg.textContent="Reconnectez-vous pour publier.";return;}
    const {error}=await db().from("posts").insert({author_id:user.id,title,body,category});
    if(error){msg.textContent="Publication refusée. Vérifiez votre compte actif et les politiques RLS.";return;}
    form.reset();msg.textContent="Publication ajoutée.";await load();
  }
  async function comment(e,postId){
    e.preventDefault();const form=e.currentTarget, body=form.body.value.trim();
    const {data:{user}}=await db().auth.getUser();if(!user)return;
    const {error}=await db().from("post_comments").insert({post_id:postId,author_id:user.id,body});
    if(error){alert("Impossible d’ajouter la réponse. Vérifiez votre compte et les politiques RLS.");return;}
    form.reset();await loadComments(postId);
  }
  return {load,publish,comment};
})();
