import assert from "node:assert/strict";
import { HttpError, buildRequest, callAnthropic, checkAccess, createLimiter, parseJsonText, readReply, sameSecret } from "../netlify/lib/ai-core.mjs";

const msgs = [{ role: "user", content: "salut" }];

// code d'accès
assert.ok(sameSecret("abc", "abc"));
assert.equal(sameSecret("abc", "abd"), false);
assert.equal(sameSecret("abc", "abcd"), false);
assert.equal(sameSecret(null, "abc"), false);

// accès : code obligatoire, sauf OPEN_ACCESS=1 ; configuration incomplète = 500
const env = { ANTHROPIC_API_KEY: "K", ACCESS_CODE: "c0de" };
const denied = (e, code, status) => assert.throws(() => checkAccess(e, code), (x) => x instanceof HttpError && x.status === status);
checkAccess(env, "c0de");
denied(env, "faux", 401); denied(env, undefined, 401); denied(env, "", 401);
denied({ ...env, OPEN_ACCESS: "true" }, "faux", 401); // seul "1" ouvre l'accès
checkAccess({ ...env, OPEN_ACCESS: "1" }, undefined); // ouvert : aucun code requis
checkAccess({ ANTHROPIC_API_KEY: "K", OPEN_ACCESS: "1" }, ""); // ouvert : ACCESS_CODE inutile
denied({ ACCESS_CODE: "c0de", OPEN_ACCESS: "1" }, "", 500); // la clé API reste obligatoire
denied({ ANTHROPIC_API_KEY: "K" }, "", 500);

// requête valide, modèle selon le niveau, system + règle JSON
let { request, json } = buildRequest({ system: "S", messages: msgs, json: true, modelTier: "quick" });
assert.equal(request.model, "claude-haiku-5-5"); assert.equal(json, true);
assert.match(request.system, /^S\n\nRéponds UNIQUEMENT par un objet JSON/);
assert.equal(buildRequest({ messages: msgs }).request.model, "claude-sonnet-5-5");
assert.equal(buildRequest({ messages: msgs, modelTier: "complex" }, { MODEL_COMPLEX: "x" }).request.model, "x");
assert.equal("system" in buildRequest({ messages: msgs }).request, false);

// images ajoutées au dernier tour user, avant le texte
({ request } = buildRequest({ messages: msgs, images: [{ media_type: "image/jpeg", data: "AAAA" }] }));
assert.equal(request.messages[0].content[0].type, "image");
assert.deepEqual(request.messages[0].content.at(-1), { type: "text", text: "salut" });

// entrées refusées
const refuse = (body, status = 400) => assert.throws(() => buildRequest(body), (e) => e instanceof HttpError && e.status === status);
refuse(null); refuse({ messages: [] });
refuse({ messages: [{ role: "assistant", content: "x" }] });
refuse({ messages: [msgs[0], msgs[0]] });
refuse({ messages: msgs, images: [{ media_type: "image/gif", data: "A" }] });
refuse({ messages: msgs, images: Array(7).fill({ media_type: "image/png", data: "A" }) });
refuse({ messages: [{ role: "user", content: "x".repeat(400_001) }] }, 413);

// JSON dans le texte du modèle
assert.deepEqual(parseJsonText('Voici :\n```json\n{"a":1}\n```'), { a: 1 });
assert.throws(() => parseJsonText("pas de json"), (e) => e.code === "invalid_json");
assert.throws(() => parseJsonText("{cassé"), (e) => e.code === "invalid_json");
const r = readReply({ content: [{ type: "text", text: '{"ok":true}' }], stop_reason: "max_tokens" }, true);
assert.deepEqual(r, { text: '{"ok":true}', truncated: true, data: { ok: true } });

// appel Anthropic : en-têtes, erreurs
let seen;
const fake = (status, body = {}) => async (url, init) => { seen = { url, init }; return new Response(JSON.stringify(body), { status }); };
assert.deepEqual(await callAnthropic({ m: 1 }, "K", fake(200, { content: [] })), { content: [] });
assert.equal(seen.init.headers["x-api-key"], "K");
await assert.rejects(callAnthropic({}, "K", fake(429)), (e) => e.status === 429 && e.code === "rate_limited");
await assert.rejects(callAnthropic({}, "K", fake(500)), (e) => e.status === 502 && e.code === "upstream_error");

// limite par IP
let t = 0;
const allow = createLimiter({ max: 2, windowMs: 1000, now: () => t });
assert.ok(allow("a")); assert.ok(allow("a")); assert.equal(allow("a"), false);
assert.ok(allow("b"));
t = 1500; assert.ok(allow("a"));
console.log("ok");
