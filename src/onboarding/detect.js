import { askAI } from "../ai/index.js";

export const NIVEAUX = ["collège", "lycée", "supérieur"];
const MAX_CHARS = 6000;

const SYSTEM =
  "Tu identifies la matière et le sujet d'un cours à partir de son texte et du nom du fichier.\n" +
  'Réponds uniquement par un objet JSON de la forme {"matiere": string, "sujet": string, "niveau_estime": "collège" | "lycée" | "supérieur"}.\n' +
  '- matiere : la discipline, en un ou deux mots (ex. "Histoire", "Droit civil").\n' +
  "- sujet : le chapitre ou thème précis, en moins de 12 mots.\n" +
  "- niveau_estime : le niveau scolaire que suggèrent le vocabulaire et la difficulté.\n" +
  "Le nom du fichier est un indice, pas une preuve : le contenu prime.";

// Défensif : un champ absent ou invalide devient "" et l'élève le remplit.
export function parseDetection(data) {
  const s = (v) => (typeof v === "string" ? v.trim() : "");
  const d = data && typeof data === "object" ? data : {};
  const niveau = s(d.niveau_estime);
  return { matiere: s(d.matiere), sujet: s(d.sujet), niveau_estime: NIVEAUX.includes(niveau) ? niveau : "" };
}

export async function detectSubject({ name, text, signal }) {
  const r = await askAI({
    system: SYSTEM,
    messages: [{ role: "user", content: `Nom du fichier : ${name}\n\nDébut du cours :\n${text.slice(0, MAX_CHARS)}` }],
    json: true,
    modelTier: "quick",
    signal,
  });
  return parseDetection(r.data);
}
