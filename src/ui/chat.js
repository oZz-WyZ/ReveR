import { askCourse, reexplain } from "../chat/ask.js";
import { insertAfter, loadChat, saveChat, setFeedback } from "../chat/store.js";

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

/** Chat sourcé sur le cours. show(doc) exige doc.text et doc.onboarding.consigne (le system, jamais affiché). */
export function createChat() {
  let doc, chat, busy = false;

  const status = (msg, err = false, retry) => {
    const s = $("chat-status");
    s.textContent = msg;
    s.className = err ? "err" : "";
    if (retry) { const b = el("button", null, "Réessayer"); b.type = "button"; b.onclick = retry; s.append(" ", b); }
  };

  function bubble(t) {
    if (t.role === "user") return el("div", "msg user", t.content);
    const m = el("div", "msg bot");
    if (t.reexplique) m.append(el("div", "tag", "Ré-explication"));
    m.append(el("span", "badge " + t.source, t.source === "cours" ? "d'après ton cours" : "connaissances générales"));
    m.append(el("p", null, t.reponse));
    if (t.passage) m.append(el("blockquote", null, t.passage));
    if (t.tronque) m.append(el("p", "note", "Ton cours est long : je m'appuie sur les passages les plus proches de ta question."));
    const fb = el("div", "fb");
    for (const [v, label, name] of [["up", "👍", "Utile"], ["down", "👎", "Pas clair"]]) {
      const b = el("button", null, label);
      b.type = "button"; b.title = name; b.setAttribute("aria-label", name);
      b.setAttribute("aria-pressed", String(t.feedback === v));
      b.onclick = () => vote(t.id, v);
      fb.append(b);
    }
    m.append(fb);
    return m;
  }

  function render() {
    $("chat-log").replaceChildren(...chat.turns.map(bubble));
    $("chat-input").disabled = $("chat-send").disabled = busy;
  }

  async function send(question) {
    busy = true; render(); status("Réflexion…");
    try {
      const a = await askCourse({ doc, turns: chat.turns, question });
      const ts = Date.now();
      chat = { ...chat, turns: [...chat.turns, { id: uid(), role: "user", content: question, ts }, { id: uid(), role: "assistant", ...a, feedback: null, ts }] };
      saveChat(doc.id, chat);
      $("chat-input").value = "";
      status("");
    } catch (e) {
      status(ERRORS[e.code] ?? "La réponse n'a pas pu être obtenue. Réessaie.", true);
    } finally { busy = false; render(); }
  }

  async function explain(targetId) {
    busy = true; render(); status("Je reformule plus simplement…");
    try {
      const a = await reexplain({ doc, turns: chat.turns, targetId });
      const turn = { id: uid(), role: "assistant", ...a, feedback: null, reexplique: targetId, ts: Date.now() };
      chat = { ...chat, turns: insertAfter(chat.turns, targetId, turn) };
      saveChat(doc.id, chat);
      status("");
    } catch {
      status("La ré-explication a échoué.", true, () => explain(targetId));
    } finally { busy = false; render(); }
  }

  async function vote(turnId, v) {
    if (busy) return;
    chat = setFeedback(chat, turnId, v);
    saveChat(doc.id, chat);
    render();
    if (chat.turns.find((t) => t.id === turnId).feedback === "down") await explain(turnId);
  }

  $("chat-form").onsubmit = (e) => {
    e.preventDefault();
    const q = $("chat-input").value.trim();
    if (q && !busy) send(q);
  };

  return {
    hide() { $("chat").hidden = true; },
    show(d) {
      if (busy && doc?.id === d.id) { doc = d; return; } // appel en cours : ne pas écraser l'état
      doc = d; chat = loadChat(d.id);
      $("chat").hidden = false; status(""); render();
    },
  };
}
