import { openPdf, pageText, renderPage } from "./pdf.js";
import { transcribe } from "./transcribe.js";

export const MAX_PAGES_SCAN = 20;    // chemin transcription : 1 appel vision facturé par lot
export const MAX_PAGES_TEXTE = 500;  // chemin pdf.js : gratuit, plafond de sécurité seulement
export const PAGES_DETECTION = 10;   // pages échantillonnées pour décider natif / scanné
export const SEUIL_MOYENNE = 50;     // caractères non blancs par page, en moyenne
export const SEUIL_PAGE_VIDE = 20;   // une page sous ce seuil compte comme vide

const fail = (code, message) => Object.assign(new Error(message), { code });

/** counts = caractères non blancs par page échantillonnée. */
export function isScanned(counts) {
  if (!counts.length) return true;
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const empty = counts.filter((c) => c < SEUIL_PAGE_VIDE).length;
  return avg < SEUIL_MOYENNE || empty > counts.length / 2;
}

/** @returns {Promise<{text:string, method:"pdf-text"|"ocr", truncated:boolean}>} */
export async function extractText(file, { signal, onProgress } = {}) {
  if (/^image\/(jpeg|png)$/.test(file.type)) {
    const r = await transcribe(1, async () => file, { signal, onProgress });
    return { ...r, method: "ocr" };
  }
  if (file.type !== "application/pdf") throw fail("unsupported", "Formats acceptés : PDF, JPEG, PNG.");

  let doc;
  try { doc = await openPdf(file); } catch { throw fail("pdf_unreadable", "PDF illisible."); }
  const n = doc.numPages;

  const texts = [];
  for (let p = 1; p <= Math.min(PAGES_DETECTION, n); p++) texts.push(await pageText(doc, p));
  const counts = texts.map((t) => t.replace(/\s/g, "").length);

  if (isScanned(counts)) {
    if (n > MAX_PAGES_SCAN) throw fail("too_many_pages", `PDF scanné de ${n} pages : maximum ${MAX_PAGES_SCAN}.`);
    const r = await transcribe(n, (i) => renderPage(doc, i + 1), { signal, onProgress });
    return { ...r, method: "ocr" };
  }
  if (n > MAX_PAGES_TEXTE) throw fail("too_many_pages", `PDF de ${n} pages : maximum ${MAX_PAGES_TEXTE}.`);
  for (let p = texts.length + 1; p <= n; p++) {
    if (signal?.aborted) throw fail("cancelled", "annulé");
    texts.push(await pageText(doc, p));
    onProgress?.({ done: p, total: n });
  }
  return { text: texts.map((t) => t.trim()).join("\n\n"), method: "pdf-text", truncated: false };
}
