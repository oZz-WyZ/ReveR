const P = "reviz:";
const mem = new Map(); // repli si localStorage absent ou bloqué (iframe sandbox)

function ls() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

// Originaux (PDF, photos) : trop gros pour localStorage, donc IndexedDB. Si elle manque ou échoue (sandbox),
// repli en mémoire pour la session : get renvoie alors null après rechargement et l'app affiche le texte.
const blobMem = new Map();
let dbp;
function db() {
  return (dbp ??= new Promise((res, rej) => {
    try {
      const r = globalThis.indexedDB.open("reviz", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("blobs");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }));
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction("blobs", mode);
    const req = fn(t.objectStore("blobs"));
    t.oncomplete = () => res(req?.result ?? null);
    t.onerror = t.onabort = () => rej(t.error);
  });
}

const blob = {
  async put(id, file) {
    blobMem.set(id, file);
    try { await idb("readwrite", (s) => s.put(file, id)); } catch { /* repli mémoire */ }
  },
  async get(id) {
    try { return (await idb("readonly", (s) => s.get(id))) ?? blobMem.get(id) ?? null; }
    catch { return blobMem.get(id) ?? null; }
  },
  async clear() {
    blobMem.clear();
    try { await idb("readwrite", (s) => s.clear()); } catch { /* rien à effacer */ }
  },
};

export const storage = {
  blob,
  get(key, fallback = null) {
    try {
      const raw = ls() ? ls().getItem(P + key) : mem.get(P + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    const raw = JSON.stringify(value);
    try { ls() ? ls().setItem(P + key, raw) : mem.set(P + key, raw); }
    catch { mem.set(P + key, raw); }
  },
  remove(key) {
    try { ls()?.removeItem(P + key); } catch {}
    mem.delete(P + key);
  },
  // Efface toute la donnée Reviz (docs:index, doc:*, chat:*...), pas les clés des autres applis.
  clear() {
    this.keys().forEach((k) => this.remove(k));
    mem.clear();
  },
  keys(prefix = "") {
    const all = ls() ? Object.keys(ls()) : [...mem.keys()];
    return all.filter((k) => k.startsWith(P + prefix)).map((k) => k.slice(P.length));
  },
};
