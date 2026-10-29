// Mini-Markdown pour les réponses de l'assistant : paragraphes, listes « - » / « 1. », **gras**. Rien d'autre.
// Le DOM est construit avec textContent : jamais de HTML venant du modèle.

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;

/** Texte -> blocs : { type: "p" | "ul" | "ol", items: string[] } (un seul item pour "p"). */
export function parseBlocks(text) {
  const blocks = [];
  let cur = null;
  const flush = () => { if (cur) blocks.push(cur); cur = null; };
  const add = (type, line, join) => {
    if (cur?.type === type) { if (join) cur.items[0] += " " + line; else cur.items.push(line); }
    else { flush(); cur = { type, items: [line] }; }
  };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const b = raw.match(BULLET), n = raw.match(NUMBER);
    if (b) add("ul", b[1].trim());
    else if (n) add("ol", n[1].trim());
    else add("p", line, true);
  }
  flush();
  return blocks;
}

/** Texte avec **gras** -> [{ text, bold }]. */
export function parseInline(s) {
  return s.split(/\*\*(.+?)\*\*/g).map((text, i) => ({ text, bold: i % 2 === 1 })).filter((x) => x.text);
}

function inline(parent, s) {
  for (const { text, bold } of parseInline(s)) {
    if (bold) { const b = document.createElement("strong"); b.textContent = text; parent.append(b); }
    else parent.append(text);
  }
}

/** Texte -> tableau de nœuds <p>, <ul>, <ol>. */
export function renderMarkdown(text) {
  return parseBlocks(text).map(({ type, items }) => {
    const root = document.createElement(type);
    if (type === "p") inline(root, items[0]);
    else for (const it of items) { const li = document.createElement("li"); inline(li, it); root.append(li); }
    return root;
  });
}
