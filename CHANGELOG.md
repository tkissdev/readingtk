# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié]

### Ajouté

- Passage du projet en open source (licence MIT)
- Page `/contribute` avec boutons de don (PayPal, Ko-fi, Buy Me a Coffee, Stripe, Liberapay, Patreon)
- Installeur Windows classique (assistant d'installation, désinstalleur)

### Corrigé

- Faux positifs de détection de chapitres sur certains sites (liens `nofollow` piégés)
- La session de l'application Windows ne se reconnectait pas automatiquement après expiration
- La date du dernier scraping global ne se mettait pas à jour depuis l'application Windows
- Le statut "Down" des sites ne se remettait jamais à jour automatiquement

### Sécurité

- Vérification d'origine renforcée sur le relais de messages entre le site et l'extension navigateur
- Durcissement d'une fonction de base de données contre le détournement de `search_path`

---

_L'historique détaillé de chaque version antérieure est disponible via `git log`._
