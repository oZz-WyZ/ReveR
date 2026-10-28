import { askAI } from "./ai/index.js";
import { storage } from "./storage.js";

const $ = (id) => document.getElementById(id);
const prompt = $("prompt"), out = $("out"), meta = $("meta"), send = $("send"), stop = $("stop");
prompt.value = storage.get("lastPrompt", "Explique en deux phrases ce qu'est la mitose.");

let ctl;
stop.onclick = () => ctl?.abort();

send.onclick = async () => {
  storage.set("lastPrompt", prompt.value);
  ctl = new AbortController();
  send.disabled = true; stop.hidden = false;
  out.textContent = "Réflexion…"; meta.textContent = "";
  let first = true;
  try {
    const r = await askAI({
      system: "Tu es Reviz, assistant de révision. Réponds en français, de façon claire et concise.",
      messages: [{ role: "user", content: prompt.value }],
      signal: ctl.signal,
      onToken: (d) => { out.textContent = first ? d : out.textContent + d; first = false; },
    });
    out.textContent = r.text;
    meta.textContent = `source : ${r.source}${r.truncated ? " · tronqué" : ""}`;
  } catch (e) {
    out.textContent = e.text ?? "";
    meta.textContent = e.code === "cancelled" ? "annulé" : `erreur : ${e.code} — ${e.message}`;
  } finally {
    send.disabled = false; stop.hidden = true;
  }
};
