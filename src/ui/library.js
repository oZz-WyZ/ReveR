const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function trashIcon() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "16", height: "16", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6");
  svg.append(path);
  return svg;
}

/** Répertoire en cards (image, titre, corbeille en haut à droite) : onOpen(id), onDelete(id), thumb(id) -> Promise<url|null>. */
export function renderLibrary(entries, { onOpen, onDelete, thumb }) {
  $("lib-list").replaceChildren(...entries.map((e) => {
    const card = el("div", "card");
    const img = el("button", "card-img");
    img.type = "button"; img.setAttribute("aria-label", "Ouvrir " + e.titre); img.onclick = () => onOpen(e.id);
    thumb?.(e.id).then((url) => {
      if (!url) return;
      const i = el("img"); i.src = url; i.alt = "";
      img.replaceChildren(i);
    });
    const open = el("button", "titre", cap(e.titre));
    open.type = "button"; open.onclick = () => onOpen(e.id);
    const del = el("button", "trash");
    del.type = "button"; del.title = "Supprimer ce cours"; del.setAttribute("aria-label", "Supprimer ce cours");
    del.append(trashIcon());
    del.onclick = () => onDelete(e.id);
    card.append(img, open, del);
    return card;
  }));
}
