import { loadPrefs, savePrefs } from "../prefs.js";

const $ = (id) => document.getElementById(id);
const LABEL = { texte: "le cours", assistant: "l'assistant" };

/** Disposition de la fiche : côte à côte / empilé, chaque panneau repliable ; choix mémorisé. */
export function setupLayout() {
  let prefs = loadPrefs();

  function apply() {
    $("workspace").classList.toggle("side", prefs.layout === "side");
    $("workspace").classList.toggle("stack", prefs.layout === "stack");
    $("lay-side").setAttribute("aria-pressed", String(prefs.layout === "side"));
    $("lay-stack").setAttribute("aria-pressed", String(prefs.layout === "stack"));
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

  $("lay-side").onclick = () => update({ layout: "side" });
  $("lay-stack").onclick = () => update({ layout: "stack" });
  document.querySelectorAll(".fold").forEach((b) => {
    b.onclick = () => update({ fold: { ...prefs.fold, [b.dataset.pane]: !prefs.fold[b.dataset.pane] } });
  });
  apply();
}
