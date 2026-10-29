const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const dateFr = (ms) => new Date(ms).toLocaleDateString("fr-FR");

/** Répertoire en cards (image, titre, date, Supprimer) : onOpen(id), onDelete(id), thumb(id) -> Promise<url|null>. */
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
    const open = el("button", "titre", e.titre);
    open.type = "button"; open.onclick = () => onOpen(e.id);
    const del = el("button", "card-del", "Supprimer");
    del.type = "button"; del.onclick = () => onDelete(e.id);
    card.append(img, open, el("span", "meta", "importé le " + dateFr(e.importedAt)), del);
    return card;
  }));
}
