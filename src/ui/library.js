const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const dateFr = (ms) => new Date(ms).toLocaleDateString("fr-FR");
const isoFr = (iso) => iso.split("-").reverse().join("/");

function trashIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6");
  svg.append(path);
  return svg;
}

/** Répertoire : onOpen(id), onDelete(id). */
export function renderLibrary(entries, { onOpen, onDelete }) {
  $("lib-list").replaceChildren(...entries.map((e) => {
    const row = el("div", "row");
    const open = el("button", "titre", e.titre);
    open.type = "button"; open.onclick = () => onOpen(e.id);
    const meta = [e.matiere, e.echeance && "échéance : " + isoFr(e.echeance), "importé le " + dateFr(e.importedAt)]
      .filter(Boolean).join(" · ");
    const del = el("button", "trash");
    del.type = "button"; del.title = "Supprimer ce cours"; del.setAttribute("aria-label", "Supprimer ce cours");
    del.append(trashIcon());
    del.onclick = () => onDelete(e.id);
    row.append(open, el("span", "meta", meta), del);
    return row;
  }));
}
