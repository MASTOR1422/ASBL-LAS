document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#reset-form");
  const message = document.querySelector("#reset-message");
  const button = document.querySelector("#save-button");
  const say = (text, ok = false) => {
    message.textContent = text;
    message.classList.toggle("success", ok);
  };
  const token = new URLSearchParams(window.location.search).get("token") || "";
  if (!token || token.length > 200) {
    say("Le lien de récupération est absent ou invalide. Retournez à la connexion pour demander un nouveau lien.");
    if (button) button.disabled = true;
    return;
  }
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.querySelector("#new-password").value;
    const confirm = document.querySelector("#confirm-password").value;
    if (password.length < 12) return say("Le mot de passe doit contenir au moins 12 caractères.");
    if (password.length > 1024) return say("Le mot de passe est trop long.");
    if (password !== confirm) return say("Les deux mots de passe ne correspondent pas.");
    button.disabled = true;
    button.textContent = "Enregistrement…";
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Impossible de réinitialiser le mot de passe.");
      say(data.message || "Mot de passe modifié. Connectez-vous.", true);
      form.reset();
      window.setTimeout(() => window.location.replace("/v2/login.html"), 1600);
    } catch (error) {
      say(error.message || "Impossible de réinitialiser le mot de passe.");
    } finally {
      button.disabled = false;
      button.textContent = "Enregistrer le mot de passe";
    }
  });
});
