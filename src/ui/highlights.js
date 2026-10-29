import { makeAnchor, segments } from "../anchors.js";
import { askPassage } from "../chat/ask.js";

const MIN_CHARS = 3, MAX_CHARS = 1000;
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ERRORS = {
  not_granted: "Accès refusé : vérifie le code d'accès (ou l'autorisation Claude).",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function card(c, orphan = false) {
  const d = el("div", "card");
  const q = el("blockquote", "passage");
  q.append(el("strong", null, orphan ? "Passage introuvable : " : "Passage : "), c.quote);
  d.append(q, el("p", "ask", "Ta question : " + c.question));
  d.append(el("p", null, c.reponse));
  return d;
}

/** Sélection -> question -> commentaire surligné. getDoc() = doc courant ; saveComments(list) persiste puis rappelle render(). */
export function createHighlights({ reader, viewer, getMode, getDoc, saveComments }) {
  let pending = null, popOpen = false, busy = false;
  const btn = $("ask-btn"), pop = $("ask-pop"), input = $("ask-input"), status = $("ask-status");

  const hideBtn = () => { btn.hidden = true; pending = null; };
  const closePop = () => { pop.hidden = true; popOpen = false; status.textContent = ""; input.value = ""; };

  // Place `node` sous `rect`, sans dépasser du panneau (on le rend visible un instant pour le mesurer).
  function place(node, rect) {
    const box = $("doc").getBoundingClientRect();
    const wasHidden = node.hidden;
    node.hidden = false;
    node.style.left = Math.min(Math.max(0, rect.left - box.left), Math.max(0, box.width - node.offsetWidth)) + "px";
    node.style.top = rect.bottom - box.top + 6 + "px";
    node.hidden = wasHidden;
  }
  const closeCards = () => { $("cards").hidden = true; $("cards").replaceChildren(); };

  function onSelection() {
    if (popOpen || busy) return;
    const doc = getDoc();
    const surface = getMode() === "original" ? viewer : reader; // PDF d'origine ou texte
    const s = !surface.isEditing?.() && doc?.consigne ? surface.selection() : null;
    if (!s) return hideBtn();
    // on rogne les espaces de bord pour que la quote commence et finisse sur du texte
    let { start, end } = s;
    while (start < end && /\s/.test(doc.text[start])) start++;
    while (end > start && /\s/.test(doc.text[end - 1])) end--;
    if (end - start < MIN_CHARS || end - start > MAX_CHARS) return hideBtn();
    pending = makeAnchor(doc.text, start, end);
    place(btn, s.rect);
    btn.hidden = false;
  }
  document.addEventListener("selectionchange", onSelection);

  btn.onmousedown = (e) => e.preventDefault(); // garde la sélection
  btn.onclick = () => {
    if (!pending) return;
    place(pop, getSelection().getRangeAt(0).getBoundingClientRect());
    btn.hidden = true; pop.hidden = false; popOpen = true;
    input.focus();
  };
  $("ask-cancel").onclick = () => { closePop(); hideBtn(); };

  pop.onsubmit = async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question || busy || !pending) return;
    const selRect = getSelection().rangeCount ? getSelection().getRangeAt(0).getBoundingClientRect() : null;
    busy = true;
    status.textContent = "Réflexion…"; status.className = "";
    const doc = getDoc();
    try {
      const a = await askPassage({ doc, passage: pending.quote, question });
      if (getDoc()?.id !== doc.id) return; // l'élève a changé de cours pendant l'appel
      const c = { id: uid(), ...pending, question, reponse: a.reponse, source: a.source, orphan: false, createdAt: Date.now() };
      closePop(); hideBtn();
      getSelection().removeAllRanges();
      saveComments([...(getDoc().comments ?? []), c]);
      const anchor = getMode() === "original" ? viewer.rectOf(c.id) : reader.el.querySelector(`mark[data-ids~="${c.id}"]`)?.getBoundingClientRect();
      openCards([c.id], anchor ?? selRect ?? reader.el.getBoundingClientRect());
    } catch (err) {
      status.textContent = ERRORS[err.code] ?? "La réponse n'a pas pu être obtenue. Réessaie.";
      status.className = "err";
    } finally { busy = false; }
  };

  // Pop-over ancré sous `rect` (le surlignage cliqué).
  function openCards(ids, rect) {
    const all = getDoc().comments ?? [];
    const box = $("cards");
    const list = ids.map((id) => all.find((c) => c.id === id)).filter(Boolean); // « __ref » (réponse de l'assistant) n'est pas un commentaire
    if (!list.length) return;
    box.replaceChildren(...list
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => {
        const d = card(c);
        const close = el("button", "ghost", "Fermer");
        close.type = "button"; close.onclick = closeCards;
        d.append(close);
        return d;
      }));
    box.hidden = false;
    place(box, rect);
  }

  // Fermeture : Échap, ou clic en dehors du pop-over et des surlignages
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCards(); if (!busy) { closePop(); hideBtn(); } } });
  document.addEventListener("mousedown", (e) => {
    if (!$("cards").hidden && !e.target.closest("#cards, mark")) closeCards();
  });

  // Clic sur un surlignage (et pas fin d'une sélection à la souris)
  reader.el.addEventListener("click", (e) => {
    const m = e.target.closest?.("mark");
    if (m && getSelection().isCollapsed) openCards(m.dataset.ids.split(" "), m.getBoundingClientRect());
  });

  // Clic sur un surlignage du PDF
  viewer.root.addEventListener("click", (e) => {
    if (!getSelection().isCollapsed) return;
    const hits = viewer.hit(e.clientX, e.clientY);
    if (hits.length) openCards(hits.map((h) => h.id), hits[0].rect);
  });

  // Passage cité par l'assistant : surligné comme un commentaire (même jaune) dans le texte et dans le PDF, sans carte.
  let ref = null, last = null;
  const withRef = (comments) => (ref ? [...comments, { id: "__ref", range: ref, orphan: false }] : comments);

  return {
    /** Réaffiche le texte (surligné en lecture, brut en correction) et la liste des orphelins. */
    render(doc, editing) {
      last = { doc, editing };
      const comments = doc.comments ?? [];
      const all = withRef(comments);
      hideBtn(); closePop(); closeCards();
      editing ? reader.show(doc.text) : reader.showMarked(doc.text, segments(all));
      viewer.setComments(all);
      const orphans = comments.filter((c) => c.orphan);
      $("orphans").hidden = !orphans.length;
      $("orphans-list").replaceChildren(...orphans.map((c) => card(c, true)));
    },
    /** Surligne un passage (offsets dans doc.text) ou l'efface (null). `redraw:false` : pas de réaffichage. */
    setRef(range, redraw = true) {
      ref = range;
      if (redraw && last) this.render(last.doc, last.editing);
    },
    /** Fait défiler la vue affichée jusqu'au passage surligné. */
    reveal() {
      if (getMode() === "original") viewer.reveal("__ref");
      else reader.el.querySelector('mark[data-ids~="__ref"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
  };
}
