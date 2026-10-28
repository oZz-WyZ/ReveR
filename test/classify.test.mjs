import assert from "node:assert/strict";
import { classify, parseClassification, isSure } from "../src/classify.js";
import { buildConsigne } from "../src/chat/consigne.js";

const MAT = [{ id: "histoire-geographie", nom: "Histoire-Géographie" }, { id: "mathematiques", nom: "Mathématiques" }, { id: "droit-civil", nom: "Droit civil" }];

// parse défensif : identifiant inconnu -> null ; confiance inconnue -> faible ; entrée absurde sans lever
assert.deepEqual(parseClassification({ matiere: "droit-civil", confiance: "haute" }, MAT), { matiereId: "droit-civil", confiance: "haute" });
assert.deepEqual(parseClassification({ matiere: " mathematiques ", confiance: "moyenne" }, MAT), { matiereId: "mathematiques", confiance: "moyenne" });
assert.deepEqual(parseClassification({ matiere: "chimie", confiance: "haute" }, MAT), { matiereId: null, confiance: "haute" });
assert.deepEqual(parseClassification({ matiere: "droit-civil", confiance: "certaine" }, MAT), { matiereId: "droit-civil", confiance: "faible" });
for (const bad of [null, undefined, "texte", 3, {}, { matiere: 5 }]) assert.deepEqual(parseClassification(bad, MAT), { matiereId: null, confiance: "faible" });

// sûr = matière connue ET confiance pas faible ; sinon l'app demande à l'élève
assert.equal(isSure({ matiereId: "x", confiance: "haute" }), true);
assert.equal(isSure({ matiereId: "x", confiance: "moyenne" }), true);
assert.equal(isSure({ matiereId: "x", confiance: "faible" }), false);
assert.equal(isSure({ matiereId: null, confiance: "haute" }), false);

// bout en bout avec le mock (cherche un mot de matière dans le nom du fichier)
assert.equal((await classify({ name: "cours-droit-civil.pdf", text: "…", matieres: MAT })).matiereId, "droit-civil");
const hg = await classify({ name: "histoire-revolution.pdf", text: "…", matieres: MAT });
assert.deepEqual([hg.matiereId, isSure(hg)], ["histoire-geographie", true]);
const inconnu = await classify({ name: "scan-0042.jpg", text: "…", matieres: MAT });
assert.equal(isSure(inconnu), false);   // rien ne correspond : on demandera à l'élève

// consigne sans IA : matière + niveau ; matière inconnue gérée
const prof = { niveau: "lycee", lycee: "terminale", voie: "generale" };
assert.match(buildConsigne(prof, "Philosophie"), /expert en Philosophie.*lycée/);
assert.match(buildConsigne(prof, null), /matière du cours/);
assert.doesNotMatch(buildConsigne(null, "Droit"), /undefined|niveau $/);
console.log("ok");
