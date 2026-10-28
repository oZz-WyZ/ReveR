import { storage } from "./storage.js";

// Préférences d'affichage (panneaux repliés). Jamais bloquant : valeurs par défaut si le stockage est vide.
const DEFAULTS = { fold: { texte: false, assistant: false } };

export function loadPrefs() {
  const saved = storage.get("prefs", {}) ?? {};
  return {
    fold: { ...DEFAULTS.fold, ...(saved.fold && typeof saved.fold === "object" ? saved.fold : {}) },
  };
}

export const savePrefs = (prefs) => storage.set("prefs", prefs);
