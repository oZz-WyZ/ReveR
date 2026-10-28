import { extractText } from "./extract/index.js";
import { storage } from "./storage.js";
import { setupImporter } from "./ui/importer.js";
import { createReader } from "./ui/reader.js";
import { createOnboarding } from "./ui/onboarding.js";

const $ = (id) => document.getElementById(id);
const reader = createReader($("reader"));
const onboarding = createOnboarding(persist);
let current; // { id, name, method, truncated }

const ERRORS = {
  unsupported: "Format non pris en charge (PDF, JPEG ou PNG).",
  too_many_pages: null, // message déjà explicite
  pdf_unreadable: "Ce PDF est illisible.",
  images_unavailable: "La transcription d'images n'est pas disponible ici.",
  not_granted: "Autorise Claude pour transcrire ce document.",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
};
const status = (msg, err = false) => { $("status").textContent = msg; $("status").className = err ? "err" : ""; };

function open(doc) {
  current = doc;
  $("title").textContent = doc.name;
  $("info").textContent =
    (doc.method === "ocr" ? "Transcrit par l'IA : relis et corrige." : "Texte extrait du PDF.") +
    (doc.truncated ? " Attention : transcription peut-être incomplète." : "");
  reader.show(doc.text);
  $("doc").hidden = false;
  doc.onboarding ? onboarding.show(doc) : onboarding.hide();
}

function persist(doc) {
  doc = { ...doc, updatedAt: Date.now() };
  const ids = storage.get("docs", []);
  storage.set("doc:" + doc.id, doc);
  if (!ids.includes(doc.id)) storage.set("docs", [...ids, doc.id]);
  current = doc;
  renderDocs();
  return doc;
}

function renderDocs() {
  $("docs").replaceChildren(...storage.get("docs", []).map((id) => {
    const d = storage.get("doc:" + id);
    const b = document.createElement("button");
    b.textContent = d.name;
    b.onclick = () => open(d);
    return b;
  }));
}

setupImporter($("drop"), $("file"), async (file) => {
  $("doc").hidden = true;
  onboarding.hide();
  status("Import en cours…");
  try {
    const r = await extractText(file, {
      onProgress: ({ done, total }) => status(`Lecture… ${done}/${total} pages`),
    });
    if (!r.text.trim()) throw Object.assign(new Error("Aucun texte trouvé."), { code: "empty" });
    status("");
    open({ id: Date.now().toString(36), name: file.name, text: r.text, method: r.method, truncated: r.truncated });
  } catch (e) {
    status(ERRORS[e.code] ?? e.message, true);
  }
});

$("save").onclick = () => {
  const doc = persist({ ...current, text: reader.getText() });
  status("Texte enregistré.");
  doc.onboarding ? onboarding.show(doc) : onboarding.start(doc);
};

renderDocs();
