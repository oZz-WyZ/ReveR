import { AIError } from "./errors.js";

// Itération future : API Anthropic via un proxy (la clé reste côté serveur).
export async function complete() {
  throw new AIError("not_implemented", "mode proxy pas encore implémenté");
}
