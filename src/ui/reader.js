// Panneau de lecture : vrai texte DOM (sélectionnable, éditable) — base du surlignage (it. 4).
// contenteditable="plaintext-only" n'existe pas partout : repli sur "true" (texte lu via innerText).
export function createReader(el) {
  el.setAttribute("contenteditable", "plaintext-only");
  if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  return {
    show: (text) => { el.textContent = text; },
    // innerText respecte les sauts de ligne rendus (white-space: pre-wrap)
    getText: () => el.innerText.replace(/\n{3,}/g, "\n\n").trim(),
  };
}
