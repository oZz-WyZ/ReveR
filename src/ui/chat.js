import { askCourse } from "../chat/ask.js";
import { loadChat, saveChat } from "../chat/store.js";

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
  let doc, chat, busy = false, wait = null; // wait : { docId, question? } pendant un appel IA

  const status = (msg, err = false, retry) => {
    const s = $("chat-status");
    s.textContent = msg;
    s.className = err ? "err" : "";
    if (retry) { const b = el("button", null, "Réessayer"); b.type = "button"; b.onclick = retry; s.append(" ", b); }
  };

  // Réponse de l'assistant : à gauche, avec son avatar, sans bulle (comme dans un chat de LLM).
  const botRow = (body) => {
    const m = el("div", "msg bot");
    const a = el("img", "avatar"); a.src = "mascotte.svg"; a.alt = "";
    m.append(a, body);
    return m;
  };

  function thinking() {
    const d = el("div", "bot-body dots");
    d.append(el("i"), el("i"), el("i"));
    return botRow(d);
  }

  function bubble(t) {
    if (t.role === "user") return el("div", "msg user", t.content);
    const m = el("div", "bot-body");
    if (t.reexplique) m.append(el("div", "tag", "Ré-explication"));
    if (t.passage) {
      const q = el("blockquote", "passage");
      q.append(el("strong", null, "Dans ton cours : "), t.passage);
      m.append(q);
    }
    m.append(el("p", null, t.reponse));
    if (t.tronque) m.append(el("p", "note", "Ton cours est long : je m'appuie sur les passages les plus proches de ta question."));
    return botRow(m);
  }

  function render() {
    const rows = chat.turns.map(bubble);
    if (wait?.docId === doc.id) {
      if (wait.question) rows.push(el("div", "msg user", wait.question)); // la question s'affiche tout de suite
      rows.push(thinking());
    }
    const log = $("chat-log");
    log.replaceChildren(...rows);
    $("chat-empty").hidden = rows.length > 0; // écran d'accueil tant qu'il n'y a pas d'échange
    $("chat-input").disabled = $("chat-send").disabled = busy;
    log.scrollTop = log.scrollHeight;
  }

  async function send(question) {
    const d = doc;
    busy = true; wait = { docId: d.id, question }; $("chat-input").value = ""; status(""); render();
    try {
      const a = await askCourse({ doc: d, turns: chat.turns, question });
      const ts = Date.now();
      const base = d.id === doc.id ? chat : loadChat(d.id);
      const next = { ...base, turns: [...base.turns, { id: uid(), role: "user", content: question, ts }, { id: uid(), role: "assistant", ...a, feedback: null, ts }] };
      saveChat(d.id, next);
      if (d.id === doc.id) chat = next;
      status("");
    } catch (e) {
      if (d.id === doc.id) $("chat-input").value = question; // on rend sa question à l'élève
      status(ERRORS[e.code] ?? "La réponse n'a pas pu être obtenue. Réessaie.", true);
    } finally { busy = false; wait = null; render(); if (d.id === doc.id) $("chat-input").focus(); }
  }

  $("chat-form").onsubmit = (e) => {
    e.preventDefault();
    const q = $("chat-input").value.trim();
    if (q && !busy) send(q);
  };

  // Suggestions de l'écran d'accueil : un clic envoie la question
  const SUGGESTIONS = ["Résume ce cours", "Quels sont les points clés à retenir ?", "Explique le passage le plus difficile"];
  $("chat-suggest").replaceChildren(...SUGGESTIONS.map((t) => {
    const b = el("button", "chip", t);
    b.type = "button";
    b.onclick = () => { if (!busy) send(t); };
    return b;
  }));

  return {
    hide() { $("chat").hidden = true; },
    show(d) {
      if (busy && doc?.id === d.id) { doc = d; return; } // appel en cours : ne pas écraser l'état
      doc = d; chat = loadChat(d.id);
      $("chat").hidden = false; status(""); render();
    },
  };
}
