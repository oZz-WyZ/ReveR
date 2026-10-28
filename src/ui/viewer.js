import { extractPdfPages, loadPdfLib, openPdf } from "../extract/pdf.js";
import { overlap } from "../extract/layout.js";

const MAX_PAGE_W = 820; // largeur d'une page, comme un aperçu avant impression (A4 ≈ 794 px)

const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

/**
 * Visionneuse de l'original (PDF page par page, ou photo). Pour un PDF à couche texte, un calque de texte
 * invisible reste sélectionnable et les surlignages sont dessinés d'après les offsets de doc.text.
 */
export function createViewer(root) {
  let st = null, token = 0, lastW = 0, timer, observer;

  function clear() {
    observer?.disconnect();
    if (st?.url) URL.revokeObjectURL(st.url);
    root.replaceChildren();
    st = null;
  }

  // --- rendu des pages (paresseux : seulement celles proches de l'écran) ---
  async function renderPage(i) {
    const pg = st.pages[i], my = st.build;
    if (pg.rendered) return;
    pg.rendered = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = el("canvas");
    const vp2 = pg.page.getViewport({ scale: pg.vp.scale * dpr });
    canvas.width = Math.ceil(vp2.width); canvas.height = Math.ceil(vp2.height);
    canvas.style.width = pg.vp.width + "px"; canvas.style.height = pg.vp.height + "px";
    await pg.page.render({ canvasContext: canvas.getContext("2d"), viewport: vp2 }).promise;
    if (st?.build !== my) return;
    pg.hl = el("div", "hl-layer");
    pg.el.append(canvas, pg.hl);
    if (!st.layout) return;
    const tc = await pg.page.getTextContent();
    const items = tc.items.filter((it) => typeof it.str === "string");
    const layer = el("div", "textLayer"), divs = [];
    pg.el.append(layer);
    await (await loadPdfLib()).renderTextLayer({ textContentSource: tc, container: layer, viewport: pg.vp, textDivs: divs }).promise;
    if (st?.build !== my || divs.length !== items.length) return; // décalage : pas de sélection sur cette page
    divs.forEach((d, k) => { d.dataset.p = i; d.dataset.i = k; });
    pg.divs = divs;
    paint(i);
  }

  function paint(i) {
    const pg = st?.pages[i];
    if (!pg?.divs || !pg.hl) return;
    pg.hl.replaceChildren();
    const box = pg.el.getBoundingClientRect(), lay = st.layout.pages[i];
    for (const c of st.comments) {
      if (c.orphan || !c.range) continue;
      for (const { i: k, a, b } of overlap(lay, c.range.start, c.range.end)) {
        const tn = pg.divs[k]?.firstChild;
        if (tn?.nodeType !== 3) continue;
        const r = document.createRange();
        r.setStart(tn, Math.min(a, tn.length)); r.setEnd(tn, Math.min(b, tn.length));
        for (const q of r.getClientRects()) {
          const h = el("div", "hl");
          h.dataset.id = c.id;
          Object.assign(h.style, { left: q.left - box.left + "px", top: q.top - box.top + "px", width: q.width + "px", height: q.height + "px" });
          pg.hl.append(h);
        }
      }
    }
  }

  async function build() {
    const avail = root.clientWidth;
    if (!avail) return; // masqué : on ne touche à rien (les pages déjà là restent) ; refresh() relancera au réaffichage
    const my = (st.build = (st.build ?? 0) + 1);
    observer?.disconnect();
    root.replaceChildren();
    lastW = avail; // largeur disponible (et non celle de la page) : sert à détecter un vrai redimensionnement
    const width = Math.min(avail, MAX_PAGE_W);
    st.pages = [];
    observer = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && renderPage(e.target.__i)), { rootMargin: "800px 0px" });
    for (let n = 1; n <= st.pdf.numPages; n++) {
      const page = await st.pdf.getPage(n);
      if (st?.build !== my) return;
      const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const box = el("div", "pdf-page");
      box.style.width = vp.width + "px"; box.style.height = vp.height + "px";
      box.__i = n - 1;
      root.append(box);
      st.pages.push({ el: box, page, vp, rendered: false });
      observer.observe(box);
    }
  }

  // Réajuste les pages quand le panneau change de largeur (fenêtre, repli, disposition).
  new ResizeObserver(() => {
    if (st?.kind !== "pdf" || !root.clientWidth || Math.abs(root.clientWidth - lastW) < 24) return;
    clearTimeout(timer);
    timer = setTimeout(() => st?.kind === "pdf" && build(), 250);
  }).observe(root);

  // --- sélection : (nœud, décalage) -> offset dans doc.text ---
  function locate(node, offset, isEnd) {
    const from = node.nodeType === 3 ? node.parentElement : node;
    const d = from?.closest?.("[data-i]");
    if (d) {
      const it = st.layout.pages[+d.dataset.p].items[+d.dataset.i], len = it.end - it.start;
      const ch = node.nodeType === 3 ? offset : offset > 0 ? len : 0;
      return it.start + Math.min(ch, len);
    }
    const layer = from?.closest?.(".textLayer"); // frontière entre deux morceaux de texte
    if (!layer) return null;
    const kids = [...layer.childNodes];
    const near = (isEnd ? kids.slice(0, offset).reverse() : kids.slice(offset)).find((k) => k.dataset?.i !== undefined);
    if (!near) return null;
    const it = st.layout.pages[+near.dataset.p].items[+near.dataset.i];
    return isEnd ? it.end : it.start;
  }

  return {
    root,
    get kind() { return st?.kind ?? null; },
    /** @returns {Promise<{ok:boolean, kind?:string, canComment?:boolean}>} */
    async open({ doc, blob }) {
      clear();
      const my = ++token;
      try {
        if (blob.type.startsWith("image/")) {
          const url = URL.createObjectURL(blob);
          const img = el("img", "orig-img");
          img.src = url; img.alt = "Cours d'origine";
          root.append(img);
          st = { kind: "image", url, pages: [], comments: [] };
          return { ok: true, kind: "image", canComment: false };
        }
        const pdf = await openPdf(blob);
        let layout = null;
        if (doc.method === "pdf-text") {
          layout = await extractPdfPages(pdf);
          if (layout.text !== doc.text) layout = null; // texte différent de l'original : pas de surlignage sur le PDF
        }
        if (my !== token) return { ok: false };
        st = { kind: "pdf", pdf, layout, pages: [], comments: [] };
        await build();
        return { ok: true, kind: "pdf", canComment: !!layout };
      } catch {
        clear();
        return { ok: false };
      }
    },
    close() { token++; clear(); },
    /** À appeler quand le conteneur vient d'être affiché : (re)calcule les pages à la bonne largeur. */
    refresh() { if (st?.kind === "pdf" && (!root.childElementCount || Math.abs(root.clientWidth - lastW) >= 24)) build(); },
    setComments(comments) {
      if (!st) return;
      st.comments = comments ?? [];
      st.pages.forEach((_, i) => paint(i));
    },
    /** Sélection courante sur le PDF : { start, end, rect } en offsets de doc.text, ou null. */
    selection() {
      if (!st?.layout) return null;
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return null;
      const r = sel.getRangeAt(0);
      if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
      const start = locate(r.startContainer, r.startOffset, false), end = locate(r.endContainer, r.endOffset, true);
      return start == null || end == null || end <= start ? null : { start, end, rect: r.getBoundingClientRect() };
    },
    /** Surlignages sous un point de l'écran : [{ id, rect }]. */
    hit(x, y) {
      const out = [];
      for (const h of root.querySelectorAll(".hl")) {
        const r = h.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && !out.some((o) => o.id === h.dataset.id)) out.push({ id: h.dataset.id, rect: r });
      }
      return out;
    },
    rectOf(id) { return root.querySelector(`.hl[data-id="${id}"]`)?.getBoundingClientRect() ?? null; },
  };
}
