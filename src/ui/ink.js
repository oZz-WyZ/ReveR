import { createModel, strokeHit } from "../annotations.js";

export const PALETTES = {
  pen: ["#1f1f1f", "#d64545", "#2e6fd6", "#2e9d57"],
  hl: ["#ffe066", "#8ee6a1", "#ff9ec4", "#8cc8ff"],
};
PALETTES.text = PALETTES.pen;
export const WIDTHS = { pen: [0.0025, 0.005, 0.009], hl: [0.018, 0.026, 0.036], text: [0.016, 0.024, 0.036] }; // relatives à la largeur de la page (texte : taille de police)
const ERASE_PX = 10;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * Calque de dessin posé sur chaque page de la visionneuse (un canvas par page, voir attach).
 * Outils : select (aucune capture, le texte reste sélectionnable), pen, hl (surligneur), eraser (efface le trait touché).
 * onChange(strokes) est appelé après chaque trait ajouté ou effacé, pour persister.
 */
export function createInk({ onChange } = {}) {
  let onState = null;
  const model = createModel();
  const pages = new Map(); // p -> { box, canvas }
  const sel = { tool: "select", color: { pen: 0, hl: 0, text: 0 }, size: { pen: 1, hl: 1, text: 1 } };
  let cur = null, pending = null, editing = null; // editing : id du texte en cours de modification (masqué sur le canvas) // trait en cours / traits touchés par la gomme pendant le geste

  const size = (box) => ({ W: box.clientWidth, H: box.clientHeight });

  function drawStroke(ctx, s, W, H) {
    if (s.tool === "text") {
      const size = s.w * W;
      ctx.globalAlpha = 1; ctx.fillStyle = s.color; ctx.font = `${size}px system-ui, sans-serif`; ctx.textBaseline = "top";
      s.text.split("\n").forEach((l, i) => ctx.fillText(l, s.pts[0][0] * W, s.pts[0][1] * H + i * size * 1.25));
      return;
    }
    ctx.globalAlpha = s.tool === "hl" ? 0.4 : 1;
    ctx.strokeStyle = s.color; ctx.lineWidth = s.w * W; ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    const [first, ...rest] = s.pts.map(([x, y]) => [x * W, y * H]);
    ctx.moveTo(...first);
    rest.forEach((q, i) => {
      const prev = i ? rest[i - 1] : first;
      ctx.quadraticCurveTo(prev[0], prev[1], (prev[0] + q[0]) / 2, (prev[1] + q[1]) / 2); // lissé par les milieux
    });
    ctx.lineTo(...(rest.at(-1) ?? first));
    ctx.stroke();
  }

  function draw(p) {
    const rec = pages.get(p);
    if (!rec) return;
    const { W, H } = size(rec.box);
    if (!W || !H) return;
    const ctx = rec.canvas.getContext("2d");
    ctx.setTransform(rec.canvas.width / W, 0, 0, rec.canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of model.list()) if (s.p === p && !pending?.has(s.id) && s.id !== editing) drawStroke(ctx, s, W, H);
    if (cur?.p === p) drawStroke(ctx, cur, W, H);
    ctx.globalAlpha = 1;
  }
  const drawAll = () => pages.forEach((_, p) => draw(p));
  const state = () => onState?.({ tool: sel.tool, color: sel.color, size: sel.size, canUndo: model.canUndo(), canRedo: model.canRedo(), count: model.list().length });
  const changed = () => { onChange?.(model.list()); state(); };

  function eraseAt(p, pt) {
    const { W, H } = size(pages.get(p).box);
    for (const s of model.list()) if (s.p === p && !pending.has(s.id) && strokeHit(s, pt[0], pt[1], ERASE_PX, W, H)) pending.add(s.id);
    draw(p);
  }

  // Texte : un champ posé à l'endroit du clic ; Entrée ou perte du focus l'enregistre, Échap l'annule, Maj+Entrée saute une ligne.
  function typeAt(p, pt, existing) {
    const { box } = pages.get(p), { W } = size(box);
    const s = existing ? { ...existing } : { id: uid(), p, tool: "text", color: PALETTES.text[sel.color.text], w: WIDTHS.text[sel.size.text], pts: [pt], text: "" };
    if (existing) { editing = s.id; draw(p); }
    const ta = document.createElement("textarea");
    ta.className = "ink-text"; ta.rows = 1; ta.cols = 4;
    Object.assign(ta.style, { left: pt[0] * 100 + "%", top: pt[1] * 100 + "%", font: `${s.w * W}px/1.25 system-ui, sans-serif`, color: s.color });
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const text = ta.value.replace(/\s+$/, "");
      ta.remove();
      editing = null;
      if (save && existing && !text) model.remove([existing]); // texte vidé : il disparaît
      else if (save && existing && text !== existing.text) model.replace(existing, { ...s, text });
      else if (save && !existing && text) model.add({ ...s, text });
      draw(p);
      if (save && (text !== (existing?.text ?? ""))) changed();
    };
    ta.oninput = () => { const lines = ta.value.split("\n"); ta.rows = lines.length; ta.cols = Math.max(4, ...lines.map((l) => l.length + 1)); };
    ta.onblur = () => finish(true);
    ta.onkeydown = (e) => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); finish(true); }
    };
    ta.value = s.text; ta.oninput();
    box.append(ta);
    requestAnimationFrame(() => ta.focus()); // après le clic, qui sinon reprendrait le focus
  }

  function bind(p, canvas) {
    const rel = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    canvas.onpointerdown = (e) => {
      if (sel.tool === "select" || e.button > 0) return;
      canvas.setPointerCapture(e.pointerId);
      const pt = rel(e);
      if (sel.tool === "eraser") { pending = new Set(); eraseAt(p, pt); return; }
      if (sel.tool === "text") { // un clic sur un texte déjà posé le rouvre pour le modifier
        const { W, H } = size(pages.get(p).box);
        const hit = model.list().findLast((s) => s.tool === "text" && s.p === p && strokeHit(s, pt[0], pt[1], 4, W, H));
        typeAt(p, hit?.pts[0] ?? pt, hit);
        return;
      }
      const t = sel.tool;
      cur = { id: uid(), p, tool: t, color: PALETTES[t][sel.color[t]], w: WIDTHS[t][sel.size[t]], pts: [pt] };
      draw(p);
    };
    canvas.onpointermove = (e) => {
      if (pending) return eraseAt(p, rel(e));
      if (!cur || cur.p !== p) return;
      cur.pts.push(rel(e));
      draw(p);
    };
    const end = () => {
      if (pending) {
        const gone = model.list().filter((s) => pending.has(s.id));
        pending = null; model.remove(gone); drawAll(); if (gone.length) changed();
      } else if (cur) {
        if (cur.pts.length === 1) cur.pts.push(cur.pts[0]); // un simple clic laisse un point
        const done = cur; cur = null; model.add(done); draw(p); changed();
      }
    };
    canvas.onpointerup = canvas.onpointercancel = end;
  }

  const api = {
    /** Pose le calque sur la page `p` (depuis 0) : appelé par la visionneuse à chaque (re)construction. */
    attach(box, p) {
      const canvas = document.createElement("canvas");
      canvas.className = "ink";
      pages.set(p, { box, canvas });
      box.append(canvas);
      bind(p, canvas);
      new ResizeObserver(() => {
        const dpr = Math.min(2, window.devicePixelRatio || 1), { W, H } = size(box);
        if (!W || !H) return;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        draw(p);
      }).observe(box);
      api.setTool(sel.tool);
    },
    reset() { pages.clear(); },
    setStrokes(list) { model.set(list); drawAll(); state(); },
    setTool(t) {
      sel.tool = t;
      pages.forEach(({ canvas }) => { canvas.style.pointerEvents = t === "select" ? "none" : "auto"; canvas.style.cursor = t === "select" ? "" : t === "text" ? "text" : "crosshair"; });
      state();
    },
    setColor(i) { if (sel.tool in PALETTES) { sel.color[sel.tool] = i; state(); } },
    setSize(i) { if (sel.tool in PALETTES) { sel.size[sel.tool] = i; state(); } },
    /** Efface toutes les annotations (une seule entrée d'historique : « Annuler » les rend). Renvoie le nombre effacé. */
    clear() { const all = model.list(); model.remove(all); drawAll(); if (all.length) changed(); return all.length; },
    undo() { if (model.undo()) { drawAll(); changed(); } },
    redo() { if (model.redo()) { drawAll(); changed(); } },
    /** La barre d'outils s'abonne ici : render(état) est appelé à chaque changement. */
    bind(render) { onState = render; state(); },
  };
  return api;
}
