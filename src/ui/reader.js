// Panneau de lecture : vrai texte DOM (sélectionnable) — base des surlignages.
// Lecture seule par défaut ; éditable seulement en mode correction.
// contenteditable="plaintext-only" n'existe pas partout : repli sur "true" (texte lu via innerText).
export function createReader(el) {
  let editing = false;
  return {
    el,
    isEditing: () => editing,
    setEditable(on) {
      editing = on;
      if (!on) return void (el.contentEditable = "false");
      el.setAttribute("contenteditable", "plaintext-only");
      if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    },
    show: (text) => { el.textContent = text; },
    // Les <mark> ne changent pas textContent : les offsets restent ceux de `text`.
    showMarked(text, segs) {
      const frag = document.createDocumentFragment();
      let pos = 0;
      for (const s of segs) {
        if (s.start > pos) frag.append(text.slice(pos, s.start));
        const m = document.createElement("mark");
        m.dataset.ids = s.ids.join(" ");
        if (s.ids.length > 1) m.className = "multi";
        m.textContent = text.slice(s.start, s.end);
        frag.append(m);
        pos = s.end;
      }
      frag.append(text.slice(pos));
      el.replaceChildren(frag);
    },
    // innerText respecte les sauts de ligne rendus (white-space: pre-wrap)
    getText: () => el.innerText.replace(/\n{3,}/g, "\n\n").trim(),
    /** Sélection courante dans le panneau : offsets dans textContent + rectangle écran, ou null. */
    selection() {
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed) return null;
      const r = sel.getRangeAt(0);
      if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return null;
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.startContainer, r.startOffset);
      const start = pre.toString().length;
      return { start, end: start + r.toString().length, rect: r.getBoundingClientRect() };
    },
  };
}
