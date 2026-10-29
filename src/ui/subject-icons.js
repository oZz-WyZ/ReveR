// Icône d'une matière d'après son nom (les matières sont libres : on cherche des mots-clés, sinon un livre).
const BOOK = "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5";
const ICONS = [
  [/non classe/, "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"], // dossier
  [/math|algebre|statist/, "M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"], // calculatrice
  [/\beps\b|sport|education physique/, "M22 12h-4l-3 9L9 3l-3 9H2"], // pouls
  [/eco|gestion|droit|\bses\b|commerce|management|finance|marketing/, "M12 20V10M18 20V4M6 20v-4"], // histogramme
  [/francais|litterature|lettres|philo|humanites/, "M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"], // livre ouvert
  [/histoire|geo|\bemc\b|politique/, "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"], // globe
  [/anglais|langue|espagnol|allemand|italien|portugais|chinois|arabe|russe|latin|grec/, "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 3.5 11.5 8.5 8.5 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"], // bulle
  [/svt|biolog|ecolog|sante/, "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 21c0-3 1.9-5.5 6-7"], // feuille
  [/techno|numerique|informatique|\bnsi\b/, "M16 18l6-6-6-6M8 6l-6 6 6 6"], // code
  [/physique|chimie|science|ingenieur/, "M9 2h6M10 2v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8V2M7.5 15h9"], // fiole
  [/art|musique|design/, "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"], // note
];

export function subjectIcon(nom) {
  const n = nom.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const d = ICONS.find(([re]) => re.test(n))?.[1] ?? BOOK;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}
