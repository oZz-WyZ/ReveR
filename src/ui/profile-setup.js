import { buildMatieres, genreOf, makeProfile, nextStep, toMatieres } from "../profile.js";

const $ = (id) => document.getElementById(id);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Illustrations de l'étape « niveau », selon le genre : [fichier, gauche, haut, largeur, hauteur] du recadrage Figma (en %)
const PICS = {
  fille: { college: ["fille-college", 0, -20.06, 100, 140.12], lycee: ["fille-lycee", 0, -20.06, 100, 140.12], superieur: ["fille-superieur", -0.55, -0.06, 100, 140.39] },
  garcon: { college: ["garcon-college", 6.17, -6.12, 86.74, 121.77], lycee: ["garcon-lycee", -0.28, -7.64, 100, 140.51], superieur: ["garcon-superieur", 0.09, -0.28, 100, 141] },
};

/**
 * Onboarding du profil : une question à la fois, chaque réponse décide de la question suivante (voir profile.js),
 * jusqu'au récapitulatif des matières. onDone(profil) est appelé quand l'élève valide.
 */
export function startSetup({ onDone }) {
  let a = {};            // réponses
  const history = [];    // états précédents (bouton Retour)
  let names = null;      // matières du récapitulatif (modifiables)

  const answer = (id, value) => { history.push(structuredClone(a)); a = { ...a, [id]: value }; names = null; render(); };

  $("setup-back").onclick = () => { a = history.pop() ?? {}; names = null; render(); };

  function chips(list, selected, onToggle) {
    const box = el("div", "opts");
    for (const o of list) {
      const b = el("button", "opt-card compact", o.label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(selected.has(o.value)));
      b.onclick = () => onToggle(o.value);
      box.append(b);
    }
    return box;
  }

  const KINDS = {
    // cartes à cocher (une seule) ; « Continuer » valide, grisé tant que rien n'est choisi
    single(step, body, next) {
      let picked = null;
      const box = el("div", "opts");
      for (const o of step.options) {
        const b = el("button", "opt-card");
        b.type = "button";
        b.setAttribute("aria-pressed", "false");
        const pic = step.id === "niveau" && PICS[genreOf(a)]?.[o.value];
        if (pic) {
          b.classList.add("with-pic");
          const frame = el("span", "opt-pic");
          const img = el("img"); img.src = `assets/onboarding/${pic[0]}.png`; img.alt = "";
          Object.assign(img.style, { left: pic[1] + "%", top: pic[2] + "%", width: pic[3] + "%", height: pic[4] + "%" });
          frame.append(img); b.append(frame);
        }
        b.append(el("span", null, o.label));
        b.style.setProperty("--i", box.children.length); // ordre d'apparition
        b.onclick = () => {
          picked = o.value;
          for (const c of box.children) c.setAttribute("aria-pressed", String(c === b));
          next.disabled = false;
        };
        box.append(b);
      }
      body.append(box);
      next.disabled = true;
      next.onclick = () => answer(step.id, picked);
    },

    multi(step, body, next) {
      const sel = new Set(step.preset ?? []);
      const info = el("p", "note");
      const refresh = () => {
        for (const b of box.children) b.setAttribute("aria-pressed", String(sel.has(b.dataset.v)));
        if (step.exact) info.textContent = `${sel.size} / ${step.exact} choisies`;
        next.disabled = step.exact ? sel.size !== step.exact : !step.optional && sel.size === 0;
      };
      const box = chips(step.options, sel, (v) => {
        if (sel.has(v)) sel.delete(v); else if (!step.exact || sel.size < step.exact) sel.add(v);
        refresh();
      });
      [...box.children].forEach((b, i) => { b.dataset.v = step.options[i].value; });
      body.append(box, info);
      next.onclick = () => answer(step.id, [...sel]);
      refresh();
    },

    text(step, body, next) {
      const input = el("input");
      input.className = "big"; // question à une seule réponse : grand champ
      input.placeholder = step.placeholder ?? "Ta réponse";
      body.append(input);
      next.onclick = () => answer(step.id, input.value.trim());
      const check = () => { next.disabled = !step.optional && !input.value.trim(); };
      input.oninput = check; check();
      input.onkeydown = (e) => { if (e.key === "Enter") next.click(); };
      input.focus();
    },

    // matières saisies une par une, avec des raccourcis cliquables
    tags(step, body, next) {
      const list = [];
      const input = el("input");
      input.placeholder = "Une matière, puis Entrée";
      const out = el("div", "tags");
      const sugg = el("div", "opts");
      const draw = () => {
        out.replaceChildren(...list.map((n, i) => tagChip(n, () => { list.splice(i, 1); draw(); })));
        for (const b of sugg.children) b.setAttribute("aria-pressed", String(list.some((n) => n.toLowerCase() === b.textContent.toLowerCase())));
        next.disabled = list.length === 0;
      };
      const add = (n) => { n = n.trim(); if (n && !list.some((x) => x.toLowerCase() === n.toLowerCase())) list.push(n); draw(); };
      for (const c of step.chips) {
        const b = el("button", "opt-card compact", c);
        b.type = "button";
        b.onclick = () => (list.some((n) => n.toLowerCase() === c.toLowerCase()) ? list.splice(list.findIndex((n) => n.toLowerCase() === c.toLowerCase()), 1) && draw() : add(c));
        sugg.append(b);
      }
      input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); add(input.value); input.value = ""; } };
      body.append(input, out);
      if (step.chips.length) body.append(el("p", "note", "Suggestions :"), sugg);
      next.onclick = () => { if (input.value.trim()) add(input.value); answer(step.id, [...list]); };
      draw();
      input.focus();
    },

    // questions oui / non pour ne rien oublier
    guides(step, body, next) {
      const vals = step.guides.map(() => false);
      step.guides.forEach((g, i) => {
        const row = el("div", "guide-row");
        row.append(el("span", null, g.question));
        const seg = el("span", "seg");
        for (const [label, v] of [["Non", false], ["Oui", true]]) {
          const b = el("button", null, label);
          b.type = "button";
          b.setAttribute("aria-pressed", String(vals[i] === v));
          b.onclick = () => { vals[i] = v; [...seg.children].forEach((c, k) => c.setAttribute("aria-pressed", String((k === 1) === v))); };
          seg.append(b);
        }
        row.append(seg);
        body.append(row);
      });
      next.onclick = () => answer(step.id, [...vals]);
      next.disabled = false;
    },

    recap(step, body, next) {
      names ??= toMatieres(buildMatieres(a)).map((m) => m.nom);
      const out = el("div", "tags");
      const input = el("input");
      input.placeholder = "Ajouter une matière";
      const draw = () => {
        out.replaceChildren(...names.map((n, i) => tagChip(n, () => { names.splice(i, 1); draw(); })));
        next.disabled = names.length === 0;
      };
      input.onkeydown = (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const n = input.value.trim();
        if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
        input.value = ""; draw();
      };
      body.append(out, input);
      next.textContent = "C'est parti";
      next.onclick = () => onDone(makeProfile(a, names));
      draw();
    },
  };

  function tagChip(nom, onRemove) {
    const c = el("span", "tag-chip", nom);
    const x = el("button");
    x.innerHTML = '<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg>';
    x.type = "button"; x.setAttribute("aria-label", "Retirer " + nom); x.onclick = onRemove;
    c.append(x);
    return c;
  }

  function render() {
    const step = nextStep(a);
    const title = $("setup-title");
    title.textContent = step.titre;
    title.classList.remove("enter"); void title.offsetWidth; title.classList.add("enter"); // relance l'animation
    $("setup-back").hidden = history.length === 0;
    const body = $("setup-body"), next = $("setup-next");
    body.replaceChildren();
    next.hidden = false; next.disabled = false; next.textContent = "Continuer"; next.onclick = null;
    KINDS[step.kind](step, body, next);
  }

  render();
}
