import { MAITRISE } from "../library.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const dateFr = (ms) => new Date(ms).toLocaleDateString("fr-FR");
const isoFr = (iso) => iso.split("-").reverse().join("/");

/** Sélecteur d'état de maîtrise ; onChange(valeur). */
export function maitriseSelect(value, onChange) {
  const s = el("select", "maitrise");
  s.setAttribute("aria-label", "État de maîtrise");
  for (const [v, label] of Object.entries(MAITRISE)) s.append(new Option(label, v, false, v === value));
  s.value = value;
  s.dataset.v = value; // couleur selon l'état
  s.onchange = () => { s.dataset.v = s.value; onChange(s.value); };
  return s;
}

/** Répertoire : onOpen(id), onMaitrise(id, valeur). */
export function renderLibrary(entries, { onOpen, onMaitrise }) {
  $("lib-empty").hidden = entries.length > 0;
  $("lib-list").replaceChildren(...entries.map((e) => {
    const row = el("div", "row");
    const open = el("button", "titre", e.titre);
    open.type = "button"; open.onclick = () => onOpen(e.id);
    const meta = [e.matiere, e.echeance && "échéance : " + isoFr(e.echeance), "importé le " + dateFr(e.importedAt)]
      .filter(Boolean).join(" · ");
    row.append(open, el("span", "meta", meta), maitriseSelect(e.maitrise, (v) => onMaitrise(e.id, v)));
    return row;
  }));
}
