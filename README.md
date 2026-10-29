# ReveR

Assistant de révision. Web app unique, sans build (ES modules).

Toute la couche IA passe par `askAI({ system, messages, json, signal, onToken })` (`src/ai/index.js`).
La persistance passe par `storage` (`src/storage.js`, localStorage).

## Deux modes IA (`src/config.js`)

- **artifact** (démo) : capability `sample` de Claude, via `claude.use("sample")`. Ne tourne que dans un artifact publié (déclarer `capabilities: {sample: {}}`). Sans `window.claude` (dev local), `askAI` retombe sur un **mock**.
- **proxy** (site déployé sur Netlify) : API Anthropic via la fonction `netlify/functions/ai.mjs` (route `/api/ai`). La clé reste côté serveur ; un code d'accès protège l'appel. Choisi automatiquement hors artifact sur une page https qui n'est pas `localhost` (`src/ai/index.js`).

Le reste de l'app ignore quel mode tourne.

## Lancer

- Local (mock) : `python3 -m http.server` puis http://localhost:8000
- Vrai chemin `sample` : publier en artifact, puis ouvrir le lien.
- Test : `node test/ai.test.mjs`

## Import (itération 1)

PDF (texte natif via pdf.js, gratuit) ou image/PDF scanné (transcription via `askAI({ images })`, déclarer `sample: {images: true}`). Détection natif/scanné : moyenne de caractères par page sur les 10 premières pages (`src/extract/index.js`). Le texte s'affiche dans un `contenteditable` (vrai DOM, sélectionnable) et se valide via `storage`.

## Profil et matières (remplace l'ancien onboarding par cours)

Au premier lancement, un onboarding pose des questions pour connaître le niveau de l'élève et toutes ses matières (`src/profile.js` : `nextStep` décide de la question suivante d'après les réponses ; `src/ui/profile-setup.js`). Collège : la classe, puis la liste unique des matières. Lycée : classe, voie, série ou spécialités (nombre exact imposé), options, langue vivante B. Études supérieures : formation, domaine, année, puis l'élève déclare ses matières (suggestions cliquables par domaine, jamais ajoutées sans son accord) et répond à des questions guidées pour n'en oublier aucune. Les programmes sont écrits en dur dans `src/curriculum.js`. Le profil est stocké dans `profil = { niveau, classe, ..., matieres: [{ id, nom }] }`.

À l'import d'un cours, `src/classify.js` (`askAI` en `json`, niveau `quick`) choisit la matière parmi celles du profil. Si le modèle n'est pas sûr (matière inconnue ou confiance faible), l'app demande tout de suite à l'élève dans quelle matière ranger le cours (`chooseMatiere`) ; « Non classé » existe. La matière se change ensuite depuis la puce de la fiche. Le cours porte `matiereId` ; l'accueil affiche une carte par matière, un clic ouvre la page de la matière (`#matiere-<id>`). La consigne de l'assistant est construite sans IA (`src/chat/consigne.js`) à partir du profil et de la matière. Plus de sujet, de niveau ni de date de contrôle par cours. Bouton « Reset » (bas gauche, provisoire, deux clics) : efface tout pour retester l'onboarding.

## Chat sourcé (itération 3)

`askAI` en `json` avec `system` = `doc.onboarding.consigne` (jamais affichée) + règles + cours (`src/chat/context.js`). Réponse `{ reponse, source: "cours"|"general", passage }`, `passage` vérifié contre le texte (sinon ignoré). Cours au-delà de `MAX_COURS_CHARS` (60 000) : seuls les blocs les plus proches de la question sont envoyés, avec un message à l'élève. Historique : 10 derniers échanges, seul `reponse` est renvoyé. Les pouces 👍/👎 sont retirés de l'interface (temps 2 : amélioration des réponses) ; `reexplain` et `setFeedback` restent côté données. Stockage : `chat:<docId>` = `{ turns, counts }`. La capability veut des tours qui alternent : `system` est fondu dans le premier tour user (`artifact.js`).

## Commentaires surlignés (itération 4)

Le panneau de lecture est en lecture seule ; « Corriger le texte » passe en édition. Sélectionner un passage → « Poser une question sur ce passage » → `askPassage` (`src/chat/ask.js`, même logique que le chat, fil isolé sans historique). Le passage est surligné, un clic ouvre la carte question/réponse. Stockage : `doc:<id>.comments = [{ id, range:{start,end}, quote, prefix, suffix, question, reponse, source, orphan, createdAt }]`. Ancrage (`src/anchors.js`) : offsets sur `doc.text`, relocalisation par quote + contexte si le texte change, `orphan: true` si la quote a disparu (listé sous le texte, jamais de plantage). Chevauchements : le texte est découpé aux bornes des surlignages.

## Répertoire (itération 5)

