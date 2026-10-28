import { AIError } from "./errors.js";

// Dev local : la capability sample ne tourne que dans un artifact publié.
export async function complete({ messages, json, images, signal, onToken }) {
  if (signal?.aborted) throw new AIError("cancelled", "annulé");
  const last = messages[messages.length - 1].content;
  const text = images?.length
    ? `[mock] transcription de ${images.length} image(s)\n\n${last}`
    : `[mock] reçu : ${last}`;
  onToken?.(text);
  return { text, data: json ? { mock: true } : null, truncated: false, source: "mock" };
}

export const limits = async () => ({ maxImages: 4 });
