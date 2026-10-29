// Modèle des annotations dessinées (stylo, surligneur) : traits en coordonnées relatives à la page (0..1)
// et historique annuler / rétablir. Aucun DOM ici : le dessin est dans ui/ink.js.
// Trait : { id, p (page, depuis 0), tool: "pen" | "hl", color, w (épaisseur, relative à la largeur de page), pts: [[x, y], ...] }

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Le point (x, y) relatif touche-t-il le trait à `r` pixels près, sur une page de W x H pixels ? */
export function strokeHit(s, x, y, r, W, H) {
  const reach = r + (s.w * W) / 2;
  const px = x * W, py = y * H;
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
  // Une entrée d'historique est { add: [...] } ou { del: [...] } ; l'annuler fait l'inverse.
  const apply = (e, reverse) => {
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
    undo() { const e = past.pop(); if (!e) return false; apply(e, true); future.push(e); return true; },
    redo() { const e = future.pop(); if (!e) return false; apply(e, false); past.push(e); return true; },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
