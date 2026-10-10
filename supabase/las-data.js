/* ASBL LAS — accès aux données via Supabase/RLS, sans cache local des fiches personnelles. */
window.LASData = (() => {
  const client = () => window.lasSupabase;
  function memberFromRow(r) {
    return {
      id:Number(r.id), name:r.name, phone:r.phone||"", email:r.email||"", address:r.address||"",
      note:r.note||"", birthdate:r.birthdate||"", birthplace:r.birthplace||"",
      profession:r.profession||"", poste:r.position||"", joined:r.joined_on||"",
      asbl:r.asbl_status||"OUI", forum:r.forum_status||"NON", reunion:r.meeting_status||"NON",
      photo:"", photoPath:r.photo_path||null, payments:{}
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
      const {data,error}=await db.storage.from("las-private-media").createSignedUrl(r.photo_path,300);
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
      meeting_status:m.reunion||null,status:m.asbl==="NON"?"inactive":"active"
    };
    const {data,error}=await client().from("members").insert(row).select("id").single();
    if(error) throw error;
    const id=Number(data.id);
    if(typeof m.photo==="string"&&m.photo.startsWith("data:")){
      const blob=await (await fetch(m.photo)).blob();
      if(blob.size>10*1024*1024) throw new Error("La photo dépasse la limite de 10 Mo.");
      const ext=(blob.type.split("/")[1]||"jpg").replace(/[^a-z0-9]/gi,"").slice(0,8)||"jpg";
      const path="members/"+id+"/"+crypto.randomUUID()+"."+ext;
      const {error:uploadError}=await client().storage.from("las-private-media").upload(path,blob,{contentType:blob.type,upsert:false});
      if(uploadError) throw uploadError;
      const {error:updateError}=await client().from("members").update({photo_path:path}).eq("id",id);
      if(updateError) throw updateError;
      m.photoPath=path;
    }
    return id;
  }
  async function saveMembers(members) {
    if(!["admin","secretaire"].includes(ROLE)) throw new Error("Droits insuffisants pour modifier les fiches membres.");
    const rows=[];
    for(const m of members){
      const row={
        id:Number(m.id),name:String(m.name||"").trim(),phone:m.phone||null,email:m.email||null,
        address:m.address||null,note:m.note||null,birthdate:m.birthdate||null,
        birthplace:m.birthplace||null,profession:m.profession||null,position:m.poste||null,
        joined_on:m.joined||null,asbl_status:m.asbl||null,forum_status:m.forum||null,
        meeting_status:m.reunion||null,status:m.asbl==="NON"?"inactive":"active",photo_path:m.photoPath||null
      };
      if(typeof m.photo==="string"&&m.photo.startsWith("data:")){
        const blob=await (await fetch(m.photo)).blob();
        if(blob.size>10*1024*1024) throw new Error("La photo de "+m.name+" dépasse la limite de 10 Mo.");
        const ext=(blob.type.split("/")[1]||"jpg").replace(/[^a-z0-9]/gi,"").slice(0,8)||"jpg";
        const path="members/"+Number(m.id)+"/"+crypto.randomUUID()+"."+ext;
        const {error:uploadError}=await client().storage.from("las-private-media").upload(path,blob,{contentType:blob.type,upsert:false});
        if(uploadError) throw uploadError;
        row.photo_path=path; m.photoPath=path;
      }
      rows.push(row);
    }
    if(!rows.length) return;
    const {error}=await client().from("members").upsert(rows,{onConflict:"id"});
    if(error) throw error;
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
