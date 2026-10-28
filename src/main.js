import { extractText } from "./extract/index.js";
import { relocateAll } from "./anchors.js";
import { listEntries, loadDoc, rebuildIndex, saveDoc, setMaitrise } from "./library.js";
import { storage } from "./storage.js";
import { setupImporter } from "./ui/importer.js";
import { createReader } from "./ui/reader.js";
import { createOnboarding } from "./ui/onboarding.js";
import { createChat } from "./ui/chat.js";
import { createHighlights } from "./ui/highlights.js";
import { createViewer } from "./ui/viewer.js";
import { createQuiz } from "./ui/quiz.js";
import { maitriseSelect, renderLibrary } from "./ui/library.js";
import { setupLayout } from "./ui/layout.js";

const $ = (id) => document.getElementById(id);
const reader = createReader($("reader"));
const viewer = createViewer($("pdf-view"));
const backToCourse = () => go("cours-" + current.id);
const onboarding = createOnboarding(persist, backToCourse);
const chat = createChat();
const quiz = createQuiz((dernierQuiz) => persist({ ...current, dernierQuiz }), backToCourse);
const highlights = createHighlights({
  reader,
  viewer,
  getMode: () => mode,
  getDoc: () => current,
  saveComments: (comments) => { const d = persist({ ...current, comments }); highlights.render(d, false); },
});
let current = null; // le cours affiché : { id, name, text, method, truncated, importedAt, maitrise, onboarding?, comments? }
let shown = null;   // "home" ou "<écran>:<id>" (cours / infos / quiz)
let mode = "texte"; // affichage du cours : "original" (PDF / photo) ou "texte"
let orig = null;    // { kind, canComment } si l'original est affiché
let viewToken = 0;
let pendingFile = null; // { id, file } : original d'un import pas encore enregistré

const ERRORS = {
  unsupported: "Format non pris en charge (PDF, JPEG ou PNG).",
  too_many_pages: null, // message déjà explicite
  pdf_unreadable: "Ce PDF est illisible.",
  images_unavailable: "La transcription d'images n'est pas disponible ici.",
  not_granted: "Autorise Claude pour transcrire ce document.",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
};
const status = (msg, err = false) => { $("status").textContent = msg; $("status").className = err ? "err" : ""; };

// Écrans : répertoire, fiche (cours + assistant), infos du cours, quiz.
const SCREENS = ["home", "fiche", "infos-page", "quiz-page"];
const screen = (name) => SCREENS.forEach((s) => { $(s).hidden = s !== name; });

// Navigation par hash : #repertoire, #cours-<id>, #infos-<id>, #quiz-<id> (les id sont en base 36, sans tiret).
// go() appelle route() aussi, au cas où hashchange ne partirait pas.
const go = (hash) => { location.hash = hash; route(); };
function route() {
  const [kind, id] = location.hash.slice(1).split("-");
  const key = id && ["cours", "infos", "quiz"].includes(kind) ? `${kind}:${id}` : "home";
  if (key === shown) return;
  if (key === "home") return showHome();
  // un import pas encore enregistré n'existe qu'en mémoire (fiche seulement)
  const doc = kind === "cours" && current?.id === id ? current : loadDoc(id);
  if (!doc) { showHome(); location.hash = "repertoire"; return; }
  ({ cours: showFiche, infos: showInfos, quiz: showQuiz })[kind](doc);
}
window.addEventListener("hashchange", route);

