# ReveR — consignes pour l'agent

Assistant de révision pour élèves (collège, lycée, études supérieures). Web app unique, **sans build** : ES modules, `index.html` + `styles.css` + `src/`. Voir `docs/ARCHITECTURE.md` (modules, données) et `docs/DESIGN.md` (direction artistique). Le `README.md` détaille chaque fonctionnalité.

## Lancer et tester

- Local : `python3 -m http.server` puis http://localhost:8000. L'IA y est un **mock** ; la vraie IA ne tourne que sur le site Netlify.
- Tests : `for t in test/*.test.mjs; do node $t || echo FAIL $t; done` (node seul, aucune dépendance). Les tests couvrent la logique pure, pas le rendu.
- Le navigateur n'est pas toujours pilotable (extension Chrome parfois déconnectée) : si le rendu n'a pas été vu, le dire clairement dans la réponse. Ne jamais écrire « vérifié » sans l'avoir vu.

## Façon de travailler (validée depuis le début du projet)

1. **Faire seulement ce qui est demandé.** Pas de « tant qu'on y est ». Ce qui est sauté ou risqué se dit en une ou deux lignes à la fin de la réponse.
2. **Proposer avant de coder** les grosses fonctionnalités ou refontes (fichiers touchés, données, comportement) et attendre le oui. Les petits ajustements d'UI se font directement.
3. **Un commit local par changement terminé**, sans redemander. Commits atomiques, en français, message court à l'impératif ou au présent (`feat(onboarding): …`, `fix(accueil): …`, `chore: …`), terminés par la ligne `Co-Authored-By` demandée par le système.
4. **Ne jamais `git push` sans demande explicite.** Chaque push sur `main` déclenche un déploiement Netlify et l'utilisateur a un quota. Pas de `--force` ni de réécriture d'historique sans demande.
5. **Ne jamais ajouter `ui-inspi.webp`** (référence visuelle laissée non suivie).
6. Toute IA passe par `askAI()` (`src/ai/index.js`), jamais la capability `sample` hors `src/ai/artifact.js`. La persistance passe par `storage` (`src/storage.js`) et `src/library.js` (seul module qui écrit `doc:<id>`).
7. L'artifact « Reviz » est abandonné : ne plus le republier.
8. Réponses en français, courtes, sans formule de politesse. Les tests passent avant chaque commit.

## Sécurité et secrets

- Aucune clé API ni code d'accès dans le dépôt, dans un message ou dans un fichier de mémoire. `ANTHROPIC_API_KEY` et `ACCESS_CODE` ne vivent que dans les variables d'environnement Netlify.
- Un hook `PostToolUse` (`.claude/settings.json`) lance `betterleaks` sur chaque fichier écrit ou modifié ; s'il signale un secret, le retirer avant de continuer. Scan complet : `betterleaks dir .` et `betterleaks git .`.
- Les clés internes de stockage gardent l'ancien nom (`reviz:` en localStorage, base IndexedDB `reviz`) pour ne pas perdre les données des utilisateurs : ne pas les renommer sans migration.

## Veille des consignes (automatique)

L'utilisateur demande qu'à la reprise du travail, l'agent `.claude/agents/doc-freshness.md` vérifie si les consignes techniques des `.md` et de `.claude/` sont encore d'actualité (évolutions de Claude Code, version de betterleaks) et les corrige. Un hook `SessionStart` (`.claude/hooks/doc-freshness-check.sh`) le demande **au plus une fois tous les 7 jours** (date dans `.claude/.doc-check`, ignoré par git). Quand le hook le demande, lancer l'agent en arrière-plan sans attendre d'autre accord ; ensuite résumer en 3 lignes et commiter en local ce qu'il a modifié. Il ne change jamais les décisions du projet ni le code de l'app. Pour forcer un contrôle : demander « lance doc-freshness ».

## Conventions de code

- Écrire comme le code autour : mêmes noms, même densité de commentaires (français, une ligne, le *pourquoi*). Ne pas supprimer ni raccourcir un commentaire existant qu'on ne modifie pas.
- JS : modules ES, DOM construit avec `createElement`/`textContent` (jamais `innerHTML` avec du contenu venant d'un utilisateur ou de l'IA ; seules les icônes SVG statiques l'utilisent).
- Logique pure séparée du DOM (`src/profile.js`, `src/annotations.js`, `src/classify.js`…) pour pouvoir la tester avec node. Une logique nouvelle non triviale s'accompagne d'un test dans `test/`.
- CSS : un seul `styles.css`. Les couleurs et filets de la nouvelle DA sont écrits en dur (`#242222`, `.5px`) ; ne pas réintroduire l'orange, le gris `#E5E4E2` ni le violet. Attention à la spécificité (une règle `#id` bat une classe : c'est déjà arrivé).
- Responsive : tout nouvel écran doit tenir à 900 px et 640 px de large (voir `docs/DESIGN.md`).

## Décisions produit à ne pas remettre en cause sans demande

- Pas de mode réduit en pastille, pas de barre « Reviz », pas de panneaux repliables : sur grand écran cours et assistant restent côte à côte.
- Pas de pouces 👍/👎, pas de sélecteur de maîtrise, pas de bouton « Valider », pas de texte « Pas encore enregistré ».
- Le cours s'affiche en original (PDF page par page, ou photo) ; la vue Texte n'existe que sans original. Plus de bascule Origine/Texte.
- Onboarding : prénom, puis genre **seulement si** le prénom est mixte ou inconnu (`src/prenoms.js`), puis niveau, etc. Aucun sous-titre sous les questions. Pas de limite imposée sur le nombre de spécialités.
- Le classement d'un cours est fait par l'IA ; l'app ne demande à l'élève que si l'IA n'est pas sûre.
- Ton de l'assistant : neutre, concis, sans affect ni encouragement.
