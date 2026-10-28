import assert from "node:assert/strict";
import { storage } from "../src/storage.js";
import { loadPrefs, savePrefs } from "../src/prefs.js";

storage.clear();
assert.deepEqual(loadPrefs(), { layout: "side", fold: { texte: false, assistant: false } });   // stockage vide
savePrefs({ layout: "stack", fold: { assistant: true } });
assert.deepEqual(loadPrefs(), { layout: "stack", fold: { texte: false, assistant: true } });   // fusion avec les défauts
storage.set("prefs", { layout: "diagonale", fold: "oups" });
assert.deepEqual(loadPrefs(), { layout: "side", fold: { texte: false, assistant: false } });   // valeurs invalides ignorées
storage.clear();
console.log("ok");
