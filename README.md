# Blue Shield

Extension Chrome anti-spoil pour YouTube : sur les chaînes que tu choisis, la barre de progression
disparaît, la durée totale aussi : seul le temps écoulé reste, avec des boutons de saut.

## Installer (2 minutes)

1. Ouvre `chrome://extensions`.
2. Active **Mode développeur** (en haut à droite).
3. Clique **Charger l'extension non empaquetée** et choisis ce dossier (`blue-shield`).
4. Épingle l'icône Blue Shield dans la barre d'outils.
5. Recharge les onglets YouTube déjà ouverts.

## Ajouter une chaîne

- Sur une vidéo ou la page d'une chaîne : popup → **Ajouter**.
- Ou colle dans le popup : `https://www.youtube.com/@KarmineCorpVOD`, `@KarmineCorpVOD`,
  un ID `UC…` ou le lien d'une vidéo de la chaîne.

## Ce qui est masqué

Chaque chaîne a 4 interrupteurs dans le popup, en deux groupes : **Page de la vidéo** (durée, commentaires) et **Listes de vidéos** (miniatures, titres).

| Fuite | Traitement |
|---|---|
| Barre de progression, aperçu au survol, heatmap | masqués |
| Durée totale du timer | retirée, seul le temps écoulé reste (`1:24:37`) |
| Saut dans la vidéo | boutons `−1 min` `−10 s` `+10 s` `+1 min` à droite du timer |
| Mode « temps restant » (clic sur le timer) | bloqué |
| Touches `0`–`9` (saut à X %), `Début`, `Fin` | bloquées (`←` `→` `J` `L` restent actives) |
| Chapitres (lecteur + description) | masqués |
| Badge de durée et barre « déjà vu » des miniatures | masqués (page de la chaîne, recherche, accueil, suggestions) |
| Contrôles média Windows / Chrome | durée factice 9:59:59 |
| Commentaires et chat replay | remplacés par « Commentaires masqués » + bouton Afficher *(option par chaîne)* |
| Titres des vidéos de la chaîne | floutés, lisibles après 0,6 s de survol *(option par chaîne, désactivée par défaut)* |
| Miniatures de la chaîne (ex. « GAME 02 ») | floutées, durée masquée *(option par chaîne, désactivée par défaut)* |

## Afficher la durée

Bouton œil à droite des boutons de saut → confirmation → barre et durée réapparaissent pour
cette vidéo seulement (jusqu'à la fermeture de l'onglet). L'œil barré remasque sans confirmation.

Plein écran, mode cinéma et miniplayer utilisent le même lecteur : ils sont couverts.
La durée des **pubs** reste visible.

Tant que la chaîne de la vidéo n'est pas identifiée, tout est masqué (fail-closed).

## Réglages

Roue dentée à droite de l'interrupteur du popup :

- **Thème** : sombre (par défaut) ou clair. Il s'applique au popup.
- **Langue** : français ou anglais. Elle s'applique au popup et aux boutons du lecteur.
  Sans choix enregistré, la langue suit celle du navigateur.

## Test de fumée

```
node tools/smoke.mjs
```

Ouvre un Chrome jetable (profil temporaire, tes chaînes et tes cookies ne bougent pas), y charge
l'extension et vérifie sur le vrai YouTube que la barre, la durée, les badges des miniatures et les
touches `0`–`9` sont bien neutralisés — avec le contre-test sur une chaîne non listée. Compte
5 minutes : déconnecté, YouTube sert jusqu'à 3 minutes de pubs avant la vidéo. `--headless` pour
le lancer sans fenêtre. Sortie non nulle si une vérification échoue.

## Fichiers

- `content/main-world.js` : lit l'ID de chaîne dans les données internes de YouTube, falsifie la Media Session.
- `content/content.js` : décide quoi masquer, pose `data-blueshield-*` sur `<html>`, bloque les touches.
- `content/blueshield.css` : le masquage, piloté par ces attributs.
- `popup/` : gestion des chaînes et réglages (`chrome.storage.sync`).
- `welcome/` : page ouverte à l'installation (épingler l'icône, choisir des chaînes parmi les abonnements YouTube). `background.js` l'ouvre.
- `shared/` : tout ce qui sert à plus d'une surface. Les trois fichiers chargés en script classique
  (le script de contenu ne peut pas être un module) exposent un objet global :
  - `i18n.js` : les textes français et anglais → `blueshieldI18n`.
  - `options.js` : la liste des options par chaîne et leurs valeurs par défaut → `blueshieldOptions`.
    **C'est la seule source** : ajouter une option commence ici.
  - `dom.js` : `el()`, `svg()` et le jeu d'icônes → `blueshieldDom`.
- `shared/ui.js` (module) : l'avatar, la ligne de statut, le sélecteur d'abonnements, l'application
  des textes / du thème / du focus. `shared/ui.css` : les tokens et les composants communs.
  `shared/channels.js` : retrouver une chaîne depuis un lien, lire les abonnements.
  `shared/theme.js` pose le thème avant l'affichage.
- `design/icons/build.mjs` : génère les icônes de `icons/`.
- `tools/smoke.mjs` : le test de fumée ci-dessus ; `tools/cdp.mjs` : son client DevTools, sans dépendance.
- `tools/build-zip.mjs` : le zip à téléverser sur le Chrome Web Store (`dist/`). `store/` : les textes de la fiche.
