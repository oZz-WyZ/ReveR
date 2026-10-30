import { AIError } from "./errors.js";
import { storage } from "../storage.js";
import { askAccessCode } from "../ui/access.js";

// API Anthropic via la fonction Netlify /api/ai (la clé reste côté serveur, un code d'accès protège l'appel).
const ENDPOINT = "/api/ai";
const CODE_KEY = "accessCode";
const MAX_IMAGES = 4; // le corps d'une fonction Netlify est limité à ~6 Mo

const toBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function post(body, code, signal) {
  return fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "x-access-code": code }, body: JSON.stringify(body), signal });
}

export async function complete({ system, messages, json, images, modelTier, signal }) {
  const body = {
    system, messages, json: !!json, modelTier,
    images: await Promise.all((images ?? []).map(async (b) => ({ media_type: b.type, data: await toBase64(b) }))),
  };
  // Le code n'est demandé que si le serveur le refuse (il ne l'exige pas quand OPEN_ACCESS=1 est défini sur Netlify).
  let code = storage.get(CODE_KEY, null) ?? "";
  let res;
  for (let attempt = 0; ; attempt++) {
    try { res = await post(body, code, signal); }
    catch (e) { throw new AIError(e.name === "AbortError" ? "cancelled" : "upstream_error", e.message); }
    if (res.status !== 401 || attempt >= 2) break;
    storage.remove(CODE_KEY);
    code = await askAccessCode({ wrong: !!code });
    if (!code) throw new AIError("not_granted", "code d'accès requis");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new AIError(res.status === 401 ? "not_granted" : data.code ?? "upstream_error", data.message ?? `HTTP ${res.status}`);
  if (code) storage.set(CODE_KEY, code);
  return { text: data.text, truncated: !!data.truncated, data: data.data ?? null, source: "proxy" };
}

export const limits = async () => ({ maxImages: MAX_IMAGES });
