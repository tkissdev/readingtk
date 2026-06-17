import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ── Langues ──────────────────────────────────────────────────────────────────

export type Lang = "fr" | "en";

type Dict = Record<string, string>;

const fr: Dict = {
  // Commun
  "common.cancel": "Annuler",
  "common.confirm": "Confirmer",
  "common.save": "Enregistrer",
  "common.add": "Ajouter",
  "common.delete": "Supprimer",
  "common.loading": "Chargement…",
  "common.open": "Ouvrir",
  "common.create": "Créer",
  "opt.all": "Tous",

  // Types & statuts
  "type.other": "autre",
  "status.ongoing": "en cours",
  "status.paused": "en pause",
  "status.dropped": "abandonné",
  "status.completed": "terminé",

  // Langues
  "lang.fr": "Français",
  "lang.en": "Anglais",

  // Navigation (sidebar)
  "nav.library": "Bibliothèque",
  "nav.calendar": "Calendrier",
  "nav.sites": "Sites",
  "nav.notifications": "Notifications",
  "nav.settings": "Paramètres",
  "nav.addTitle": "Ajouter un titre",
  "nav.import": "Importer bookmarks",
  "nav.export": "Exporter bookmarks",
  "nav.expand": "Agrandir",
  "nav.collapse": "Réduire",
  "nav.logout": "Déconnexion",
  "nav.loggedOut": "Déconnecté",

  // Landing
  "landing.metaTitle": "ReadingTK — Votre bibliothèque de lecture, enfin intelligent",
  "landing.metaDesc": "Suivez vos mangas, manhuas, manhwas et novels. Centralisez vos sources et soyez notifié à chaque nouveau chapitre.",
  "landing.signin": "Connexion",
  "landing.createAccount": "Créer un compte",
  "landing.hero1": "Votre tracker de lecture,",
  "landing.hero2": "enfin intelligent",
  "landing.heroSub1": "Suivez la progression de vos mangas, manhuas, manhwas et novels.",
  "landing.heroSub2": "Centralisez vos liens de lecture et soyez notifié dès qu'un nouveau chapitre sort.",
  "landing.start": "Commencer maintenant",
  "landing.f.track.t": "Suivi par titre",
  "landing.f.track.d": "Dernier chapitre lu, statut — tout au même endroit.",
  "landing.f.sources.t": "Multi-sources",
  "landing.f.sources.d": "Une priorité par site, ajoutez vos liens de lecture préférés.",
  "landing.f.check.t": "Check à la demande",
  "landing.f.check.d": "Détection heuristique des nouveaux chapitres en un clic.",
  "landing.f.calendar.t": "Calendrier automatique",
  "landing.f.calendar.d": "Jour et heure de parution de chaque titre, projetés semaine après semaine.",
  "landing.f.notif.t": "Notifications",
  "landing.f.notif.d": "Un badge dès qu'un nouveau chapitre apparaît.",
  "landing.footerSelfHosted": "Prêt pour l'auto-hébergement",
  "landing.footerBackend": "Backend Supabase",
  "landing.footerPrivacy": "Politique de confidentialité",
  "landing.extensions": "Extension",
  "landing.howItWorks": "Comment ça marche",

  // Auth
  "auth.metaTitle": "Connexion · ReadingTK",
  "auth.createTitle": "Créer un compte",
  "auth.loginTitle": "Connexion",
  "auth.createSub": "Commencez à suivre vos lectures.",
  "auth.loginSub": "Heureux de vous revoir.",
  "auth.continueWith": "Continuer avec {provider}",
  "auth.or": "ou",
  "auth.email": "Email",
  "auth.password": "Mot de passe",
  "auth.createBtn": "Créer le compte",
  "auth.loginBtn": "Se connecter",
  "auth.haveAccount": "Déjà un compte ?",
  "auth.noAccount": "Pas encore de compte ?",
  "auth.toCreate": "Créer un compte",
  "auth.toLogin": "Se connecter",
  "auth.created": "Compte créé !",
  "auth.createdConfirm": "Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse.",
  "auth.emailInUse": "Cet email est déjà utilisé (Google, Discord ou Twitch). Connectez-vous avec ce service, puis définissez un mot de passe dans Paramètres.",
  "auth.connected": "Connecté",
  "auth.errOAuth": "Erreur de connexion",
  "auth.errGeneric": "Erreur d'authentification",
  "auth.captchaRequired": "Veuillez valider le captcha avant de continuer",

  // Callback
  "callback.connecting": "Connexion en cours…",

  // 404 / erreur
  "notfound.title": "Page introuvable",
  "notfound.desc": "Cette page n'existe pas ou a été déplacée.",
  "notfound.back": "Retour à l'accueil",
  "error.title": "Erreur de chargement",
  "error.desc": "Quelque chose s'est mal passé.",
  "error.retry": "Réessayer",
  "error.home": "Accueil",

  // Dashboard
  "dash.metaTitle": "Bibliothèque · ReadingTK",
  "dash.search": "Rechercher un titre ou variante…",
  "filter.type": "Type",
  "filter.status": "Statut",
  "dash.lastScraping": "Dernier scraping : {date}",
  "dash.refresh": "Actualiser",
  "dash.titleCount": "{n} / {total} titres",
  "dash.merge": "Fusionner",
  "dash.selected": "{n} sélectionné(s)",
  "dash.mergeN": "Fusionner ({n})",
  "dash.colTitle": "Titre",
  "dash.colRead": "Lu",
  "dash.colDetected": "Détecté",
  "dash.emptyTitle": "Votre bibliothèque est vide",
  "dash.emptyDesc": "Ajoutez vos premiers titres pour commencer.",
  "dash.variantsOne": "+{n} variante",
  "dash.variantsMany": "+{n} variantes",
  "dash.merged": "Titres fusionnés",

  // Merge modal
  "merge.title": "Fusionner les titres",
  "merge.desc": "Choisissez le nom principal. Les autres seront conservés comme variantes de recherche.",
  "merge.variants": "variantes : {list}",
  "merge.willKeep": "Seront conservés comme variantes : {list}",

  // Drawer
  "drawer.editCover": "Modifier l'image de couverture",
  "drawer.renameTitle": "Renommer le titre",
  "drawer.renameFail": "Erreur lors du renommage",
  "drawer.scrapeNow": "Vérifier les chapitres de ce titre\n\nSi aucune source n'est configurée, une auto-découverte est lancée automatiquement.\nAvec 'Auto-découverte' activée, cherche aussi sur tous les sites connus.",
  "drawer.autoDiscover": "Auto-découverte",
  "drawer.extUnavailable": "Extension non disponible — installez l'extension ReadingTK",
  "drawer.scrapeDone": "Scraping terminé",
  "drawer.lastRead": "Dernier chapitre lu",
  "drawer.progressSaved": "Progression enregistrée",
  "drawer.titleDeleted": "Titre supprimé",
  "drawer.titleFallback": "titre",
  "drawer.detectedTitle": "Dernier chapitre détecté",
  "drawer.detectedNone": "Aucun chapitre détecté pour l'instant.",
  "drawer.detectedPrefix": "Dernier chapitre détecté : ",
  "drawer.deleteChapter": "Supprimer ce chapitre",
  "drawer.sources": "Sources ({n})",
  "drawer.googleSearch": "Rechercher sur Google",
  "drawer.googleSearchChap": "Rechercher ce chapitre sur Google",
  "drawer.priority": "priorité {n}",
  "drawer.down": "Down",
  "drawer.redirected": "Redirigé",
  "drawer.link": "Lien",
  "drawer.lastDetected": "Dernier détecté",
  "drawer.lastDetectedColon": "Dernier détecté : {n}",
  "drawer.lastDetectedPh": "ex : 134",
  "drawer.editSource": "Modifier cette source",
  "drawer.deleteSource": "Supprimer cette source",
  "drawer.confirmDeleteSource": "Supprimer cette source ?",
  "drawer.addSource": "Ajouter une source",
  "drawer.noSources": "Aucune source.",
  "drawer.deleteTitleBtn": "Supprimer ce titre",
  "drawer.confirmDeleteTitle": "Supprimer ce titre ?",

  // Calendrier
  "cal.metaTitle": "Calendrier · ReadingTK",
  "cal.title": "Calendrier",
  "cal.subtitle": "Jour et heure de parution de chaque titre, chaque semaine. Cliquez pour ajouter ou modifier.",
  "cal.today": "Aujourd'hui",
  "cal.prevWeek": "Semaine précédente",
  "cal.nextWeek": "Semaine suivante",
  "cal.upcoming": "{name} — parution à venir",
  "cal.openOnSite": "{name}{chap} (ouvrir sur le site)",
  "cal.chapterOf": " — chapitre {n}",
  "cal.editEntry": "Modifier l'entrée",
  "cal.addEntry": "Ajouter une entrée",
  "cal.editEntryTitle": "Modifier l'entrée",
  "cal.titleField": "Titre",
  "cal.customName": "— Nom personnalisé —",
  "cal.name": "Nom",
  "cal.namePh": "Ex. Nouvelle parution",
  "cal.day": "Jour",
  "cal.time": "Heure",
  "cal.added": "Entrée ajoutée",
  "cal.modified": "Entrée modifiée",
  "cal.deleted": "Entrée supprimée",
  "cal.saveFail": "Échec de l'enregistrement",
  "cal.deleteFail": "Échec de la suppression",
  "cal.needTitle": "Choisissez un titre ou saisissez un nom",
  "cal.untitled": "Sans titre",
  "cal.addBtn": "Ajouter",

  // Paramètres
  "set.metaTitle": "Paramètres · ReadingTK",
  "set.title": "Paramètres",
  "set.account": "Compte",
  "set.emailLabel": "Email :",
  "set.connections": "Connexions :",
  "set.changePassword": "Modifier le mot de passe",
  "set.setPassword": "Définir un mot de passe",
  "set.changePasswordDesc": "Choisissez un nouveau mot de passe pour la connexion par email.",
  "set.setPasswordDesc": "Ajoutez un mot de passe pour pouvoir vous connecter aussi avec votre email, en plus des autres services.",
  "set.newPassword": "Nouveau mot de passe",
  "set.confirmPassword": "Confirmer le mot de passe",
  "set.setPasswordBtn": "Définir le mot de passe",
  "set.pwTooShort": "Le mot de passe doit faire au moins 6 caractères",
  "set.pwMismatch": "Les deux mots de passe ne correspondent pas",
  "set.pwFail": "Échec de la définition du mot de passe",
  "set.pwSaved": "Mot de passe enregistré. Vous pouvez maintenant vous connecter par email.",
  "set.language": "Langue",
  "set.languageDesc": "Choisissez la langue de l'interface.",
  "set.notifications": "Notifications",
  "set.inApp": "Notifications in-app",
  "set.emailNotif": "Notifications Email",
  "set.comingSoon": "Bientôt",
  "set.chapterFormat": "Format de chapitre",
  "set.formatNumeric": "Numérique (12, 12.5)",
  "set.formatText": "Texte (Chapitre 12)",
  "set.defaults": "Valeurs par défaut",
  "set.bookmarksImport": "Import bookmarks",
  "set.ignoreDuplicates": "Ignorer les doublons",
  "set.saved": "Paramètres enregistrés",
  "set.loading": "Chargement…",

  // Sites
  "sites.metaTitle": "Sites · ReadingTK",
  "sites.title": "Sites à scraper",
  "sites.subtitle": "La priorité la plus haute est scrappée en premier.",
  "sites.name": "Nom",
  "sites.baseUrl": "URL de base",
  "sites.priority": "Priorité",
  "sites.enabled": "Activé",
  "sites.templateUrl": "Template URL",
  "sites.templatePh": "Template URL (optionnel) — ex : https://site.com/series/{slug}/",
  "sites.templateHelp": "Si renseigné, le scraper cherchera automatiquement chaque titre sur ce site en remplaçant {code} par le nom du titre (ex : \"The Shepherd Wizard\" → \"the-shepherd-wizard\").",
  "sites.addBtn": "Ajouter le site",
  "sites.created": "Site créé",
  "sites.down": "Down",
  "sites.none": "Aucun site configuré.",

  // Notifications
  "notif.metaTitle": "Notifications · ReadingTK",
  "notif.title": "Notifications",
  "notif.markAllRead": "Tout marquer comme lu",
  "notif.allMarked": "Tout marqué lu",
  "notif.titleDeleted": "Titre supprimé",
  "notif.markRead": "Marquer comme lu",
  "notif.deleteAll": "Tout supprimer",
  "notif.deleteAllConfirm": "Supprimer toutes les notifications ?",
  "notif.allDeleted": "Toutes les notifications supprimées",
  "notif.empty": "Aucune notification pour l'instant.",

  // Import
  "import.metaTitle": "Import bookmarks · ReadingTK",
  "import.title": "Importer des bookmarks",
  "import.subtitle": "Exportez vos favoris au format HTML depuis votre navigateur (Chrome/Firefox : Gérer les favoris → Exporter).",
  "import.choose": "Cliquer pour choisir un fichier HTML",
  "import.linksFound": "{n} liens trouvés",
  "import.selectedCount": "{a} / {b} sélectionnés",
  "import.importSelection": "Importer la sélection",
  "import.imported": "{titles} titre(s) importé(s) depuis {count} favoris",
  "import.chapShort": "ch. {n}",

  // Export
  "export.metaTitle": "Exporter bookmarks · ReadingTK",
  "export.title": "Exporter bookmarks",
  "export.subtitle": "Sélectionnez les titres et le type de liens à exporter au format HTML (importable dans tous les navigateurs).",
  "export.links": "Liens",
  "export.linkSources": "Sources",
  "export.linkChapters": "Dernier chapitre détecté",
  "export.linkAll": "Tous les liens",
  "export.selectAll": "Tout sélectionner",
  "export.deselectAll": "Tout désélectionner",
  "export.titleCount": "{n} titre(s)",
  "export.loading": "Chargement…",
  "export.noTitles": "Aucun titre correspondant aux filtres.",
  "export.noLinks": "Aucun lien disponible pour ce filtre",
  "export.summary": "{titles} titre(s) sélectionné(s) · {links} lien(s)",
  "export.exportBtn": "Exporter",

  // Ajouter des titres
  "add.metaTitle": "Ajouter des titres · ReadingTK",
  "add.title": "Ajouter des titres",
  "add.tabUrls": "Ajout via URLs",
  "add.tabManual": "Ajout manuel",
  "add.manualHelp": "Un titre par ligne.",
  "add.urlsHelp": "Une URL par ligne. Le domaine sera associé automatiquement à un site existant, et le template d'URL sera déduit.",
  "add.created": "{n} titre(s) créé(s)",
  "add.urlsImported": "{n} URL(s) importée(s) ✓",
  "add.sameTitleToggle": "Toutes les URLs sont pour le même titre",
  "add.sameTitleName": "Nom du titre…",
  "add.sameTitleNameRequired": "Indique le nom du titre avant de continuer.",
};

