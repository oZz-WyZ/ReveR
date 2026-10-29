import assert from "node:assert/strict";
import { hexToRgb, strokeToPath } from "../src/export.js";

assert.deepEqual(hexToRgb("#ff0000"), [1, 0, 0]);
assert.deepEqual(hexToRgb("#000000"), [0, 0, 0]);
// page 200 x 100, origine en haut à gauche
assert.equal(strokeToPath({ pts: [[0, 0], [0.5, 0.5], [1, 1]] }, 200, 100), "M 0 0 L 100 50 L 200 100");
assert.equal(strokeToPath({ pts: [[0.25, 0.5]] }, 200, 100), "M 50 50 L 50 50"); // simple point
console.log("ok");
