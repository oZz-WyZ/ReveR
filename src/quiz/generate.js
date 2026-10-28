import { askAI } from "../ai/index.js";
import { findPassage } from "../chat/ask.js";
import { buildSystem, selectCoverage } from "../chat/context.js";

export const QUIZ_MIN = 3;
export const QUIZ_MAX = 10;
const CHARS_PAR_QUESTION = 2000; // une question par tranche de texte (taille des blocs de context.js)

/** Nombre de questions proportionnel à la longueur du cours, borné. */
export const quizSize = (text) => Math.min(QUIZ_MAX, Math.max(QUIZ_MIN, Math.ceil(text.length / CHARS_PAR_QUESTION)));

const rules = (n) =>
  `Tu génères un QCM de ${n} questions pour tester la maîtrise du cours fourni plus bas.\n` +
  "Réponds UNIQUEMENT par un objet JSON :\n" +
  '{"questions": [{"question": string, "options": [string, string, string, string], "correctIndex": 0 | 1 | 2 | 3, "passage": string}]}\n' +
  "- Questions STRICTEMENT tirées du contenu du cours : aucune connaissance extérieure, aucune question dont la réponse n'est pas dans le cours.\n" +
  "- Couvre l'ensemble du cours : une question par partie ou idée distincte, réparties du début à la fin (pas seulement le début).\n" +
  "- 4 options plausibles, une seule bonne ; les trois autres sont fausses d'après le cours.\n" +
  "- passage : extrait du cours copié MOT POUR MOT qui justifie la bonne réponse.\n" +
  "- Questions courtes, adaptées au niveau de l'élève.";

const isText = (v) => typeof v === "string" && v.trim() !== "";

/** Copie mélangée (Fisher-Yates). `rnd` injectable pour les tests. */
export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** data (sortie json du modèle) -> [{ question, options[4], correctIndex, passage|null }]. Lève bad_quiz si rien d'exploitable. */
export function parseQuiz(data, text, rnd = Math.random, max = QUIZ_MAX) {
  const out = [];
  for (const q of Array.isArray(data?.questions) ? data.questions : []) {
    if (!isText(q?.question) || !Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(isText)) continue;
    const opts = q.options.map((o) => o.trim());
    if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) continue;
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) continue;
    // le modèle place souvent la bonne réponse au même rang : on mélange et on recalcule l'index
    const good = opts[q.correctIndex];
    const options = shuffle(opts, rnd);
    out.push({
      question: q.question.trim(),
      options,
      correctIndex: options.indexOf(good),
      passage: typeof q.passage === "string" ? findPassage(text, q.passage) : null,
    });
  }
  if (!out.length) throw Object.assign(new Error("aucune question exploitable"), { code: "bad_quiz" });
  return out.slice(0, max);
}

/** @returns {Promise<{questions: ReturnType<typeof parseQuiz>, tronque: boolean}>} tronque : le cours dépasse le budget, extraits répartis. */
export async function generateQuiz({ doc, signal }) {
  const n = quizSize(doc.text);
  const { text: cours, tronque } = selectCoverage(doc.text);
  const system = buildSystem({ consigne: doc.consigne, cours, tronque, rules: rules(n) });
  const r = await askAI({
    system,
    messages: [{ role: "user", content: `Génère le QCM de ${n} questions.` }],
    json: true,
    modelTier: "default",
    signal,
  });
  return { questions: parseQuiz(r.data, doc.text, Math.random, n), tronque };
}
