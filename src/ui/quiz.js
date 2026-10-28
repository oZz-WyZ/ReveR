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

/** Quiz de maîtrise, une question à la fois : un clic sur une option = réponse, puis question suivante.
 *  La correction (bonne réponse + passage du cours) est donnée à la fin, avec le score.
 *  saveScore({ score, total, at, tronque }) persiste sur le cours. N'agit pas sur l'état de maîtrise. */
export function createQuiz(saveScore, onBack) {
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
    readyAt = Date.now() + 250; // évite qu'un double-clic réponde aussi à la question suivante
    $("quiz-run").hidden = false;
  }

  function answer(j) {
    if (!run || Date.now() < readyAt) return;
    run.answer(j) ? showResult() : renderQuestion();
  }

  function showResult() {
    const box = $("quiz-result");
    box.replaceChildren(el("p", "score", `Score : ${run.score}/${run.total}`));
    const again = el("button", "primary", "Refaire un quiz"); again.type = "button"; again.onclick = start;
    const back = el("button", null, "Retour à Reviz"); back.type = "button"; back.onclick = onBack;
    const actions = el("div", "result-actions");
    actions.append(again, back);
    box.append(actions);
    run.answers.forEach((a, i) => {
      const d = el("div", "qres " + (a.ok ? "ok" : "ko"));
      d.append(el("strong", null, `${i + 1}. ${a.question}`));
      d.append(el("p", null, (a.ok ? "✔ " : "✘ ") + "Ta réponse : " + a.options[a.picked]));
      if (!a.ok) d.append(el("p", null, "Bonne réponse : " + a.options[a.correctIndex]));
      if (a.passage) {
        const b = el("blockquote");
        b.append(el("strong", null, "Dans ton cours : "), a.passage);
        d.append(b);
      } else d.append(el("p", "note", "Passage non retrouvé dans le cours."));
      box.append(d);
    });
    $("quiz-run").hidden = true; box.hidden = false;
    saveScore({ score: run.score, total: run.total, at: Date.now(), tronque });
  }

  async function start() {
    if (busy) return;
    const d = doc;
    busy = true;
    reset(); status("Génération du quiz…");
    try {
      const r = await generateQuiz({ doc: d });
      if (doc?.id !== d.id) return; // l'élève a changé de cours pendant l'appel
      run = createRun(r.questions); tronque = r.tronque;
      renderQuestion();
      status(r.tronque ? NOTE_LONG : "");
    } catch {
      if (doc?.id === d.id) status("Le quiz n'a pas pu être généré.", true, start);
    } finally { busy = false; }
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
