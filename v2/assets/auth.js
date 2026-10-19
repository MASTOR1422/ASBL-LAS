document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#login-form");
  const button = document.querySelector("#submit-button");
  const message = document.querySelector("#login-message");
  const forgot = document.querySelector("#forgot-button");
  const say = (text, ok = false) => {
    message.textContent = text;
    message.classList.toggle("success", ok);
  };

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    say("");
    button.disabled = true;
    button.textContent = "Connexion…";
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          username: String(form.elements.username.value || "").trim().toLowerCase(),
          password: String(form.elements.password.value || "")
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.user) throw new Error(data.message || "Connexion refusée.");
      window.location.assign("/espace.html");
    } catch (error) {
      say(error.message || "Connexion impossible.");
    } finally {
      button.disabled = false;
      button.textContent = "Se connecter";
    }
  });

  forgot?.addEventListener("click", () => {
    say("La récupération automatique par e-mail n’est pas configurée dans le mode SQLite local. Contactez l’administrateur pour réinitialiser le mot de passe.");
  });
});
