# Architecture

Web app statique, sans build. `index.html` déclare tous les écrans (`#setup`, `#home`, `#matiere-page`, `#fiche`), `src/main.js` les pilote (navigation par hash : `#repertoire`, `#matiere-<id>`, `#cours-<id>`).

## Modules (`src/`)

| Dossier / fichier | Rôle |
|---|---|
| `main.js` | Écrans, routes, import d'un cours, fiche (onglets, panneaux), export |
| `profile.js`, `curriculum.js`, `prenoms.js` | Onboarding : `nextStep(réponses)` décide la question suivante ; programmes écrits en dur ; genre déduit du prénom (null = mixte ou inconnu → question posée) |
| `classify.js` | Rangement IA d'un cours dans une matière (`isSure`) |
| `library.js`, `storage.js` | Seuls accès aux données (localStorage + IndexedDB pour les originaux) |
| `ai/` | `askAI()` ; modes `artifact` (abandonné), `proxy` (Netlify), `mock` (local) ; choix automatique dans `ai/index.js` |
| `extract/` | PDF natif (pdf.js), scanné ou photo (transcription IA), mise en page pour la sélection |
| `chat/` | Consigne sans IA, contexte, questions sourcées, historique |
| `quiz/` | Génération (JSON défensif) et déroulé |
| `anchors.js` | Ancrage des commentaires sur `doc.text` (offsets, relocalisation, orphelins) |
| `annotations.js`, `export.js` | Modèle pur des annotations (annuler/rétablir) ; export PDF annoté (pdf-lib via CDN) |
| `ui/` | Un fichier par composant (viewer, ink, inkbar, chat, quiz, profile-setup, subjects, library, typewriter, toast…) |

Les modules sans DOM (`profile`, `annotations`, `classify`, `anchors`, `prenoms`, `quiz/run`) sont ceux qui ont des tests.

## Données

- `profil` : `{ prenom, genre?, niveau, classe?, lycee?, voie?, serie?, filiere?, lvb?, formation?, domaine?, annee?, matieres: [{ id, nom }], createdAt }`
- `doc:<id>` : texte, `matiereId`, commentaires, `annotations`, `dernierQuiz` ; `docs:index` : index reconstruit au démarrage si besoin ; `chat:<id>` : fil de l'assistant ; `accessCode` : code d'accès au proxy.
- Originaux (PDF, photos) : IndexedDB, base `reviz`. Préfixe localStorage : `reviz:`. Ces noms historiques sont conservés exprès.

## IA

Une seule porte : `askAI({ system, messages, json, modelTier, images, signal })`. En production, `src/ai/proxy.js` appelle `/api/ai` (`netlify/functions/ai.mjs`, logique dans `netlify/lib/ai-core.mjs`) avec l'en-tête `x-access-code`. Niveaux de modèle : `quick`, `default`, `complex` (variables `MODEL_*` facultatives). Limites : taille de requête, 6 images, 60 appels / 10 min / IP (par instance).

## Déploiement

Netlify, branche `main`, pas de commande de build (`netlify.toml`). Variables à définir sur Netlify : `ANTHROPIC_API_KEY`, `ACCESS_CODE`. Chaque push sur `main` redéploie.

## Hooks et outillage

`.claude/settings.json` : hook `PostToolUse` (`Write|Edit`) qui lance `betterleaks` sur le fichier modifié (sortie 2 = secret détecté, valeur masquée). Les consignes de travail sont dans `CLAUDE.md`.
