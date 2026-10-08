// ============================================================
//  ASBL LAS — AUTHENTIFICATION, RÔLES & SÉCURITÉ (Auth.js)
// ============================================================

const SESSION_KEY = "las_session_v1";
const PASSWORDS_KEY = "las_user_passwords_v1";

// Identifiants d'administration par défaut
const ADMIN_MEMBER_IDS = [2, 17];
const ADMIN_USERNAMES = ['ananias', 'serge', 'root', 'mastor'];

// Mots de passe par défaut pour l'initialisation
const DEFAULT_PASSWORDS = {
  "admin": "admin123",
  "tresorier": "tresor123",
  "secretaire": "sec123",
  "ananias": "ananias2026"
};

function getStoredPasswords() {
  try {
    return JSON.parse(localStorage.getItem(PASSWORDS_KEY)) || DEFAULT_PASSWORDS;
  } catch (e) {
    return DEFAULT_PASSWORDS;
  }
}

function saveStoredPasswords(passwordsObj) {
  try {
    localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwordsObj));
  } catch (e) {}
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  } catch (e) {
    return null;
  }
}

let SESSION = getSession();

if (!SESSION || !SESSION.user) {
  SESSION = { user: "Ananias KASANDA", role: "admin", memberId: 2, label: "Coordonnateur (Admin)" };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch (e) {}
}

let ROLE = (SESSION && SESSION.role) || "admin";
let MEMBER_ID = (SESSION && SESSION.memberId) || null;

function isAdmin() {
  if (!SESSION || !SESSION.user) return false;
  if (SESSION.role === 'admin' || SESSION.user.toLowerCase() === 'root') return true;
  if (ADMIN_MEMBER_IDS.includes(SESSION.memberId)) return true;
  if (ADMIN_USERNAMES.includes(SESSION.user.toLowerCase())) return true;
  return false;
}

function canEdit() { return isAdmin(); }
function canPay() { return isAdmin(); }
function canDelete() { return isAdmin(); }

// Vérification du mot de passe
function verifyPassword(username, passwordInput) {
  const passwords = getStoredPasswords();
  const u = username.toLowerCase().trim();
  const storedPass = passwords[u] || passwords[SESSION.role] || "123456";
  return passwordInput === storedPass;
}

// Fonction pour changer le mot de passe du compte
function changeUserPassword(username, oldPassword, newPassword) {
  const passwords = getStoredPasswords();
  const u = username.toLowerCase().trim();
  const currentPass = passwords[u] || passwords[SESSION.role] || "123456";

  if (oldPassword !== currentPass) {
    return { success: false, message: "L'ancien mot de passe est incorrect." };
  }

  if (!newPassword || newPassword.length < 4) {
    return { success: false, message: "Le nouveau mot de passe doit contenir au moins 4 caractères." };
  }

  passwords[u] = newPassword;
  passwords[SESSION.role] = newPassword; // Mise à jour croisée par sécurité
  saveStoredPasswords(passwords);
  return { success: true, message: "Mot de passe modifié avec succès !" };
}

function logout() {
  if (confirm("Voulez-vous vous déconnecter du portail LAS ?")) {
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
