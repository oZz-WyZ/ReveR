import { levelLabel } from "../profile.js";

/** Consigne de l'assistant, construite sans appel IA : matière du cours + niveau de l'élève. */
export function buildConsigne(profil, matiere) {
  const quoi = matiere ? `expert en ${matiere}` : "expert de la matière du cours";
  const niveau = levelLabel(profil);
  return `Tu es un assistant de révision ${quoi}.${niveau ? ` Tu aides un élève de niveau ${niveau}.` : ""} Adapte le vocabulaire et la profondeur de tes réponses à ce niveau.`;
}
