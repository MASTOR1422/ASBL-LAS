/* ASBL LAS — Authentification Supabase via identifiant public + mot de passe.
 * Les mots de passe et clés secrètes ne sont jamais stockés dans le navigateur.
 */
const SESSION_KEY = "las_session_v1";
let SESSION = null;
let ROLE = null;
let MEMBER_ID = null;
let LAS_AUTH_READY = false;

function lasIsConfigured() {
  return !!(window.lasSupabase && window.LAS_SUPABASE_CONFIG &&
    window.LAS_SUPABASE_CONFIG.url && window.LAS_SUPABASE_CONFIG.publishableKey &&
    !window.LAS_SUPABASE_CONFIG.url.includes("VOTRE-PROJET") &&
    !window.LAS_SUPABASE_CONFIG.publishableKey.includes("REMPLACER"));
}
function isAdmin() { return !!SESSION && ROLE === "admin"; }
function canEdit() { return isAdmin() || ROLE === "secretaire"; }
function canPay() { return isAdmin() || ROLE === "tresorier"; }
function canDelete() { return isAdmin(); }

async function initAuth() {
  const clearAuthState = () => { SESSION = null; ROLE = null; MEMBER_ID = null; LAS_AUTH_READY = false; };
  try {
    try { await window.LAS_SUPABASE_READY; } catch (_) {
      clearAuthState();
      return { success: false, reason: "not-configured", message: "La configuration Supabase n’est pas disponible. Contactez l’administrateur." };
    }
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    if (!lasIsConfigured() || !window.lasSupabase?.auth) {
      clearAuthState();
      return { success: false, reason: "not-configured", message: "La connexion sécurisée n’est pas configurée." };
    }
    let authResult;
    try { authResult = await window.lasSupabase.auth.getSession(); } catch (_) {
      clearAuthState();
      return { success: false, reason: "session-check-failed", message: "La vérification de la session a échoué. Reconnectez-vous." };
    }
    const session = authResult?.data?.session;
    if (authResult?.error || !session?.user) { clearAuthState(); return { success: false, reason: "not-authenticated" }; }

    let profileResult;
    try {
      profileResult = await window.lasSupabase.from("profiles")
        .select("role, member_id, display_name, active").eq("id", session.user.id).single();
    } catch (_) {
      try { await window.lasSupabase.auth.signOut(); } catch (_) {}
      clearAuthState();
      return { success: false, reason: "profile-unavailable", message: "Impossible de vérifier votre profil d’accès. Contactez l’administrateur LAS." };
    }
    const profile = profileResult?.data;
    if (profileResult?.error || !profile || profile.active !== true) {
      try { await window.lasSupabase.auth.signOut(); } catch (_) {}
      clearAuthState();
      return { success: false, reason: "profile-unavailable", message: "Compte non activé ou profil d’accès indisponible. Contactez l’administrateur LAS." };
    }
    if (!["admin", "tresorier", "secretaire", "membre"].includes(profile.role)) {
      try { await window.lasSupabase.auth.signOut(); } catch (_) {}
      clearAuthState();
      return { success: false, reason: "invalid-role", message: "Rôle non autorisé. Contactez l’administrateur LAS." };
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
  } catch (e) {
    try { if (window.lasSupabase?.auth) await window.lasSupabase.auth.signOut(); } catch (_) {}
    clearAuthState();
    console.error("Erreur pendant la vérification d’authentification LAS:", e);
    return { success: false, reason: "auth-error", message: "Vérification de connexion impossible. Veuillez vous reconnecter." };
  }
}

async function signIn(username, password) {
  try { await window.LAS_SUPABASE_READY; } catch (_) {
    return { success: false, message: "La configuration Supabase n’est pas disponible. Contactez l’administrateur." };
  }
  if (!lasIsConfigured()) return { success: false, message: "Le service de connexion n’est pas configuré." };
  const identifier = String(username || "").trim().toLowerCase();
  const secret = String(password || "");
  if (!identifier || !secret) return { success: false, message: "Saisissez votre identifiant et votre mot de passe." };
  try {
    const response = await fetch("/api/auth/username-login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identifier, password: secret })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token || !result.refresh_token) {
      return { success: false, message: result.message || "Identifiant ou mot de passe incorrect." };
    }
    const { error } = await window.lasSupabase.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token
    });
    if (error) return { success: false, message: "Connexion refusée. Réessayez." };
    const checked = await initAuth();
    if (!checked.success) {
      await window.lasSupabase.auth.signOut();
      return { success: false, message: checked.message || "Compte non autorisé. Contactez l’administrateur LAS." };
    }
    return { success: true, session: checked.session };
  } catch (_) {
    return { success: false, message: "Service de connexion temporairement indisponible. Réessayez plus tard." };
  }
}

async function requestPasswordReset(username) {
  const identifier = String(username || "").trim().toLowerCase();
  if (!identifier) return { success: false, message: "Saisissez votre nom d’utilisateur." };
  try {
    const response = await fetch("/api/auth/recover", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: identifier })
    });
    // Toujours afficher un message neutre afin de ne pas révéler si un compte existe.
    if (!response.ok) return { success: false, message: "Demande impossible pour le moment. Réessayez plus tard ou contactez l’administrateur." };
    return { success: true, message: "Si cet identifiant est enregistré, un e-mail de récupération sera envoyé à l’adresse associée." };
  } catch (_) {
    return { success: false, message: "Service de récupération temporairement indisponible. Réessayez plus tard." };
  }
}

async function changeUserPassword(_username, oldPassword, newPassword) {
  if (!LAS_AUTH_READY || !window.lasSupabase) return { success: false, message: "Session expirée. Reconnectez-vous." };
  if (!newPassword || newPassword.length < 12) return { success: false, message: "Utilisez au moins 12 caractères pour le nouveau mot de passe." };
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
