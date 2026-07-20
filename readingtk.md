# ReadingTK — Documentation projet

Application web de suivi de lecture (manga, manhwa, manhua, novel).  
**URL live :** [readingtk.net](https://readingtk.net)  
**Dépôt git :** branche `main`  
**Déploiement :** Vercel uniquement (`vercel --prod`)

---

## Versioning

Le footer (`src/components/Footer.tsx`) est un composant partagé, affiché sur **toutes les pages** (landing, comment ça marche, confidentialité, téléchargements, connexion, et toutes les pages authentifiées via `_authenticated/route.tsx`). La version affichée suit ce format : **v1.00, v1.01, v1.02…**

**Règle :** à chaque commit, incrémenter la version de **+0.01**.  
Exemple : v1.00 → v1.01 → v1.02 → … → v1.09 → v1.10 → etc.

La version est écrite en dur dans `src/components/Footer.tsx` : `const VERSION = "X.XX"`

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
│   ├── download.tsx       ← Téléchargements (extensions navigateur + app Windows)
│   ├── how-it-works.tsx   ← Comment ça marche + section "Fonctionnalités en détail" (captures d'écran)
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
3. Navigation principale (Bibliothèque, Calendrier, Sites, Notifications, Paramètres, Download et Extension)
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

**Versions publiées :** Chrome v1.1.0 (en attente d'approbation), Firefox v1.1.0 (approuvé et live)  
**Version prête à soumettre :** v1.1.2 (correctif faux positifs mangahub.io — voir section ci-dessous ; inclut aussi le correctif du statut "Down" des sites de la v1.1.1)

**ZIPs :** `readingtk-chrome-X.X.X.zip` et `readingtk-firefox-X.X.X.zip` à la racine du projet.  
**Recréer les ZIPs (Windows) :** utiliser Python pour forcer les forward slashes :
```python
import zipfile, pathlib
src = pathlib.Path('extension-firefox')
with zipfile.ZipFile('readingtk-firefox-X.X.X.zip', 'w', zipfile.ZIP_DEFLATED) as zf:
    for file in src.rglob('*'):
        if file.is_file():
            zf.write(file, file.relative_to(src).as_posix())
```
(Firefox AMO rejette les ZIPs avec des backslashes Windows)

**Soumission manuelle requise** (comptes développeur — ne peut pas être fait par Claude) :
- Chrome Web Store Developer Dashboard → nouvelle version → uploader `readingtk-chrome-X.X.X.zip`
- Firefox AMO Developer Hub → nouvelle version → uploader `readingtk-firefox-X.X.X.zip`

### Filtre anti-faux-positifs (v1.1.0, renforcé en v1.1.2)
Dans `background.js` (Chrome et Firefox), `checker.py`/`scraper.py` (Windows) :
- Toutes les détections inter-sources sont collectées dans `pending` (avant toute écriture en base)
- Si ≥2 sources ont détecté, les numéros > 1.3× la médiane sont écartés (faux positifs)
- **v1.1.2 :** ce filtre protège désormais aussi `title_sources.last_seen_chapter` et la table
  `chapters`, pas seulement la notification — avant, un faux positif détecté par une seule source
  était filtré pour la notif mais quand même écrit en base, et l'UI ("dernier chapitre détecté" =
  max brut des sources) l'affichait malgré tout. Toutes les écritures attendent maintenant le filtre.
- **v1.1.2 :** `parseLastChapter()`/`parse_last_chapter()` ignorent aussi les liens `rel="nofollow"`
  ou `rel="noindex"` — mangahub.io place un lien caché de ce type juste à côté du vrai lien de
  chapitre, avec un ID interne sans rapport (ex: chapitre réel #820, lien caché vers "chapter-2227").
  C'était la cause des faux positifs Hajime No Ippo (#2227) et Vinland Saga (#8523).
- Notification basée sur le chapitre le plus fréquent parmi les résultats retenus (`pickBestChapter`)

### Filtre domaines externes
`parseLastChapter()` / `parse_last_chapter()` ignorent les liens vers des domaines différents de la page source (boutons Twitter, Facebook, etc.)

---

## Application Windows (`windows-app/`)

| Fichier | Rôle |
|---|---|
| `main.py` | Systray pystray, menu, dialogs tkinter, scheduling |
| `checker.py` | Port Python de `runCheck()` du background.js |
| `scraper.py` | Fetch HTTP / Playwright, parsing HTML |
| `notifier.py` | Notifications toast Windows (winotify) |
| `server.py` | Serveur HTTP local (callback depuis la web app) |
| `auth_dialog.py` | Dialog de connexion |
| `settings_dialog.py` | Dialog des paramètres |
| `build.py` | Script de build PyInstaller |

### Rapport d'erreurs (systray)
- Après chaque check, `_last_check_report` stocke `{time, detected, errors, error_details}`
- Menu systray → "Rapport du dernier check" → dialog tkinter avec liste des erreurs
- **Erreurs comptabilisées :** redirect, 404, exceptions
- **Non comptabilisé :** "aucun chapitre trouvé" (limitation du parseur, pas actionnable)

### Notification icône
`notifier.py` génère `icon.ico` depuis `icon.png` au premier lancement.  
Si `icon.ico` existe déjà (ancien cercle bleu), le supprimer pour forcer la régénération.

### Génération des fichiers d'installation (.exe, .msi, .zip)
Trois formats de distribution, générés dans `windows-app/dist/` (non versionné dans Git — fichiers trop volumineux, ~70-85 Mo chacun) :

| Fichier | Commande | Description |
|---|---|---|
| `ReadingTK.exe` | `python build.py` (PyInstaller) | Exécutable autonome, portable, sans installation |
| `ReadingTK-X.X.X-portable.zip` | zippe `dist/ReadingTK.exe` | Version zip du .exe portable |
| `ReadingTK-X.X.X-win64.msi` | `python setup_msi.py bdist_msi` (cx_Freeze) | Installateur Windows classique (Programmes, menu Démarrer, désinstallation) |

**Prérequis :** `pip install pyinstaller cx_Freeze` + générer `icon.ico` depuis `icon.png` si absent (voir section notification ci-dessus, ou lancer `notifier.py`).

**Numéro de version du MSI :** `APP_VERSION` en haut de `windows-app/setup_msi.py`.  
**Code de mise à niveau (upgrade_code) :** fixe, ne jamais changer — sinon les mises à jour du MSI n'écrasent pas l'ancienne version.

Ces fichiers (.exe/.msi/.zip) sont trop lourds pour être commités sur GitHub — ils sont distribués via **GitHub Releases** (tag `windows-app-vX.X.X`).

**⚠️ Dépôt de release : `tkissdev/readingtk-releases` (public), PAS `tkissdev/readingtk` (privé).**  
Le dépôt principal du code est privé — sur GitHub, les assets d'une release héritent toujours de la visibilité du dépôt qui les héberge. Une release créée sur `readingtk` (privé) est donc inaccessible à un visiteur non connecté, même si l'URL semble publique (404 silencieux). D'où ce dépôt séparé, public, qui ne contient que les releases (pas de code source).

**Page de téléchargement :** `src/routes/download.tsx` (route `/download`) liste à la fois les extensions navigateur et l'app Windows, avec liens directs vers les assets de la release. Après un nouveau build, mettre à jour `RELEASE_BASE` et `WINDOWS_VERSION` dans ce fichier pour pointer vers la nouvelle release, et **toujours vérifier avec un `curl` sans authentification** que les liens sont bien publics avant de considérer la mise à jour terminée :
```bash
curl -sL -A "Mozilla/5.0" -o /dev/null -w "%{http_code}" "<url-du-fichier>"  # doit renvoyer 200
```

---

## Page "Comment ça marche" (`src/routes/how-it-works.tsx`)

Section **"Fonctionnalités en détail"** : une carte par page/fonctionnalité (bibliothèque, volet d'un titre, calendrier, sites, notifications, paramètres, ajout de titre, import/export), chacune avec 1-2 captures d'écran + texte explicatif (tableaux `FEATURES_FR` / `FEATURES_EN`).

**Captures d'écran :** `public/screenshots/` (numérotées `01-...` à `12-...`). Ce sont de vraies captures de l'app en conditions réelles (pas des maquettes) — **toujours masquer l'email avant une nouvelle capture** :
```js
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// remplacer tous les nœuds texte + inputs contenant un email par "utilisateur@email.com"
```
Ce masquage est fait en direct dans le DOM (non persisté) — à refaire à chaque nouvelle session avant capture.

---

## Comptes et accès

| Service | Compte |
|---|---|
| GitHub | timothekiss |
| Vercel | timothekiss-1303 |
| Supabase | tkissdev@gmail.com / TkissDev's Org |
| Google Cloud (OAuth) | tkissdev@gmail.com |
| Chrome Web Store | tkissdev@gmail.com |
| Firefox AMO | TKissDev |
| Email contact | contact@tkissdev.com |

**MCP Supabase :** connecté à tkissdev@gmail.com / TkissDev's Org.  
Projet Supabase ID : `jjjfphkvwtruckxygwal`

---

## Points d'attention

- Toujours invalider `["title-detail", titleId]` en plus de `["titles"]` dans les mutations du drawer pour que le volet droit se rafraîchisse.
- Le calendrier utilise `1500` (25×60) comme diviseur pour le positionnement, pas `1440`.
- La langue par défaut est `"fr"` même au premier rendu SSR, puis ajustée côté client via `useEffect`.
- Le tri "Détecté" est basé sur la présence du badge NEW (chapitre détecté > chapitre lu), puis alphabétique — pas sur le numéro de chapitre.
- Après modification de `checker.py`, `scraper.py`, `notifier.py` ou `main.py`, reconstruire l'app Windows avec `python build.py` dans `windows-app/`.
- `callback.tsx` : si l'app Windows n'est pas lancée, le catch redirige vers `/dashboard` (comportement voulu — l'app Windows est optionnelle).
