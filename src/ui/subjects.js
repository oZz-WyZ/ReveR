import { NON_CLASSE } from "../library.js";
import { subjectIcon } from "./subject-icons.js";

const $ = (id) => document.getElementById(id);
const TINTS = ["#ffe0c2", "#e6dcf7", "#d8ecf7", "#dff5e6", "#fde6ee", "#fff3c4"];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const plural = (n) => (n === 0 ? "Aucun cours" : n === 1 ? "1 cours" : `${n} cours`);

/** Accueil : une carte par matière (+ « Non classé » s'il y a des cours sans matière). onOpen(id). */
export function renderSubjects(matieres, countOf, nonClasse, onOpen) {
  const cards = matieres.map((m, i) => ({ id: m.id, nom: m.nom, n: countOf(m.id), tint: TINTS[i % TINTS.length] }))
    .sort((x, y) => (y.n > 0) - (x.n > 0)); // les matières qui ont des cours d'abord (tri stable : l'ordre d'origine est gardé dans chaque groupe)
  if (nonClasse > 0) cards.push({ id: NON_CLASSE, nom: "Non classé", n: nonClasse, tint: "#ece4de" });
  $("subjects").replaceChildren(...cards.map((c) => {
    const b = el("button", "subject");
    b.type = "button";
    const dot = el("span", "dot");
    dot.append(subjectIcon(c.nom));
    dot.style.setProperty("--tint", c.tint);
    const top = el("span", "subject-top"); // icône à gauche, nombre de cours en pastille à droite (rien si la matière est vide)
    top.append(dot);
    if (c.n > 0) {
      const n = el("span", "count", String(c.n));
      n.title = plural(c.n); n.setAttribute("aria-label", plural(c.n));
      top.append(n);
    }
    b.append(top, el("span", "subject-name", c.nom));
    b.onclick = () => onOpen(c.id);
    return b;
  }));
}

/**
 * Fenêtre « Dans quelle matière ranger ce cours ? ». Renvoie l'identifiant choisi, NON_CLASSE, ou null si fermée.
 * `dismissable` : peut être fermée sans choisir (changement de matière) ; à l'import, il faut choisir.
 */
export function chooseMatiere({ matieres, titre, sous, dismissable = false, current = null }) {
  return new Promise((resolve) => {
    const root = $("chooser");
    const card = el("div", "chooser-card");
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", titre);
    card.append(el("h2", null, titre));
    if (sous) card.append(el("p", "note", sous));
    const list = el("div", "opts chips");
    const done = (v) => { document.removeEventListener("keydown", onKey); root.hidden = true; root.replaceChildren(); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape" && dismissable) done(null); };
    for (const m of matieres) {
      const b = el("button", "opt-card compact", m.nom);
      b.type = "button";
      b.setAttribute("aria-pressed", String(m.id === current));
      b.onclick = () => done(m.id);
      list.append(b);
    }
    const none = el("button", "opt-card compact", "Non classé");
    none.setAttribute("aria-pressed", "false");
    none.type = "button"; none.onclick = () => done(NON_CLASSE);
    list.append(none);
    card.append(list);
    if (dismissable) {
      const x = el("button", "ghost", "Annuler");
      x.type = "button"; x.onclick = () => done(null);
      card.append(x);
      root.onclick = (e) => { if (e.target === root) done(null); };
    } else root.onclick = null;
    document.addEventListener("keydown", onKey);
    root.replaceChildren(card);
    root.hidden = false;
    list.querySelector("button")?.focus();
  });
}
