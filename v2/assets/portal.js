/* Portail LAS V2: la base reste l'autorité; l'interface ne remplace jamais RLS. */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = (selector) => document.querySelector(selector);
  const alertBox = $("#portal-alert");
  const content = $("#portal-content");
  const adminPanel = $("#admin-panel");
  const warning = $("#data-warning");
  let currentProfile = null;
  let currentUser = null;
  const money = (amount, currency) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(amount || 0)) + " " + String(currency || "CDF").trim();
  const dateLabel = (value) => value ? new Date(value).toLocaleDateString("fr-FR") : "—";
  const showMessage = (node, message, success = false) => { if (node) { node.textContent = message; node.classList.toggle("success", success); } };
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined && text !== null) node.textContent = String(text); if (className) node.className = className; return node; };
  const table = (headers, rows) => {
    const wrap = el("div", undefined, "table-wrap");
    const t = el("table"); const thead = el("thead"); const tr = el("tr");
    headers.forEach(h => tr.append(el("th", h))); thead.append(tr); t.append(thead);
    const tbody = el("tbody");
    rows.forEach(row => { const r = el("tr"); row.forEach(cell => r.append(el("td", cell ?? "—"))); tbody.append(r); });
    if (!rows.length) { const r = el("tr"); const c = el("td", "Aucun enregistrement pour le moment."); c.colSpan = headers.length; r.append(c); tbody.append(r); }
    t.append(tbody); wrap.append(t); return wrap;
  };
  const renderError = (target, message) => { target.replaceChildren(el("p", message, "muted")); };
  const loadList = async (target, query, render, missingMessage) => {
    const { data, error } = await query;
    if (error) { renderError(target, missingMessage || "Lecture impossible avec les autorisations actuelles."); return { error }; }
    render(target, data || []); return { data: data || [] };
  };
  $("#logout-button")?.addEventListener("click", async () => {
    try { await window.lasSupabase?.auth.signOut(); } finally { window.location.replace("./login.html"); }
  });
  try {
    await window.LAS_SUPABASE_READY;
    if (!window.lasSupabase) throw new Error("Configuration Supabase indisponible.");
    const { data: { session }, error: sessionError } = await window.lasSupabase.auth.getSession();
    if (sessionError || !session?.access_token) throw new Error("Votre session a expiré. Reconnectez-vous.");
    const response = await fetch("../api/auth/verify-session", { method: "POST", credentials: "same-origin", headers: { "Authorization": "Bearer " + session.access_token, "Accept": "application/json" } });
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

  const supabase = window.lasSupabase;
  const profileBox = $("#profile-details");
  const contributionBox = $("#contributions-list");
  const aidBox = $("#aid-list");
  const aidForm = $("#aid-form");
  const warnings = [];
  const memberId = currentProfile.member_id;

  if (memberId) {
    const memberResult = await supabase.from("members").select("name,phone,email,profession,birthdate,birthplace,address,joined_on,position,asbl_status,meeting_status,forum_status").eq("id", memberId).maybeSingle();
    if (memberResult.error) {
      renderError(profileBox, "Votre fiche membre n'est pas encore accessible. Les règles d'accès doivent être vérifiées avant d'afficher ces données.");
      warnings.push("La lecture du profil membre a échoué.");
    } else if (!memberResult.data) {
      renderError(profileBox, "Aucune fiche membre n'est associée à votre compte. Contactez l'équipe LAS.");
    } else {
      const m = memberResult.data; profileBox.replaceChildren();
      const fields = [["Nom", m.name], ["Téléphone", m.phone], ["E-mail", m.email], ["Profession", m.profession], ["Date de naissance", dateLabel(m.birthdate)], ["Lieu de naissance", m.birthplace], ["Adresse", m.address], ["Membre depuis", dateLabel(m.joined_on)], ["Fonction", m.position], ["Statut LAS", m.asbl_status], ["Participation aux réunions", m.meeting_status], ["Participation au forum", m.forum_status]];
      const dl = el("dl", undefined, "profile-list");
      fields.forEach(([label, value]) => { dl.append(el("dt", label)); dl.append(el("dd", value || "—")); }); profileBox.append(dl);
    }
    const contribResult = await loadList(contributionBox, supabase.from("monthly_contributions").select("contribution_year,contribution_month,amount,currency,paid_at,note").eq("member_id", memberId).order("contribution_year", { ascending: false }).order("contribution_month", { ascending: false }).limit(24), (target, rows) => {
      const sum = rows.reduce((total, row) => total + Number(row.amount || 0), 0);
      $("#contribution-summary").textContent = rows.length ? rows.length + " enregistrement(s) · total affiché : " + money(sum, rows[0]?.currency) : "Aucune cotisation enregistrée.";
      target.replaceChildren(table(["Période", "Montant", "Date", "Note"], rows.map(r => [String(r.contribution_month).padStart(2, "0") + "/" + r.contribution_year, money(r.amount, r.currency), dateLabel(r.paid_at), r.note || "—"])));
    }, "Impossible de lire vos cotisations. La politique RLS personnelle doit être activée.");
    if (contribResult.error) warnings.push("Les cotisations sont indisponibles jusqu'à activation des règles RLS personnelles.");
    const paymentResult = await supabase.from("member_payments").select("payment_year,payment_month,paid,updated_at").eq("member_id", memberId).order("payment_year", { ascending: false }).order("payment_month", { ascending: false }).limit(24);
    if (paymentResult.error) warnings.push("Le relevé mensuel des paiements n'est pas accessible avec les règles actuelles.");
    else if (paymentResult.data?.length) {
      contributionBox.append(el("h3", "Suivi mensuel"));
      contributionBox.append(table(["Mois", "État", "Mis à jour"], paymentResult.data.map(r => [String(r.payment_month).padStart(2, "0") + "/" + r.payment_year, r.paid ? "Payé" : "À payer", dateLabel(r.updated_at)])));
    }
    await loadList($("#tontine-list"), supabase.from("tontine_entries").select("amount,currency,status,paid_at,period:tontine_periods(title,starts_on,ends_on,status)").eq("member_id", memberId).order("created_at", { ascending: false }).limit(20), (target, rows) => {
      target.replaceChildren(table(["Période", "Montant", "État", "Paiement"], rows.map(r => [r.period?.title || "Période", money(r.amount, r.currency), r.status, dateLabel(r.paid_at)])));
    }, "Le module de tontine sera disponible après validation et application de la migration dédiée.");
    await loadList(aidBox, supabase.from("aid_requests").select("subject,status,created_at,decision_note").eq("member_id", memberId).order("created_at", { ascending: false }).limit(10), (target, rows) => {
      target.replaceChildren(table(["Demande", "État", "Envoyée le", "Réponse"], rows.map(r => [r.subject, r.status, dateLabel(r.created_at), r.decision_note || "En attente"])));
    }, "Le module d'entraide sera disponible après validation et application de la migration dédiée.");
  } else {
    renderError(profileBox, "Aucun identifiant de fiche membre n'est lié à ce compte. Demandez à un administrateur de rattacher le compte à une fiche existante.");
    $("#contribution-summary").textContent = "Compte non rattaché à une fiche membre.";
    renderError(contributionBox, "Les cotisations ne peuvent pas être filtrées sans identifiant de membre.");
    renderError($("#tontine-list"), "Le compte doit être lié à une fiche membre.");
    renderError(aidBox, "Le compte doit être lié à une fiche membre.");
    aidForm.hidden = true;
  }

  aidForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!memberId) return;
    const submit = aidForm.querySelector("button[type=submit]");
    submit.disabled = true; showMessage($("#aid-message"), "Envoi en cours…");
    const payload = { member_id: memberId, subject: $("#aid-subject").value.trim(), description: $("#aid-description").value.trim() };
    const { error } = await supabase.from("aid_requests").insert(payload);
    if (error) showMessage($("#aid-message"), "La demande n'a pas été enregistrée. Vérifiez que le module d'entraide et ses règles RLS sont actifs.");
    else { aidForm.reset(); showMessage($("#aid-message"), "Votre demande a été envoyée à l'équipe habilitée.", true); await loadList(aidBox, supabase.from("aid_requests").select("subject,status,created_at,decision_note").eq("member_id", memberId).order("created_at", { ascending: false }).limit(10), (target, rows) => target.replaceChildren(table(["Demande", "État", "Envoyée le", "Réponse"], rows.map(r => [r.subject, r.status, dateLabel(r.created_at), r.decision_note || "En attente"])))); }
    submit.disabled = false;
  });

  if (adminPanel.hidden === false) {
    const paymentsTarget = $("#admin-payments");
    const adminPayments = await supabase.from("member_payments").select("id,member_id,payment_year,payment_month,paid,updated_at").order("payment_year", { ascending: false }).order("payment_month", { ascending: false }).limit(100);
    if (adminPayments.error) renderError(paymentsTarget, "Lecture des paiements refusée ou indisponible.");
    else {
      const memberIds = [...new Set(adminPayments.data.map(r => r.member_id))];
      let names = {};
      if (memberIds.length) {
        const membersResult = await supabase.from("members").select("id,name").in("id", memberIds);
        if (!membersResult.error) names = Object.fromEntries(membersResult.data.map(m => [m.id, m.name]));
      }
      paymentsTarget.replaceChildren(table(["Membre", "Mois", "État", "Mis à jour"], adminPayments.data.map(r => [names[r.member_id] || ("Membre #" + r.member_id), String(r.payment_month).padStart(2, "0") + "/" + r.payment_year, r.paid ? "Payé" : "À payer", dateLabel(r.updated_at)])));
    }
    await loadList($("#admin-aid"), supabase.from("aid_requests").select("id,subject,status,created_at").order("created_at", { ascending: false }).limit(50), (target, rows) => {
      const wrap = el("div");
      rows.forEach(r => {
        const item = el("div", undefined, "admin-aid-item");
        item.append(el("strong", r.subject), el("p", "État : " + r.status + " · " + dateLabel(r.created_at), "muted"));
        const select = el("select"); select.setAttribute("aria-label", "Modifier l'état de la demande " + r.subject);
        [["submitted","Soumise"],["under_review","En cours"],["approved","Approuvée"],["declined","Refusée"],["closed","Clôturée"]].forEach(([value,label])=>{const opt=el("option",label);opt.value=value;opt.selected=value===r.status;select.append(opt);});
        const note = el("input"); note.placeholder = "Note de décision (facultatif)"; note.maxLength = 1000; note.setAttribute("aria-label","Note de décision");
        const save = el("button","Enregistrer","button button-small");
        save.addEventListener("click", async()=>{save.disabled=true;const {error}=await supabase.from("aid_requests").update({status:select.value,decision_note:note.value.trim()||null,decided_by:currentUser.id,decided_at:new Date().toISOString()}).eq("id",r.id);save.disabled=false;if(error){showMessage(warning,"Modification refusée par la base. Vérifiez les autorisations du rôle.");}else{showMessage(warning,"Demande mise à jour.");}});
        item.append(select,note,save);wrap.append(item);
      });
      target.replaceChildren(wrap);
    }, "La file d'entraide sera disponible après activation du module et des politiques RLS.");
  }
  warning.textContent = warnings.length ? warnings.join(" ") : "Les données sont demandées à Supabase. Les modules dont la migration n'est pas appliquée restent indisponibles sans exposer d'informations privées.";
});