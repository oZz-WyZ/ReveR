# Reviz

Assistant de révision. Web app unique, sans build (ES modules).

Toute la couche IA passe par `askAI({ system, messages, json, signal, onToken })` (`src/ai/index.js`).
La persistance passe par `storage` (`src/storage.js`, localStorage).

## Deux modes IA (`src/config.js`)

- **artifact** (démo) : capability `sample` de Claude, via `claude.use("sample")`. Ne tourne que dans un artifact publié (déclarer `capabilities: {sample: {}}`). Sans `window.claude` (dev local), `askAI` retombe sur un **mock**.
- **proxy** (PWA, plus tard) : API Anthropic derrière un proxy. Stub dans `src/ai/proxy.js`.

Le reste de l'app ignore quel mode tourne.

## Lancer

- Local (mock) : `python3 -m http.server` puis http://localhost:8000
- Vrai chemin `sample` : publier en artifact, puis ouvrir le lien.
- Test : `node test/ai.test.mjs`

## Import (itération 1)

PDF (texte natif via pdf.js, gratuit) ou image/PDF scanné (transcription via `askAI({ images })`, déclarer `sample: {images: true}`). Détection natif/scanné : moyenne de caractères par page sur les 10 premières pages (`src/extract/index.js`). Le texte s'affiche dans un `contenteditable` (vrai DOM, sélectionnable) et se valide via `storage`.

## Onboarding (itération 2)

Après « Valider » sur le texte : détection matière / sujet / niveau (`askAI` en `json`, `src/onboarding/detect.js`), formulaire prérempli et corrigeable, échéance facultative, puis génération d'une consigne experte (`src/onboarding/consigne.js`). Tout est stocké dans `doc:<id>.onboarding` = `{ matiere, sujet, niveau, echeance, consigne, detecte, updatedAt }`. La consigne servira de `system` au chat. La vraie détection ne se vérifie qu'en artifact publié ; en local le mock renvoie un JSON conforme (Droit si le nom de fichier évoque le droit, sinon Histoire).

## Chat sourcé (itération 3)

`askAI` en `json` avec `system` = `doc.onboarding.consigne` (jamais affichée) + règles + cours (`src/chat/context.js`). Réponse `{ reponse, source: "cours"|"general", passage }`, `passage` vérifié contre le texte (sinon ignoré). Cours au-delà de `MAX_COURS_CHARS` (60 000) : seuls les blocs les plus proches de la question sont envoyés, avec un message à l'élève. Historique : 10 derniers échanges, seul `reponse` est renvoyé. Pouce bas : ré-explication plus simple qui remplace la réponse dans l'historique. Stockage : `chat:<docId>` = `{ turns, counts }`. La capability veut des tours qui alternent : `system` est fondu dans le premier tour user (`artifact.js`).

## Commentaires surlignés (itération 4)

Le panneau de lecture est en lecture seule ; « Corriger le texte » passe en édition. Sélectionner un passage → « Poser une question sur ce passage » → `askPassage` (`src/chat/ask.js`, même logique que le chat, fil isolé sans historique). Le passage est surligné, un clic ouvre la carte question/réponse. Stockage : `doc:<id>.comments = [{ id, range:{start,end}, quote, prefix, suffix, question, reponse, source, orphan, createdAt }]`. Ancrage (`src/anchors.js`) : offsets sur `doc.text`, relocalisation par quote + contexte si le texte change, `orphan: true` si la quote a disparu (listé sous le texte, jamais de plantage). Chevauchements : le texte est découpé aux bornes des surlignages.

## Répertoire (itération 5)

Écran d'accueil = liste des cours (`#repertoire`), fiche = `#cours-<id>`. `src/library.js` est le seul module qui écrit `doc:<id>` ; il tient à jour l'index `docs:index = [{ id, titre, matiere, sujet, echeance, importedAt, maitrise }]` dans le même appel, et `rebuildIndex()` le reconstruit au démarrage s'il diverge (migration de l'ancienne clé `docs`). Maîtrise manuelle : `a_reviser` (défaut) / `en_cours` / `maitrise`, stockée dans `doc.maitrise`, modifiable depuis le répertoire ou la fiche. Rouvrir une fiche relit `doc:<id>` (texte, onboarding, commentaires) et `chat:<id>`. Un cours importé n'entre dans le répertoire qu'au « Valider ». Pas de suppression par cours pour l'instant ; « Réinitialiser » (répertoire, confirmation en deux clics) efface toute la donnée Reviz via `storage.clear()`.

## Quiz de maîtrise (itération 6)

Onglet « Me tester » dans le panneau de droite de la fiche, à la place de l'assistant « Reviz » (onglet de gauche du toggle ; actif quand l'assistant est configuré). Une question à la fois : choisir une option, « Valider » (correction immédiate avec le passage), « Suivante », score cumulé à la fin (`src/quiz/run.js`). Nombre de questions = `ceil(longueur / 2000)` borné de 3 à 10 (`quizSize`). `generateQuiz` (`src/quiz/generate.js`) : `askAI` en `json` avec `system` = consigne + règles du quiz + cours ; `selectCoverage` (`src/chat/context.js`) envoie le cours entier, ou au-delà de 60 000 car. des blocs régulièrement espacés du début à la fin (signalé à l'élève). Parse défensif : questions invalides écartées, passage vérifié contre le texte (sinon `null`), options mélangées côté app, rien d'exploitable → `bad_quiz` + « Réessayer », rien n'est stocké. Le dernier score est stocké dans `doc.dernierQuiz = { score, total, at, tronque }` ; l'état de maîtrise reste manuel.

## Interface (spec UX)

Écrans : répertoire (`#repertoire`), fiche (`#cours-<id>`), infos du cours (`#infos-<id>`). La fiche a deux panneaux : le cours à gauche (PDF d'origine page par page avec calque de texte sélectionnable, ou photo ; bascule « Original / Texte ») et à droite un toggle « Reviz » (assistant, chat seul) / « Me tester » (quiz, à la place de l'assistant), toujours côte à côte (ordinateur), chacun repliable (`src/ui/layout.js`, préférences dans `prefs`). Les originaux sont gardés dans IndexedDB (`storage.blob`) ; sans eux (anciens cours, IndexedDB indisponible) on affiche le texte. Sur un PDF natif, la sélection et les surlignages sont reliés à `doc.text` par offsets (`src/extract/layout.js`, `src/ui/viewer.js`). Commentaires en pop-over au clic sur le surlignage. Thème dans `styles.css` d'après la référence `ui-inspi.webp` (fond pêche, héros orange, boutons noirs, très arrondi ; texte de cours sur fond blanc). La mascotte `mascotte.svg` sert de logo (héros, icône d'onglet) et d'avatar à l'assistant.
