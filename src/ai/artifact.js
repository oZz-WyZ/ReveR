import { AIError } from "./errors.js";

// Pas de system prompt dans la capability : on le passe en tour user initial.
export function buildInput({ system, messages }) {
  return system ? [{ role: "user", content: system }, ...messages] : messages;
}

export async function complete({ system, messages, json, images, modelTier, signal, onToken }) {
  const sample = await window.claude.use("sample");
  if (!sample) throw new AIError("unavailable", "capability sample indisponible");
  const opts = {
    signal,
    cache: false, // chat / ré-explication : chaque appel doit redemander
    onText: onToken && (({ delta }) => onToken(delta)),
    ...(images?.length && { images }),
    ...(modelTier && { modelTier }),
  };
  try {
    const input = buildInput({ system, messages });
    if (json) {
      const data = await sample.json(input, opts);
      return { text: JSON.stringify(data), data, truncated: false, source: "artifact" };
    }
    const { text, truncated } = await sample(input, opts);
    return { text, data: null, truncated, source: "artifact" };
  } catch (e) {
    throw new AIError(e.code ?? "upstream_error", e.message ?? String(e), e.text);
  }
}

export async function limits() {
  const sample = await window.claude.use("sample");
  const l = sample && (await sample.limits().catch(() => null));
  return { maxImages: l?.images?.maxCount ?? 0 };
}
