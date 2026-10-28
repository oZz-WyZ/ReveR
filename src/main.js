import { extractText } from "./extract/index.js";
import { relocateAll } from "./anchors.js";
import { storage } from "./storage.js";
import { listEntries, loadDoc, rebuildIndex, saveDoc, setMaitrise } from "./library.js";
import { setupImporter } from "./ui/importer.js";
import { createReader } from "./ui/reader.js";
import { createOnboarding } from "./ui/onboarding.js";
import { createChat } from "./ui/chat.js";
import { createHighlights } from "./ui/highlights.js";
import { maitriseSelect, renderLibrary } from "./ui/library.js";

const $ = (id) => document.getElementById(id);
const reader = createReader($("reader"));
const onboarding = createOnboarding(persist);
const chat = createChat();
const highlights = createHighlights({
  reader,
  getDoc: () => current,
  saveComments: (comments) => { const d = persist({ ...current, comments }); highlights.render(d, false); },
});
let current = null; // le cours affiché : { id, name, text, method, truncated, importedAt, maitrise, onboarding?, comments? }
let shown = null;   // "home" ou l'id du cours affiché

const ERRORS = {
  unsupported: "Format non pris en charge (PDF, JPEG ou PNG).",
  too_many_pages: null, // message déjà explicite
  pdf_unreadable: "Ce PDF est illisible.",
  images_unavailable: "La transcription d'images n'est pas disponible ici.",
  not_granted: "Autorise Claude pour transcrire ce document.",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
};
const status = (msg, err = false) => { $("status").textContent = msg; $("status").className = err ? "err" : ""; };

// Navigation par hash : #repertoire et #cours-<id>. go() appelle route() aussi, au cas où hashchange ne partirait pas.
const go = (hash) => { location.hash = hash; route(); };
function route() {
  const h = location.hash.slice(1);
  const id = h.startsWith("cours-") ? h.slice(6) : null;
  if (id ? id === shown : shown === "home") return;
  const doc = id && loadDoc(id);
  if (doc) return showFiche(doc, false);
  showHome();
  if (id) location.hash = "repertoire"; // cours introuvable
}
window.addEventListener("hashchange", route);

function showHome() {
  shown = "home"; current = null;
  status("");
  $("fiche").hidden = true; $("home").hidden = false;
  onboarding.hide(); chat.hide();
  const entries = listEntries();
  renderLibrary(entries, {
    onOpen: (id) => go("cours-" + id),
    onMaitrise: (id, v) => setMaitrise(id, v),
  });
  $("drop").hidden = entries.length > 0; // « Nouveau cours » l'affiche sinon
  askReset(false);
}

// Réinitialisation : confirmation en deux clics dans la page (confirm() est bloqué en artifact).
const askReset = (on) => { $("reset").hidden = on; $("reset-confirm").hidden = !on; };
$("reset").onclick = () => askReset(true);
$("reset-no").onclick = () => askReset(false);
$("reset-yes").onclick = () => { storage.clear(); showHome(); status("Toutes les données ont été effacées."); };

// Lecture seule + surlignages, ou mode correction (texte brut, éditable).
function view(doc, edit) {
  reader.setEditable(edit);
  highlights.render(doc, edit);
  $("save").hidden = !edit;
  $("edit-text").hidden = edit;
}

function renderMaitrise(doc) {
  const s = maitriseSelect(doc.maitrise ?? "a_reviser", (v) => {
    const d = setMaitrise(doc.id, v);
    if (d) current = { ...current, maitrise: d.maitrise };
  });
  s.disabled = !loadDoc(doc.id); // pas de maîtrise tant que le cours n'est pas enregistré
  $("fiche-maitrise").replaceChildren(s);
}

function showFiche(doc, edit) {
  shown = doc.id;
  // texte modifié depuis : on relocalise les commentaires (les introuvables deviennent orphelins)
  const comments = relocateAll(doc.text, doc.comments ?? []);
  if (JSON.stringify(comments) !== JSON.stringify(doc.comments ?? [])) doc = persist({ ...doc, comments });
  current = doc;
  status("");
  $("home").hidden = true; $("fiche").hidden = false;
  $("unsaved").hidden = !!loadDoc(doc.id);
  renderMaitrise(doc);
  $("title").textContent = doc.name;
  $("info").textContent =
    (doc.method === "ocr" ? "Transcrit par l'IA : relis et corrige." : "Texte extrait du PDF.") +
    (doc.truncated ? " Attention : transcription peut-être incomplète." : "");
  view(doc, edit);
  doc.onboarding ? onboarding.show(doc) : onboarding.hide();
  doc.onboarding?.consigne ? chat.show(doc) : chat.hide();
}

function persist(doc) {
  // la maîtrise peut avoir changé depuis le répertoire pendant un appel IA : on ne l'écrase pas
  doc = saveDoc({ ...doc, updatedAt: Date.now(), maitrise: loadDoc(doc.id)?.maitrise ?? doc.maitrise });
  if (shown !== doc.id) return doc; // l'élève a quitté ce cours pendant un appel
  current = doc;
  $("unsaved").hidden = true;
  renderMaitrise(doc);
  doc.onboarding?.consigne ? chat.show(doc) : chat.hide();
  return doc;
}

$("new-course").onclick = () => { $("drop").hidden = false; };
$("back").onclick = () => go("repertoire");

setupImporter($("drop"), $("file"), async (file) => {
  status("Import en cours…");
  try {
    const r = await extractText(file, {
      onProgress: ({ done, total }) => status(`Lecture… ${done}/${total} pages`),
    });
    if (!r.text.trim()) throw Object.assign(new Error("Aucun texte trouvé."), { code: "empty" });
    const doc = { id: Date.now().toString(36), name: file.name, text: r.text, method: r.method, truncated: r.truncated, importedAt: Date.now() };
    showFiche(doc, true); // pas encore enregistré : il entre dans le répertoire au « Valider »
    go("cours-" + doc.id);
  } catch (e) {
    status(ERRORS[e.code] ?? e.message, true);
  }
});

$("edit-text").onclick = () => view(current, true);

$("save").onclick = () => {
  const text = reader.getText();
  const doc = persist({ ...current, text, comments: relocateAll(text, current.comments ?? []) });
  view(doc, false);
  status("Texte enregistré.");
  doc.onboarding ? onboarding.show(doc) : onboarding.start(doc);
};

rebuildIndex();
route();
