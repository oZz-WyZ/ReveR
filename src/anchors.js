// Ancrage des commentaires sur doc.text : offsets (rapides) + quote/prefix/suffix (robustes).
const CTX = 30;

export function makeAnchor(text, start, end) {
  return {
    range: { start, end },
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CTX), start),
    suffix: text.slice(end, end + CTX),
  };
}

const commonSuffix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a.at(-1 - i) === b.at(-1 - i)) i++; return i; };
const commonPrefix = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };

/** Renvoie le commentaire avec range à jour, ou orphan:true si la quote a disparu. Ne lève jamais. */
export function relocate(text, c) {
  const { quote, range, prefix = "", suffix = "" } = c;
  if (!quote) return { ...c, orphan: true };
  if (range && text.slice(range.start, range.end) === quote) return { ...c, orphan: false };
  let best = null;
  for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) {
    const score =
      commonSuffix(text.slice(Math.max(0, i - prefix.length), i), prefix) +
      commonPrefix(text.slice(i + quote.length, i + quote.length + suffix.length), suffix);
    const dist = Math.abs(i - (range?.start ?? 0));
    if (!best || score > best.score || (score === best.score && dist < best.dist)) best = { i, score, dist };
  }
  return best
    ? { ...c, ...makeAnchor(text, best.i, best.i + quote.length), orphan: false }
    : { ...c, orphan: true };
}

// Les orphelins sont retentés à chaque fois : un texte restauré les rattache de nouveau.
export const relocateAll = (text, comments) => comments.map((c) => relocate(text, c));

/** Découpe le texte aux bornes des surlignages : [{ start, end, ids }], sans chevauchement entre segments. */
export function segments(comments) {
  const live = comments.filter((c) => !c.orphan && c.range && c.range.end > c.range.start);
  const cuts = [...new Set(live.flatMap((c) => [c.range.start, c.range.end]))].sort((a, b) => a - b);
  const out = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    const [start, end] = [cuts[k], cuts[k + 1]];
    const ids = live.filter((c) => c.range.start <= start && c.range.end >= end).map((c) => c.id);
    if (ids.length) out.push({ start, end, ids });
  }
  return out;
}
