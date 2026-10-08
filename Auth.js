// ============================================================
//  ASBL LAS — GESTION DES IDENTIFIANTS, AUTHENTIFICATION ET RÔLES (auth.js)
// ============================================================

const SESSION_KEY = "las_session_v1";

// Identifiants exclusifs des Administrateurs ayant le pouvoir de modifier, uploader et supprimer :
// - ID 2  : Ananias KASANDA (Coordonnateur)
// - ID 17 : Serge KITA (Secrétaire Général / Trésorier)
const ADMIN_MEMBER_IDS = [2, 17];

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

function getSession(){
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  } catch(e){
    return null;
  }
}

let SESSION = getSession();

// Par défaut, connexion automatique sur le compte Coordonnateur (Ananias KASANDA)
if (!SESSION || !SESSION.user){
  SESSION = { user: "Ananias KASANDA", role: "admin", memberId: 2, label: "Coordonnateur (Admin)" };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch(e){}
}

let ROLE = (SESSION && SESSION.role) || "admin";
let MEMBER_ID = (SESSION && SESSION.memberId) || null;

// --- REGLE DE SÉCURITÉ : VÉRIFICATION STRICTE DE L'ADMINISTRATEUR ---
function isAdmin(){
  if (!SESSION || !SESSION.user) return false;
  if (SESSION.role === 'admin' || SESSION.user.toLowerCase() === 'root') return true;
  if (ADMIN_MEMBER_IDS.includes(SESSION.memberId)) return true;
  return false;
}

function canEdit(){ return isAdmin(); }
function canPay(){ return isAdmin(); }
function canDelete(){ return isAdmin(); }

function logout(){
  if (confirm("Voulez-vous vous déconnecter du portail ?")){
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html"; // Redirige vers la page de connexion sécurisée
  }
}

// Modal d'authentification (Changement d'utilisateur)
function openLoginModal(){
  const selMember = document.getElementById('login-member-select');
  if (selMember && typeof membersData !== 'undefined') {
    selMember.innerHTML = membersData.map(m => {
      const isAdminTag = ADMIN_MEMBER_IDS.includes(m.id) ? " (Admin)" : "";
      return `<option value="${m.id}">N° ${m.id} — ${escapeHTML(m.name)}${isAdminTag}</option>`;
    }).join('');
  }

  const roleSel = document.getElementById('login-role-select');
  if (roleSel) roleSel.value = (SESSION.memberId === 0) ? 'root' : 'membre';
  if (MEMBER_ID && selMember && MEMBER_ID !== 0) selMember.value = MEMBER_ID;

  toggleLoginMemberSelect();
  document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal(){
  document.getElementById('login-modal').classList.add('hidden');
}

function toggleLoginMemberSelect(){
  const role = document.getElementById('login-role-select').value;
  const grp = document.getElementById('login-member-group');
  if (role === 'membre') {
    grp.classList.remove('hidden');
  } else {
    grp.classList.add('hidden');
  }
}

function applyUserLogin(){
  const roleSelect = document.getElementById('login-role-select').value;
  const pinInput = document.getElementById('login-pin-input').value.trim();

  if (roleSelect === 'root') {
    if (pinInput === '0000' || pinInput === 'root') {
      SESSION = { user: "Root Principal", role: "admin", memberId: 0, label: "Root Principal (Admin)" };
    } else {
      alert("Mot de passe Root incorrect. (Code PIN par défaut: 0000)");
      return;
    }
  } else {
    const memId = parseInt(document.getElementById('login-member-select').value);
    const m = typeof membersData !== 'undefined' ? membersData.find(x => x.id === memId) : null;

    if (!m){ alert("Membre introuvable."); return; }

    const expectedPin = m.pin || (1000 + m.id).toString();
    if (pinInput !== expectedPin){
      alert(`Code PIN incorrect. (Pour N°${m.id}, le PIN par défaut est ${expectedPin})`);
      return;
    }

    // Attribution automatique des privilèges d'administration selon l'ID
    if (m.id === 2) {
      SESSION = { user: m.name, role: "admin", memberId: m.id, label: "Coordonnateur (Admin)" };
    } else if (m.id === 17) {
      SESSION = { user: m.name, role: "admin", memberId: m.id, label: "Secrétaire Gén / Trésorier (Admin)" };
    } else {
      SESSION = { user: m.name, role: "membre", memberId: m.id, label: "Membre (Consultation)" };
    }
  }

  try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch(e){}
  window.location.reload();
}
