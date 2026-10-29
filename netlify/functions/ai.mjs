import { HttpError, buildRequest, callAnthropic, createLimiter, readReply, sameSecret } from "../lib/ai-core.mjs";

const allow = createLimiter();
const reply = (status, body) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// Proxy IA de ReveR : vérifie le code d'accès, relaie vers l'API Anthropic avec la clé du serveur.
// Variables Netlify : ANTHROPIC_API_KEY, ACCESS_CODE (obligatoires) ; MODEL_QUICK / MODEL_DEFAULT / MODEL_COMPLEX (facultatives).
export default async (req, context) => {
  const { ANTHROPIC_API_KEY: key, ACCESS_CODE: code } = process.env;
  try {
    if (req.method !== "POST") throw new HttpError(405, "bad_request", "POST uniquement");
    if (!key || !code) throw new HttpError(500, "not_configured", "ANTHROPIC_API_KEY et ACCESS_CODE doivent être définis");
    if (!sameSecret(req.headers.get("x-access-code"), code)) throw new HttpError(401, "bad_code", "code d'accès incorrect");
    if (!allow(context?.ip ?? "?")) throw new HttpError(429, "rate_limited", "trop de requêtes");
    const { request, json } = buildRequest(await req.json().catch(() => null), process.env);
    return reply(200, readReply(await callAnthropic(request, key), json));
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, { code: e.code, message: e.message });
    return reply(500, { code: "upstream_error", message: "erreur interne" });
  }
};

export const config = { path: "/api/ai" };
