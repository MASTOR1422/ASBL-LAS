# Raccordement du `index.html` actuel à Supabase

## État actuel observé
- `Auth.js` est référencé dans le `<head>` mais n'a pas été fourni.
- Les données membres sont chargées depuis `localStorage` avec la clé `las_members_v2`.
- Les médias sont chargés depuis `localStorage` avec la clé `las_media_v1`.
- `saveData()` et `saveMediaStorage()` enregistrent localement et les erreurs médias sont silencieuses.
- Le code contient `DEFAULT_MEMBERS`; retirez toutes les données personnelles de ce tableau avant publication.

## Plan de modification minimal

1. Ajouter les scripts Supabase et le fichier de configuration.
2. Créer `login.html`.
3. Protéger `index.html` par `auth-guard.js` et attendre `las:ready`.
4. Supprimer l'authentification locale en double (à confirmer en inspectant `Auth.js`).
5. Créer une couche `las-repository.js` avec des fonctions `listMembers`, `createMember`, `updateMember`, `deleteMember`, `listContributions`, `markMonthPaid`, `listMedia`, `createMedia`, `deleteMedia`.
6. Faire évoluer les fonctions de rendu pour consommer les données chargées de façon asynchrone.
7. Remplacer les appels synchrones à `saveData()` par `await` sur les fonctions Supabase et afficher une erreur si l'opération échoue.
8. Modifier le modèle : la fiche membre n'embarque plus `payments[year]`; chaque mois payé est une ligne dans `monthly_contributions`.
9. Remplacer les photos Base64 par des objets dans un bucket privé Supabase Storage.
10. Ajouter une vérification du rôle aux boutons pour l'expérience utilisateur, mais compter sur RLS pour la vraie autorisation.

## Exemple de lecture des membres

```js
async function listMembers() {
  const { data, error } = await window.lasSupabase
    .from("members")
    .select("*")
    .order("id");
  if (error) throw error;
  return data;
}
```

## Exemple d'enregistrement d'une cotisation mensuelle

```js
async function markMonthPaid(memberId, year, month, amount = 10) {
  const { data: userData, error: userError } =
    await window.lasSupabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Session expirée.");

  const { data, error } = await window.lasSupabase
    .from("monthly_contributions")
    .upsert({
      member_id: memberId,
      contribution_year: year,
      contribution_month: month,
      amount,
      currency: "USD",
      recorded_by: userData.user.id
    }, { onConflict: "member_id,contribution_year,contribution_month" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

Cette opération est protégée par la politique RLS du rôle `treasurer` ou `admin`. Le bouton seul ne constitue jamais une protection.
