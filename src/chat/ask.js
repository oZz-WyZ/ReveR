import { askAI } from "../ai/index.js";
import { buildHistory, buildSystem, selectCourse } from "./context.js";

const REEXPLAIN =
  "Je n'ai pas bien compris ta réponse. Ré-explique la même chose plus simplement : " +
  "phrases courtes, mots du quotidien, et au moins un exemple concret ou une analogie. " +
  "Reste fidèle au cours, n'invente rien, garde un ton neutre et factuel. Garde exactement le même format JSON " +
  "(reponse, source, passage) ; si tu cites un passage du cours, il doit rester une copie exacte.";

const fail = (code, message) => Object.assign(new Error(message), { code });

/** Sous-chaîne EXACTE de `text` correspondant à `passage` (espaces et sauts de ligne ignorés), sinon null. */
export function findPassage(text, passage) {
  const p = passage.trim().replace(/^[«"“]\s*|\s*[»"”]$/g, "");
  if (p.length < 8) return null;
  if (text.includes(p)) return p;
  const map = [];
  let flat = "";
  for (let i = 0; i < text.length; i++) {
    const ws = /\s/.test(text[i]);
    if (ws && flat.endsWith(" ")) continue;
    flat += ws ? " " : text[i];
    map.push(i);
  }
  const needle = p.replace(/\s+/g, " ");
  const at = flat.indexOf(needle);
  return at < 0 ? null : text.slice(map[at], map[at + needle.length - 1] + 1);
}

/** data (sortie json du modèle) -> { reponse, source, passage }. Lève bad_answer si inutilisable. */
export function parseAnswer(data, text) {
  const reponse = typeof data?.reponse === "string" ? data.reponse.trim() : "";
  if (!reponse) throw fail("bad_answer", "réponse vide ou illisible");
  const source = data.source === "cours" ? "cours" : "general";
  const passage = source === "cours" && typeof data.passage === "string" ? findPassage(text, data.passage) : null;
  return { reponse, source, passage };
}

async function run({ doc, messages, queries, signal }) {
  const { text: cours, tronque } = selectCourse(doc.text, queries);
  const system = buildSystem({ consigne: doc.onboarding.consigne, cours, tronque });
  const r = await askAI({ system, messages, json: true, modelTier: "default", signal });
  return { ...parseAnswer(r.data, doc.text), tronque };
}

/** @returns {Promise<{reponse:string, source:"cours"|"general", passage:string|null, tronque:boolean}>} */
export function askCourse({ doc, turns, question, signal }) {
  const prev = turns.findLast((t) => t.role === "user");
  return run({
    doc,
    messages: [...buildHistory(turns), { role: "user", content: question }],
    queries: [question, prev?.content ?? ""],
    signal,
  });
}

/** Pouce bas : même contexte + historique jusqu'à la question, la réponse insuffisante, puis la consigne de simplification. */
export async function reexplain({ doc, turns, targetId, signal }) {
  const i = turns.findIndex((t) => t.id === targetId);
  const qi = turns.slice(0, i).findLastIndex((t) => t.role === "user");
  if (i < 0 || qi < 0) throw fail("bad_target", "réponse introuvable");
  return run({
    doc,
    messages: [
      ...buildHistory(turns.slice(0, qi)),
      { role: "user", content: turns[qi].content },
      { role: "assistant", content: turns[i].reponse },
      { role: "user", content: REEXPLAIN },
    ],
    queries: [turns[qi].content],
    signal,
  });
}

/** Question sur un passage sélectionné : fil ISOLÉ (aucun historique), même logique et mêmes règles que le chat. */
export function askPassage({ doc, passage, question, signal }) {
  return askCourse({
    doc,
    turns: [],
    question: `À propos de ce passage du cours : « ${passage} »\n\nQuestion : ${question}`,
    signal,
  });
}
