import { config } from "../config.js";
import * as artifact from "./artifact.js";
import * as mock from "./mock.js";
import * as proxy from "./proxy.js";

export { AIError } from "./errors.js";

// Site déployé = https hors localhost. Évalué à chaque appel : window.claude peut arriver après le chargement des modules.
const deployed = () => globalThis.location?.protocol === "https:" && !/^(localhost|127\.)/.test(location.hostname);

function impl() {
  if (config.mode === "proxy") return proxy;
  if (globalThis.claude?.use) return artifact;
  return deployed() ? proxy : mock;
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
  // La capability veut des tours qui alternent, du premier user au dernier user.
  const ok = messages?.length && messages.every((m, i) => m.role === (i % 2 ? "assistant" : "user"));
  if (!ok || messages.length % 2 === 0) {
    throw new TypeError("askAI: messages doit alterner user/assistant et finir par un tour user");
  }
  return impl().complete({ system, messages, json, images, modelTier, signal, onToken });
}

/** @returns {Promise<{maxImages:number}>} images max par appel dans ce runtime (0 = indisponible) */
export const aiLimits = () => impl().limits();
