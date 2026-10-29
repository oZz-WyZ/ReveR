import { generateQuiz } from "../quiz/generate.js";
import { createRun } from "../quiz/run.js";

const $ = (id) => document.getElementById(id);
const NOTE_LONG = "Ton cours est long : le quiz porte sur des extraits répartis sur tout le cours.";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Quiz de maîtrise, une question à la fois : un clic sur une option = réponse. La correction de CETTE question
 *  (option choisie en vert ou rouge, bonne réponse en vert) s'affiche tout de suite, puis « Suivante » ; l'écran final ne montre que le score.
 *  saveScore({ score, total, at, tronque }) persiste sur le cours. N'agit pas sur l'état de maîtrise. */
export function createQuiz(saveScore) {
  let doc, run = null, tronque = false, busy = false, readyAt = 0;

  const status = (msg, err = false, retry) => {
    const s = $("quiz-status");
    s.textContent = msg;
    s.className = err ? "err" : "";
    if (retry) { const b = el("button", null, "Réessayer"); b.type = "button"; b.onclick = retry; s.append(" ", b); }
  };

  function reset() {
    run = null;
    $("quiz-run").hidden = true; $("quiz-result").hidden = true;
    $("quiz-result").replaceChildren();
    status("");
  }

  function renderQuestion() {
    const q = run.question;
    $("quiz-q").textContent = q.question;
    $("quiz-options").replaceChildren(...q.options.map((o, j) => {
      const b = el("button", "opt", o);
      b.type = "button";
      b.onclick = () => answer(j);
      return b;
    }));
    $("quiz-feedback").hidden = true; $("quiz-feedback").replaceChildren();
    readyAt = Date.now() + 250; // évite qu'un double-clic réponde aussi à la question suivante
    $("quiz-run").hidden = false;
  }

  // Un clic sur une option : réponse définitive et correction immédiate de cette question.
  function answer(j) {
    if (!run || run.answered || Date.now() < readyAt) return;
    run.pick(j);
    const c = run.validate();
    [...$("quiz-options").children].forEach((b, k) => {
      b.disabled = true;
      if (k === c.correctIndex) b.classList.add("ok");
      else if (k === c.picked) b.classList.add("ko");
    });
    const fb = $("quiz-feedback");
    fb.replaceChildren(el("p", "verdict " + (c.ok ? "ok" : "ko"), c.ok ? "✔ Bonne réponse" : "✘ Mauvaise réponse"));
    const next = el("button", "primary", run.last ? "Voir mon score" : "Suivante");
    next.type = "button";
    next.onclick = () => (run.next() ? showResult() : renderQuestion());
    fb.append(next);
    fb.hidden = false;
    next.focus();
    fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function showResult() {
    const box = $("quiz-result");
    box.replaceChildren(el("p", "score", `Score : ${run.score}/${run.total}`));
    $("quiz-run").hidden = true; box.hidden = false;
    saveScore({ score: run.score, total: run.total, at: Date.now(), tronque });
  }

  async function start() {
    if (busy) return;
    const d = doc;
    busy = true;
    reset(); $("quiz-loading").hidden = false; // trois points pendant la génération, pas de texte
    try {
      const r = await generateQuiz({ doc: d });
      if (doc?.id !== d.id) return; // l'élève a changé de cours pendant l'appel
      run = createRun(r.questions); tronque = r.tronque;
      renderQuestion();
      status(r.tronque ? NOTE_LONG : "");
    } catch {
      if (doc?.id === d.id) status("Le quiz n'a pas pu être généré.", true, start);
    } finally { busy = false; $("quiz-loading").hidden = true; }
  }

  return {
    // nouveau cours affiché : remise à zéro
    show(d) { doc = d; reset(); },
    // Onglet « Me tester » ouvert : le quiz se lance directement, sauf s'il est déjà en cours ou terminé
    open() { if (!run && !busy && $("quiz-result").hidden) start(); },
    // le cours a été enregistré : on garde la référence à jour, sans toucher au quiz en cours
    update(d) { doc = d; },
  };
}
