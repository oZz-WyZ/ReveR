import { HttpError, buildRequest, callAnthropic, checkAccess, createLimiter, readReply } from "../lib/ai-core.mjs";

const allow = createLimiter();
const reply = (status, body) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// Proxy IA de ReveR : vérifie le code d'accès, relaie vers l'API Anthropic avec la clé du serveur.
// Variables Netlify : ANTHROPIC_API_KEY, ACCESS_CODE (obligatoires) ; OPEN_ACCESS=1 (démonstration : supprime la demande de code) ; MODEL_QUICK / MODEL_DEFAULT / MODEL_COMPLEX (facultatives).
export default async (req, context) => {
  try {
    if (req.method !== "POST") throw new HttpError(405, "bad_request", "POST uniquement");
    checkAccess(process.env, req.headers.get("x-access-code"));
    if (!allow(context?.ip ?? "?")) throw new HttpError(429, "rate_limited", "trop de requêtes");
    const { request, json } = buildRequest(await req.json().catch(() => null), process.env);
    return reply(200, readReply(await callAnthropic(request, process.env.ANTHROPIC_API_KEY), json));
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, { code: e.code, message: e.message });
    return reply(500, { code: "upstream_error", message: "erreur interne" });
  }
};

export const config = { path: "/api/ai" };
