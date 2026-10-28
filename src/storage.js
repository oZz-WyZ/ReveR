const P = "reviz:";
const mem = new Map(); // repli si localStorage absent ou bloqué (iframe sandbox)

function ls() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export const storage = {
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