function showHome() {
  shown = "home"; current = null;
  status("");
  screen("home");
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
$("reset-yes").onclick = async () => {
  await storage.blob.clear();
  storage.clear();
  showHome();
  status("Toutes les données ont été effacées.");
};

// Lecture seule + surlignages, ou mode correction (texte brut, éditable).
function view(doc, edit) {
  reader.setEditable(edit);
  highlights.render(doc, edit);
  syncControls();
}

// Texte transcrit corrigeable seulement si le texte ne vient pas tel quel d'un PDF affiché.
const canEdit = (doc) => doc.method === "ocr" || !orig;

function syncControls() {
  const saved = !!loadDoc(current.id);
  const editing = reader.isEditing();
  $("save").hidden = !(editing || !saved);
  $("edit-text").hidden = editing || mode !== "texte" || !canEdit(current);
  $("view-seg").hidden = !orig;
  $("view-original").setAttribute("aria-pressed", String(mode === "original"));
  $("view-texte").setAttribute("aria-pressed", String(mode === "texte"));
  $("view-hint").textContent = mode === "original" && orig && !orig.canComment ? "Pour commenter un passage, passe en « Texte »." : "";
}

function setMode(m) {
  mode = m;
  $("pdf-view").hidden = m !== "original";
  $("reader").hidden = m !== "texte";
  if (m === "original") { viewer.refresh(); requestAnimationFrame(() => viewer.refresh()); } // 2e passage : la mise en page peut ne pas être prête
  highlights.render(current, reader.isEditing());
  syncControls();
}
$("view-original").onclick = () => setMode("original");
$("view-texte").onclick = () => setMode("texte");

// Affiche l'original (PDF page par page, photo) s'il est disponible ; sinon on reste sur le texte.
async function loadOriginal(doc, edit) {
  const my = ++viewToken;
  viewer.close(); orig = null;
  $("pdf-view").hidden = $("reader").hidden = !edit; // pas de clignotement texte -> PDF
  const file = pendingFile?.id === doc.id ? pendingFile.file : await storage.blob.get(doc.id);
  const r = file ? await viewer.open({ doc, blob: file }) : { ok: false };
  if (my !== viewToken) return r.ok && viewer.close();
  orig = r.ok ? r : null;
  if (orig) viewer.setComments(doc.comments);
  setMode(orig && !edit ? "original" : "texte");
}

function renderMaitrise(doc) {
  const s = maitriseSelect(doc.maitrise ?? "a_reviser", (v) => {
    const d = setMaitrise(doc.id, v);
    if (d) current = { ...current, maitrise: d.maitrise };
  });
  s.disabled = !loadDoc(doc.id); // pas de maîtrise tant que le cours n'est pas enregistré
  $("fiche-maitrise").replaceChildren(s);
}

function showFiche(doc, edit = false) {
  shown = "cours:" + doc.id;
  // texte modifié depuis : on relocalise les commentaires (les introuvables deviennent orphelins)
  const comments = relocateAll(doc.text, doc.comments ?? []);
  if (JSON.stringify(comments) !== JSON.stringify(doc.comments ?? [])) doc = persist({ ...doc, comments });
  current = doc;
  status("");
  screen("fiche");
  const saved = !!loadDoc(doc.id);
  const ready = !!doc.onboarding?.consigne;
  $("unsaved").hidden = saved;
  $("infos-open").hidden = $("quiz-open").hidden = !saved;
  $("quiz-open").disabled = !ready;
  renderMaitrise(doc);
  $("title").textContent = doc.name;
  $("info").textContent =
    (doc.method === "ocr" ? "Transcrit par l'IA : relis et corrige." : "Texte extrait du PDF.") +
    (doc.truncated ? " Attention : transcription peut-être incomplète." : "");
  view(doc, edit);
  loadOriginal(doc, edit);
  ready ? chat.show(doc) : chat.hide();
  $("assistant-off").hidden = ready || !saved;
}

function showInfos(doc) {
  shown = "infos:" + doc.id; current = doc;
  status("");
  screen("infos-page");
  doc.onboarding ? onboarding.show(doc) : onboarding.start(doc);
}

function showQuiz(doc) {
  shown = "quiz:" + doc.id; current = doc;
  status("");
  screen("quiz-page");
  quiz.show(doc);
}

function persist(doc) {
  // la maîtrise peut avoir changé depuis le répertoire pendant un appel IA : on ne l'écrase pas
  doc = saveDoc({ ...doc, updatedAt: Date.now(), maitrise: loadDoc(doc.id)?.maitrise ?? doc.maitrise });
  quiz.update(doc);
  if (shown?.split(":")[1] !== doc.id) return doc; // l'élève a quitté ce cours pendant un appel
  current = doc;
  $("unsaved").hidden = true;
  renderMaitrise(doc);
  if (shown?.startsWith("cours:")) syncControls();
  return doc;
}

$("new-course").onclick = () => { $("drop").hidden = false; };
$("back").onclick = () => go("repertoire");
$("infos-open").onclick = $("to-infos").onclick = () => go("infos-" + current.id);
$("quiz-open").onclick = () => go("quiz-" + current.id);
$("infos-back").onclick = $("quiz-back").onclick = backToCourse;

setupImporter($("drop"), $("file"), async (file) => {
  status("Import en cours…");
  try {
    const r = await extractText(file, {
      onProgress: ({ done, total }) => status(`Lecture… ${done}/${total} pages`),
    });
    if (!r.text.trim()) throw Object.assign(new Error("Aucun texte trouvé."), { code: "empty" });
    const doc = { id: Date.now().toString(36), name: file.name, text: r.text, method: r.method, truncated: r.truncated, importedAt: Date.now() };
    pendingFile = { id: doc.id, file };
    showFiche(doc, r.method === "ocr"); // pas encore enregistré : il entre dans le répertoire au « Valider »
    go("cours-" + doc.id);
  } catch (e) {
    status(ERRORS[e.code] ?? e.message, true);
  }
});

$("edit-text").onclick = () => view(current, true);

$("save").onclick = async () => {
  const text = reader.isEditing() ? reader.getText() : current.text; // le texte d'un PDF natif n'est pas retouché
  if (pendingFile?.id === current.id) { await storage.blob.put(current.id, pendingFile.file); pendingFile = null; }
  const doc = persist({ ...current, text, comments: relocateAll(text, current.comments ?? []) });
  go("infos-" + doc.id); // étape suivante : infos du cours (matière détectée, échéance)
};

setupLayout();
rebuildIndex();
route();
