// ============================================================
//  ASBL LAS — GESTION DES IDENTIFIANTS, AUTHENTIFICATION ET RÔLES (auth.js)
// ============================================================

const SESSION_KEY = "las_session_v1";

const ADMIN_MEMBER_IDS = [2, 17];

function getSession(){
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  } catch(e){
    return null;
  }
}

let SESSION = getSession();

if (!SESSION || !SESSION.user){
  SESSION = { user: "Ananias KASANDA", role: "admin", memberId: 2, label: "Coordonnateur (Admin)" };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch(e){}
}

let ROLE = (SESSION && SESSION.role) || "admin";
let MEMBER_ID = (SESSION && SESSION.memberId) || null;

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
    window.location.reload();
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
