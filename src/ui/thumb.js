import { openPdf } from "../extract/pdf.js";

const WIDTH = 360; // px : assez net pour une card, léger en mémoire
const cache = new Map(); // id -> Promise<url|null> ; la miniature ne change pas tant que l'original ne change pas

async function make(blob) {
  if (blob.type.startsWith("image/")) return URL.createObjectURL(blob);
  const page = await (await openPdf(blob)).getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: WIDTH / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.8);
}

/** Miniature (URL) de la 1re page de l'original, ou null s'il n'y en a pas / si le rendu échoue. */
export function thumbnail(id, blob) {
  if (!blob) return Promise.resolve(null);
  if (!cache.has(id)) cache.set(id, make(blob).catch(() => null));
  return cache.get(id);
}
