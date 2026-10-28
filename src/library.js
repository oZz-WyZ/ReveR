import { storage } from "./storage.js";

// Seul module qui écrit doc:<id>. L'index (docs:index) n'est qu'un résumé dérivé de ces cours :
// saveDoc met les deux à jour dans le même appel, rebuildIndex rattrape toute dérive.
export const MAITRISE = { a_reviser: "À réviser", en_cours: "En cours", maitrise: "Maîtrisé" };
const INDEX = "docs:index";

const stripExt = (n) => n.replace(/\.[^./\\]+$/, "");

export function entryOf(doc) {
  return {
    id: doc.id,
    titre: stripExt(doc.name),
    matiereId: doc.matiereId ?? null, // null = non classé
    importedAt: doc.importedAt ?? (parseInt(doc.id, 36) || 0), // l'id est un horodatage base 36
    maitrise: doc.maitrise ?? "a_reviser",
  };
}

export const loadDoc = (id) => storage.get("doc:" + id, null);

export function saveDoc(doc) {
  const entry = entryOf(doc);
  doc = { ...doc, importedAt: entry.importedAt, maitrise: entry.maitrise };
  storage.set("doc:" + doc.id, doc);
  storage.set(INDEX, [...storage.get(INDEX, []).filter((e) => e.id !== doc.id), entry]);
  return doc;
}

/** Cours du plus récent au plus ancien. */
export const listEntries = () => [...storage.get(INDEX, [])].sort((a, b) => b.importedAt - a.importedAt);

export const NON_CLASSE = "none";
/** Cours d'une matière (`NON_CLASSE` = sans matière, ou dont la matière n'existe plus dans le profil). */
export function entriesOf(matiereId, matieres) {
  const known = new Set(matieres.map((m) => m.id));
  return listEntries().filter((e) => (matiereId === NON_CLASSE ? !e.matiereId || !known.has(e.matiereId) : e.matiereId === matiereId));
}

export function setMaitrise(id, value) {
  const doc = loadDoc(id);
  if (!doc || !(value in MAITRISE)) return null;
  return saveDoc({ ...doc, maitrise: value });
}

/** Reconstruit l'index depuis les doc:* si les identifiants divergent (ancien format `docs`, import interrompu). */
export function rebuildIndex() {
  const ids = storage.keys("doc:").map((k) => k.slice(4)).sort();
  const indexed = storage.get(INDEX, []).map((e) => e.id).sort();
  if (ids.join() !== indexed.join()) {
    storage.set(INDEX, ids.map(loadDoc).filter(Boolean).map(entryOf));
  }
  storage.remove("docs"); // ancienne liste d'identifiants
}

/** Supprime un cours (texte, commentaires, chat) et son entrée d'index ; renvoie de quoi le restaurer (l'original est géré à part). */
export function deleteDoc(id) {
  const snap = { doc: loadDoc(id), chat: storage.get("chat:" + id, null) };
  storage.remove("doc:" + id);
  storage.remove("chat:" + id);
  storage.set(INDEX, storage.get(INDEX, []).filter((e) => e.id !== id));
  return snap;
}

export function restoreDoc({ doc, chat }) {
  if (!doc) return;
  saveDoc(doc);
  if (chat) storage.set("chat:" + doc.id, chat);
}
