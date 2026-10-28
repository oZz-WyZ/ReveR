// Texte d'un PDF à couche texte, avec la position de chaque morceau (item pdf.js) dans le texte complet.
// Sert à la fois à produire doc.text et à relier la sélection / les surlignages du visualiseur au texte.

/** pagesItems : [[{ str, hasEOL }]] -> { text, pages: [{ base, items: [{ start, end }] }] } */
export function layoutPages(pagesItems) {
  let text = "";
  const pages = [];
  pagesItems.forEach((items, p) => {
    if (p > 0) text += "\n\n";
    const base = text.length;
    const out = [];
    for (const it of items) {
      const start = text.length;
      text += it.str;
      out.push({ start, end: text.length });
      if (it.hasEOL) text += "\n";
    }
    pages.push({ base, items: out });
  });
  return { text, pages };
}

/** Morceaux d'une page qui recoupent [start, end[ : [{ i, a, b }] (a..b = caractères dans le morceau i). */
export function overlap(page, start, end) {
  const out = [];
  page.items.forEach((it, i) => {
    const a = Math.max(start, it.start), b = Math.min(end, it.end);
    if (a < b) out.push({ i, a: a - it.start, b: b - it.start });
  });
  return out;
}
