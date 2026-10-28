import { AIError } from "./errors.js";

// JSON conforme au schéma de détection (it. 2) pour pouvoir tester le formulaire en local.
// Les mots-clés viennent du nom de fichier / du texte envoyé.
function mockJson(system, last) {
  if (system?.includes('"passage"')) return mockChat(system, last);
  const droit = /droit|juridi|code civil/i.test(last.split("\n")[0]); // première ligne = nom de fichier
  return droit
    ? { matiere: "Droit", sujet: "Responsabilité civile (mock)", niveau_estime: "supérieur" }
    : { matiere: "Histoire", sujet: "La Révolution française (mock)", niveau_estime: "lycée" };
}

// Réponse de chat (it. 3) : passage réel tiré du cours reçu dans le system.
function mockChat(system, last) {
  const cours = system.match(/<<<COURS\n([\s\S]*?)\nCOURS>>>/)?.[1] ?? "";
  const simple = last.startsWith("Je n'ai pas bien compris") ? "[mock simplifié] " : "";
  if (/hors cours/i.test(last)) return { reponse: `${simple}[mock] réponse générale`, source: "general", passage: null };
  return { reponse: `${simple}[mock] d'après le cours`, source: "cours", passage: cours.trim().slice(0, 80) };
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
