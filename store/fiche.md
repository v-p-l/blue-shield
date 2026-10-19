# Fiche Chrome Web Store — brouillon

À copier dans le Developer Dashboard. Rien ici n'est publié automatiquement.

## Avant de téléverser

1. Compte développeur Chrome Web Store : 5 $ une fois (`chrome.google.com/webstore/devconsole`).
2. `node tools/build-zip.mjs` → `dist/blue-shield-1.0.0.zip`.
3. URL de la politique de confidentialité, à coller dans le formulaire :
   `https://v-p-l.github.io/blue-shield/privacy.html` (source : `docs/privacy.html`, publiée par
   GitHub Pages à chaque push sur `main`).
4. Captures 1280×800 (5 maximum) : lecteur masqué, popup avec les options d'une chaîne,
   page de chaîne sans durées, page de bienvenue.

## Nom

Blue Shield - anti-spoil YouTube

## Description courte (132 caractères maximum)

Cache la durée, la barre de progression et les commentaires des vidéos, chaîne par chaîne. Regarde un match sans savoir s'il est fini.

## Description complète

Tu regardes un replay de match en 3 vidéos. La barre de progression t'apprend qu'il reste
10 minutes : tu sais déjà que la partie est pliée. Blue Shield enlève ce qui te spoile.

Sur les chaînes que tu choisis, et seulement sur celles-là :

• La barre de progression, l'aperçu au survol et la heatmap disparaissent.
• La durée totale est retirée du lecteur : il ne reste que le temps écoulé.
• Quatre boutons remplacent la barre pour te déplacer : −1 min, −10 s, +10 s, +1 min.
• Le mode « temps restant » et les touches 0–9, Début et Fin sont neutralisés (←, →, J et L
  continuent de fonctionner).
• Les chapitres sont masqués, dans le lecteur comme dans la description.
• Sur les miniatures, le badge de durée et la barre rouge « déjà vu » disparaissent — sur la
  page de la chaîne, dans la recherche, sur l'accueil et dans les suggestions.
• Les contrôles média de Windows affichent une durée factice.
• En option, par chaîne : masquer les commentaires, flouter les titres et les miniatures.

Un bouton œil, dans le lecteur, réaffiche la durée après confirmation — pour cette vidéo
seulement. Plein écran, mode cinéma et miniplayer sont couverts. La durée des publicités
reste visible.

Gratuit, sans compte, sans publicité, sans suivi. Rien ne sort de ton navigateur : ta liste de
chaînes est stockée par Chrome et suit ton compte Chrome si la synchronisation est activée.

Français et anglais. Thème sombre ou clair.

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
