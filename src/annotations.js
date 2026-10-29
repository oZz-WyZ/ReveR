// Modèle des annotations dessinées (stylo, surligneur) : traits en coordonnées relatives à la page (0..1)
// et historique annuler / rétablir. Aucun DOM ici : le dessin est dans ui/ink.js.
// Trait : { id, p (page, depuis 0), tool: "pen" | "hl", color, w (épaisseur, relative à la largeur de page), pts: [[x, y], ...] }
// Texte : même forme avec tool "text", w = taille de police (relative à la largeur), pts = [[x, y]] (coin haut-gauche) et text.

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Boîte approximative (en pixels) d'un texte posé sur une page de W x H pixels. */
export function textBox(s, W, H) {
  const lines = s.text.split("\n"), size = s.w * W;
  return { x: s.pts[0][0] * W, y: s.pts[0][1] * H, w: Math.max(...lines.map((l) => l.length)) * size * 0.55, h: lines.length * size * 1.25 };
}

/** Le point (x, y) relatif touche-t-il le trait à `r` pixels près, sur une page de W x H pixels ? */
export function strokeHit(s, x, y, r, W, H) {
  const px = x * W, py = y * H;
  if (s.tool === "text") {
    const b = textBox(s, W, H);
    return px >= b.x - r && px <= b.x + b.w + r && py >= b.y - r && py <= b.y + b.h + r;
  }
  const reach = r + (s.w * W) / 2;
  const pts = s.pts;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[Math.min(i + 1, pts.length - 1)];
    if (distToSegment(px, py, ax * W, ay * H, bx * W, by * H) <= reach) return true;
  }
  return false;
}

export function createModel(initial = []) {
  let list = [...initial], past = [], future = [];
  const ids = (ss) => new Set(ss.map((s) => s.id));
  // Une entrée d'historique est { add: [...] }, { del: [...] } ou { swap: [avant, après] } ; l'annuler fait l'inverse.
  const apply = (e, reverse) => {
    if (e.swap) { const [from, to] = reverse ? [e.swap[1], e.swap[0]] : e.swap; list = list.map((s) => (s.id === from.id ? to : s)); return; }
    const adding = reverse ? !e.add : !!e.add;
    const ss = e.add ?? e.del;
    list = adding ? [...list, ...ss] : list.filter((s) => !ids(ss).has(s.id));
  };
  return {
    list: () => list,
    /** Remplace tout (changement de cours) : l'historique repart de zéro. */
    set(l) { list = [...l]; past = []; future = []; },
    add(s) { list = [...list, s]; past.push({ add: [s] }); future = []; },
    remove(ss) {
      if (!ss.length) return;
      list = list.filter((s) => !ids(ss).has(s.id));
      past.push({ del: ss }); future = [];
    },
    /** Remplace un trait par une version modifiée (même id) : une seule entrée d'historique. */
    replace(before, after) { list = list.map((s) => (s.id === before.id ? after : s)); past.push({ swap: [before, after] }); future = []; },
    undo() { const e = past.pop(); if (!e) return false; apply(e, true); future.push(e); return true; },
    redo() { const e = future.pop(); if (!e) return false; apply(e, false); past.push(e); return true; },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
