import { storage } from "./storage.js";

// Préférences d'affichage (panneaux repliés, mode réduit). Jamais bloquant : valeurs par défaut si le stockage est vide.
const DEFAULTS = { fold: { texte: false, assistant: false }, mini: false };

export function loadPrefs() {
  const saved = storage.get("prefs", {}) ?? {};
  return {
    fold: { ...DEFAULTS.fold, ...(saved.fold && typeof saved.fold === "object" ? saved.fold : {}) },
    mini: saved.mini === true, // mode réduit (pastille)
  };
}

export const savePrefs = (prefs) => storage.set("prefs", prefs);
