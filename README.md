# ReadingTK

Tracker de lecture pour manga, manhwa, manhua et novels, avec détection automatique des nouveaux chapitres.

**Site :** [readingtk.net](https://readingtk.net) · **Licence :** MIT

## Fonctionnalités

- Bibliothèque de lecture centralisée (titres, statut, progression, sources multiples par titre)
- Détection automatique des nouveaux chapitres via l'extension navigateur ou l'application Windows
- Notifications (in-app et navigateur) dès qu'un nouveau chapitre est disponible
- Calendrier de parution avec projection des prochaines sorties
- Import/export de favoris (bookmarks HTML)
- Auto-découverte de nouvelles sources de lecture pour un titre
- Interface bilingue (français / anglais)

## Structure du dépôt

| Dossier              | Contenu                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `src/`               | Application web (TanStack Start + React 19 + Supabase)                            |
| `extension/`         | Extension navigateur Chrome (Manifest V3)                                         |
| `extension-firefox/` | Extension navigateur Firefox (Manifest V2)                                        |
| `windows-app/`       | Application Windows (systray, Python) — détection en arrière-plan sans navigateur |
| `supabase/`          | Migrations et fonctions edge Supabase                                             |

## Stack technique

- **Frontend :** TanStack Start (React 19), TanStack Router, TanStack Query, Tailwind CSS v4, Radix UI
- **Backend :** Supabase (PostgreSQL + Row Level Security + Auth + Storage + Edge Functions)
- **Extensions :** JavaScript vanilla (Manifest V3 / V2)
- **App Windows :** Python (pystray, scrapling/curl_cffi, patchright)
- **Déploiement :** Vercel

## Développement local

Prérequis : Node.js 20+, un projet Supabase (gratuit sur [supabase.com](https://supabase.com)).

```bash
npm install
cp .env.example .env.local   # renseigner les variables Supabase
npm run dev
```

L'app est servie sur `http://localhost:8080` (ou le port indiqué par Vite).

### Extensions navigateur

Voir les instructions d'installation manuelle sur [readingtk.net/download](https://readingtk.net/download) (mode développeur, "Charger l'extension non empaquetée").

### Application Windows

Voir `windows-app/` — build via PyInstaller (`build.py`), packaging via Inno Setup (`installer.iss`) ou cx_Freeze (`setup_msi.py`).

## Contribuer

Les contributions sont les bienvenues — voir [CONTRIBUTING.md](CONTRIBUTING.md) et le [code de conduite](CODE_OF_CONDUCT.md).

## Sécurité

Pour signaler une vulnérabilité, voir [SECURITY.md](SECURITY.md).

## Historique des versions

Voir [CHANGELOG.md](CHANGELOG.md).

## Soutenir le projet

ReadingTK est gratuit et développé sur mon temps libre. Si le projet vous est utile, vous pouvez le soutenir via la page [readingtk.net/contribute](https://readingtk.net/contribute).

## Licence

Ce projet est sous licence [MIT](LICENSE).
