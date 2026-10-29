import assert from "node:assert/strict";
import { createModel, strokeHit } from "../src/annotations.js";

const s = (id, pts, w = 0.004) => ({ id, p: 0, tool: "pen", color: "#000", w, pts });
const a = s("a", [[0.1, 0.1], [0.5, 0.1]]), b = s("b", [[0.1, 0.5], [0.5, 0.5]]);

// historique : ajout, annulation, rétablissement
const m = createModel();
m.add(a); m.add(b);
assert.deepEqual(m.list().map((x) => x.id), ["a", "b"]);
assert.ok(m.undo()); assert.deepEqual(m.list().map((x) => x.id), ["a"]);
assert.ok(m.redo()); assert.deepEqual(m.list().map((x) => x.id), ["a", "b"]);
assert.equal(m.redo(), false);

// une gomme = une seule entrée d'historique, même pour plusieurs traits
m.remove([a, b]);
assert.deepEqual(m.list(), []);
assert.ok(m.undo()); assert.equal(m.list().length, 2);
assert.ok(m.redo()); assert.equal(m.list().length, 0);

// un nouvel ajout vide « rétablir » ; set() repart de zéro
m.undo(); m.add(s("c", [[0, 0], [1, 1]]));
assert.equal(m.canRedo(), false);
m.set([a]);
assert.equal(m.canUndo(), false);
assert.equal(m.list().length, 1);

// collision : en pixels, sur une page 800 x 1000
assert.ok(strokeHit(a, 0.3, 0.1, 10, 800, 1000));          // sur le trait
assert.ok(strokeHit(a, 0.3, 0.1 + 8 / 1000, 10, 800, 1000)); // à 8 px, dans la portée
assert.equal(strokeHit(a, 0.3, 0.2, 10, 800, 1000), false);  // à 100 px
assert.ok(strokeHit(s("d", [[0.4, 0.4], [0.4, 0.4]]), 0.4, 0.4, 5, 800, 1000)); // simple point
// texte : touché dans sa boîte, pas ailleurs
const t = { id: "t", p: 0, tool: "text", color: "#000", w: 0.02, text: "Bonjour\nmonde", pts: [[0.1, 0.1]] };
assert.ok(strokeHit(t, 0.15, 0.105, 5, 800, 1000));
assert.equal(strokeHit(t, 0.8, 0.8, 5, 800, 1000), false);
console.log("ok");
