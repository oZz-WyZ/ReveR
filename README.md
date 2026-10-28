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
