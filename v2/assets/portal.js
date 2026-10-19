/* Portail LAS V2. Les contrôles SQL/RLS restent l'autorité finale. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (s) => document.querySelector(s);
  const alertBox = $("#portal-alert"), content = $("#portal-content"), adminPanel = $("#admin-panel"), warning = $("#data-warning");
  let currentProfile = null, currentUser = null, memberRows = [], periodRows = [], migrationReady = false;
  const money = (amount, currency) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(amount || 0)) + " " + String(currency || "CDF").trim();
  const dateLabel = (value) => value ? new Date(value).toLocaleDateString("fr-FR") : "—";
  const showMessage = (node, message, success = false) => { if (node) { node.textContent = message; node.classList.toggle("success", success); } };
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined && text !== null) node.textContent = String(text); if (className) node.className = className; return node; };
  const table = (headers, rows) => {
    const wrap = el("div", undefined, "table-wrap"), t = el("table"), thead = el("thead"), tr = el("tr");
    headers.forEach(h => tr.append(el("th", h))); thead.append(tr); t.append(thead);
    const tbody = el("tbody");
    rows.forEach(row => { const r = el("tr"); row.forEach(cell => r.append(el("td", cell ?? "—"))); tbody.append(r); });
    if (!rows.length) { const r = el("tr"), c = el("td", "Aucun enregistrement pour le moment."); c.colSpan = headers.length; r.append(c); tbody.append(r); }
    t.append(tbody); wrap.append(t); return wrap;
  };
  const renderError = (target, message) => target?.replaceChildren(el("p", message, "muted"));
  const fillSelect = (target, rows, valueKey, labelKey, placeholder) => {
    if (!target) return;
    target.replaceChildren();
    const first = el("option", placeholder); first.value = ""; first.disabled = true; first.selected = true; target.append(first);
    rows.forEach(row => { const opt = el("option", row[labelKey]); opt.value = row[valueKey]; target.append(opt); });
  };
  const loadList = async (target, query, render, missingMessage) => {
    const { data, error } = await query;
    if (error) { renderError(target, missingMessage || "Lecture impossible avec les autorisations actuelles."); return { error }; }
    render(target, data || []); return { data: data || [] };
  };
  $("#logout-button")?.addEventListener("click", async () => { try { await window.lasSupabase?.auth.signOut(); } finally { window.location.replace("./login.html"); } });
  try {
    await window.LAS_SUPABASE_READY;
    if (!window.lasSupabase) throw new Error("Configuration Supabase indisponible.");
    const { data: { session }, error: sessionError } = await window.lasSupabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error("Votre session a expiré. Reconnectez-vous.");
    const response = await fetch("../api/auth/verify-session", { method: "POST", credentials: "same-origin", headers: { Authorization: "Bearer " + session.access_token, Accept: "application/json" } });
    const verified = await response.json().catch(() => ({}));
    if (!response.ok || !verified.profile?.active) throw new Error(verified.message || "Votre compte ne permet pas d'accéder à cet espace.");
    currentProfile = verified.profile; currentUser = verified.user;
    $("#member-label").textContent = currentProfile.display_name || "Membre LAS";
    $("#welcome-title").textContent = "Bienvenue, " + (currentProfile.display_name || "membre");
    adminPanel.hidden = !["admin", "tresorier", "secretaire"].includes(currentProfile.role);
    alertBox.hidden = true; content.hidden = false;
  } catch (error) {
    alertBox.hidden = false; alertBox.textContent = error.message || "Vérification de la session impossible."; content.hidden = true;
    const link = el("a", "Retour à la connexion", "button"); link.href = "./login.html"; alertBox.append(" ", link); return;
  }

  const db = window.lasSupabase, memberId = currentProfile.member_id, warnings = [];
  const profileBox = $("#profile-details"), contributionBox = $("#contributions-list"), aidBox = $("#aid-list"), aidForm = $("#aid-form");
  if (memberId) {
    const memberResult = await db.from("members").select("name,phone,email,profession,birthdate,birthplace,address,joined_on,position,asbl_status,meeting_status,forum_status").eq("id", memberId).maybeSingle();
    if (memberResult.error) { renderError(profileBox, "Votre fiche membre n'est pas accessible avec les règles actuelles."); warnings.push("Lecture de la fiche membre indisponible."); }
    else if (!memberResult.data) renderError(profileBox, "Aucune fiche membre n'est associée à votre compte. Contactez l'équipe LAS.");
    else {
      const m = memberResult.data; profileBox.replaceChildren();
      const dl = el("dl", undefined, "profile-list");
      [["Nom",m.name],["Téléphone",m.phone],["E-mail",m.email],["Profession",m.profession],["Date de naissance",dateLabel(m.birthdate)],["Lieu de naissance",m.birthplace],["Adresse",m.address],["Membre depuis",dateLabel(m.joined_on)],["Fonction",m.position],["Statut LAS",m.asbl_status],["Réunions",m.meeting_status],["Forum",m.forum_status]].forEach(([label,value])=>{dl.append(el("dt",label),el("dd",value||"—"));});
      profileBox.append(dl);
    }
    const contrib = await loadList(contributionBox, db.from("monthly_contributions").select("id,contribution_year,contribution_month,amount,currency,paid_at,note").eq("member_id",memberId).order("contribution_year",{ascending:false}).order("contribution_month",{ascending:false}).limit(24), (target,rows)=>{
      const sum=rows.reduce((n,r)=>n+Number(r.amount||0),0); $("#contribution-summary").textContent=rows.length?rows.length+" enregistrement(s) · total affiché : "+money(sum,rows[0]?.currency):"Aucune cotisation enregistrée.";
      target.replaceChildren(table(["Période","Montant","Date","Note"],rows.map(r=>[String(r.contribution_month).padStart(2,"0")+"/"+r.contribution_year,money(r.amount,r.currency),dateLabel(r.paid_at),r.note||"—"])));
    },"Impossible de lire vos cotisations. La règle RLS personnelle doit être activée.");
    if(contrib.error)warnings.push("Les cotisations sont indisponibles jusqu'à validation des règles RLS personnelles.");
    const payments=await db.from("member_payments").select("payment_year,payment_month,paid,updated_at").eq("member_id",memberId).order("payment_year",{ascending:false}).order("payment_month",{ascending:false}).limit(24);
    if(payments.error)warnings.push("Le relevé mensuel des paiements n'est pas accessible.");
    else if(payments.data?.length){contributionBox.append(el("h3","Suivi mensuel"));contributionBox.append(table(["Mois","État","Mis à jour"],payments.data.map(r=>[String(r.payment_month).padStart(2,"0")+"/"+r.payment_year,r.paid?"Payé":"À payer",dateLabel(r.updated_at)])));}
    await loadList($("#tontine-list"),db.from("tontine_entries").select("amount,currency,status,paid_at,period:tontine_periods(title,starts_on,ends_on,status)").eq("member_id",memberId).order("created_at",{ascending:false}).limit(20),(target,rows)=>target.replaceChildren(table(["Période","Montant","État","Paiement"],rows.map(r=>[r.period?.title||"Période",money(r.amount,r.currency),r.status,dateLabel(r.paid_at)]))),"Le module tontine attend la migration dédiée et la validation de ses politiques RLS.");
    await loadList(aidBox,db.from("aid_requests").select("subject,status,created_at,decision_note").eq("member_id",memberId).order("created_at",{ascending:false}).limit(10),(target,rows)=>target.replaceChildren(table(["Demande","État","Envoyée le","Réponse"],rows.map(r=>[r.subject,r.status,dateLabel(r.created_at),r.decision_note||"En attente"]))),"Le module d'entraide attend la migration dédiée et la validation de ses politiques RLS.");
  } else {
    renderError(profileBox,"Aucun identifiant de fiche membre n'est lié à ce compte. Demandez à un administrateur de rattacher le compte à une fiche existante.");
    $("#contribution-summary").textContent="Compte non rattaché à une fiche membre."; renderError(contributionBox,"Les cotisations ne peuvent pas être filtrées sans identifiant de membre."); renderError($("#tontine-list"),"Le compte doit être lié à une fiche membre."); renderError(aidBox,"Le compte doit être lié à une fiche membre."); aidForm.hidden=true;
  }

  aidForm?.addEventListener("submit",async event=>{
    event.preventDefault(); if(!memberId)return; const submit=aidForm.querySelector("button[type=submit]"); submit.disabled=true; showMessage($("#aid-message"),"Envoi en cours…");
    const {error}=await db.from("aid_requests").insert({member_id:memberId,subject:$("#aid-subject").value.trim(),description:$("#aid-description").value.trim()});
    if(error)showMessage($("#aid-message"),"La demande n'a pas été enregistrée. Le module ou ses règles RLS ne sont pas encore actifs.");
    else{aidForm.reset();showMessage($("#aid-message"),"Votre demande a été envoyée à l'équipe habilitée.",true);await loadList(aidBox,db.from("aid_requests").select("subject,status,created_at,decision_note").eq("member_id",memberId).order("created_at",{ascending:false}).limit(10),(target,rows)=>target.replaceChildren(table(["Demande","État","Envoyée le","Réponse"],rows.map(r=>[r.subject,r.status,dateLabel(r.created_at),r.decision_note||"En attente"]))));}
    submit.disabled=false;
  });

  if(!adminPanel.hidden){
    const adminPayments=$("#admin-payments"), financePanel=$("#finance-panel");
    const paymentRows=await db.from("member_payments").select("id,member_id,payment_year,payment_month,paid,updated_at").order("payment_year",{ascending:false}).order("payment_month",{ascending:false}).limit(100);
    if(paymentRows.error)renderError(adminPayments,"Lecture des paiements refusée ou indisponible.");
    else{
      const ids=[...new Set(paymentRows.data.map(r=>r.member_id))];
      const memberNames=await db.from("members").select("id,name").in("id",ids.length?ids:[-1]);
      const names=Object.fromEntries((memberNames.data||[]).map(m=>[m.id,m.name]));
      adminPayments.replaceChildren(table(["Membre","Mois","État","Mis à jour"],paymentRows.data.map(r=>[names[r.member_id]||("Membre #"+r.member_id),String(r.payment_month).padStart(2,"0")+"/"+r.payment_year,r.paid?"Payé":"À payer",dateLabel(r.updated_at)])));
    }
    await loadList($("#admin-aid"),db.from("aid_requests").select("id,subject,status,created_at,decision_note").order("created_at",{ascending:false}).limit(50),(target,rows)=>{
      const wrap=el("div");
      rows.forEach(r=>{
        const item=el("div",undefined,"admin-aid-item");item.append(el("strong",r.subject),el("p","État : "+r.status+" · "+dateLabel(r.created_at),"muted"));
        const select=el("select");select.setAttribute("aria-label","État de "+r.subject);
        [["submitted","Soumise"],["under_review","En cours"],["approved","Approuvée"],["declined","Refusée"],["closed","Clôturée"]].forEach(([v,l])=>{const o=el("option",l);o.value=v;o.selected=v===r.status;select.append(o);});
        const note=el("input");note.placeholder="Note de décision (facultatif)";note.maxLength=1000;note.setAttribute("aria-label","Note de décision");
        const save=el("button","Enregistrer","button button-small");save.addEventListener("click",async()=>{save.disabled=true;const {error}=await db.from("aid_requests").update({status:select.value,decision_note:note.value.trim()||null,decided_by:currentUser.id,decided_at:new Date().toISOString()}).eq("id",r.id);save.disabled=false;showMessage(warning,error?"Modification refusée par la base ou module non activé.":"Demande mise à jour.",!error);});
        item.append(select,note,save);wrap.append(item);
      });target.replaceChildren(wrap);
    },"La file d'entraide attend la migration dédiée et les politiques RLS.");

    if(["admin","tresorier"].includes(currentProfile.role)){
      const probe=await db.from("tontine_periods").select("id").limit(1);
      migrationReady=!probe.error;
      financePanel.hidden=!migrationReady;
      if(!migrationReady)warnings.push("Les écritures financières et la gestion tontine restent verrouillées tant que la migration d'audit n'est pas appliquée et validée.");
      if(migrationReady){
        const members=await db.from("members").select("id,name").order("name");
        if(members.error){warnings.push("La liste des membres n'est pas accessible au rôle courant.");financePanel.hidden=true;}
        else{
          memberRows=members.data||[];
          fillSelect($("#contrib-member"),memberRows,"id","name","Choisir un membre");
          fillSelect($("#entry-member"),memberRows,"id","name","Choisir un membre");
          const reloadContributions=async()=>{
            const q=await db.from("monthly_contributions").select("id,member_id,contribution_year,contribution_month,amount,currency,paid_at,note").order("contribution_year",{ascending:false}).order("contribution_month",{ascending:false}).limit(200);
            const target=$("#admin-contributions");if(q.error){renderError(target,"Lecture des cotisations refusée.");return;}
            const nameById=Object.fromEntries(memberRows.map(m=>[m.id,m.name]));const wrap=el("div",undefined,"table-wrap");const t=el("table"),head=el("thead"),hr=el("tr");
            ["Membre","Période","Montant","Devise","Note","Action"].forEach(s=>hr.append(el("th",s)));head.append(hr);t.append(head);const body=el("tbody");
            q.data.forEach(r=>{
              const tr=el("tr");tr.append(el("td",nameById[r.member_id]||("Membre #"+r.member_id)),el("td",String(r.contribution_month).padStart(2,"0")+"/"+r.contribution_year));
              const amountCell=el("td"),amount=el("input");amount.type="number";amount.min="0";amount.step="0.01";amount.value=r.amount;amount.setAttribute("aria-label","Montant de la cotisation");amountCell.append(amount);tr.append(amountCell);
              const currencyCell=el("td"),currency=el("select");[["CDF","CDF"],["USD","USD"]].forEach(([v,l])=>{const o=el("option",l);o.value=v;o.selected=v===r.currency.trim();currency.append(o);});currencyCell.append(currency);tr.append(currencyCell);
              tr.append(el("td",r.note||"—"));const action=el("td"),save=el("button","Enregistrer","button button-small");save.addEventListener("click",async()=>{if(!Number.isFinite(Number(amount.value))||Number(amount.value)<0){showMessage($("#contrib-message"),"Saisissez un montant valide.");return;}save.disabled=true;const {error}=await db.from("monthly_contributions").update({amount:Number(amount.value),currency:currency.value}).eq("id",r.id);save.disabled=false;showMessage($("#contrib-message"),error?"Modification refusée. Vérifiez les règles RLS.":"Cotisation modifiée et journalisée.",!error);if(!error)await reloadContributions();});action.append(save);tr.append(action);body.append(tr);
            });
            if(!q.data.length){const tr=el("tr"),td=el("td","Aucune cotisation enregistrée.");td.colSpan=6;tr.append(td);body.append(tr);}t.append(body);wrap.append(t);target.replaceChildren(wrap);
          };
          await reloadContributions();
          $("#contrib-year").value=new Date().getFullYear();
          $("#contribution-form")?.addEventListener("submit",async event=>{event.preventDefault();const button=$("#contribution-form button[type=submit]");button.disabled=true;const payload={member_id:Number($("#contrib-member").value),contribution_year:Number($("#contrib-year").value),contribution_month:Number($("#contrib-month").value),amount:Number($("#contrib-amount").value),currency:$("#contrib-currency").value,note:$("#contrib-note").value.trim()||null,recorded_by:currentUser.id};const {error}=await db.from("monthly_contributions").insert(payload);button.disabled=false;if(error)showMessage($("#contrib-message"),"Enregistrement refusé. Vérifiez les champs et les règles RLS.");else{showMessage($("#contrib-message"),"Cotisation enregistrée et journalisée.",true);$("#contrib-amount").value="";$("#contrib-note").value="";await reloadContributions();}});
          const reloadPeriods=async()=>{
            const q=await db.from("tontine_periods").select("id,title,starts_on,ends_on,contribution_amount,currency,status").order("starts_on",{ascending:false});
            const target=$("#admin-tontine-periods");if(q.error){renderError(target,"Lecture des périodes impossible.");return;}
            periodRows=q.data||[];fillSelect($("#entry-period"),periodRows,"id","title","Choisir une période");
            target.replaceChildren(table(["Période","Dates","Contribution","État"],periodRows.map(r=>[r.title,dateLabel(r.starts_on)+" – "+dateLabel(r.ends_on),money(r.contribution_amount,r.currency),r.status])));
          };
          const reloadEntries=async()=>{
            const q=await db.from("tontine_entries").select("id,member_id,period_id,amount,currency,status,paid_at").order("created_at",{ascending:false}).limit(200);
            const target=$("#admin-tontine-entries");if(q.error){renderError(target,"Lecture des participations impossible.");return;}
            const memberName=Object.fromEntries(memberRows.map(m=>[m.id,m.name])), periodName=Object.fromEntries(periodRows.map(m=>[m.id,m.title]));
            const wrap=el("div",undefined,"table-wrap"),t=el("table"),head=el("thead"),hr=el("tr");
            ["Membre","Période","Montant","État","Action"].forEach(s=>hr.append(el("th",s)));head.append(hr);t.append(head);const body=el("tbody");
            q.data.forEach(r=>{const tr=el("tr");tr.append(el("td",memberName[r.member_id]||("Membre #"+r.member_id)),el("td",periodName[r.period_id]||("Période #"+r.period_id)),el("td",money(r.amount,r.currency)),el("td",r.status));const cell=el("td"),sel=el("select");[["due","À payer"],["paid","Payé"],["late","En retard"],["waived","Exempté"]].forEach(([v,l])=>{const o=el("option",l);o.value=v;o.selected=v===r.status;sel.append(o);});const save=el("button","Mettre à jour","button button-small");save.addEventListener("click",async()=>{save.disabled=true;const {error}=await db.from("tontine_entries").update({status:sel.value,paid_at:sel.value==="paid"?new Date().toISOString():null}).eq("id",r.id);save.disabled=false;showMessage(warning,error?"Modification tontine refusée par RLS.":"Participation tontine mise à jour et journalisée.",!error);if(!error)await reloadEntries();});cell.append(sel,save);tr.append(cell);body.append(tr);});
            if(!q.data.length){const tr=el("tr"),td=el("td","Aucune participation enregistrée.");td.colSpan=5;tr.append(td);body.append(tr);}t.append(body);wrap.append(t);target.replaceChildren(wrap);
          };
          await reloadPeriods();await reloadEntries();
          $("#tontine-period-form")?.addEventListener("submit",async event=>{event.preventDefault();const button=$("#tontine-period-form button[type=submit]");button.disabled=true;const payload={title:$("#period-title").value.trim(),starts_on:$("#period-start").value,ends_on:$("#period-end").value,contribution_amount:Number($("#period-amount").value),currency:$("#period-currency").value,status:$("#period-status").value,created_by:currentUser.id};const {error}=await db.from("tontine_periods").insert(payload);button.disabled=false;if(error)showMessage($("#period-message"),"Création refusée. Vérifiez les dates et les droits.");else{showMessage($("#period-message"),"Période créée.",true);$("#tontine-period-form").reset();await reloadPeriods();await reloadEntries();}});
          $("#tontine-entry-form")?.addEventListener("submit",async event=>{event.preventDefault();const button=$("#tontine-entry-form button[type=submit]");button.disabled=true;const payload={period_id:Number($("#entry-period").value),member_id:Number($("#entry-member").value),amount:Number($("#entry-amount").value),currency:$("#entry-currency").value,status:"due",recorded_by:currentUser.id};const {error}=await db.from("tontine_entries").insert(payload);button.disabled=false;if(error)showMessage($("#entry-message"),"Participation non créée. Vérifiez que le membre n'est pas déjà inscrit à cette période.");else{showMessage($("#entry-message"),"Participation enregistrée et journalisée.",true);$("#tontine-entry-form").reset();await reloadEntries();}});
        }
      }
    }
  }
  warning.textContent=warnings.length?warnings.join(" "):"Les données sont chargées depuis Supabase; les écritures sont soumises aux règles d'accès de la base.";
});