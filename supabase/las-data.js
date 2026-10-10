/* ASBL LAS — accès aux données via Supabase/RLS, sans cache local des fiches personnelles. */
window.LASData = (() => {
  const client = () => window.lasSupabase;
  function memberFromRow(r) {
    return {
      id:Number(r.id), name:r.name, phone:r.phone||"", email:r.email||"", address:r.address||"",
      note:r.note||"", birthdate:r.birthdate||"", birthplace:r.birthplace||"",
      profession:r.profession||"", poste:r.position||"", joined:r.joined_on||"",
      asbl:r.asbl_status||"OUI", forum:r.forum_status||"NON", reunion:r.meeting_status||"NON",
      photo:"", photoPath:r.photo_path||null, birthdayVisible:r.birthday_visible!==false, payments:{}
    };
  }
  async function loadMembers() {
    const db=client();
    const [mr,pr]=await Promise.all([
      db.from("members").select("*").order("id"),
      db.from("member_payments").select("member_id,payment_year,payment_month,paid")
    ]);
    if(mr.error) throw mr.error;
    if(pr.error) throw pr.error;
    const map=new Map(mr.data.map(r=>[Number(r.id),memberFromRow(r)]));
    for(const p of pr.data){
      const m=map.get(Number(p.member_id)); if(!m) continue;
      const y=String(p.payment_year); if(!m.payments[y]) m.payments[y]=Array(12).fill(false);
      m.payments[y][Number(p.payment_month)-1]=!!p.paid;
    }
    await Promise.all(mr.data.filter(r=>r.photo_path).map(async r=>{
      const {data,error}=await db.storage.from("las-private-media").createSignedUrl(r.photo_path,3600);
      if(!error&&data?.signedUrl&&map.has(Number(r.id))) map.get(Number(r.id)).photo=data.signedUrl;
    }));
    return [...map.values()];
  }
  async function createMember(m) {
    if (!["admin","secretaire"].includes(ROLE)) throw new Error("Droits insuffisants pour créer une fiche membre.");
    const row={
      name:String(m.name||"").trim(),phone:m.phone||null,email:m.email||null,
      address:m.address||null,note:m.note||null,birthdate:m.birthdate||null,
      birthplace:m.birthplace||null,profession:m.profession||null,position:m.poste||null,
      joined_on:m.joined||null,asbl_status:m.asbl||null,forum_status:m.forum||null,
      meeting_status:m.reunion||null,status:m.asbl==="NON"?"inactive":"active",birthday_visible:m.birthdayVisible!==false
    };
    let uploadedPath=null;
    try {
      if(typeof m.photo==="string"&&m.photo.startsWith("data:")){
        const blob=await (await fetch(m.photo)).blob();
        if(blob.size>10*1024*1024) throw new Error("La photo dépasse la limite de 10 Mo.");
        if(!["image/jpeg","image/png","image/webp"].includes(blob.type)) throw new Error("Format de photo non pris en charge. Utilisez JPG, PNG ou WebP.");
        const ext=blob.type==="image/jpeg"?"jpg":blob.type.split("/")[1];
        uploadedPath="members/new/"+crypto.randomUUID()+"."+ext;
        const {error:uploadError}=await client().storage.from("las-private-media").upload(uploadedPath,blob,{contentType:blob.type,upsert:false});
        if(uploadError) throw uploadError;
        row.photo_path=uploadedPath;
      }
      const {data,error}=await client().from("members").insert(row).select("id").single();
      if(error) throw error;
      const id=Number(data.id);
      m.photoPath=uploadedPath;
      if(uploadedPath){
        try {
          const {data:signed,error:signError}=await client().storage.from("las-private-media").createSignedUrl(uploadedPath,3600);
          m.photo=!signError&&signed?.signedUrl?signed.signedUrl:"";
        } catch (_) { m.photo=""; }
      } else if(typeof m.photo==="string"&&m.photo.startsWith("data:")) {
        m.photo="";
      }
      return id;
    } catch(error) {
      if(uploadedPath) {
        const {error:cleanupError}=await client().storage.from("las-private-media").remove([uploadedPath]);
        if(cleanupError) console.warn("Nettoyage du fichier photo incomplet.",cleanupError);
      }
      throw error;
    }
  }
  async function saveMembers(members) {
    if(!["admin","secretaire"].includes(ROLE)) throw new Error("Droits insuffisants pour modifier les fiches membres.");
    const rows=[], uploadedPaths=[], photoUpdates=[], photoRemovals=[];
    try {
      for(const m of members){
        const row={
          id:Number(m.id),name:String(m.name||"").trim(),phone:m.phone||null,email:m.email||null,
          address:m.address||null,note:m.note||null,birthdate:m.birthdate||null,
          birthplace:m.birthplace||null,profession:m.profession||null,position:m.poste||null,
          joined_on:m.joined||null,asbl_status:m.asbl||null,forum_status:m.forum||null,
          meeting_status:m.reunion||null,status:m.asbl==="NON"?"inactive":"active",
          birthday_visible:m.birthdayVisible!==false,photo_path:m.photoRemoved?null:(m.photoPath||null)
        };
        if(m.photoRemoved && m.photoPath) photoRemovals.push({member:m,oldPath:m.photoPath});
        if(typeof m.photo==="string"&&m.photo.startsWith("data:")){
          const blob=await (await fetch(m.photo)).blob();
          if(blob.size>10*1024*1024) throw new Error("La photo de "+m.name+" dépasse la limite de 10 Mo.");
          if(!["image/jpeg","image/png","image/webp"].includes(blob.type)) throw new Error("Format de photo non pris en charge pour "+m.name+". Utilisez JPG, PNG ou WebP.");
          const ext=blob.type==="image/jpeg"?"jpg":blob.type.split("/")[1];
          const path="members/"+Number(m.id)+"/"+crypto.randomUUID()+"."+ext;
          const {error:uploadError}=await client().storage.from("las-private-media").upload(path,blob,{contentType:blob.type,upsert:false});
          if(uploadError) throw uploadError;
          uploadedPaths.push(path);
          photoUpdates.push({member:m,path,oldPath:m.photoPath||null});
          row.photo_path=path;
        }
        rows.push(row);
      }
      if(rows.length){
        const {error}=await client().from("members").upsert(rows,{onConflict:"id"});
        if(error) throw error;
      }
    } catch(error) {
      if(uploadedPaths.length){
        const {error:cleanupError}=await client().storage.from("las-private-media").remove(uploadedPaths);
        if(cleanupError) console.warn("Nettoyage des fichiers photos incomplet.",cleanupError);
      }
      throw error;
    }
    for(const item of photoUpdates) {
      item.member.photoPath=item.path;
      item.member.photoRemoved=false;
      try {
        const {data:signed,error:signError}=await client().storage.from("las-private-media").createSignedUrl(item.path,3600);
        item.member.photo=!signError&&signed?.signedUrl?signed.signedUrl:"";
      } catch (_) { item.member.photo=""; }
      if(item.oldPath) {
        const {error:cleanupError}=await client().storage.from("las-private-media").remove([item.oldPath]);
        if(cleanupError) console.warn("L’ancienne photo n’a pas pu être supprimée.",cleanupError);
      }
    }
    for(const item of photoRemovals) {
      item.member.photoPath=null;
      item.member.photo="";
      item.member.photoRemoved=false;
      const {error:cleanupError}=await client().storage.from("las-private-media").remove([item.oldPath]);
      if(cleanupError) console.warn("L’ancienne photo n’a pas pu être supprimée.",cleanupError);
    }
  }
  async function deleteMember(id) {
    if (ROLE !== "admin") throw new Error("Seul l’administrateur peut supprimer un membre.");
    const {error}=await client().from("members").delete().eq("id",Number(id));
    if(error) throw error;
  }
  async function saveMemberPayments(member) {
    if(!["admin","tresorier"].includes(ROLE)) throw new Error("Droits insuffisants pour modifier les cotisations.");
    const {data:{user}}=await client().auth.getUser();
    const rows=[];
    Object.entries(member.payments||{}).forEach(([year,months])=>{
      (months||[]).forEach((paid,i)=>rows.push({
        member_id:Number(member.id),payment_year:Number(year),payment_month:i+1,
        paid:!!paid,updated_by:user?.id||null
      }));
    });
    if(!rows.length) return;
    const {error}=await client().from("member_payments").upsert(rows,{onConflict:"member_id,payment_year,payment_month"});
    if(error) throw error;
  }
  return {loadMembers,createMember,saveMembers,saveMemberPayments,deleteMember};
})();
