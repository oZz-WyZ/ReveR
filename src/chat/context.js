export const MAX_COURS_CHARS = 60000; // budget de contexte pour le texte du cours
export const MAX_TURNS = 10;          // échanges (question + réponse) gardés dans l'historique
const CHUNK_CHARS = 2000;
const SEP = "\n[…]\n";

const RULES =
  "Tu réponds à une question d'élève sur le cours fourni plus bas.\n" +
  "Priorité : réponds d'abord à partir du cours. Si la question dépasse le cours, réponds avec tes connaissances générales et indique-le (source \"general\").\n" +
  'Réponds UNIQUEMENT par un objet JSON : {"reponse": string, "source": "cours" | "general", "passage": string | null}.\n' +
  '- source "cours" seulement si ta réponse repose sur le cours ; sinon "general".\n' +
  '- passage : si source est "cours", un extrait du cours copié MOT POUR MOT (une à trois phrases, sans reformuler), celui sur lequel tu t\'appuies ; sinon null.\n' +
  "- reponse : en français, adaptée au niveau de l'élève.\n" +
  "Sois BREF : va droit au but, 3 à 5 phrases sauf si la question exige davantage. " +
  "Pas de formule de remplissage (« Bonne question ! », « Bien sûr ! »). " +
  "Ne termine pas par une question de vérification ou de relance que l'élève n'a pas demandée. " +
  "Reste fidèle au cours, n'invente rien, et signale clairement quand tu sors du cours.";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const words = (s) => new Set(norm(s).match(/\p{L}{4,}/gu) ?? []);

export function chunkText(text, size = CHUNK_CHARS) {
  const out = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length + 2 > size) { out.push(cur); cur = ""; }
    if (para.length > size) {
      for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size));
      continue;
    }
    cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur) out.push(cur);
  return out;
}

/** Cours entier s'il tient dans le budget ; sinon les blocs les plus proches des questions, dans l'ordre du cours. */
export function selectCourse(text, queries, budget = MAX_COURS_CHARS) {
  if (text.length <= budget) return { text, tronque: false };
  const q = new Set(queries.flatMap((s) => [...words(s)]));
  const chunks = chunkText(text).map((c, i) => ({ c, i, score: [...words(c)].filter((w) => q.has(w)).length }));
  const chosen = [];
  let used = 0;
  for (const ch of [...chunks].sort((a, b) => b.score - a.score || a.i - b.i)) {
    if (used + ch.c.length + SEP.length > budget) continue;
    chosen.push(ch);
    used += ch.c.length + SEP.length;
  }
  chosen.sort((a, b) => a.i - b.i);
  return { text: chosen.map((x) => x.c).join(SEP), tronque: true };
}

/** `rules` : règles de la tâche (chat par défaut, quiz...). */
export function buildSystem({ consigne, cours, tronque, rules = RULES }) {
  const note = tronque ? "Le cours ci-dessous est un extrait : « […] » marque une coupure.\n" : "";
  return `${consigne}\n\n${rules}\n\n${note}<<<COURS\n${cours}\nCOURS>>>`;
}

/** Pour le quiz : cours entier s'il tient ; sinon des blocs régulièrement espacés du début à la fin (pas de tri par pertinence). */
export function selectCoverage(text, budget = MAX_COURS_CHARS) {
  if (text.length <= budget) return { text, tronque: false };
  const chunks = chunkText(text);
  const n = Math.max(1, Math.floor(budget / (CHUNK_CHARS + SEP.length))); // pire cas : blocs de CHUNK_CHARS
  const picks = n === 1 ? [0] : Array.from({ length: n }, (_, k) => Math.round((k * (chunks.length - 1)) / (n - 1)));
  return { text: [...new Set(picks)].map((i) => chunks[i]).join(SEP), tronque: true };
}

/** Tours stockés -> messages qui alternent user/assistant. Par question, la dernière réponse l'emporte
 *  (une ré-explication remplace la réponse jugée insuffisante). Seul `reponse` est renvoyé. */
export function buildHistory(turns) {
  const pairs = [];
  for (const t of turns) {
    if (t.role === "user") pairs.push({ q: t, a: null });
    else if (pairs.length) pairs.at(-1).a = t;
  }
  return pairs
    .filter((p) => p.a)
    .slice(-MAX_TURNS)
    .flatMap((p) => [{ role: "user", content: p.q.content }, { role: "assistant", content: p.a.reponse }]);
}
