// pdf.js (CDN autorisé par la CSP des artifacts). Le worker passe par un blob ;
// si le navigateur le refuse, pdf.js retombe sur un worker sur le thread principal.
const BASE = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
const SCAN_MPX = 1.5e6; // la plateforme réduit de toute façon à ~1,2 Mpx

let lib;
function load() {
  return (lib ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = BASE + "pdf.min.js";
    s.onload = () => {
      const l = window.pdfjsLib;
      const worker = `importScripts("${BASE}pdf.worker.min.js")`;
      l.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
      res(l);
    };
    s.onerror = () => { lib = null; rej(new Error("pdf.js introuvable")); };
    document.head.append(s);
  }));
}

export async function openPdf(file) {
  return (await load()).getDocument({ data: await file.arrayBuffer() }).promise;
}

// Pages numérotées à partir de 1.
export async function pageText(doc, n) {
  const { items } = await (await doc.getPage(n)).getTextContent();
  return items.map((i) => i.str + (i.hasEOL ? "\n" : "")).join("");
}

export async function renderPage(doc, n) {
  const page = await doc.getPage(n);
  const { width, height } = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.sqrt(SCAN_MPX / (width * height)) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("rendu de page échoué"))), "image/jpeg", 0.85));
}
