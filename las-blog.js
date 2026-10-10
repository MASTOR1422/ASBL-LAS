/* Blog communautaire LAS — seuls les comptes actifs peuvent lire et publier. */
window.LASBlog = (() => {
  const db=()=>window.lasSupabase;
  const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  async function load() {
    const host=document.getElementById("community-blog-list"); if(!host) return;
    host.innerHTML='<p class="text-xs text-slate-500">Chargement des échanges…</p>';
    const {data:posts,error}=await db().from("posts").select("id,title,body,category,author_id,created_at,profiles(display_name)").eq("status","published").order("created_at",{ascending:false}).limit(50);
    if(error){host.innerHTML='<p class="text-xs text-rose-600">Impossible de charger les échanges. Vérifiez les politiques RLS et la configuration Supabase.</p>';return;}
    const {data:{user}}=await db().auth.getUser();
    if(!posts?.length){host.innerHTML='<p class="text-sm text-slate-500 py-4">Aucune publication pour le moment. Lancez la conversation !</p>';return;}
    host.innerHTML=posts.map(p=>`<article class="border border-slate-200 rounded-xl p-4 bg-white space-y-2"><div class="flex items-center justify-between gap-2"><span class="text-xs font-extrabold text-las-800">${esc(p.profiles?.display_name||"Membre LAS")}</span><span class="text-[10px] text-slate-400">${new Date(p.created_at).toLocaleString("fr-FR")}</span></div><h3 class="font-bold text-slate-900">${esc(p.title)}</h3><p class="text-sm text-slate-700 whitespace-pre-wrap break-words">${esc(p.body)}</p><div class="flex gap-3 text-[11px]">${p.author_id===user?.id?'<button type="button" onclick="LASBlog.removePost(\''+p.id+'\')" class="text-rose-600 font-bold">Supprimer ma publication</button>':''}${ROLE==="admin"?'<button type="button" onclick="LASBlog.hidePost(\''+p.id+'\')" class="text-amber-700 font-bold">Masquer (modération)</button>':''}</div><div class="pt-2 border-t border-slate-100"><div id="comments-${p.id}" class="space-y-2 mb-2 text-xs text-slate-600">Chargement des commentaires…</div><form onsubmit="LASBlog.comment(event,'${p.id}')" class="flex gap-2"><input name="body" maxlength="3000" required placeholder="Répondre à cette publication…" class="flex-1 min-w-0 px-3 py-2 border rounded-lg text-xs"><button class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Répondre</button></form></div></article>`).join("");
    await Promise.all(posts.map(p=>loadComments(p.id)));
  }
  async function loadComments(postId){
    const el=document.getElementById("comments-"+postId); if(!el) return;
    const {data:{user}}=await db().auth.getUser();
    const {data,error}=await db().from("post_comments").select("id,body,author_id,created_at,profiles(display_name)").eq("post_id",postId).eq("status","published").order("created_at").limit(100);
    if(error){el.textContent="Commentaires momentanément indisponibles.";return;}
    el.innerHTML=(data||[]).map(c=>`<div class="bg-slate-50 rounded-lg px-3 py-2"><p><strong>${esc(c.profiles?.display_name||"Membre")}</strong> · ${esc(c.body)}</p><div class="flex gap-3 mt-1">${c.author_id===user?.id?'<button type="button" onclick="LASBlog.removeComment(\''+c.id+'\',\''+postId+'\')" class="text-rose-600">Supprimer</button>':''}${ROLE==="admin"?'<button type="button" onclick="LASBlog.hideComment(\''+c.id+'\',\''+postId+'\')" class="text-amber-700">Masquer</button>':''}</div></div>`).join("")||'<p class="text-slate-400">Aucune réponse pour le moment.</p>';
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
  async function removePost(id){
    if(!confirm("Supprimer cette publication ?"))return;
    const {error}=await db().from("posts").delete().eq("id",id);
    if(error){alert("Suppression refusée par les droits de sécurité.");return;}
    await load();
  }
  async function hidePost(id){
    if(ROLE!=="admin")return;
    const {error}=await db().from("posts").update({status:"hidden"}).eq("id",id);
    if(error){alert("Modération refusée par les droits de sécurité.");return;}
    await load();
  }
  async function removeComment(id,postId){
    if(!confirm("Supprimer cette réponse ?"))return;
    const {error}=await db().from("post_comments").delete().eq("id",id);
    if(error){alert("Suppression refusée par les droits de sécurité.");return;}
    await loadComments(postId);
  }
  async function hideComment(id,postId){
    if(ROLE!=="admin")return;
    const {error}=await db().from("post_comments").update({status:"hidden"}).eq("id",id);
    if(error){alert("Modération refusée par les droits de sécurité.");return;}
    await loadComments(postId);
  }
  return {load,publish,comment,removePost,hidePost,removeComment,hideComment};
})();
