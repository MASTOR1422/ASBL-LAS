document.addEventListener("DOMContentLoaded", async () => {
  const $ = (s) => document.querySelector(s);
  const node = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined&&text!==null)n.textContent=String(text); if(cls)n.className=cls; return n; };
  const safeUrl = raw => { try { const u=new URL(raw); return u.protocol==="https:"?u.href:null; } catch { return null; } };
  const link = (label, href) => { const url=safeUrl(href); if(!url)return node("span",label); const a=node("a",label,"text-link"); a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a; };
  const date = v => v ? new Date(v+(String(v).length===10?"T12:00:00":"")).toLocaleDateString("fr-FR") : "";
  const news=$("#public-news"),library=$("#library-content"),photos=$("#photo-content");
  try {
    const [postResponse,mediaResponse]=await Promise.all([fetch("/api/public/posts"),fetch("/api/public/media")]);
    if(!postResponse.ok||!mediaResponse.ok)throw new Error("Données publiques indisponibles");
    const posts=(await postResponse.json()).filter(p=>["annonce","evenement"].includes(p.category)).slice(0,6);
    const items=(await mediaResponse.json()).filter(i=>safeUrl(i.external_url));
    news.replaceChildren(...(posts.length?posts.map(post=>{const card=node("article",undefined,"feature-card");card.append(node("span",post.category==="evenement"?"ÉVÉNEMENT":"ANNONCE","card-number"),node("h3",post.title),node("p",post.body),node("p",date(post.created_at),"muted"));return card;}):[node("p","Aucune annonce publique n'a été publiée pour le moment.","muted")]));
    const docs=items.filter(i=>["pdf","article","video"].includes(i.media_type)),images=items.filter(i=>i.media_type==="photo");
    library.replaceChildren(...(docs.length?docs.map(item=>{const row=node("div",undefined,"resource-item");row.append(node("span",item.media_type.toUpperCase(),"eyebrow"),link(item.title,item.external_url));if(item.description)row.append(node("p",item.description,"muted"));row.append(node("small",date(item.published_date),"muted"));return row;}):[node("p","Aucun document public n'est disponible pour le moment.","muted")]));
    photos.replaceChildren(...(images.length?images.map(item=>{const card=node("article",undefined,"media-card"),a=link("",item.external_url),img=document.createElement("img");img.src=safeUrl(item.external_url);img.alt=item.title||"Photo ASBL-LAS";img.loading="lazy";img.referrerPolicy="no-referrer";a.append(img);card.append(a,node("h3",item.title));if(item.description)card.append(node("p",item.description,"muted"));return card;}):[node("p","Aucune photo publique n'a été publiée pour le moment.","muted")]));
  } catch {
    news.replaceChildren(node("p","Les annonces publiques sont temporairement indisponibles.","muted"));
    library.replaceChildren(node("p","La bibliothèque publique est temporairement indisponible.","muted"));
    photos.replaceChildren(node("p","La photothèque publique est temporairement indisponible.","muted"));
  }
});
