import { loadPrefs, savePrefs } from "../prefs.js";

const $ = (id) => document.getElementById(id);
const LABEL = { texte: "le cours", assistant: "l'assistant" };

/** Panneaux repliables de la fiche (toujours côte à côte) ; choix mémorisés. */
export function setupLayout() {
  let prefs = loadPrefs();

  function apply() {
    for (const name of Object.keys(LABEL)) {
      const folded = !!prefs.fold[name];
      $("pane-" + name).classList.toggle("folded", folded);
      const b = document.querySelector(`.fold[data-pane="${name}"]`);
      b.textContent = folded ? `Déplier ${LABEL[name]}` : "Replier";
      b.setAttribute("aria-expanded", String(!folded));
    }
  }

  function update(patch) {
    prefs = { ...prefs, ...patch };
    savePrefs(prefs);
    apply();
  }

  document.querySelectorAll(".fold").forEach((b) => {
    b.onclick = () => update({ fold: { ...prefs.fold, [b.dataset.pane]: !prefs.fold[b.dataset.pane] } });
  });
  apply();
}
