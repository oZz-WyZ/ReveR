const $ = (id) => document.getElementById(id);

/** Demande le code d'accès du proxy IA. Renvoie le code saisi, ou null si l'élève annule. */
export function askAccessCode({ wrong = false } = {}) {
  return new Promise((resolve) => {
    const root = $("chooser");
    const card = document.createElement("form");
    card.className = "chooser-card";
    card.setAttribute("aria-label", "Code d'accès");
    const h = document.createElement("h2"); h.textContent = "Code d'accès";
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = wrong ? "Code incorrect : réessaie." : "Entre le code d'accès pour utiliser l'assistant.";
    const input = document.createElement("input");
    input.type = "password"; input.required = true; input.autocomplete = "off"; input.placeholder = "Code d'accès";
    const ok = document.createElement("button"); ok.className = "primary"; ok.textContent = "Valider";
    const no = document.createElement("button"); no.type = "button"; no.className = "ghost"; no.textContent = "Annuler";
    const done = (v) => { root.hidden = true; root.replaceChildren(); resolve(v); };
    card.onsubmit = (e) => { e.preventDefault(); done(input.value.trim()); };
    no.onclick = () => done(null);
    card.append(h, note, input, ok, no);
    root.onclick = null;
    root.replaceChildren(card);
    root.hidden = false;
    input.focus();
  });
}
