import assert from "node:assert/strict";
import { buildMatieres, nextStep, makeProfile, toMatieres, levelLabel, saveProfile, loadProfile } from "../src/profile.js";
import { slug, COLLEGE, LYCEE } from "../src/curriculum.js";
import { storage } from "../src/storage.js";

// parcours complet : répond à chaque question (premier choix, ou valeur donnée) jusqu'au récapitulatif
function run(answers) {
  const a = {}, ids = [];
  for (let i = 0; i < 20; i++) {
    const s = nextStep(a);
    ids.push(s.id);
    if (s.id === "recap") return { a, ids, matieres: buildMatieres(a) };
    assert.ok(s.id in answers, "réponse manquante pour " + s.id);
    a[s.id] = answers[s.id];
  }
  throw new Error("boucle infinie");
}

assert.equal(slug("Histoire-Géographie-EMC"), "histoire-geographie-emc");
assert.equal(slug("  Éducation musicale "), "education-musicale");

// collège : même liste pour tous, la classe est demandée
const c = run({ niveau: "college", classe: "4e" });
assert.deepEqual(c.ids, ["niveau", "classe", "recap"]);
assert.deepEqual(c.matieres, COLLEGE.matieres);

// lycée, voie générale, première : tronc + langues + 3 spécialités + options
const g = run({ niveau: "lycee", lycee: "premiere", voie: "generale", specialites: ["Mathématiques", "Physique-Chimie", "SVT"], options: ["Latin"], lvb: "Espagnol" });
assert.deepEqual(g.ids, ["niveau", "lycee", "voie", "specialites", "options", "lvb", "recap"]);
for (const m of ["Français", "Enseignement scientifique", "Anglais", "Espagnol", "Mathématiques", "SVT", "Latin"]) assert.ok(g.matieres.includes(m), m);
assert.ok(!g.matieres.includes("Philosophie"));

// terminale : philosophie, 2 spécialités ; « Aucune » langue B n'ajoute rien
const t = run({ niveau: "lycee", lycee: "terminale", voie: "generale", specialites: ["Mathématiques", "NSI"], options: [], lvb: "Aucune" });
assert.ok(t.matieres.includes("Philosophie") && t.matieres.includes("Anglais") && !t.matieres.includes("Aucune"));

// seconde : pas de voie ni de spécialité
const s2 = run({ niveau: "lycee", lycee: "seconde", options: [], lvb: "Allemand" });
assert.deepEqual(s2.ids, ["niveau", "lycee", "options", "lvb", "recap"]);
assert.ok(s2.matieres.includes("Sciences numériques et technologie") && s2.matieres.includes("Allemand"));

// technologique : série puis enseignements de la série
const te = run({ niveau: "lycee", lycee: "terminale", voie: "techno", serie: "STMG", serieSpes: ["Management", "Droit et économie"], lvb: "Espagnol" });
assert.deepEqual(te.ids, ["niveau", "lycee", "voie", "serie", "serieSpes", "lvb", "recap"]);
assert.ok(te.matieres.includes("Management") && te.matieres.includes("Philosophie") && !te.matieres.includes("Mercatique (marketing)"));
// série sans liste connue : pas d'étape serieSpes
assert.ok(!run({ niveau: "lycee", lycee: "premiere", voie: "techno", serie: "Autre série", lvb: "Aucune" }).ids.includes("serieSpes"));

// pro : filière libre (peut rester vide), enseignements généraux, langue
const pro = run({ niveau: "lycee", lycee: "pro", filiere: "", proMatieres: ["Français", "Mathématiques"], lvb: "Aucune" });
assert.deepEqual(pro.ids, ["niveau", "lycee", "filiere", "proMatieres", "lvb", "recap"]);

// supérieur : l'élève déclare tout ; les « oui » des questions guidées ajoutent des matières
const su = run({ niveau: "superieur", formation: "Licence (université)", domaine: "Droit", annee: "1re année", supMatieres: ["Droit civil", "Droit pénal"], guides: [true, false, true] });
assert.deepEqual(su.ids, ["niveau", "formation", "domaine", "annee", "supMatieres", "guides", "recap"]);
assert.deepEqual(su.matieres, ["Droit civil", "Droit pénal", "Anglais", "Option"]);
assert.equal(nextStep({ niveau: "superieur", formation: "BTS", domaine: "Droit", annee: "1re année" }).kind, "tags");
assert.ok(nextStep({ niveau: "superieur", formation: "BTS", domaine: "Droit", annee: "1re année" }).chips.includes("Droit civil"));

// toMatieres : identifiants stables, doublons fusionnés (même matière écrite différemment)
assert.deepEqual(toMatieres(["Anglais", "anglais", "Histoire-Géo", ""]).map((m) => m.id), ["anglais", "histoire-geo"]);

// profil enregistré
const p = makeProfile({ niveau: "college", classe: "3e", ignore: "x" }, COLLEGE.matieres);
assert.equal(p.niveau, "college"); assert.equal(p.classe, "3e"); assert.ok(!("ignore" in p));
assert.equal(p.matieres.length, COLLEGE.matieres.length);
assert.equal(levelLabel(p), "collège (3e)");
assert.match(levelLabel(makeProfile({ niveau: "lycee", lycee: "terminale", voie: "techno", serie: "STMG" }, [])), /Terminale.*technologique STMG/);
assert.match(levelLabel(makeProfile({ niveau: "superieur", formation: "Master (université)", domaine: "Droit", annee: "2e année" }, [])), /Master.*Droit/);

storage.clear();
assert.equal(loadProfile(), null);
saveProfile(p);
assert.equal(loadProfile().classe, "3e");
storage.clear();
console.log("ok");
