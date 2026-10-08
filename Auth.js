// ============================================================
//  ASBL LAS — GESTION EXCLUSIVE DES IDENTIFIANTS ET RÔLES (auth.js)
// ============================================================

const SESSION_KEY = "las_session_v2";

// Liste stricte des ID Membres administrateurs (Ananias KASANDA: ID 2, Serge KITA: ID 17)
const ADMIN_MEMBER_IDS = [2, 17];

function getSession(){
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "null");
  } catch(e){
    return null;
  }
}

let SESSION = getSession();

// Par défaut, si aucune session valide n'est trouvée, connexion Coordonnateur (Ananias KASANDA)
if (!SESSION || !SESSION.user){
  SESSION = { user: "Ananias KASANDA", role: "admin", memberId: 2, label: "Coordonnateur (Admin)" };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch(e){}
}

let ROLE = (SESSION && SESSION.role) || "admin";
let MEMBER_ID = (SESSION && SESSION.memberId) || 2;

// Vérification stricte des droits d'administration
function isAdmin(){
  if (!SESSION || !SESSION.memberId) return false;
  return ADMIN_MEMBER_IDS.includes(SESSION.memberId);
}

function canEdit(){ return isAdmin(); }
function canPay(){ return isAdmin(); }
function canDelete(){ return isAdmin(); }

// Action sur le bouton "Quitter" : Réinitialise la session et réouvre la modale de connexion
function logout(){
  if (confirm("Voulez-vous vous déconnecter du portail ?")){
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    SESSION = null;
    openLoginModal();
  }
}

// Extraction du premier prénom en minuscule
function extractFirstName(fullName){
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Génération de l'identifiant et du mot de passe
function getCredentialsForMember(m){
  const username = extractFirstName(m.name);
  const password = username + "2026";
  return { username, password };
}

// Modal d'authentification
function openLoginModal(){
  const userInput = document.getElementById('login-username-input');
  const passInput = document.getElementById('login-pass-input');

  // Purge et effacement strict des champs de saisie
  if (userInput) userInput.value = "";
  if (passInput) passInput.value = "";

  const selMember = document.getElementById('login-member-select');
  if (selMember && typeof membersData !== 'undefined') {
    selMember.innerHTML = membersData.map(m => {
      const creds = getCredentialsForMember(m);
      const isAdminTag = ADMIN_MEMBER_IDS.includes(m.id) ? " [ADMIN]" : "";
      return `<option value="${m.id}">N° ${m.id} — ${escapeHTML(m.name)}${isAdminTag} (Login: ${creds.username})</option>`;
    }).join('');
    
    if (MEMBER_ID) selMember.value = MEMBER_ID;
  }

  document.getElementById('login-modal').classList.remove('hidden');
}

function closeLoginModal(){
  if (!SESSION || !SESSION.user) {
    alert("Veuillez vous connecter pour accéder à l'application.");
    return;
  }
  document.getElementById('login-modal').classList.add('hidden');
}

function onMemberSelectChange(){
  const selMember = document.getElementById('login-member-select');
  const userInput = document.getElementById('login-username-input');
  const passInput = document.getElementById('login-pass-input');
  
  if (userInput) userInput.value = "";
  if (passInput) passInput.value = "";

  if (selMember && typeof membersData !== 'undefined') {
    const memId = parseInt(selMember.value);
    const m = membersData.find(x => x.id === memId);
    if (m && userInput) {
      const creds = getCredentialsForMember(m);
      userInput.placeholder = `Identifiant ex: ${creds.username}`;
    }
  }
}

function applyUserLogin(){
  const userInput = document.getElementById('login-username-input').value.trim().toLowerCase();
  const passInput = document.getElementById('login-pass-input').value.trim();
  const memId = parseInt(document.getElementById('login-member-select').value);

  if (typeof membersData === 'undefined') {
    alert("Base de données indisponible.");
    return;
  }

  const m = membersData.find(x => x.id === memId);
  if (!m) {
    alert("Membre sélectionné introuvable.");
    return;
  }

  const creds = getCredentialsForMember(m);

  if (userInput !== creds.username) {
    alert(`Identifiant incorrect pour ${m.name}. L'identifiant attendu est son prénom en minuscules : "${creds.username}"`);
    return;
  }

  if (passInput !== creds.password) {
    alert(`Mot de passe incorrect. Le mot de passe par défaut est : "${creds.password}"`);
    return;
  }

  // Attribution des rôles
  if (ADMIN_MEMBER_IDS.includes(m.id)) {
    const labelRole = (m.id === 2) ? "Coordonnateur (Admin)" : "Secrétaire Général / Trésorier (Admin)";
    SESSION = { user: m.name, role: "admin", memberId: m.id, label: labelRole };
  } else {
    SESSION = { user: m.name, role: "membre", memberId: m.id, label: "Membre (Consultation)" };
  }

  try { localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); } catch(e){}

  // Purge immédiate des zones de saisie après validation
  document.getElementById('login-username-input').value = "";
  document.getElementById('login-pass-input').value = "";

  closeLoginModal();
  window.location.reload();
}
