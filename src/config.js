// "artifact" (défaut) : capability sample de Claude si window.claude existe ; sinon, sur le site déployé (https, hors localhost),
// le proxy Netlify /api/ai ; sinon (dev local) le mock. "proxy" force le proxy.
export const config = { mode: "artifact" };
