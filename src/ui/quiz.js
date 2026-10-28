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

/** Quiz de maîtrise, une question à la fois. saveScore({ score, total, at, tronque }) persiste sur le cours à la fin. N'agit pas sur l'état de maîtrise. */
export function createQuiz(saveScore, onBack) {
  let doc, run = null, tronque = false, busy = false;

  const status = (msg, err = false, retry) => {
    const s = $("quiz-status");
    s.textContent = msg;
    s.className = err ? "err" : "";
    if (retry) { const b = el("button", null, "Réessayer"); b.type = "button"; b.onclick = retry; s.append(" ", b); }
  };

  function renderLast() {
    const q = doc?.dernierQuiz;
    $("quiz-last").textContent = q ? `Dernier quiz : ${q.score}/${q.total} (le ${new Date(q.at).toLocaleDateString("fr-FR")})` : "";
  }

  function reset() {
    run = null;
    $("quiz-run").hidden = true; $("quiz-result").hidden = true;
    $("quiz-result").replaceChildren();
    $("quiz-start").hidden = false;
    status("");
  }

  function renderQuestion() {
    const q = run.question;
    $("quiz-progress").textContent = `Question ${run.n}/${run.total}`;
    $("quiz-q").textContent = q.question;
    $("quiz-options").replaceChildren(...q.options.map((o, j) => {
      const label = el("label", "opt");
      const r = el("input"); r.type = "radio"; r.name = "quiz-opt";
      r.onchange = () => { run.pick(j); $("quiz-validate").disabled = false; };
      label.append(r, " " + o);
      return label;
    }));
    $("quiz-feedback").hidden = true; $("quiz-feedback").replaceChildren();
    $("quiz-validate").hidden = false; $("quiz-validate").disabled = true;
    $("quiz-next").hidden = true;
    $("quiz-run").hidden = false;
  }

  $("quiz-validate").onclick = () => {
    const c = run?.validate();
    if (!c) return;
    const opts = [...$("quiz-options").children];
    opts.forEach((label, j) => {
      label.firstChild.disabled = true;
      if (j === c.correctIndex) label.classList.add("ok");
      else if (j === c.picked) label.classList.add("ko");
    });
    const fb = $("quiz-feedback");
    fb.replaceChildren(el("p", "verdict", c.ok ? "✔ Bonne réponse" : "✘ Mauvaise réponse"));
    if (!c.ok) fb.append(el("p", null, "Bonne réponse : " + run.question.options[c.correctIndex]));
    if (c.passage) {
      const b = el("blockquote");
      b.append(el("strong", null, "Dans ton cours : "), c.passage);
      fb.append(b);
    } else fb.append(el("p", "note", "Passage non retrouvé dans le cours."));
    fb.hidden = false;
    $("quiz-validate").hidden = true;
    $("quiz-next").textContent = run.last ? "Voir mon score" : "Suivante";
    $("quiz-next").hidden = false;
    $("quiz-next").focus();
  };

  $("quiz-next").onclick = () => {
    if (!run.next()) return renderQuestion();
    const box = $("quiz-result");
    box.replaceChildren(el("p", "score", `Score : ${run.score}/${run.total}`));
    const again = el("button", null, "Refaire un quiz"); again.type = "button"; again.onclick = start;
    const close = el("button", null, "Retour au cours"); close.type = "button"; close.onclick = onBack;
    box.append(again, " ", close);
    $("quiz-run").hidden = true; box.hidden = false;
    saveScore({ score: run.score, total: run.total, at: Date.now(), tronque });
  };

  async function start() {
    if (busy) return;
    const d = doc;
    busy = true; $("quiz-start").disabled = true;
    reset(); status("Génération du quiz…");
    try {
      const r = await generateQuiz({ doc: d });
      if (doc?.id !== d.id) return; // l'élève a changé de cours pendant l'appel
      run = createRun(r.questions); tronque = r.tronque;
      renderQuestion();
      $("quiz-start").hidden = true; // "Refaire un quiz" prend le relais à la fin
      status(r.tronque ? NOTE_LONG : "");
    } catch {
      if (doc?.id === d.id) status("Le quiz n'a pas pu être généré.", true, start);
    } finally { busy = false; $("quiz-start").disabled = false; }
  }
  $("quiz-start").onclick = start;

  return {
    // page du quiz ouverte pour ce cours : remise à zéro
    show(d) { doc = d; reset(); renderLast(); },
    // le cours a été enregistré (ex. configuration terminée) : on rafraîchit seulement le dernier score
    update(d) { doc = d; renderLast(); },
  };
}
