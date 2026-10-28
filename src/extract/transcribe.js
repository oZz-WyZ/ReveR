import { askAI, aiLimits } from "../ai/index.js";

export const PAGES_PAR_APPEL = 4; // plafonné par la vraie limite du runtime (aiLimits)

const SYSTEM =
  "Tu transcris des pages de cours en texte brut. " +
  "Recopie fidèlement le texte visible, dans l'ordre de lecture, sans rien résumer ni ajouter. " +
  "Sépare les titres et les paragraphes par une ligne vide, et mets les listes une puce par ligne. " +
  "Si un passage est illisible, écris [illisible]. Réponds uniquement par la transcription.";

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** @param {number} total  nombre de pages
 *  @param {(i:number)=>Promise<Blob>} getImage  i = index 0-based
 *  @returns {Promise<{text:string, truncated:boolean}>} */
export async function transcribe(total, getImage, { signal, onProgress } = {}) {
  const { maxImages } = await aiLimits();
  const size = Math.min(PAGES_PAR_APPEL, maxImages);
  if (size < 1) throw Object.assign(new Error("images non disponibles dans ce mode"), { code: "images_unavailable" });

  const parts = [];
  let truncated = false;
  for (const idx of chunk([...Array(total).keys()], size)) {
    if (signal?.aborted) throw Object.assign(new Error("annulé"), { code: "cancelled" });
    onProgress?.({ done: idx[0], total });
    const images = [];
    for (const i of idx) images.push(await getImage(i));
    const r = await askAI({
      system: SYSTEM,
      messages: [{ role: "user", content: `Transcris les pages jointes (pages ${idx[0] + 1} à ${idx.at(-1) + 1} sur ${total}).` }],
      images,
      modelTier: "default", // "quick" est trop approximatif pour de l'OCR
      signal,
    });
    parts.push(r.text.trim());
    truncated ||= r.truncated;
  }
  onProgress?.({ done: total, total });
  return { text: parts.join("\n\n"), truncated };
}