const en: Dict = {
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "Save",
  "common.add": "Add",
  "common.delete": "Delete",
  "common.loading": "Loading…",
  "common.open": "Open",
  "common.create": "Create",
  "opt.all": "All",

  "type.other": "other",
  "status.ongoing": "ongoing",
  "status.paused": "paused",
  "status.dropped": "dropped",
  "status.completed": "completed",

  "lang.fr": "French",
  "lang.en": "English",

  "nav.library": "Library",
  "nav.calendar": "Calendar",
  "nav.sites": "Sites",
  "nav.notifications": "Notifications",
  "nav.settings": "Settings",
  "nav.addTitle": "Add a title",
  "nav.import": "Import bookmarks",
  "nav.export": "Export bookmarks",
  "nav.expand": "Expand",
  "nav.collapse": "Collapse",
  "nav.logout": "Log out",
  "nav.loggedOut": "Logged out",

  "landing.metaTitle": "ReadingTK — Your reading library, finally smart",
  "landing.metaDesc": "Track your mangas, manhuas and novels. Centralize your sources and get notified on every new chapter.",
  "landing.signin": "Sign in",
  "landing.createAccount": "Create account",
  "landing.hero1": "Your library,",
  "landing.hero2": "finally smart",
  "landing.heroSub1": "Track the progress of your mangas, manhuas and novels.",
  "landing.heroSub2": "Centralize your reading links and get notified as soon as a new chapter is out.",
  "landing.start": "Get started",
  "landing.f.track.t": "Per-title tracking",
  "landing.f.track.d": "Last chapter read, status — all in one place.",
  "landing.f.sources.t": "Multi-source",
  "landing.f.sources.d": "One priority per site, add your favorite reading links.",
  "landing.f.check.t": "On-demand check",
  "landing.f.check.d": "Heuristic detection of new chapters in one click.",
  "landing.f.calendar.t": "Automatic calendar",
  "landing.f.calendar.d": "Each title's release day and time, projected week after week.",
  "landing.f.notif.t": "Notifications",
  "landing.f.notif.d": "A badge as soon as a new chapter appears.",
  "landing.footerSelfHosted": "Self-hosted ready",
  "landing.footerBackend": "Supabase backend",
  "landing.footerPrivacy": "Privacy Policy",
  "landing.extensions": "Extension",
  "landing.howItWorks": "How it works",

  "auth.metaTitle": "Sign in · ReadingTK",
  "auth.createTitle": "Create an account",
  "auth.loginTitle": "Sign in",
  "auth.createSub": "Start tracking your reading.",
  "auth.loginSub": "Glad to see you again.",
  "auth.continueWith": "Continue with {provider}",
  "auth.or": "or",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.createBtn": "Create account",
  "auth.loginBtn": "Sign in",
  "auth.haveAccount": "Already have an account?",
  "auth.noAccount": "No account yet?",
  "auth.toCreate": "Create an account",
  "auth.toLogin": "Sign in",
  "auth.created": "Account created!",
  "auth.createdConfirm": "Account created! Check your inbox to confirm your address.",
  "auth.emailInUse": "This email is already in use (Google, Discord or Twitch). Sign in with that service, then set a password in Settings.",
  "auth.connected": "Signed in",
  "auth.errOAuth": "Sign-in error",
  "auth.errGeneric": "Authentication error",
  "auth.captchaRequired": "Please complete the captcha before continuing",

  "callback.connecting": "Signing in…",

  "notfound.title": "Page not found",
  "notfound.desc": "This page doesn't exist or has been moved.",
  "notfound.back": "Back to home",
  "error.title": "Loading error",
  "error.desc": "Something went wrong.",
  "error.retry": "Retry",
  "error.home": "Home",

  "dash.metaTitle": "Library · ReadingTK",
  "dash.search": "Search a title or variant…",
  "filter.type": "Type",
  "filter.status": "Status",
  "dash.lastScraping": "Last scraping: {date}",
  "dash.refresh": "Refresh",
  "dash.titleCount": "{n} / {total} titles",
  "dash.merge": "Merge",
  "dash.selected": "{n} selected",
  "dash.mergeN": "Merge ({n})",
  "dash.colTitle": "Title",
  "dash.colRead": "Read",
  "dash.colDetected": "Detected",
  "dash.emptyTitle": "Your library is empty",
  "dash.emptyDesc": "Add your first titles to get started.",
  "dash.variantsOne": "+{n} variant",
  "dash.variantsMany": "+{n} variants",
  "dash.merged": "Titles merged",

  "merge.title": "Merge titles",
  "merge.desc": "Choose the main name. The others will be kept as search variants.",
  "merge.variants": "variants: {list}",
  "merge.willKeep": "Will be kept as variants: {list}",

  "drawer.editCover": "Edit cover image",
  "drawer.renameTitle": "Rename title",
  "drawer.renameFail": "Error renaming title",
  "drawer.scrapeNow": "Check chapters for this title\n\nIf no source is configured, auto-discovery runs automatically.\nWith 'Auto-discover' enabled, also searches all known sites.",
  "drawer.autoDiscover": "Auto-discover",
  "drawer.extUnavailable": "Extension unavailable — install the ReadingTK extension",
  "drawer.scrapeDone": "Scraping done",
  "drawer.lastRead": "Last chapter read",
  "drawer.progressSaved": "Progress saved",
  "drawer.titleDeleted": "Title deleted",
  "drawer.titleFallback": "title",
  "drawer.detectedTitle": "Last detected chapter",
  "drawer.detectedNone": "No chapter detected yet.",
  "drawer.detectedPrefix": "Last detected chapter: ",
  "drawer.deleteChapter": "Delete this chapter",
  "drawer.sources": "Sources ({n})",
  "drawer.googleSearch": "Search on Google",
  "drawer.googleSearchChap": "Search this chapter on Google",
  "drawer.priority": "priority {n}",
  "drawer.down": "Down",
  "drawer.redirected": "Redirected",
  "drawer.link": "Link",
  "drawer.lastDetected": "Last detected",
  "drawer.lastDetectedColon": "Last detected: {n}",
  "drawer.lastDetectedPh": "e.g. 134",
  "drawer.editSource": "Edit this source",
  "drawer.deleteSource": "Delete this source",
  "drawer.confirmDeleteSource": "Delete this source?",
  "drawer.addSource": "Add a source",
  "drawer.noSources": "No source.",
  "drawer.deleteTitleBtn": "Delete this title",
  "drawer.confirmDeleteTitle": "Delete this title?",

  "cal.metaTitle": "Calendar · ReadingTK",
  "cal.title": "Calendar",
  "cal.subtitle": "Each title's release day and time, every week. Click to add or edit.",
  "cal.today": "Today",
  "cal.prevWeek": "Previous week",
  "cal.nextWeek": "Next week",
  "cal.upcoming": "{name} — upcoming release",
  "cal.openOnSite": "{name}{chap} (open on the site)",
  "cal.chapterOf": " — chapter {n}",
  "cal.editEntry": "Edit the entry",
  "cal.addEntry": "Add an entry",
  "cal.editEntryTitle": "Edit the entry",
  "cal.titleField": "Title",
  "cal.customName": "— Custom name —",
  "cal.name": "Name",
  "cal.namePh": "e.g. New release",
  "cal.day": "Day",
  "cal.time": "Time",
  "cal.added": "Entry added",
  "cal.modified": "Entry updated",
  "cal.deleted": "Entry deleted",
  "cal.saveFail": "Save failed",
  "cal.deleteFail": "Delete failed",
  "cal.needTitle": "Choose a title or enter a name",
  "cal.untitled": "Untitled",
  "cal.addBtn": "Add",

  "set.metaTitle": "Settings · ReadingTK",
  "set.title": "Settings",
  "set.account": "Account",
  "set.emailLabel": "Email:",
  "set.connections": "Connections:",
  "set.changePassword": "Change password",
  "set.setPassword": "Set a password",
  "set.changePasswordDesc": "Choose a new password for email sign-in.",
  "set.setPasswordDesc": "Add a password so you can also sign in with your email, in addition to the other services.",
  "set.newPassword": "New password",
  "set.confirmPassword": "Confirm password",
  "set.setPasswordBtn": "Set password",
  "set.pwTooShort": "The password must be at least 6 characters",
  "set.pwMismatch": "The two passwords don't match",
  "set.pwFail": "Failed to set the password",
  "set.pwSaved": "Password saved. You can now sign in with your email.",
  "set.language": "Language",
  "set.languageDesc": "Choose the interface language.",
  "set.notifications": "Notifications",
  "set.inApp": "In-app notifications",
  "set.emailNotif": "Email notifications",
  "set.comingSoon": "Coming soon",
  "set.chapterFormat": "Chapter format",
  "set.formatNumeric": "Numeric (12, 12.5)",
  "set.formatText": "Text (Chapter 12)",
  "set.defaults": "Defaults",
  "set.bookmarksImport": "Bookmarks import",
  "set.ignoreDuplicates": "Ignore duplicates",
  "set.saved": "Settings saved",
  "set.loading": "Loading…",

  "sites.metaTitle": "Sites · ReadingTK",
  "sites.title": "Sites to scrape",
  "sites.subtitle": "The highest priority is scraped first.",
  "sites.name": "Name",
  "sites.baseUrl": "Base URL",
  "sites.priority": "Priority",
  "sites.enabled": "Enabled",
  "sites.templateUrl": "URL template",
  "sites.templatePh": "URL template (optional) — e.g. https://site.com/series/{slug}/",
  "sites.templateHelp": "If set, the scraper will automatically look up each title on this site by replacing {code} with the title name (e.g. \"The Shepherd Wizard\" → \"the-shepherd-wizard\").",
  "sites.addBtn": "Add site",
  "sites.created": "Site created",
  "sites.down": "Down",
  "sites.none": "No site configured.",

  "notif.metaTitle": "Notifications · ReadingTK",
  "notif.title": "Notifications",
  "notif.markAllRead": "Mark all as read",
  "notif.allMarked": "All marked as read",
  "notif.titleDeleted": "Deleted title",
  "notif.markRead": "Mark as read",
  "notif.deleteAll": "Delete all",
  "notif.deleteAllConfirm": "Delete all notifications?",
  "notif.allDeleted": "All notifications deleted",
  "notif.empty": "No notification yet.",

  "import.metaTitle": "Import bookmarks · ReadingTK",
  "import.title": "Import bookmarks",
  "import.subtitle": "Export your bookmarks as HTML from your browser (Chrome/Firefox: Manage bookmarks → Export).",
  "import.choose": "Click to choose an HTML file",
  "import.linksFound": "{n} links found",
  "import.selectedCount": "{a} / {b} selected",
  "import.importSelection": "Import selection",
  "import.imported": "{titles} title(s) imported from {count} bookmarks",
  "import.chapShort": "ch. {n}",

  "export.metaTitle": "Export bookmarks · ReadingTK",
  "export.title": "Export bookmarks",
  "export.subtitle": "Select the titles and the type of links to export as HTML (importable in all browsers).",
  "export.links": "Links",
  "export.linkSources": "Sources",
  "export.linkChapters": "Last detected chapter",
  "export.linkAll": "All links",
  "export.selectAll": "Select all",
  "export.deselectAll": "Deselect all",
  "export.titleCount": "{n} title(s)",
  "export.loading": "Loading…",
  "export.noTitles": "No title matching the filters.",
  "export.noLinks": "No link available for this filter",
  "export.summary": "{titles} title(s) selected · {links} link(s)",
  "export.exportBtn": "Export",

  "add.metaTitle": "Add titles · ReadingTK",
  "add.title": "Add titles",
  "add.tabUrls": "Add via URLs",
  "add.tabManual": "Manual add",
  "add.manualHelp": "One title per line.",
  "add.urlsHelp": "One URL per line. The domain will be matched automatically to an existing site, and the URL template will be inferred.",
  "add.created": "{n} title(s) created",
  "add.urlsImported": "{n} URL(s) imported ✓",
  "add.sameTitleToggle": "All URLs are for the same title",
  "add.sameTitleName": "Title name…",
  "add.sameTitleNameRequired": "Enter the title name before continuing.",
};

