import assert from "node:assert/strict";
import { parseDetection, detectSubject } from "../src/onboarding/detect.js";
import { generateConsigne } from "../src/onboarding/consigne.js";

assert.deepEqual(parseDetection({ matiere: " Droit ", sujet: "Contrats", niveau_estime: "supérieur" }),
  { matiere: "Droit", sujet: "Contrats", niveau_estime: "supérieur" });
assert.deepEqual(parseDetection({ matiere: "Histoire", niveau_estime: "CM2" }),
  { matiere: "Histoire", sujet: "", niveau_estime: "" });           // partiel / niveau hors liste
assert.deepEqual(parseDetection(null), { matiere: "", sujet: "", niveau_estime: "" });
assert.deepEqual(parseDetection("pas du json"), { matiere: "", sujet: "", niveau_estime: "" });
assert.deepEqual(parseDetection({ matiere: 42, sujet: [] }), { matiere: "", sujet: "", niveau_estime: "" });

// mock : détection conforme au schéma, selon le nom de fichier
assert.equal((await detectSubject({ name: "cours-histoire.pdf", text: "Déclaration des droits de l'homme" })).matiere, "Histoire");
assert.equal((await detectSubject({ name: "droit-des-contrats.pdf", text: "..." })).matiere, "Droit");
assert.match(await generateConsigne({ matiere: "Droit", sujet: "S", niveau: "supérieur" }), /Droit/);
console.log("ok");
