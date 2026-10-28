// code: codes de la capability sample (cancelled, not_granted, rate_limited, invalid_json,
// upstream_error...) + "unavailable" (pas de capability) et "not_implemented" (proxy).
export class AIError extends Error {
  constructor(code, message, text) {
    super(message);
    this.code = code;
    this.text = text; // réponse partielle éventuelle
  }
}
