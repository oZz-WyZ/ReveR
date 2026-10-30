# Direction artistique

Source : maquettes Figma du fichier « PFE » (`U8rjF3ZgyW9X3MyHhJdFY3`) : *Niveau* (nœud 23:43), *Classe* (26:244), *NiveauBoy* (27:479). Le reste de l'app a été décliné à la main depuis ces écrans. Elle remplace l'ancienne direction (fond pêche, héros orange, boutons noirs, inspirée de `ui-inspi.webp`), abandonnée.

## Principes

Blanc, très aéré, typographie fine, filets fins noirs, arrondis généreux. Le noir sert à dire « actif / sélectionné / action principale ». Pas d'ombres, pas de dégradés, pas de couleur d'accent.

## Jetons

| Rôle | Valeur |
|---|---|
| Fond de page | `#fff` (sur tous les écrans, fiche comprise) |
| Texte et filets | `#242222` (jamais `#000`) |
| Texte secondaire | `#858585` |
| Fonds neutres | `#fafafa` (survol), `#f1f1f1` / `#f4f4f4` (états actifs, miniatures) |
| Bouton désactivé | fond `#e9e9e9`, texte `#858585` |
| Police | `system-ui`, graisse 300 (400 pour le texte courant du cours) |
| Filet | `.5px solid #242222` ; pointillé `1.5px dashed` pour la zone d'import |
| Rayons | cartes 32 px · boutons 24 px · petites cartes et badges 24 px / pastille 999 px · ronds 50 % |
| Focus clavier | `outline: 2px solid #242222; outline-offset: 3px` |
| Exceptions de couleur | surlignage `#ffe066`, quiz bonne réponse `#2e9d57` / mauvaise `#d64545`, couleurs du stylo et du surligneur |

Tailles de texte : titre `clamp(28px, 5vw + 8px, 48px)`, saisie unique `clamp(36px, 9vw, 72px)`, options 24 px (22 px dense, 20 px badges), aide 16 px.

## Composants (classes dans `styles.css`)

- **Carte de choix** `.opt-card` : filet fin, rond en haut à droite ; sélectionnée = anneau intérieur de 3,5 px et rond plein. `.with-pic` pour les illustrations du niveau, `.dense` quand une question a plus de 4 choix (cartes plus basses).
- **Badge** `.opt-card.compact` dans `.opts.chips` (choix multiples, matières ajoutées, fenêtre de choix de matière) : sélectionné = fond noir, texte blanc, croix dans un rond. Une réponse unique peut aussi s'afficher en badges (`badges: true`, ex. langue vivante B).
- **CTA** `.setup-nav` : *Continuer* noir (gris `#e9e9e9` tant que rien n'est choisi), *Retour* en texte seul souligné de gauche à droite au survol. La barre est **fixée en bas de la fenêtre**, à la même place pour toutes les questions ; `scrollbar-gutter: stable` évite tout décalage.
- **Saisie** : sans cadre, grande, placeholder gris qui « tape » des exemples (`src/ui/typewriter.js`), texte saisi en noir.
- **Bouton maison** `.home-btn` : rond contour, plein noir au survol (même logique que la corbeille `.trash`).
- **Zone d'import** `.import-dock` (accueil) : onglet collé en bas de la fenêtre (≈ 4,5 % de la hauteur), pointillé en haut sans bord bas ; au survol le cadre disparaît et seul le bouton reste, avec une lueur blanche ; pendant un glisser-déposer elle se soulève et change de texte. Sur écran tactile (`hover: none`) le bouton est toujours visible.
- **Carte de matière** `.subject` : icône à gauche, **pastille noire du nombre de cours** à droite (rien si la matière est vide), nom en bas. Les matières qui ont des cours passent en premier.
- **Fiche** : cadre unique à filet fin (cours | assistant), pastille de matière noire collée en haut à gauche de la visionneuse, onglets ReveR / Me tester avec curseur noir, champ de question en capsule, liste déroulante en pilule à chevron.

## Animations

Brèves (≈ 0,7 s en tout) : le titre monte en se dévoilant (`setup-title`, 0,4 s), puis les options entrent en cascade (`setup-in`, 0,35 s, +50 ms par carte). Une liste modifiée après coup (`.opts.live`) ne rejoue pas l'animation. Tout est coupé sous `prefers-reduced-motion`.

## Responsive

- ≤ 900 px (tablette) : la fiche affiche **un panneau à la fois**, choisi par le sélecteur *Cours | Assistant* en bas (`#pane-switch`, `showPane` dans `main.js`) ; poser une question sur un passage bascule sur l'assistant. `#fiche` suit la hauteur de la fenêtre (`100dvh`), sans hauteur minimale.
- ≤ 640 px (téléphone) : cartes de choix sur 2 colonnes, illustrations à gauche du libellé, grilles de matières et de cours sur 2 colonnes, marges et boutons réduits.
- Écrans sans survol : voir zone d'import.

## À vérifier à chaque nouvel écran

Fond blanc, aucun orange/gris/violet, filets `.5px`, noir `#242222`, taille de cible tactile ≥ 44 px, aucun décalage horizontal entre deux écrans, rendu à 900 px et 640 px.
