import assert from "node:assert/strict";
import { storage } from "../src/storage.js";
import { entryOf, saveDoc, loadDoc, listEntries, setMaitrise, rebuildIndex, deleteDoc, restoreDoc, entriesOf, NON_CLASSE } from "../src/library.js";

const wipe = () => storage.keys("").forEach((k) => storage.remove(k));
const doc = (id, extra = {}) => ({ id, name: id + ".pdf", text: "texte " + id, ...extra });

// entryOf : titre = nom de fichier sans extension ; matière (null = non classé) ; défauts ; importedAt déduit de l'id
assert.equal(entryOf(doc("abc")).titre, "abc");
assert.equal(entryOf({ id: "z", name: "Cours de droit.v2.pdf" }).titre, "Cours de droit.v2");
assert.equal(entryOf(doc("abc")).matiereId, null);
assert.equal(entryOf(doc("abc", { matiereId: "histoire" })).matiereId, "histoire");
assert.equal(entryOf(doc("abc")).maitrise, "a_reviser");
assert.equal(entryOf(doc("mvryclwd")).importedAt, parseInt("mvryclwd", 36));
assert.equal(entryOf(doc("x", { importedAt: 42 })).importedAt, 42);

// saveDoc : écrit le cours ET l'index, sans doublon, tri du plus récent au plus ancien
wipe();
saveDoc(doc("a", { importedAt: 100 }));
saveDoc(doc("b", { importedAt: 200 }));
saveDoc(doc("a", { importedAt: 100, matiereId: "histoire" }));
assert.deepEqual(listEntries().map((e) => e.id), ["b", "a"]);
assert.equal(listEntries().find((e) => e.id === "a").matiereId, "histoire");
// entriesOf : par matière ; « non classé » = sans matière ou matière absente du profil
const MAT = [{ id: "histoire", nom: "Histoire" }, { id: "maths", nom: "Maths" }];
assert.deepEqual(entriesOf("histoire", MAT).map((e) => e.id), ["a"]);
assert.deepEqual(entriesOf("maths", MAT), []);
assert.deepEqual(entriesOf(NON_CLASSE, MAT).map((e) => e.id), ["b"]);
saveDoc(doc("c", { importedAt: 300, matiereId: "supprimee" }));
assert.deepEqual(entriesOf(NON_CLASSE, MAT).map((e) => e.id), ["c", "b"]);
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
