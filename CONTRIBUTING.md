# Contribuer à ReadingTK

Merci de l'intérêt porté à ReadingTK ! Ce guide résume comment proposer un changement.

## Signaler un bug

Ouvrez une [issue](https://github.com/tkissdev/readingtk/issues) avec :

- Ce que vous attendiez / ce qui s'est passé
- Les étapes pour reproduire
- Navigateur/OS, et si le bug vient de l'extension ou de l'app Windows

## Proposer une fonctionnalité

Ouvrez une issue décrivant le besoin avant d'écrire du code, pour discuter de l'approche.

## Faire une Pull Request

1. Forkez le dépôt et créez une branche depuis `main`
2. Faites vos changements en suivant le style existant du code (voir `readingtk.md` pour les conventions internes du projet)
3. Vérifiez que `npm run build` passe sans erreur
4. Ouvrez une Pull Request avec une description claire de ce qui a changé et pourquoi

## Zones du projet

- `src/` — application web (TanStack Start)
- `extension/` et `extension-firefox/` — extensions navigateur (gardez les deux synchronisées quand vous modifiez la logique de scraping)
- `windows-app/` — application Windows (Python)
- `supabase/` — migrations base de données

## Code de conduite

Soyez respectueux et constructif. Les comportements toxiques ne seront pas tolérés.
