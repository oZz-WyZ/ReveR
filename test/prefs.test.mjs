import assert from "node:assert/strict";
import { storage } from "../src/storage.js";
import { loadPrefs, savePrefs } from "../src/prefs.js";

storage.clear();
assert.deepEqual(loadPrefs(), { fold: { texte: false, assistant: false }, mini: false });   // stockage vide
savePrefs({ layout: "stack", fold: { assistant: true } }); // ancienne clé `layout` ignorée
assert.deepEqual(loadPrefs(), { fold: { texte: false, assistant: true }, mini: false });   // fusion avec les défauts
storage.set("prefs", { layout: "diagonale", fold: "oups" });
assert.deepEqual(loadPrefs(), { fold: { texte: false, assistant: false }, mini: false });   // valeurs invalides ignorées
storage.set("prefs", { mini: true });
assert.equal(loadPrefs().mini, true);
storage.set("prefs", { mini: "oui" });
assert.equal(loadPrefs().mini, false);                                                         // seul `true` compte
storage.clear();
console.log("ok");
