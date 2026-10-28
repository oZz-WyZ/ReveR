import assert from "node:assert/strict";
import { askAI } from "../src/ai/index.js";
import { buildInput } from "../src/ai/artifact.js";
import { storage } from "../src/storage.js";

// hors navigateur : pas de window.claude -> mock
const msgs = [{ role: "user", content: "salut" }];
const r = await askAI({ messages: msgs });
assert.equal(r.source, "mock");
assert.match(r.text, /salut/);
assert.throws(() => askAI({ messages: [{ role: "assistant", content: "x" }] }), TypeError);

// system devient un tour user initial
// system fondu dans le 1er tour user : historique vide, puis non vide (alternance conservée)
assert.deepEqual(buildInput({ system: "S", messages: msgs }), [{ role: "user", content: "S\n\nsalut" }]);
const hist = [...msgs, { role: "assistant", content: "yo" }, { role: "user", content: "et ?" }];
assert.deepEqual(buildInput({ system: "S", messages: hist }), [{ role: "user", content: "S\n\nsalut" }, hist[1], hist[2]]);
assert.throws(() => askAI({ messages: [msgs[0], msgs[0]] }), TypeError); // deux user de suite
assert.deepEqual(buildInput({ messages: msgs }), msgs);

// storage (repli mémoire sous node)
storage.set("a", { x: 1 });
assert.deepEqual(storage.get("a"), { x: 1 });
assert.deepEqual(storage.keys(), ["a"]);
storage.remove("a");
assert.equal(storage.get("a", "dflt"), "dflt");
console.log("ok");
