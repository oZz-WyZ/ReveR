import { storage } from "./storage.js";

// Préférences d'affichage (disposition, panneaux repliés). Jamais bloquant : valeurs par défaut si le stockage est vide.
const DEFAULTS = { layout: "side", fold: { texte: false, assistant: false } };

export function loadPrefs() {
  const saved = storage.get("prefs", {}) ?? {};
  return {
    layout: saved.layout === "stack" ? "stack" : DEFAULTS.layout,
    fold: { ...DEFAULTS.fold, ...(saved.fold && typeof saved.fold === "object" ? saved.fold : {}) },
  };
}

export const savePrefs = (prefs) => storage.set("prefs", prefs);
