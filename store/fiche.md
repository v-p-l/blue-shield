# Fiche Chrome Web Store — brouillon

À copier dans le Developer Dashboard. Rien ici n'est publié automatiquement.

## Avant de téléverser

1. Compte développeur Chrome Web Store : 5 $ une fois (`chrome.google.com/webstore/devconsole`).
2. `node tools/build-zip.mjs` → `dist/blue-shield-1.0.0.zip`.
3. URL de la politique de confidentialité : `https://v-p-l.github.io/blue-shield/privacy.html`
   (source : `docs/privacy.html`, publiée par GitHub Pages à chaque push sur `main`). Elle ne se
   colle pas dans la fiche mais dans l'onglet **Pratiques de confidentialité** du menu de gauche,
   tout en bas, champ « URL des règles de confidentialité ».
4. Visuels, dans `store/visuels/` : les 5 captures 1280×800, à téléverser dans cet ordre
   (`capture-1-lecteur.png`, `capture-2-miniatures.png`, `capture-3-commentaires.png`,
   `capture-4-flou.png`, `capture-5-options.png`), et la petite image promotionnelle
   (`vignette-440x280.png`). L'image promotionnelle « marquee » (1400×560) est facultative :
   elle ne sert que si Google met l'extension en avant sur la page d'accueil du Store.

Ordre de mise en avant, partout (visuels, description) : la durée qui disparaît du lecteur,
puis des miniatures, puis les commentaires ; le reste après.

## Nom

Blue Shield - anti-spoil YouTube

## Résumé (132 caractères maximum)

Le Store le lit dans le champ `description` de `manifest.json` : le modifier ici ne suffit pas.

```text
Masque la durée, la barre de progression et les commentaires des vidéos YouTube, chaîne par chaîne.
```

## Description complète

À copier tel quel : chaque ligne est un paragraphe ou une puce.

```text
Blue Shield masque la durée des vidéos YouTube : la barre de progression, le timer et le badge de durée des miniatures.

Tu choisis les chaînes concernées dans le popup. Les autres chaînes restent intactes.

DANS LE LECTEUR
- Barre de progression masquée, avec l'aperçu au survol et la heatmap
- Durée totale retirée : seul le temps écoulé reste affiché
- Boutons pour se déplacer : −1 min, −10 s, +10 s, +1 min
- Raccourcis qui révèlent la durée bloqués : touches 0 à 9, Début, Fin, mode « temps restant »
- Chapitres masqués
- Durée factice dans les contrôles média de Windows

SUR LES MINIATURES
- Badge de durée et barre « déjà vu » masqués
- Sur la page de la chaîne, dans la recherche, sur l'accueil et dans les suggestions

COMMENTAIRES
- Commentaires et chat en replay masqués
- Un bouton les réaffiche

EN OPTION, PAR CHAÎNE
- Flouter les miniatures
- Flouter les titres

Un bouton dans le lecteur réaffiche la durée de la vidéo en cours.
Plein écran, mode cinéma et miniplayer sont couverts. La durée des publicités reste visible.

Gratuit, sans compte, sans publicité, sans suivi. Les réglages restent dans le navigateur.
Français et anglais. Thème clair ou sombre.

YouTube est une marque de Google LLC. Blue Shield n'est pas affilié à YouTube.
```

## Catégorie

Outils (ou Divertissement)

## Justification des permissions (formulaire de confidentialité)

- `storage` : enregistrer la liste des chaînes et les réglages (thème, langue). Rien d'autre
  n'est stocké.
- Accès à `https://www.youtube.com/*` : l'extension ne peut masquer les durées que sur les
  pages YouTube ; elle y lit l'identifiant de la chaîne de la vidéo et le nom des chaînes
  auxquelles tu es abonné, pour te les proposer dans le popup.
- Pas de code distant : tout le code est dans le paquet.
- Usage unique déclaré : « masquer des éléments d'une page web à la demande de l'utilisateur ».

## Données collectées

Aucune. Ne cocher aucune catégorie du formulaire, et cocher les trois attestations
(pas de vente, pas d'usage hors du but annoncé, pas de solvabilité).
