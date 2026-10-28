import assert from "node:assert/strict";
import { isScanned } from "../src/extract/index.js";
import { chunk } from "../src/extract/transcribe.js";

assert.equal(isScanned([]), true);
assert.equal(isScanned([1800, 2100, 1500]), false);   // PDF natif
assert.equal(isScanned([0, 3, 0, 12]), true);          // scan sans couche texte
assert.equal(isScanned([2000, 5, 8, 3]), true);        // majorité de pages vides
assert.equal(isScanned([40, 45, 30]), true);           // moyenne sous le seuil
assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
console.log("ok");
