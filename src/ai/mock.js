import { AIError } from "./errors.js";

// JSON conforme au schéma de détection (it. 2) pour pouvoir tester le formulaire en local.
// Les mots-clés viennent du nom de fichier / du texte envoyé.
function mockJson(system, last) {
  if (system?.includes('"correctIndex"')) return mockQuiz(system);
  if (system?.includes("Liste des matières")) return mockClassify(system, last);
  if (system?.includes('"passage"')) return mockChat(system, last);
}

// Classement d'un cours (it. 9) : cherche, dans le nom de fichier, un mot d'une matière de la liste ; sinon « ne sait pas ».
function mockClassify(system, last) {
  const name = (last.split("\n")[0] ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const lignes = [...(system.split("Liste des matières")[1] ?? "").matchAll(/^- (\S+) : (.+)$/gm)].map((x) => ({ id: x[1], nom: x[2] }));
  const hit = lignes.find((l) => l.nom.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/[^a-z]+/).some((w) => w.length > 3 && name.includes(w)));
  return hit ? { matiere: hit.id, confiance: "haute" } : { matiere: null, confiance: "faible" };
}

// Réponse de chat (it. 3) : passage réel tiré du cours reçu dans le system.
function mockChat(system, last) {
  const cours = system.match(/<<<COURS\n([\s\S]*?)\nCOURS>>>/)?.[1] ?? "";
  const simple = last.startsWith("Je n'ai pas bien compris") ? "[mock simplifié] " : "";
  if (/hors cours/i.test(last)) return { reponse: `${simple}[mock] réponse générale`, source: "general", passage: null };
  return { reponse: `${simple}[mock] d'après le cours :\n\n- **premier point** du cours\n- second point\n\nEn résumé, deux idées.`, source: "cours", passage: cours.trim().slice(0, 80) };
}

// QCM (it. 6) : questions bâties sur des phrases réparties dans le cours reçu ; vide si aucune phrase exploitable.
function mockQuiz(system) {
  const cours = system.match(/<<<COURS\n([\s\S]*?)\nCOURS>>>/)?.[1] ?? "";
  const phrases = cours.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length >= 45);
  const want = Number(system.match(/QCM de (\d+) questions/)?.[1] ?? 5);
  const n = Math.min(want, phrases.length);
  const picks = Array.from({ length: n }, (_, k) => phrases[Math.round((k * (phrases.length - 1)) / Math.max(1, n - 1))]);
  return {
    questions: picks.map((p) => ({
      question: `Complète : « ${p.slice(0, 30)}… »`,
      options: [p.slice(30, 70), "[mock] option fausse A", "[mock] option fausse B", "[mock] option fausse C"],
      correctIndex: 0,
      passage: p,
    })),
  };
}

// Dev local : la capability sample ne tourne que dans un artifact publié.
export async function complete({ system, messages, json, images, signal, onToken }) {
  if (signal?.aborted) throw new AIError("cancelled", "annulé");
  const last = messages[messages.length - 1].content;
  const text = images?.length
    ? `[mock] transcription de ${images.length} image(s)\n\n${last}`
    : `[mock] reçu : ${last}`;
  onToken?.(text);
  return { text, data: json ? mockJson(system, last) : null, truncated: false, source: "mock" };
}

export const limits = async () => ({ maxImages: 4 });
