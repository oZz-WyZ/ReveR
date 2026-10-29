import { PALETTES } from "./ink.js";
import { toast } from "./toast.js";

const NS = "http://www.w3.org/2000/svg";
const ICONS = {
  select: "M5 3l14 8-6 2-2 6z",
  pen: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  hl: "M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
  eraser: "M20 20H7L3 16a1 1 0 0 1 0-1.4l9.6-9.6a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L13 20M6.5 17.5l5-5",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11",
  redo: "M15 14l5-5-5-5M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13",
  text: "M4 7V4h16v3M9 20h6M12 4v16",
  zoomIn: "M11 8v6M8 11h6M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  zoomOut: "M8 11h6M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  clear: "M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14",
};
const TOOLS = [["select", "Sélectionner du texte"], ["pen", "Stylo"], ["hl", "Surligneur"], ["eraser", "Gomme"], ["text", "Texte"]];

function icon(name) {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", "stroke-width": "1.9", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", ICONS[name]);
  svg.append(path);
  return svg;
}

function button(label, content, onclick) {
  const b = document.createElement("button");
  b.type = "button"; b.title = label; b.setAttribute("aria-label", label);
  b.append(content); b.onclick = onclick;
  return b;
}

/** Barre d'outils verticale à droite de la visionneuse : outils, annuler / rétablir, couleur et épaisseur de l'outil actif. */
export function createInkBar(bar, ink, viewer) {
  const tools = TOOLS.map(([t, label]) => { const b = button(label, icon(t), () => ink.setTool(t)); b.dataset.tool = t; return b; });
  const undo = button("Annuler (Ctrl+Z)", icon("undo"), () => ink.undo());
  const redo = button("Rétablir (Ctrl+Maj+Z)", icon("redo"), () => ink.redo());
  const zoomOut = button("Zoom arrière", icon("zoomOut"), () => zoomBy(-0.2));
  const zoomIn = button("Zoom avant", icon("zoomIn"), () => zoomBy(0.2));
  const zoomLabel = button("Zoom 100 %", document.createTextNode("100%"), () => zoomBy(1 - viewer.zoom));
  zoomLabel.className = "zoom-label";
  const clear = button("Tout effacer", icon("clear"), () => {
    if (ink.clear()) toast({ text: "Annotations effacées : Annuler les rend", duration: 4000 });
  });
  const zoomBy = (d) => { viewer.setZoom(viewer.zoom + d); ink.state(); };
  const options = document.createElement("div"); // couleurs et épaisseurs : seulement pour stylo / surligneur
  options.className = "ink-options";
  const hr = () => document.createElement("hr");
  bar.append(...tools, hr(), undo, redo, hr(), zoomIn, zoomLabel, zoomOut, hr(), options, clear);

  const render = ({ tool, color, size, canUndo, canRedo, count }) => {
    zoomLabel.firstChild.data = Math.round(viewer.zoom * 100) + "%";
    zoomOut.disabled = viewer.zoom <= 0.6; zoomIn.disabled = viewer.zoom >= 2.4;
    clear.disabled = !count;
    tools.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === tool)));
    undo.disabled = !canUndo; redo.disabled = !canRedo;
    options.hidden = !(tool in PALETTES);
    if (options.hidden) return;
    const sw = PALETTES[tool].map((c, i) => {
      const b = button("Couleur " + (i + 1), document.createElement("i"), () => ink.setColor(i));
      b.className = "sw"; b.style.setProperty("--c", c); b.setAttribute("aria-pressed", String(i === color[tool]));
      return b;
    });
    const sz = [0, 1, 2].map((i) => {
      const dot = document.createElement("i"); dot.style.setProperty("--d", 4 + i * 3 + "px");
      const b = button("Épaisseur " + (i + 1), dot, () => ink.setSize(i));
      b.className = "sz"; b.setAttribute("aria-pressed", String(i === size[tool]));
      return b;
    });
    options.replaceChildren(...sw, hr(), ...sz);
  };
  ink.bind(render);

  // Ctrl/Cmd+Z : annuler, avec Maj : rétablir ; pas quand l'élève écrit dans un champ
  document.addEventListener("keydown", (e) => {
    if (bar.hidden || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    e.preventDefault();
    e.shiftKey ? ink.redo() : ink.undo();
  });
}