Écran d'accueil = liste des cours (`#repertoire`), fiche = `#cours-<id>`. `src/library.js` est le seul module qui écrit `doc:<id>` ; il tient à jour l'index `docs:index = [{ id, titre, matiere, sujet, echeance, importedAt, maitrise }]` dans le même appel, et `rebuildIndex()` le reconstruit au démarrage s'il diverge (migration de l'ancienne clé `docs`). Rouvrir une fiche relit `doc:<id>` (texte, onboarding, commentaires) et `chat:<id>`. Un cours est enregistré (texte + original) dès l'import, puis la page « Infos du cours » s'ouvre ; plus de bouton « Valider ». Pour une photo, « Corriger le texte » passe en édition et devient « Enregistrer ». Chaque carte a une corbeille (coin haut droit) : suppression immédiate (cours, commentaires, chat, original) avec une notification « Annuler » de 5 s (`deleteDoc` / `restoreDoc`). Notifications : `src/ui/toast.js` (carte en bas à droite, barre de progression qui se remplit puis ferme ; pilotée par le temps, ou par le code pour l'import). Plus de bouton « Réinitialiser », de sélecteur de maîtrise ni de message « Pas encore enregistré ».

## Quiz de maîtrise (itération 6)

Onglet « Me tester » dans le panneau de droite de la fiche, à la place de l'assistant « ReveR » (toggle intégré à la carte ; actif quand l'assistant est configuré). Ouvrir l'onglet lance directement le quiz, sans bouton « Commencer ». Une question à la fois : un clic sur une option = réponse, la correction de cette question (bonne réponse + passage) s'affiche tout de suite avec « Suivante » ; l'écran final ne montre que le score (`src/quiz/run.js`). Nombre de questions = `ceil(longueur / 2000)` borné de 3 à 10 (`quizSize`). `generateQuiz` (`src/quiz/generate.js`) : `askAI` en `json` avec `system` = consigne + règles du quiz + cours ; `selectCoverage` (`src/chat/context.js`) envoie le cours entier, ou au-delà de 60 000 car. des blocs régulièrement espacés du début à la fin (signalé à l'élève). Parse défensif : questions invalides écartées, passage vérifié contre le texte (sinon `null`), options mélangées côté app, rien d'exploitable → `bad_quiz` + « Réessayer », rien n'est stocké. Le dernier score est stocké dans `doc.dernierQuiz = { score, total, at, tronque }` ; l'état de maîtrise reste manuel.

## Interface (spec UX)

Écrans : onboarding, accueil (`#repertoire`, cartes par matière), matière (`#matiere-<id>`), fiche (`#cours-<id>`). La fiche a deux panneaux : le cours à gauche (PDF d'origine page par page avec calque de texte sélectionnable, ou photo ; bascule « Original / Texte ») et à droite un toggle « ReveR » (assistant, chat seul) / « Me tester » (quiz, à la place de l'assistant), toujours côte à côte (ordinateur), sans panneaux repliables. Les originaux sont gardés dans IndexedDB (`storage.blob`) ; sans eux (anciens cours, IndexedDB indisponible) on affiche le texte. Sur un PDF natif, la sélection et les surlignages sont reliés à `doc.text` par offsets (`src/extract/layout.js`, `src/ui/viewer.js`). Commentaires en pop-over au clic sur le surlignage. Thème dans `styles.css` d'après la référence `ui-inspi.webp` (fond pêche, héros orange, boutons noirs, très arrondi ; texte de cours sur fond blanc). La mascotte `mascotte.svg` sert de logo (héros, icône d'onglet) et d'avatar à l'assistant.

**Réponse de l'assistant :** le passage du cours qui répond à la question est réécrit tel quel, surligné du même jaune que dans la visionneuse (sans libellé ni badge). Il est aussi surligné dans le PDF et dans la vue Texte (`highlights.setRef` : un surlignage « __ref » qui n'ouvre pas de carte), et la visionneuse défile jusqu'à lui ; un clic sur le passage dans le chat l'y ramène.

**Saisie vocale (assistant) :** un micro dans le champ de saisie (`src/ui/voice.js`, API Web Speech `SpeechRecognition`, français). Un clic dicte la question (le texte s'affiche pendant qu'on parle) ; elle reste dans le champ pour être relue, corrigée puis envoyée par l'élève. Le bouton n'apparaît que si le navigateur gère la reconnaissance vocale ; si le micro est refusé (par exemple dans le cadre sandboxé d'un artifact), un message l'indique et le bouton disparaît. Sous Chrome, le son est traité par le service de reconnaissance de Google.


## Déployer sur Netlify

1. Netlify > *Add new site* > *Import an existing project* > ce repo GitHub. Pas de commande de build ; le dossier publié est la racine (`netlify.toml`).
2. *Site configuration > Environment variables* : `ANTHROPIC_API_KEY` (ta clé) et `ACCESS_CODE` (le code à donner aux utilisateurs). Facultatif : `MODEL_QUICK`, `MODEL_DEFAULT`, `MODEL_COMPLEX`.
3. Redéployer. À la première question, l'app demande le code d'accès et le garde dans le navigateur.

La fonction refuse tout appel sans le bon code, limite la taille des requêtes (400 000 caractères, 6 images) et le débit par IP (60 appels / 10 min, par instance de fonction). Sans les deux variables, elle répond `not_configured`. Test : `node test/proxy.test.mjs`.
