import { makeAnchor, segments } from "../anchors.js";
import { askPassage } from "../chat/ask.js";

const MIN_CHARS = 3, MAX_CHARS = 1000;
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ERRORS = {
  not_granted: "Autorise Claude pour obtenir une réponse.",
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
  d.append(el("span", "badge " + c.source, c.source === "cours" ? "d'après ton cours" : "connaissances générales"));
  d.append(el("p", null, c.reponse));
  return d;
}

/** Sélection -> question -> commentaire surligné. getDoc() = doc courant ; saveComments(list) persiste puis rappelle render(). */
export function createHighlights({ reader, getDoc, saveComments }) {
  let pending = null, popOpen = false, busy = false;
  const btn = $("ask-btn"), pop = $("ask-pop"), input = $("ask-input"), status = $("ask-status");

  const hideBtn = () => { btn.hidden = true; pending = null; };
  const closePop = () => { pop.hidden = true; popOpen = false; status.textContent = ""; input.value = ""; };

  function place(node, rect) {
    const box = $("doc").getBoundingClientRect();
    node.style.left = Math.max(0, rect.left - box.left) + "px";
    node.style.top = rect.bottom - box.top + 6 + "px";
  }

  function onSelection() {
    if (popOpen || busy) return;
    const doc = getDoc();
    const s = !reader.isEditing() && doc?.onboarding?.consigne ? reader.selection() : null;
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
    busy = true;
    status.textContent = "Réflexion…"; status.className = "";
    try {
      const a = await askPassage({ doc: getDoc(), passage: pending.quote, question });
      const c = { id: uid(), ...pending, question, reponse: a.reponse, source: a.source, orphan: false, createdAt: Date.now() };
      closePop(); hideBtn();
      getSelection().removeAllRanges();
      saveComments([...(getDoc().comments ?? []), c]);
      openCards([c.id]);
    } catch (err) {
      status.textContent = ERRORS[err.code] ?? "La réponse n'a pas pu être obtenue. Réessaie.";
      status.className = "err";
    } finally { busy = false; }
  };

  function openCards(ids) {
    const all = getDoc().comments ?? [];
    const box = $("cards");
    box.replaceChildren(...ids.map((id) => all.find((c) => c.id === id)).filter(Boolean)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => {
        const d = card(c);
        const close = el("button", null, "Fermer");
        close.type = "button"; close.onclick = () => box.replaceChildren();
        d.append(close);
        return d;
      }));
  }

  // Clic sur un surlignage (et pas fin d'une sélection à la souris)
  reader.el.addEventListener("click", (e) => {
    const m = e.target.closest?.("mark");
    if (m && getSelection().isCollapsed) openCards(m.dataset.ids.split(" "));
  });

  return {
    /** Réaffiche le texte (surligné en lecture, brut en correction) et la liste des orphelins. */
    render(doc, editing) {
      const comments = doc.comments ?? [];
      hideBtn(); closePop(); $("cards").replaceChildren();
      editing ? reader.show(doc.text) : reader.showMarked(doc.text, segments(comments));
      const orphans = comments.filter((c) => c.orphan);
      $("orphans").hidden = !orphans.length;
      $("orphans-list").replaceChildren(...orphans.map((c) => card(c, true)));
    },
  };
}
