/* ASBL LAS — accès aux données via Supabase/RLS, sans cache local des fiches personnelles. */
window.LASData = (() => {
  const client = () => window.lasSupabase;
  function memberFromRow(r) {
    return {
      id:Number(r.id), name:r.name, phone:r.phone||"", email:r.email||"", address:r.address||"",
      note:r.note||"", birthdate:r.birthdate||"", birthplace:r.birthplace||"",
      profession:r.profession||"", poste:r.position||"", joined:r.joined_on||"",
      asbl:r.asbl_status||"OUI", forum:r.forum_status||"NON", reunion:r.meeting_status||"NON",
      photo:"", payments:{}
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
    return [...map.values()];
  }
  async function saveMembers(members) {
    if(!["admin","secretaire"].includes(ROLE)) throw new Error("Droits insuffisants pour modifier les fiches membres.");
    const rows=members.map(m=>({
      id:Number(m.id),name:String(m.name||"").trim(),phone:m.phone||null,email:m.email||null,
      address:m.address||null,note:m.note||null,birthdate:m.birthdate||null,
      birthplace:m.birthplace||null,profession:m.profession||null,position:m.poste||null,
      joined_on:m.joined||null,asbl_status:m.asbl||null,forum_status:m.forum||null,
      meeting_status:m.reunion||null,status:m.asbl==="NON"?"inactive":"active"
    }));
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
  return {loadMembers,saveMembers,saveMemberPayments,deleteMember};
})();
