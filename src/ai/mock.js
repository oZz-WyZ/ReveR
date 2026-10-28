import { AIError } from "./errors.js";

// JSON conforme au schéma de détection (it. 2) pour pouvoir tester le formulaire en local.
// Les mots-clés viennent du nom de fichier / du texte envoyé.
function mockJson(last) {
  const droit = /droit|juridi|code civil/i.test(last.split("\n")[0]); // première ligne = nom de fichier
  return droit
    ? { matiere: "Droit", sujet: "Responsabilité civile (mock)", niveau_estime: "supérieur" }
    : { matiere: "Histoire", sujet: "La Révolution française (mock)", niveau_estime: "lycée" };
}

// Dev local : la capability sample ne tourne que dans un artifact publié.
export async function complete({ messages, json, images, signal, onToken }) {
  if (signal?.aborted) throw new AIError("cancelled", "annulé");
  const last = messages[messages.length - 1].content;
  const text = images?.length
    ? `[mock] transcription de ${images.length} image(s)\n\n${last}`
    : `[mock] reçu : ${last}`;
  onToken?.(text);
  return { text, data: json ? mockJson(last) : null, truncated: false, source: "mock" };
}

export const limits = async () => ({ maxImages: 4 });
