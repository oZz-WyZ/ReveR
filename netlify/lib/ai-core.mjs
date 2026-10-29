// Cœur du proxy IA (sans dépendance, testable sous node) : validation de la requête, appel Anthropic, sortie JSON.

export const MODELS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };
export const LIMITS = { chars: 400_000, images: 6, imageB64: 2_000_000, maxTokens: 4096 };
const IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export class HttpError extends Error {
  constructor(status, code, message) { super(message ?? code); this.status = status; this.code = code; }
}

/** Compare deux chaînes en temps constant (longueur comprise). */
export function sameSecret(a, b) {
  const x = String(a ?? ""), y = String(b ?? "");
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** Corps reçu du navigateur -> { request (pour l'API Messages), json }. Lève HttpError(400, "bad_request") sinon. */
export function buildRequest(body, env = {}) {
  const bad = (m) => { throw new HttpError(400, "bad_request", m); };
  if (!body || typeof body !== "object") bad("corps illisible");
  const { system, messages, json, images = [], modelTier } = body;
  if (system != null && typeof system !== "string") bad("system");
  if (!Array.isArray(messages) || !messages.length || messages.length % 2 === 0) bad("messages doit finir par un tour user");
  let chars = (system ?? "").length;
  messages.forEach((m, i) => {
    if (m?.role !== (i % 2 ? "assistant" : "user") || typeof m.content !== "string" || !m.content) bad("messages doit alterner user/assistant");
    chars += m.content.length;
  });
  if (chars > LIMITS.chars) throw new HttpError(413, "too_large", "requête trop longue");
  if (!Array.isArray(images) || images.length > LIMITS.images) bad("images");
  for (const im of images) {
    if (!IMAGE_TYPES.has(im?.media_type) || typeof im.data !== "string" || im.data.length > LIMITS.imageB64) bad("image");
  }
  const tier = modelTier in MODELS ? modelTier : "default";
  const model = env[`MODEL_${tier.toUpperCase()}`] || MODELS[tier];

  // les images s'ajoutent au dernier tour user, avant son texte
  const out = messages.map((m) => ({ role: m.role, content: m.content }));
  if (images.length) {
    const last = out.at(-1);
    out[out.length - 1] = { role: "user", content: [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } })), { type: "text", text: last.content }] };
  }
  const jsonRule = "Réponds UNIQUEMENT par un objet JSON valide, sans texte autour ni bloc de code.";
  return {
    json: !!json,
    request: {
      model, max_tokens: LIMITS.maxTokens, messages: out,
      ...((system || json) && { system: [system, json && jsonRule].filter(Boolean).join("\n\n") }),
    },
  };
}

/** Extrait l'objet JSON d'un texte de modèle (tolère un bloc ``` ou du texte autour). */
export function parseJsonText(text) {
  const t = text.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) throw new HttpError(502, "invalid_json", "réponse sans JSON");
  try { return JSON.parse(t.slice(a, b + 1)); } catch { throw new HttpError(502, "invalid_json", "JSON invalide"); }
}

/** Réponse de l'API Messages -> { text, truncated, data }. */
export function readReply(reply, json) {
  const text = (reply.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  return { text, truncated: reply.stop_reason === "max_tokens", data: json ? parseJsonText(text) : null };
}

export async function callAnthropic(request, apiKey, fetchImpl = fetch) {
  const res = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(request),
  });
  if (res.status === 429) throw new HttpError(429, "rate_limited", "trop de requêtes");
  if (!res.ok) throw new HttpError(502, "upstream_error", `Anthropic ${res.status}`);
  return res.json();
}

/** Limite par IP en mémoire : fenêtre glissante. shortcut: par instance de fonction seulement (pas partagé), à remplacer par un store si l'usage grandit. */
export function createLimiter({ max = 60, windowMs = 10 * 60_000, now = Date.now } = {}) {
  const hits = new Map();
  return (ip) => {
    const t = now(), recent = (hits.get(ip) ?? []).filter((x) => t - x < windowMs);
    if (recent.length >= max) { hits.set(ip, recent); return false; }
    hits.set(ip, [...recent, t]);
    return true;
  };
}
