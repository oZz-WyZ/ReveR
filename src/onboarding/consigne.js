import { askAI } from "../ai/index.js";

const SYSTEM =
  "Tu rédiges une consigne système destinée à un assistant de révision. " +
  'Réponds uniquement par la consigne, en français, à la deuxième personne ("Tu es…"), en 120 à 180 mots.\n' +
  "La consigne doit :\n" +
  "- poser l'assistant comme expert en {matière}, sur le sujet « {sujet} » ;\n" +
  "- adapter vocabulaire et profondeur au niveau {niveau} ;\n" +
  "- demander de s'appuyer d'abord sur le cours fourni dans la conversation, et de dire clairement quand une réponse n'y figure pas ;\n" +
  "- demander des explications claires, avec un exemple quand c'est utile, sans inventer de faits ;\n" +
  "- ne contenir ni salutation ni mise en forme Markdown.";

/** @returns {Promise<string>} consigne, destinée à servir de `system` au chat. Lève si vide ou tronquée. */
export async function generateConsigne({ matiere, sujet, niveau, signal }) {
  const r = await askAI({
    system: SYSTEM,
    messages: [{ role: "user", content: `Matière : ${matiere}. Sujet : ${sujet}. Niveau : ${niveau}.` }],
    modelTier: "default",
    signal,
  });
  const text = r.text.trim();
  if (!text || r.truncated) throw new Error("consigne vide ou tronquée");
  return text;
}
