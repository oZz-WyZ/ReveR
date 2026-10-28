import { generateQuiz } from "../quiz/generate.js";

const $ = (id) => document.getElementById(id);
const NOTE_LONG = "Ton cours est long : le quiz porte sur des extraits répartis sur tout le cours.";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Quiz de maîtrise. saveScore({ score, total, at, tronque }) persiste sur le cours. N'agit pas sur l'état de maîtrise. */
export function createQuiz(saveScore) {
  let doc, quiz = null, busy = false;

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
    quiz = null;
    $("quiz-form").hidden = true; $("quiz-result").hidden = true;
    $("quiz-questions").replaceChildren(); $("quiz-result").replaceChildren();
    status("");
  }

  function renderForm() {
    $("quiz-questions").replaceChildren(...quiz.questions.map((q, i) => {
      const f = el("fieldset");
      f.append(el("legend", null, `${i + 1}. ${q.question}`));
      q.options.forEach((o, j) => {
        const label = el("label");
        const r = el("input"); r.type = "radio"; r.name = "q" + i; r.value = j;
        label.append(r, " " + o);
        f.append(label);
      });
      return f;
    }));
    $("quiz-submit").disabled = true;
    $("quiz-form").hidden = false; $("quiz-result").hidden = true;
  }

  $("quiz-form").onchange = () => {
    $("quiz-submit").disabled = quiz.questions.some((_, i) => !document.querySelector(`input[name="q${i}"]:checked`));
  };

  $("quiz-form").onsubmit = (e) => {
    e.preventDefault();
    const { questions, tronque } = quiz;
    const picks = questions.map((_, i) => Number(document.querySelector(`input[name="q${i}"]:checked`).value));
    const score = questions.filter((q, i) => picks[i] === q.correctIndex).length;
    const box = $("quiz-result");
    box.replaceChildren(el("p", "score", `Score : ${score}/${questions.length}`));
    questions.forEach((q, i) => {
      const ok = picks[i] === q.correctIndex;
      const d = el("div", "qres " + (ok ? "ok" : "ko"));
      d.append(el("strong", null, `${i + 1}. ${q.question}`));
      d.append(el("p", null, (ok ? "✔ " : "✘ ") + "Ta réponse : " + q.options[picks[i]]));
      if (!ok) d.append(el("p", null, "Bonne réponse : " + q.options[q.correctIndex]));
      if (q.passage) {
        const b = el("blockquote");
        b.append(el("strong", null, "Dans ton cours : "), q.passage);
        d.append(b);
      } else d.append(el("p", "note", "Passage non retrouvé dans le cours."));
      box.append(d);
    });
    const again = el("button", null, "Refaire un quiz"); again.type = "button"; again.onclick = start;
    const close = el("button", null, "Fermer"); close.type = "button"; close.onclick = reset;
    box.append(again, " ", close);
    $("quiz-form").hidden = true; box.hidden = false;
    saveScore({ score, total: questions.length, at: Date.now(), tronque });
  };

  async function start() {
    if (busy) return;
    const d = doc;
    busy = true; $("quiz-start").disabled = true;
    reset(); status("Génération du quiz…");
    try {
      const r = await generateQuiz({ doc: d });
      if (doc?.id !== d.id) return; // l'élève a changé de cours pendant l'appel
      quiz = r;
      renderForm();
      status(r.tronque ? NOTE_LONG : "");
    } catch {
      if (doc?.id === d.id) status("Le quiz n'a pas pu être généré.", true, start);
    } finally { busy = false; $("quiz-start").disabled = false; }
  }
  $("quiz-start").onclick = start;

  // nouveau cours affiché : remise à zéro
  const show = (d) => { doc = d; reset(); renderLast(); $("quiz").hidden = false; };
  return {
    show,
    hide() { $("quiz").hidden = true; },
    // le cours a été enregistré : on rafraîchit seulement le dernier score, sans toucher au quiz en cours
    // (si l'assistant vient d'être configuré, la section apparaît)
    update(d) { if ($("quiz").hidden) return show(d); doc = d; renderLast(); },
  };
}
