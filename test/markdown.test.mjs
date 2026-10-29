import assert from "node:assert/strict";
import { parseBlocks, parseInline } from "../src/ui/markdown.js";

assert.deepEqual(parseBlocks("Un.\nDeux.\n\nTrois."), [{ type: "p", items: ["Un. Deux."] }, { type: "p", items: ["Trois."] }]);
assert.deepEqual(parseBlocks("Intro :\n- a\n- b\n\n1. x\n2) y"), [
  { type: "p", items: ["Intro :"] }, { type: "ul", items: ["a", "b"] }, { type: "ol", items: ["x", "y"] },
]);
assert.deepEqual(parseBlocks("- a\n1. b"), [{ type: "ul", items: ["a"] }, { type: "ol", items: ["b"] }]);
assert.deepEqual(parseBlocks("  \n"), []);
assert.deepEqual(parseInline("un **gras** ici"), [{ text: "un ", bold: false }, { text: "gras", bold: true }, { text: " ici", bold: false }]);
assert.deepEqual(parseInline("<b>x</b>"), [{ text: "<b>x</b>", bold: false }]); // le HTML reste du texte
console.log("ok");
