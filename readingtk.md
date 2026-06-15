# ReadingTK — Documentation projet

Application web de suivi de lecture (manga, manhwa, manhua, novel).  
**URL live :** [readingtk.net](https://readingtk.net)  
**Dépôt git :** branche `main`  
**Déploiement :** Vercel uniquement (`vercel --prod`)

---

## Versioning

La version affichée dans le footer (`src/routes/index.tsx`) suit ce format : **v1.00, v1.01, v1.02…**

**Règle :** à chaque commit, incrémenter la version de **+0.01**.  
Exemple : v1.00 → v1.01 → v1.02 → … → v1.09 → v1.10 → etc.

La version est écrite en dur dans le footer : `<span>ReadingTK vX.XX</span>`

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | TanStack Start (React 19) |
| Routing | TanStack Router (`@tanstack/react-router`) |
| State serveur | TanStack Query (`@tanstack/react-query`) |
| Base de données | Supabase (PostgreSQL + RLS) |
| UI | Radix UI + Tailwind CSS v4 + Lucide icons |
| Toasts | Sonner |
| Build | Vite 7 |

---

## Structure des fichiers clés

```
src/
├── i18n/
│   └── index.tsx          ← Dictionnaires FR/EN + LanguageProvider + useI18n()
├── integrations/
│   └── supabase/
│       └── client.ts      ← Instance Supabase (supabase)
├── routes/
│   ├── __root.tsx
│   ├── index.tsx          ← Landing page
│   ├── auth.tsx           ← Page connexion/inscription
│   ├── callback.tsx       ← OAuth callback
│   └── _authenticated/
│       ├── route.tsx      ← Layout sidebar (AuthedLayout)
│       ├── dashboard.tsx  ← Bibliothèque + volet droit (TitleDrawer)
│       ├── calendar.tsx   ← Calendrier hebdomadaire
│       ├── notifications.tsx
│       ├── sites.tsx      ← Gestion des sites à scraper
│       ├── settings.tsx
│       ├── import.tsx     ← Import bookmarks HTML
│       ├── export.tsx     ← Export bookmarks HTML
│       └── titles.add.tsx ← Ajout de titres
```

---

## Internationalisation (i18n)

**Fichier :** `src/i18n/index.tsx`

```tsx
import { useI18n, LanguageSwitcher, typeLabel, statusLabel } from "@/i18n";

const { t, lang } = useI18n();
t("nav.library")                     // → "Bibliothèque" ou "Library"
t("dash.titleCount", { n: 5, total: 42 })  // interpolation {var}
typeLabel(t, "manhwa")               // → "manhwa"
statusLabel(t, "ongoing")            // → "en cours" ou "ongoing"
```

**Langues :** `fr` (défaut) et `en`  
**Persistence :** `localStorage.getItem("rtk-lang")`  
**Détection automatique :** navigator.language si pas de valeur sauvegardée

### Ajouter une clé i18n
1. Dans `src/i18n/index.tsx`, ajouter la clé dans `const fr: Dict = { ... }` ET dans `const en: Dict = { ... }`
2. Utiliser `t("ma.cle")` dans les composants

---

## TanStack Query — clés de cache

| Clé | Contenu |
|---|---|
| `["titles"]` | Liste complète des titres |
| `["title-detail", titleId]` | Détail d'un titre (drawer droit) |
| `["notifications"]` | Liste des notifications |
| `["notifications-unread"]` | Compteur non lus (badge sidebar) |

**Règle :** après toute mutation qui modifie un titre, invalider `["titles"]` ET `["title-detail", titleId]` pour que le dashboard ET le volet droit se mettent à jour.

```tsx
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["titles"] });
  qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
},
```

---

## localStorage — clés persistées

| Clé | Valeur | Usage |
|---|---|---|
| `sidebar-collapsed` | `"true"` / `"false"` | État ouvert/fermé de la sidebar |
| `rtk-lang` | `"fr"` / `"en"` | Langue de l'interface |
| `dash-sort-col` | `SortBy` string ou null | Colonne de tri actif du dashboard |
| `dash-sort-dir` | `"asc"` / `"desc"` | Direction du tri du dashboard |

---

## Tables Supabase principales

| Table | Description |
|---|---|
| `titles` | Titres (name, type, status, variants…) |
| `reading_progress` | Progression par titre/utilisateur (last_chapter_read) |
| `sources` | Sources de lecture par titre (url, priority, last_seen_chapter…) |
| `chapters` | Chapitres détectés (chapter_label, chapter_url) |
| `notifications` | Notifications (user_id, read_at, title_id, chapter_id) |
| `calendar_entries` | Entrées calendrier (title_id, name, day_of_week, time_minutes) |
| `sites` | Sites scraping (name, base_url, priority, enabled, template_url) |
| `user_settings` | Paramètres utilisateur |

---

## Dashboard (`/dashboard`)

### Filtres disponibles
- **Type :** `all`, `manga`, `manhua`, `manhwa`, `novel`, `autre`
- **Statut :** `all`, `ongoing`, `paused`, `dropped`, `completed`

### Colonnes triables
- `title` — alphabétique
- `read` — dernier chapitre lu (numérique)
- `detected` — badge NEW en premier, puis alphabétique par titre

### Tri "Détecté"
```tsx
// NEW badge = chapitre détecté > chapitre lu
const isNew = lastSeen != null && (!lastRead || parseFloat(lastSeen) > parseFloat(lastRead || "0"));
// Tri : NEW d'abord, puis alphabétique
if (isNewA !== isNewB) cmp = isNewA ? -1 : 1;
else cmp = a.name.localeCompare(b.name, ...);
```

### Volet droit (TitleDrawer)
Fonctionnalités dans le panneau droit :
- **Modifier le titre** : bouton crayon (toujours visible) → champ input inline
- **Changer type/statut** : invalide `["title-detail", titleId]` + `["titles"]`
- **Scraper** : communique avec l'extension navigateur ReadingTK
- **Sources** : liste, modifier, supprimer, voir dernier chapitre détecté
- **Recherche Google** :
  - À côté de "Sources" → recherche `[titre] scan`
  - À côté de "Dernier chapitre détecté" → recherche `[titre] [numéro]`
  - Par source → recherche `[titre] [last_seen_chapter de la source]`

---

## Calendrier (`/calendar`)

### Grille
- **25 lignes** (24h + 1 ligne décorative 00:00 en bas)
- Heures affichées de 00:00 (haut) à 00:00 (bas)
- La ligne 00:00 du bas est non-cliquable (spacer)

### Positionnement des événements
```tsx
top: `${(e.min / 1500) * 100}%`
// 1500 = 25 lignes × 60 min (pas 1440 = 24h)
```

---

## Sidebar (`src/routes/_authenticated/route.tsx`)

### Structure (de haut en bas)
1. Logo + bouton collapse
2. Compte (avatar + email) + sélecteur langue + bouton déconnexion ← entre logo et nav
3. Navigation principale (Bibliothèque, Calendrier, Sites, Notifications, Paramètres)
4. Liens secondaires (Ajouter, Import, Export)

### Sidebar collapsed
- Avatar cliquable → popup fixe (position: fixed, left: 60, top: 100)
- Popup contient email + bouton déconnexion

---

## Déploiement

```bash
npm run build         # Vérifier que le build passe
git add .
git commit -m "..."
git push
vercel --prod         # Déployer sur readingtk.net
```

**Note :** Vercel est la seule cible de déploiement. Pas de Cloudflare Workers/Pages.

---

## Boutons Google Search

Icône SVG Google "G" inline utilisée dans le drawer. Modèle :
```tsx
<a
  href={`https://www.google.com/search?q=${encodeURIComponent(title + " scan")}`}
  target="_blank"
  rel="noreferrer"
  title={t("drawer.googleSearch")}
  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-accent transition"
>
  {/* SVG Google G icon */}
</a>
```

---

## Conventions de style (boutons du drawer)

Style standard des boutons icône dans le volet droit :
```tsx
className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-accent transition"
```
Bouton toujours visible (pas de `opacity-0 group-hover:opacity-100`).

---

## Extension navigateur

Le scraping par titre nécessite l'extension ReadingTK installée dans le navigateur.  
Si l'extension n'est pas disponible → toast `t("drawer.extUnavailable")`.

---

## Points d'attention

- Toujours invalider `["title-detail", titleId]` en plus de `["titles"]` dans les mutations du drawer pour que le volet droit se rafraîchisse.
- Le calendrier utilise `1500` (25×60) comme diviseur pour le positionnement, pas `1440`.
- La langue par défaut est `"fr"` même au premier rendu SSR, puis ajustée côté client via `useEffect`.
- Le tri "Détecté" est basé sur la présence du badge NEW (chapitre détecté > chapitre lu), puis alphabétique — pas sur le numéro de chapitre.
