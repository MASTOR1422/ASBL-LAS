// ============================================================
//  ASBL LAS — GESTION CENTRALISÉE DE L'AUTHENTIFICATION (Auth.js)
// ============================================================

const SESSION_KEY = "las_session_v1";
const ADMIN_USERNAMES = ['ananias', 'serge', 'root', 'mastor'];

function getSession(){
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  } catch(e){
    return null;
  }
}

let SESSION = getSession();

function checkAuthGuard(requireLogin = true) {
  SESSION = getSession();
  const isLoginPage = window.location.pathname.includes('login.html');
  
  if ((!SESSION || !SESSION.user) && requireLogin && !isLoginPage) {
    window.location.replace("login.html");
    return false;
  }
  if (SESSION && SESSION.user && isLoginPage) {
    window.location.replace("index.html");
    return false;
  }
  return true;
}

function getUserRole() {
  return SESSION ? (SESSION.role || 'membre') : 'invite';
}

function isAdmin() {
  const role = getUserRole();
  return role === 'admin' || (SESSION && ADMIN_USERNAMES.includes((SESSION.user || '').toLowerCase()));
}

function canEdit() {
  const role = getUserRole();
  return role === 'admin' || role === 'secretaire';
}

function canPay() {
  const role = getUserRole();
  return role === 'admin' || role === 'tresorier';
}

function canDelete() {
  return isAdmin();
}

function logout() {
  if (confirm("Voulez-vous vous déconnecter de la plateforme LAS ?")) {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("login.html");
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
