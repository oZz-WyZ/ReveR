import { askAI } from "./ai/index.js";

const MAX_CHARS = 4000;

const system = (matieres) =>
  "Tu ranges un cours dans la bonne matière de l'élève, d'après le nom du fichier et le début du texte.\n" +
  'Réponds uniquement par un objet JSON {"matiere": string | null, "confiance": "haute" | "moyenne" | "faible"}.\n' +
  '- matiere : l\'identifiant EXACT d\'une matière de la liste, ou null si aucune ne correspond clairement.\n' +
  '- confiance : "faible" si tu hésites entre plusieurs matières ou si le cours ne ressemble à aucune.\n' +
  "Liste des matières (identifiant : nom) :\n" + matieres.map((m) => `- ${m.id} : ${m.nom}`).join("\n");

/** Valide la sortie du modèle : identifiant inconnu -> null, confiance inconnue -> faible. Ne lève jamais. */
export function parseClassification(data, matieres) {
  const id = typeof data?.matiere === "string" ? data.matiere.trim() : "";
  const matiereId = matieres.some((m) => m.id === id) ? id : null;
  const confiance = ["haute", "moyenne"].includes(data?.confiance) ? data.confiance : "faible";
  return { matiereId, confiance };
}

/** Le classement est sûr : on range sans demander. Sinon l'app demande à l'élève. */
export const isSure = (c) => !!c.matiereId && c.confiance !== "faible";

/** @returns {Promise<{matiereId: string|null, confiance: string}>} */
export async function classify({ name, text, matieres, signal }) {
  const r = await askAI({
    system: system(matieres),
    messages: [{ role: "user", content: `Nom du fichier : ${name}\n\nDébut du cours :\n${text.slice(0, MAX_CHARS)}` }],
    json: true,
    modelTier: "quick",
    signal,
  });
  return parseClassification(r.data, matieres);
}