const DICTS: Record<Lang, Dict> = { fr, en };

function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS.fr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

// ── Contexte ─────────────────────────────────────────────────────────────────

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const defaultCtx: I18nCtx = {
  lang: "fr",
  setLang: () => {},
  t: (key, vars) => translate("fr", key, vars),
};

const Ctx = createContext<I18nCtx>(defaultCtx);

function detectInitial(): Lang {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem("rtk-lang");
    if (saved === "fr" || saved === "en") return saved;
  }
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")) return "en";
  return "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Toujours "fr" au premier rendu (SSR + hydratation), puis ajusté côté client.
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    const initial = detectInitial();
    setLangState(initial);
    try { document.documentElement.lang = initial; } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("rtk-lang", l); } catch {}
    try { document.documentElement.lang = l; } catch {}
  };

  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

// Libellés traduits pour les valeurs de type / statut
export function typeLabel(t: I18nCtx["t"], value: string): string {
  if (value === "all") return t("opt.all");
  if (value === "autre") return t("type.other");
  return value; // manga, manhua, manhwa, novel
}

export function statusLabel(t: I18nCtx["t"], value: string): string {
  if (value === "all") return t("opt.all");
  const key = `status.${value}`;
  const translated = t(key);
  return translated === key ? value : translated;
}

// ── Drapeaux ─────────────────────────────────────────────────────────────────

function FlagFR({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 3 2" width={size} height={(size * 2) / 3} className="rounded-sm" aria-hidden>
      <rect width="3" height="2" fill="#fff" />
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </svg>
  );
}

function FlagGB({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 60 30" width={size} height={size / 2} className="rounded-sm" aria-hidden>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export function LanguageSwitcher({ size = 18, className = "" }: { size?: number; className?: string }) {
  const { lang, setLang } = useI18n();
  const langs: { id: Lang; flag: ReactNode; label: string }[] = [
    { id: "fr", flag: <FlagFR size={size} />, label: "Français" },
    { id: "en", flag: <FlagGB size={size} />, label: "English" },
  ];
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {langs.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          title={l.label}
          aria-label={l.label}
          className={`rounded-sm transition ${lang === l.id ? "opacity-100 ring-2 ring-accent ring-offset-1 ring-offset-background" : "opacity-50 hover:opacity-90"}`}
        >
          {l.flag}
        </button>
      ))}
    </div>
  );
}
