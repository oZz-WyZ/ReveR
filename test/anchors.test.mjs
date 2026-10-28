import assert from "node:assert/strict";
import { makeAnchor, relocate, relocateAll, segments } from "../src/anchors.js";

const T = "Intro.\nLa Bastille est prise le 14 juillet.\nFin. La Bastille est prise le 14 juillet, encore.\nFin.";
const quote = "La Bastille est prise le 14 juillet";
const second = T.lastIndexOf(quote);
const mk = (start) => ({ id: "c", ...makeAnchor(T, start, start + quote.length) });

// ancre
const a = makeAnchor(T, second, second + quote.length);
assert.equal(a.quote, quote);
assert.ok(a.prefix.endsWith("Fin. ") && a.suffix.startsWith(", encore"));

// inchangé -> reste en place
assert.deepEqual(relocate(T, mk(second)).range, { start: second, end: second + quote.length });

// texte décalé : relocalisé, et c'est la BONNE occurrence (contexte), pas la première
const T2 = "Préambule ajouté.\n" + T;
const r2 = relocate(T2, mk(second));
assert.equal(r2.orphan, false);
assert.equal(r2.range.start, T2.lastIndexOf(quote));

// doublon : sans contexte utile, la plus proche de l'ancien offset gagne
const r3 = relocate("xx " + quote + " yy " + quote, { id: "d", quote, range: { start: 40, end: 40 + quote.length } });
assert.equal(r3.range.start, 3 + quote.length + 4);

// disparu -> orphelin sans lever ; restauré -> rattaché
const gone = relocate("Texte totalement différent.", mk(second));
assert.equal(gone.orphan, true);
assert.equal(relocate(T, gone).orphan, false);
assert.equal(relocate(T, { id: "x", quote: "", range: null }).orphan, true);
assert.deepEqual(relocateAll("rien", [mk(second)]).map((c) => c.orphan), [true]);

// segments : disjoint, chevauchement partiel, imbriqué, orphelin ignoré
const C = (id, start, end, orphan = false) => ({ id, range: { start, end }, orphan });
assert.deepEqual(segments([C("a", 0, 5), C("b", 10, 15)]), [{ start: 0, end: 5, ids: ["a"] }, { start: 10, end: 15, ids: ["b"] }]);
assert.deepEqual(segments([C("a", 0, 10), C("b", 5, 15)]), [
  { start: 0, end: 5, ids: ["a"] }, { start: 5, end: 10, ids: ["a", "b"] }, { start: 10, end: 15, ids: ["b"] },
]);
assert.deepEqual(segments([C("a", 0, 20), C("b", 5, 10)]), [
  { start: 0, end: 5, ids: ["a"] }, { start: 5, end: 10, ids: ["a", "b"] }, { start: 10, end: 20, ids: ["a"] },
]);
assert.deepEqual(segments([C("a", 0, 5, true)]), []);
assert.deepEqual(segments([]), []);
console.log("ok");
