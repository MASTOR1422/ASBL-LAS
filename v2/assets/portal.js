document.addEventListener("DOMContentLoaded", async () => {
  const $ = selector => document.querySelector(selector);
  const el = (tag, text, cls) => { const n=document.createElement(tag); if(text!==undefined&&text!==null)n.textContent=String(text); if(cls)n.className=cls; return n; };
  const money = (value,currency="CDF") => new Intl.NumberFormat("fr-FR",{maximumFractionDigits:2}).format(Number(value||0))+" "+currency;
  const date = value => value ? new Date(value).toLocaleDateString("fr-FR") : "—";
  const say = (target,message,ok=false) => { const n=$(target); if(n){n.textContent=message;n.classList.toggle("success",ok);if(target==="#portal-alert")n.hidden=false;} };
  const api = async (path, options={}) => {
    const response=await fetch(path,{credentials:"same-origin",headers:{"Accept":"application/json",...(options.body?{"Content-Type":"application/json"}:{})},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||"La demande n’a pas pu être traitée.");
    return data;
  };
  const makeTable = (headers, rows) => {
    const wrap=el("div",undefined,"table-wrap"), table=el("table"), head=el("thead"), hr=el("tr");
    headers.forEach(h=>hr.append(el("th",h)));head.append(hr);table.append(head);
    const body=el("tbody");
    rows.forEach(row=>{const tr=el("tr");row.forEach(cell=>{const td=el("td");if(cell instanceof Node)td.append(cell);else td.textContent=cell===null||cell===undefined||cell===""?"—":String(cell);tr.append(td);});body.append(tr);});
    if(!rows.length){const tr=el("tr"),td=el("td","Aucun enregistrement.");td.colSpan=headers.length;tr.append(td);body.append(tr);}
    table.append(body);wrap.append(table);return wrap;
  };
  const setTable = (selector,headers,rows) => {const n=$(selector);if(n)n.replaceChildren(makeTable(headers,rows));};
  const setSelect = (selector,rows,valueKey,labelKey,placeholder="Choisir…") => {
    const node=$(selector);if(!node)return;
    node.replaceChildren();const first=el("option",placeholder);first.value="";first.disabled=true;first.selected=true;node.append(first);
    rows.forEach(row=>{const opt=el("option",row[labelKey]);opt.value=String(row[valueKey]);node.append(opt);});
  };
  const onSubmit = (selector, handler) => $(selector)?.addEventListener("submit",async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button[type="submit"]');if(button)button.disabled=true;try{await handler(event.currentTarget);}catch(error){console.error(error);say("#portal-alert",error.message||"Erreur de traitement.");}finally{if(button)button.disabled=false;}});
  const alertBox=$("#portal-alert"), contentBox=$("#portal-content"), adminPanel=$("#admin-panel"), financePanel=$("#finance-panel");
  let user=null, member=null, members=[], periods=[];
  $("#logout-button")?.addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"});}finally{window.location.replace("/login.html");}});
  try {
    const auth=await api("/api/auth/me"); user=auth.user;
    const me=await api("/api/me"); member=me.member;
    $("#member-label").textContent=user.display_name||user.username;
    $("#welcome-title").textContent="Bienvenue, "+(user.display_name||user.username);
    adminPanel.hidden=!["admin","tresorier","secretaire"].includes(user.role);
    financePanel.hidden=!["admin","tresorier"].includes(user.role);
    alertBox.hidden=true;contentBox.hidden=false;
  } catch(error) {
    alertBox.hidden=false;alertBox.textContent=error.message||"Session absente.";
    const link=el("a","Retour à la connexion","button");link.href="/login.html";alertBox.append(" ",link);contentBox.hidden=true;return;
  }

  const profile=$("#profile-details"), contribBox=$("#contributions-list"), aidBox=$("#aid-list");
  if(member) {
    profile.replaceChildren();
    const dl=el("dl",undefined,"profile-list");
    [["Nom",member.name],["Téléphone",member.phone],["E-mail",member.email],["Profession",member.profession],["Date de naissance",date(member.birthdate)],["Lieu de naissance",member.birthplace],["Adresse",member.address],["Membre depuis",date(member.joined_on)],["Fonction",member.position],["Statut LAS",member.asbl_status],["Réunions",member.meeting_status],["Forum",member.forum_status]].forEach(([label,value])=>dl.append(el("dt",label),el("dd",value||"—")));
    profile.append(dl);
    try {
      const [contributions,payments,tontine,aid]=await Promise.all([api("/api/me/contributions"),api("/api/me/payments"),api("/api/me/tontine"),api("/api/me/aid")]);
      const totals=contributions.reduce((sum,row)=>{const currency=row.currency||"CDF";sum[currency]=(sum[currency]||0)+Number(row.amount||0);return sum;},{});
      $("#contribution-summary").textContent=contributions.length?contributions.length+" enregistrement(s) · total : "+Object.entries(totals).map(([currency,value])=>money(value,currency)).join(" · "):"Aucune cotisation enregistrée.";
      contribBox.replaceChildren(makeTable(["Période","Montant","Date","Note"],contributions.map(row=>[String(row.contribution_month).padStart(2,"0")+"/"+row.contribution_year,money(row.amount,row.currency),date(row.paid_at),row.note])));
      if(payments.length){contribBox.append(el("h3","Suivi mensuel"),makeTable(["Mois","État","Mis à jour"],payments.map(row=>[String(row.payment_month).padStart(2,"0")+"/"+row.payment_year,row.paid?"Payé":"À payer",date(row.updated_at)])));}
      $("#tontine-list").replaceChildren(makeTable(["Période","Montant","État","Paiement"],tontine.map(row=>[row.title,money(row.amount,row.currency),row.status,date(row.paid_at)])));
      aidBox.replaceChildren(makeTable(["Demande","État","Envoyée le","Réponse"],aid.map(row=>[row.subject,row.status,date(row.created_at),row.decision_note||"En attente"])));
    } catch(error) { $("#contribution-summary").textContent="Certaines données sont indisponibles."; console.error(error); }
    onSubmit("#aid-form",async form=>{await api("/api/me/aid",{method:"POST",body:JSON.stringify({subject:form.elements.subject.value,description:form.elements.description.value})});form.reset();say("#aid-message","Demande envoyée.",true);const rows=await api("/api/me/aid");aidBox.replaceChildren(makeTable(["Demande","État","Envoyée le","Réponse"],rows.map(row=>[row.subject,row.status,date(row.created_at),row.decision_note||"En attente"])));});
  } else {
    profile.replaceChildren(el("p","Aucune fiche membre n’est liée à ce compte. Contactez un administrateur.","muted"));
    $("#contribution-summary").textContent="Compte non rattaché à une fiche membre.";
    contribBox.replaceChildren(el("p","Les cotisations ne peuvent pas être affichées sans fiche membre.","muted"));
    $("#tontine-list").replaceChildren(el("p","Le compte doit être lié à une fiche membre.","muted"));
    aidBox.replaceChildren(el("p","Le compte doit être lié à une fiche membre.","muted"));$("#aid-form").hidden=true;
  }

  if(!adminPanel.hidden) {
    try {
      members=await api("/api/admin/members");
      const aids=await api("/api/admin/aid");
      setTable("#admin-aid",["Membre","Demande","État","Date","Décision"],aids.map(row=>{
        const select=el("select");["pending","approved","rejected","closed"].forEach(value=>{const o=el("option",value);o.value=value;o.selected=value===row.status;select.append(o);});
        const note=el("input");note.placeholder="Note de décision";note.maxLength=2000;note.value=row.decision_note||"";
        const button=el("button","Enregistrer","button button-small");button.type="button";button.addEventListener("click",async()=>{button.disabled=true;try{await api("/api/admin/aid/"+row.id,{method:"PATCH",body:JSON.stringify({status:select.value,decision_note:note.value})});say("#portal-alert","Décision enregistrée.",true);}catch(e){say("#portal-alert",e.message);}finally{button.disabled=false;}});
        const controls=el("div");controls.append(select,note,button);
        return [row.member_name,row.subject,row.status,date(row.created_at),controls];
      }));
      const paymentRows=await api("/api/admin/payments");
      setTable("#admin-payments",["Membre","Période","Payé","Mis à jour"],paymentRows.map(row=>[row.member_name,String(row.payment_month).padStart(2,"0")+"/"+row.payment_year,row.paid?"Oui":"Non",date(row.updated_at)]));
    } catch(error) { $("#admin-payments").replaceChildren(el("p",error.message,"muted")); }
  }

  if(!financePanel.hidden) {
    const contributionMembers=members.map(m=>({id:m.id,name:m.name}));
    setSelect("#contrib-member",contributionMembers,"id","name","Sélectionner un membre");
    setSelect("#entry-member",contributionMembers,"id","name","Sélectionner un membre");
    const now=new Date();$("#contrib-year").value=String(now.getFullYear());$("#contrib-month").value=String(now.getMonth()+1);
    const reloadPeriods=async()=>{periods=await api("/api/admin/tontine/periods");setSelect("#entry-period",periods,"id","title","Sélectionner une période");setTable("#admin-tontine-periods",["Période","Début","Fin","Montant","État"],periods.map(p=>[p.title,p.starts_on,p.ends_on,money(p.contribution_amount,p.currency),p.status]));};
    const reloadEntries=async()=>{const entries=await api("/api/admin/tontine/entries");setTable("#admin-tontine-entries",["Période","Membre","Montant","État","Date paiement"],entries.map(e=>[e.period_title,e.member_name,money(e.amount,e.currency),e.status,date(e.paid_at)]));};
    onSubmit("#contribution-form",async form=>{await api("/api/admin/contributions",{method:"POST",body:JSON.stringify({member_id:Number($("#contrib-member").value),contribution_year:Number($("#contrib-year").value),contribution_month:Number($("#contrib-month").value),amount:Number($("#contrib-amount").value),currency:$("#contrib-currency").value,note:$("#contrib-note").value})});form.reset();say("#contrib-message","Cotisation enregistrée.",true);});
    onSubmit("#tontine-period-form",async form=>{await api("/api/admin/tontine/periods",{method:"POST",body:JSON.stringify({title:$("#period-title").value,starts_on:$("#period-start").value,ends_on:$("#period-end").value,contribution_amount:Number($("#period-amount").value),currency:$("#period-currency").value,status:$("#period-status").value})});form.reset();say("#period-message","Période créée.",true);await reloadPeriods();await reloadEntries();});
    onSubmit("#tontine-entry-form",async form=>{await api("/api/admin/tontine/entries",{method:"POST",body:JSON.stringify({period_id:Number($("#entry-period").value),member_id:Number($("#entry-member").value),amount:Number($("#entry-amount").value),currency:$("#entry-currency").value,status:"due"})});form.reset();say("#entry-message","Participation enregistrée.",true);await reloadEntries();});
    try {
      await reloadPeriods();await reloadEntries();
      const contributions=await api("/api/admin/contributions");
      setTable("#admin-contributions",["Membre","Période","Montant","Date","Note"],contributions.map(c=>[c.member_name,String(c.contribution_month).padStart(2,"0")+"/"+c.contribution_year,money(c.amount,c.currency),date(c.paid_at),c.note]));
    } catch(error) { console.error(error); }
  }
});
