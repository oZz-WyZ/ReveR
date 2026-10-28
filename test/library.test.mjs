import assert from "node:assert/strict";
import { storage } from "../src/storage.js";
import { entryOf, saveDoc, loadDoc, listEntries, setMaitrise, rebuildIndex, deleteDoc, restoreDoc } from "../src/library.js";

const wipe = () => storage.keys("").forEach((k) => storage.remove(k));
const doc = (id, extra = {}) => ({ id, name: id + ".pdf", text: "texte " + id, ...extra });

// entryOf : titre depuis l'onboarding sinon nom de fichier ; défauts ; importedAt déduit de l'id
assert.equal(entryOf(doc("abc")).titre, "abc.pdf");
assert.equal(entryOf(doc("abc", { onboarding: { matiere: "Droit", sujet: "Contrats", echeance: "2026-11-15" } })).titre, "Droit — Contrats");
assert.equal(entryOf(doc("abc")).maitrise, "a_reviser");
assert.equal(entryOf(doc("mvryclwd")).importedAt, parseInt("mvryclwd", 36));
assert.equal(entryOf(doc("x", { importedAt: 42 })).importedAt, 42);

// saveDoc : écrit le cours ET l'index, sans doublon, tri du plus récent au plus ancien
wipe();
saveDoc(doc("a", { importedAt: 100 }));
saveDoc(doc("b", { importedAt: 200 }));
saveDoc(doc("a", { importedAt: 100, onboarding: { matiere: "Histoire", sujet: "1789" } }));
assert.deepEqual(listEntries().map((e) => e.id), ["b", "a"]);
assert.equal(listEntries().find((e) => e.id === "a").titre, "Histoire — 1789");
assert.equal(loadDoc("a").maitrise, "a_reviser");

// setMaitrise : met à jour le cours et l'index, refuse une valeur inconnue ou un cours absent
assert.equal(setMaitrise("a", "maitrise").maitrise, "maitrise");
assert.equal(loadDoc("a").maitrise, "maitrise");
assert.equal(listEntries().find((e) => e.id === "a").maitrise, "maitrise");
assert.equal(setMaitrise("a", "nimporte"), null);
assert.equal(setMaitrise("zzz", "en_cours"), null);
assert.equal(loadDoc("a").maitrise, "maitrise");

// rebuildIndex : ancien format (docs = ids, pas d'index) -> index reconstruit, ancienne clé retirée
wipe();
storage.set("doc:old1", doc("old1"));
storage.set("doc:old2", doc("old2"));
storage.set("docs", ["old1", "old2"]);
rebuildIndex();
assert.deepEqual(listEntries().map((e) => e.id).sort(), ["old1", "old2"]);
assert.equal(storage.get("docs", null), null);
// index qui diverge (cours sans entrée) -> rattrapé ; index cohérent -> inchangé
storage.set("doc:old3", doc("old3"));
rebuildIndex();
assert.equal(listEntries().length, 3);
// suppression : cours, chat et entrée d'index partent ; restauration à l'identique (annulation)
wipe();
saveDoc(doc("keep", { importedAt: 1 }));
saveDoc(doc("gone", { importedAt: 2, comments: [{ id: "c1" }] }));
storage.set("chat:gone", { turns: [{ id: "t" }], counts: { up: 0, down: 0 } });
const snap = deleteDoc("gone");
assert.equal(loadDoc("gone"), null);
assert.equal(storage.get("chat:gone", null), null);
assert.deepEqual(listEntries().map((e) => e.id), ["keep"]);
assert.equal(loadDoc("keep").id, "keep");                 // les autres cours ne bougent pas
restoreDoc(snap);
assert.equal(loadDoc("gone").comments[0].id, "c1");
assert.equal(storage.get("chat:gone").turns.length, 1);
assert.deepEqual(listEntries().map((e) => e.id), ["gone", "keep"]);
assert.doesNotThrow(() => deleteDoc("inexistant"));       // cours absent : sans effet
restoreDoc({ doc: null, chat: null });                    // rien à restaurer : sans effet
assert.equal(listEntries().length, 2);

// storage.clear : tout part (index, cours, chats), l'index reconstruit est vide
storage.set("chat:old1", { turns: [] });
storage.clear();
assert.deepEqual(storage.keys(), []);
rebuildIndex();
assert.deepEqual(listEntries(), []);
console.log("ok");
