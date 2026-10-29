import { COLLEGE, LYCEE, NIVEAUX, SUPERIEUR, slug } from "./curriculum.js";
import { storage } from "./storage.js";
import { guessGenre } from "./prenoms.js";

// --- stockage du profil ---
export const loadProfile = () => storage.get("profil", null);
export const saveProfile = (p) => storage.set("profil", p);

const uniq = (names) => [...new Map(names.filter(Boolean).map((n) => [slug(n), n.trim()])).values()];
export const toMatieres = (names) => uniq(names).map((nom) => ({ id: slug(nom), nom }));

const opts = (list) => list.map((x) => (typeof x === "string" ? { value: x, label: x } : x));

/** Genre pour les illustrations : celui répondu, sinon celui que le prénom laisse deviner (null = à demander). */
export const genreOf = (a) => a.genre ?? guessGenre(a.prenom);

/** Matières déduites des réponses (l'élève peut ensuite les ajuster dans le récapitulatif). */
export function buildMatieres(a) {
  if (a.niveau === "college") return [...COLLEGE.matieres];
  if (a.niveau === "lycee") {
    const lv = ["Anglais", a.lvb && a.lvb !== "Aucune" ? a.lvb : null];
    if (a.lycee === "seconde") return [...LYCEE.tronc.seconde, ...lv, ...(a.options ?? [])];
    if (a.lycee === "pro") return [...LYCEE.pro, ...(a.proMatieres ?? LYCEE.pro), ...lv.slice(0, 1)];
    const tronc = LYCEE.tronc[`${a.voie}_${a.lycee}`] ?? [];
    return a.voie === "generale"
      ? [...tronc, ...lv, ...(a.specialites ?? []), ...(a.options ?? [])]
      : [...tronc, ...lv, ...(a.serieSpes ?? [])];
  }
  const guides = SUPERIEUR.guides.filter((g, i) => (a.guides ?? [])[i]).map((g) => g.ajoute);
  return [...(a.supMatieres ?? []), ...guides];
}

export function levelLabel(p) {
  if (!p) return "";
  if (p.niveau === "college") return `collège${p.classe ? " (" + p.classe + ")" : ""}`;
  if (p.niveau === "lycee") {
    const n = LYCEE.niveaux.find((x) => x.value === p.lycee)?.label ?? "";
    const voie = p.voie === "generale" ? ", voie générale" : p.voie === "techno" ? `, voie technologique${p.serie ? " " + p.serie : ""}` : "";
    return `lycée (${n}${voie})`;
  }
  return `études supérieures (${[p.formation, p.domaine, p.annee].filter(Boolean).join(", ")})`;
}

// --- questions de l'onboarding : chaque étape dépend des réponses précédentes ---
const S = (id, titre, kind, extra = {}) => ({ id, titre, kind, ...extra });

/** Prochaine question, ou l'étape « recap » quand tout est renseigné. `a` = réponses (undefined = pas répondu). */
export function nextStep(a) {
  if (!a.prenom) return S("prenom", "Comment t'appelles-tu ?", "text", { placeholder: "Ton prénom" });
  if (!genreOf(a)) return S("genre", "Tu es ?", "single", { options: [{ value: "fille", label: "Une fille" }, { value: "garcon", label: "Un garçon" }] }); // sert à choisir les illustrations
  if (!a.niveau) return S("niveau", "Quel est ton niveau d'études ?", "single", { options: NIVEAUX });

  if (a.niveau === "college") {
    if (!a.classe) return S("classe", "Dans quelle classe es-tu ?", "single", { options: opts(COLLEGE.classes) });
    return recap();
  }

  if (a.niveau === "lycee") {
    if (!a.lycee) return S("lycee", "Quelle est ta classe ?", "single", { options: LYCEE.niveaux });
    if (a.lycee === "pro") {
      if (!a.filiere && a.filiere !== "") return S("filiere", "Quelle est ta filière (bac pro ou CAP) ?", "text", { optional: true });
      if (!a.proMatieres) return S("proMatieres", "Quels enseignements généraux as-tu ?", "multi", { options: opts(LYCEE.pro), preset: LYCEE.pro });
      if (!a.lvb) return S("lvb", "Quelle langue vivante B étudies-tu ?", "single", { options: opts(["Aucune", ...LYCEE.langues]) });
      return recap();
    }
    if (a.lycee !== "seconde" && !a.voie) return S("voie", "Quelle voie suis-tu ?", "single", { options: LYCEE.voies });
    if (a.voie === "techno" && !a.serie) return S("serie", "Quelle est ta série ?", "single", { options: opts(Object.keys(LYCEE.series)) });
    if (a.voie === "techno" && !a.serieSpes) {
      const list = LYCEE.series[a.serie] ?? [];
      if (list.length) return S("serieSpes", "Quels enseignements de ta série suis-tu ?", "multi", { options: opts(list), preset: list });
    }
    if (a.voie === "generale" && !a.specialites) {
      const n = LYCEE.nbSpecialites[a.lycee];
      if (n) return S("specialites", `Quelles sont tes ${n} spécialités ?`, "multi", { options: opts(LYCEE.specialites), exact: n });
    }
    if (a.voie !== "techno" && !a.options) return S("options", "Suis-tu des options ?", "multi", { options: opts(LYCEE.options[a.lycee] ?? []), optional: true });
    if (!a.lvb) return S("lvb", "Quelle langue vivante B étudies-tu ?", "single", { options: opts(["Aucune", ...LYCEE.langues]) });
    return recap();
  }

  // études supérieures : pas de catalogue, on pose des questions pour que l'élève déclare tout
  if (!a.formation) return S("formation", "Quelle formation suis-tu ?", "single", { options: opts(SUPERIEUR.formations) });
  if (!a.domaine) return S("domaine", "Dans quel domaine ?", "single", { options: opts(SUPERIEUR.domaines) });
  if (!a.annee) return S("annee", "En quelle année es-tu ?", "single", { options: opts(SUPERIEUR.annees) });
  if (!a.supMatieres) return S("supMatieres", "Quelles matières (ou unités d'enseignement) as-tu ?", "tags", { chips: SUPERIEUR.raccourcis[a.domaine] ?? [] });
  if (!a.guides) return S("guides", "Pour n'en oublier aucune :", "guides", { guides: SUPERIEUR.guides });
  return recap();
}

const recap = () => S("recap", "Voici tes matières", "recap");

/** Profil à enregistrer, à partir des réponses et de la liste finale de matières. */
export function makeProfile(a, matieres) {
  const keep = ["prenom", "niveau", "classe", "lycee", "voie", "serie", "filiere", "lvb", "formation", "domaine", "annee"];
  const p = { createdAt: Date.now(), matieres: toMatieres(matieres) };
  for (const k of keep) if (a[k]) p[k] = a[k];
  if (genreOf(a)) p.genre = genreOf(a);
  return p;
}
