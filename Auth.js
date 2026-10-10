/* ASBL LAS — Authentification Supabase. Aucun mot de passe ni rôle n'est stocké dans le navigateur. */
const SESSION_KEY = "las_session_v1"; // clé historique, uniquement supprimée lors de la migration
let SESSION = null;
let ROLE = null;
let MEMBER_ID = null;
let LAS_AUTH_READY = false;

function lasIsConfigured() {
  return !!(window.lasSupabase && window.LAS_SUPABASE_CONFIG &&
    window.LAS_SUPABASE_CONFIG.url &&
    window.LAS_SUPABASE_CONFIG.publishableKey &&
    !window.LAS_SUPABASE_CONFIG.url.includes("VOTRE-PROJET") &&
    !window.LAS_SUPABASE_CONFIG.publishableKey.includes("REMPLACER"));
}

function isAdmin() { return !!SESSION && ROLE === "admin"; }
function canEdit() { return isAdmin() || ROLE === "secretaire"; }
function canPay() { return isAdmin() || ROLE === "tresorier"; }
function canDelete() { return isAdmin(); }

async function initAuth() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}
  if (!lasIsConfigured()) {
    return { success: false, reason: "not-configured", message: "La connexion sécurisée n’est pas encore configurée. Consultez SECURITY_SETUP.md." };
  }
  const { data: { session }, error } = await window.lasSupabase.auth.getSession();
  if (error || !session || !session.user) {
    SESSION = null; ROLE = null; MEMBER_ID = null; LAS_AUTH_READY = false;
    return { success: false, reason: "not-authenticated" };
  }
  const { data: profile, error: profileError } = await window.lasSupabase
    .from("profiles")
    .select("role, member_id, display_name, active")
    .eq("id", session.user.id)
    .single();
  if (profileError || !profile || profile.active !== true) {
    await window.lasSupabase.auth.signOut();
    SESSION = null; ROLE = null; MEMBER_ID = null; LAS_AUTH_READY = false;
    return { success: false, reason: "profile-unavailable", message: "Compte non activé ou profil d’accès indisponible. Contactez l’administrateur LAS." };
  }
  if (!["admin", "tresorier", "secretaire", "membre"].includes(profile.role)) {
    await window.lasSupabase.auth.signOut();
    return { success: false, reason: "invalid-role" };
  }
  ROLE = profile.role;
  MEMBER_ID = profile.member_id || null;
  SESSION = {
    user: profile.display_name || session.user.email || "Membre LAS",
    role: profile.role,
    memberId: MEMBER_ID,
    label: ({admin:"Coordonnateur (Admin)",tresorier:"Trésorier",secretaire:"Secrétaire",membre:"Membre"})[profile.role],
    email: session.user.email || ""
  };
  LAS_AUTH_READY = true;
  return { success: true, session: SESSION };
}

async function signIn(usernameOrEmail, password) {
  if (!lasIsConfigured()) {
    return { success: false, message: "Le service de connexion n’est pas configuré. Renseignez supabase-config.js puis appliquez supabase/schema.sql." };
  }
  const identifier = String(usernameOrEmail || "").trim();
  const secret = String(password || "");
  if (!identifier || !secret) return { success: false, message: "Saisissez votre identifiant et votre mot de passe." };
  // Supabase Auth utilise l'e-mail comme identifiant. Aucun compte de secours n'est créé côté navigateur.
  const { data, error } = await window.lasSupabase.auth.signInWithPassword({ email: identifier, password: secret });
  if (error || !data || !data.user) return { success: false, message: "Identifiant ou mot de passe incorrect." };
  const result = await initAuth();
  if (!result.success) {
    await window.lasSupabase.auth.signOut();
    return { success: false, message: result.message || "Compte non autorisé. Contactez l’administrateur LAS." };
  }
  return { success: true, session: result.session };
}

async function changeUserPassword(_username, oldPassword, newPassword) {
  if (!LAS_AUTH_READY || !window.lasSupabase) return { success: false, message: "Session expirée. Reconnectez-vous." };
  if (!newPassword || newPassword.length < 12) return { success: false, message: "Utilisez au moins 12 caractères pour le nouveau mot de passe." };
  const { error: verifyError } = await window.lasSupabase.auth.signInWithPassword({
    email: SESSION.email,
    password: oldPassword
  });
  if (verifyError) return { success: false, message: "L’ancien mot de passe est incorrect." };
  const { error } = await window.lasSupabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, message: "Modification impossible : " + error.message };
  return { success: true, message: "Mot de passe modifié avec succès." };
}

async function logout() {
  if (!confirm("Voulez-vous vous déconnecter du portail LAS ?")) return;
  if (window.lasSupabase) await window.lasSupabase.auth.signOut();
  SESSION = null; ROLE = null; MEMBER_ID = null; LAS_AUTH_READY = false;
  window.location.replace("login.html");
}

function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
