import assert from "node:assert/strict";
import { layoutPages, overlap } from "../src/extract/layout.js";
import { storage } from "../src/storage.js";

// layoutPages : texte brut (retours de ligne + pages séparées par une ligne vide), décalages exacts
const p1 = [{ str: "La prise", hasEOL: false }, { str: " de la Bastille", hasEOL: true }, { str: "Le 14 juillet", hasEOL: false }];
const p2 = [{ str: "4 août", hasEOL: true }];
const { text, pages } = layoutPages([p1, p2]);
assert.equal(text, "La prise de la Bastille\nLe 14 juillet\n\n4 août\n");
for (const pg of pages) for (const it of pg.items) assert.ok(text.slice(it.start, it.end).length === it.end - it.start);
assert.equal(text.slice(pages[0].items[1].start, pages[0].items[1].end), " de la Bastille");
assert.equal(text.slice(pages[1].items[0].start, pages[1].items[0].end), "4 août");
assert.equal(pages[1].base, text.indexOf("4 août"));
assert.deepEqual(layoutPages([]), { text: "", pages: [] });

// overlap : morceaux touchés par une plage, avec les bornes dans chaque morceau
const start = text.indexOf("Bastille"), end = text.indexOf("Le 14") + 5;       // à cheval sur deux morceaux
const ov = overlap(pages[0], start, end);
assert.deepEqual(ov.map((o) => o.i), [1, 2]);
assert.equal(text.slice(pages[0].items[1].start + ov[0].a, pages[0].items[1].start + ov[0].b), "Bastille");
assert.equal(text.slice(pages[0].items[2].start + ov[1].a, pages[0].items[2].start + ov[1].b), "Le 14");
assert.deepEqual(overlap(pages[1], 0, 3), []);                                   // plage dans une autre page

// originaux : repli mémoire sans IndexedDB (node)
const fake = { size: 3, type: "application/pdf" };
assert.equal(await storage.blob.get("x"), null);
await storage.blob.put("x", fake);
assert.equal(await storage.blob.get("x"), fake);
await storage.blob.clear();
assert.equal(await storage.blob.get("x"), null);
console.log("ok");
