// Export du PDF annoté : l'original est copié tel quel (texte et mise en page conservés) et les annotations
// sont dessinées par-dessus en vectoriel avec pdf-lib (CDN autorisé par la CSP, comme pdf.js). Une photo devient une page PDF.

const URL_LIB = "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js";
const A4_W = 595; // largeur (pt) d'une page créée à partir d'une photo
const LINE = 1.25;

let lib;
function loadPdfWriter() {
  return (lib ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = URL_LIB;
    s.onload = () => res(window.PDFLib);
    s.onerror = () => { lib = null; rej(new Error("pdf-lib introuvable")); };
    document.head.append(s);
  }));
}

/** "#rrggbb" -> [r, g, b] entre 0 et 1. */
export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Trait -> chemin SVG en pixels d'une page pw x ph, origine en haut à gauche (axe y vers le bas). */
export function strokeToPath(s, pw, ph) {
  const [first, ...rest] = s.pts;
  const f = (n) => +n.toFixed(2);
  return `M ${f(first[0] * pw)} ${f(first[1] * ph)} ` + (rest.length ? rest : [first]).map(([x, y]) => `L ${f(x * pw)} ${f(y * ph)}`).join(" ");
}

// Helvetica standard ne connaît que WinAnsi : le reste devient « ? » plutôt que de faire échouer l'export.
const winAnsi = (t, font) => [...t].map((c) => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");

/** @param {Blob} blob original (PDF ou photo) @param {object[]} annotations traits (voir annotations.js) @returns {Promise<Blob>} */
export async function exportAnnotated(blob, annotations) {
  const { PDFDocument, StandardFonts, rgb, LineCapStyle } = await loadPdfWriter();
  let pdf, pages;
  if (blob.type.startsWith("image/")) {
    pdf = await PDFDocument.create();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = blob.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const page = pdf.addPage([A4_W, (A4_W * img.height) / img.width]);
    page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    pages = [page];
  } else {
    pdf = await PDFDocument.load(await blob.arrayBuffer());
    pages = pdf.getPages();
  }
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const s of annotations) {
    const page = pages[s.p];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize(); // shortcut: pages pivotées (/Rotate) non gérées, à traiter si un PDF pivoté mal placé apparaît
    const color = rgb(...hexToRgb(s.color));
    if (s.tool === "text") {
      const size = s.w * pw;
      s.text.split("\n").forEach((l, i) => page.drawText(winAnsi(l, font), { x: s.pts[0][0] * pw, y: ph - s.pts[0][1] * ph - size * 0.85 - i * size * LINE, size, font, color }));
    } else {
      page.drawSvgPath(strokeToPath(s, pw, ph), { x: 0, y: ph, borderColor: color, borderWidth: s.w * pw, borderOpacity: s.tool === "hl" ? 0.4 : 1, borderLineCap: LineCapStyle.Round });
    }
  }
  return new Blob([await pdf.save()], { type: "application/pdf" });
}

/** Télécharge un blob sous le nom donné. */
export function download(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
