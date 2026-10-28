import { config } from "../config.js";
import * as artifact from "./artifact.js";
import * as mock from "./mock.js";
import * as proxy from "./proxy.js";

export { AIError } from "./errors.js";

function impl() {
  if (config.mode === "proxy") return proxy;
  return globalThis.claude?.use ? artifact : mock;
}

/**
 * Seul point d'entrée IA de l'app.
 * @param {object} o
 * @param {string} [o.system]    consignes de rôle
 * @param {{role:"user"|"assistant",content:string}[]} o.messages  finit par un tour user
 * @param {boolean} [o.json]     true : réponse parsée dans `data`
 * @param {AbortSignal} [o.signal]
 * @param {Blob[]} [o.images]    images à lire (transcription) ; exige sample:{images:true}
 * @param {"quick"|"default"|"complex"} [o.modelTier]
 * @param {(delta:string)=>void} [o.onToken]  streaming (optionnel)
 * @returns {Promise<{text:string,truncated:boolean,data:any,source:string}>}
 *   text/truncated = contrat. Avec json:true, data est aussi contractuel (sortie structurée = charge utile) :
 *   le parser défensivement. Hors json, data/source = diagnostic, aucune logique produit ne doit en dépendre.
 * @throws {AIError}
 */
export function askAI({ system, messages, json = false, images, modelTier, signal, onToken } = {}) {
  if (!messages?.length || messages[messages.length - 1].role !== "user") {
    throw new TypeError("askAI: messages doit finir par un tour user");
  }
  return impl().complete({ system, messages, json, images, modelTier, signal, onToken });
}

/** @returns {Promise<{maxImages:number}>} images max par appel dans ce runtime (0 = indisponible) */
export const aiLimits = () => impl().limits();
