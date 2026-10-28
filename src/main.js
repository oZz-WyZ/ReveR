import { extractText } from "./extract/index.js";
import { relocateAll } from "./anchors.js";
import { deleteDoc, listEntries, loadDoc, rebuildIndex, restoreDoc, saveDoc } from "./library.js";
import { storage } from "./storage.js";
import { setupImporter } from "./ui/importer.js";
import { createReader } from "./ui/reader.js";
import { createOnboarding } from "./ui/onboarding.js";
import { createChat } from "./ui/chat.js";
import { createHighlights } from "./ui/highlights.js";
import { createViewer } from "./ui/viewer.js";
import { createQuiz } from "./ui/quiz.js";
import { renderLibrary } from "./ui/library.js";
import { toast } from "./ui/toast.js";

const $ = (id) => document.getElementById(id);
const reader = createReader($("reader"));
const viewer = createViewer($("pdf-view"));
const backToCourse = () => go("cours-" + current.id);
const onboarding = createOnboarding(persist, backToCourse);
const chat = createChat();
const quiz = createQuiz((dernierQuiz) => persist({ ...current, dernierQuiz }), () => setTab("chat"));
const highlights = createHighlights({
  reader,
  viewer,
  getMode: () => mode,
  getDoc: () => current,
  saveComments: (comments) => { const d = persist({ ...current, comments }); highlights.render(d, false); },
});
let current = null; // le cours affiché : { id, name, text, method, truncated, importedAt, maitrise, onboarding?, comments? }
let shown = null;   // "home" ou "<écran>:<id>" (cours / infos)
let mode = "texte"; // affichage du cours : "original" (PDF / photo) ou "texte"
let orig = null;    // { kind, canComment } si l'original est affiché
let viewToken = 0;

const ERRORS = {
  unsupported: "Format non pris en charge (PDF, JPEG ou PNG).",
  too_many_pages: null, // message déjà explicite
  pdf_unreadable: "Ce PDF est illisible.",
  images_unavailable: "La transcription d'images n'est pas disponible ici.",
  not_granted: "Autorise Claude pour transcrire ce document.",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
};

// Écrans : répertoire, fiche (cours + assistant / quiz), infos du cours.
const SCREENS = ["home", "fiche", "infos-page"];
const screen = (name) => {
  SCREENS.forEach((s) => { $(s).hidden = s !== name; });
  document.body.classList.toggle("fiche-open", name === "fiche"); // la fiche tient dans la fenêtre : pas de scroll de page
};

// Navigation par hash : #repertoire, #cours-<id>, #infos-<id> (les id sont en base 36, sans tiret).
// go() appelle route() aussi, au cas où hashchange ne partirait pas.
const go = (hash) => { location.hash = hash; route(); };
function route() {
  const [kind, id] = location.hash.slice(1).split("-");
  const key = id && ["cours", "infos"].includes(kind) ? `${kind}:${id}` : "home";
  if (key === shown) return;
  if (key === "home") return showHome();
  // un import pas encore enregistré n'existe qu'en mémoire (fiche seulement)
  const doc = kind === "cours" && current?.id === id ? current : loadDoc(id);
  if (!doc) { showHome(); location.hash = "repertoire"; return; }
  ({ cours: showFiche, infos: showInfos })[kind](doc);
}
window.addEventListener("hashchange", route);

function showHome() {
  shown = "home"; current = null;
  screen("home");
  const entries = listEntries();
  renderLibrary(entries, { onOpen: (id) => go("cours-" + id), onDelete: removeCourse });
}

// Suppression d'un cours : immédiate, avec un message qui permet d'annuler pendant quelques secondes.
async function removeCourse(id) {
  const blob = await storage.blob.get(id);
  const snap = deleteDoc(id);
  await storage.blob.remove(id);
  if (shown === "home") showHome();
  toast({
    text: "Cours supprimé",
    duration: 5000,
    action: {
      label: "Annuler",
      onClick: async () => {
        restoreDoc(snap);
        if (blob) await storage.blob.put(id, blob);
        if (shown === "home") showHome();
      },
    },
  });
}

// Lecture seule + surlignages, ou mode correction (texte brut, éditable).
function view(doc, edit) {
  reader.setEditable(edit);
  highlights.render(doc, edit);
  syncControls();
}

// Texte transcrit corrigeable seulement si le texte ne vient pas tel quel d'un PDF affiché.
const canEdit = (doc) => doc.method === "ocr" || !orig;

function syncControls() {
  const editing = reader.isEditing();
  $("edit-text").textContent = editing ? "Enregistrer" : "Corriger le texte";
  $("edit-text").hidden = !editing && (mode !== "texte" || !canEdit(current));
  $("view-seg").hidden = !orig;
  $("view-original").setAttribute("aria-pressed", String(mode === "original"));
  $("view-texte").setAttribute("aria-pressed", String(mode === "texte"));
  // note discrète, seulement quand elle s'applique
  const note = mode === "original"
    ? (orig && !orig.canComment ? "Pour commenter un passage, passe en « Texte »." : "")
    : [current.method === "ocr" && "Transcrit par l'IA : relis et corrige.", current.truncated && "Attention : transcription peut-être incomplète."].filter(Boolean).join(" ");
  $("doc-note").textContent = note;
  $("doc-note").hidden = !note;
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
  const file = await storage.blob.get(doc.id);
  const r = file ? await viewer.open({ doc, blob: file }) : { ok: false };
  if (my !== viewToken) return r.ok && viewer.close();
  orig = r.ok ? r : null;
  if (orig) viewer.setComments(doc.comments);
  setMode(orig && !edit ? "original" : "texte");
}

function showFiche(doc, edit = false) {
  shown = "cours:" + doc.id;
  // texte modifié depuis : on relocalise les commentaires (les introuvables deviennent orphelins)
  const comments = relocateAll(doc.text, doc.comments ?? []);
  if (JSON.stringify(comments) !== JSON.stringify(doc.comments ?? [])) doc = persist({ ...doc, comments });
  current = doc;
  screen("fiche");
  const saved = !!loadDoc(doc.id);
  const ready = !!doc.onboarding?.consigne;
  view(doc, edit);
  loadOriginal(doc, edit);
  ready ? chat.show(doc) : chat.hide();
  quiz.show(doc); // nouveau cours : quiz remis à zéro
  setTab("chat");
}

// Panneau de droite : « Reviz » (assistant) ou « Me tester » (quiz), l'un à la place de l'autre.
// Changer d'onglet ne remet pas le quiz à zéro.
function setTab(t) {
  const ready = !!current?.onboarding?.consigne, saved = !!current && !!loadDoc(current.id);
  $("tab-quiz").disabled = !ready || !saved;
  if (t === "quiz" && $("tab-quiz").disabled) t = "chat";
  document.querySelector(".tabs").dataset.active = t; // fait glisser le curseur du toggle
  $("tab-chat").setAttribute("aria-selected", String(t === "chat"));
  $("tab-quiz").setAttribute("aria-selected", String(t === "quiz"));
  $("chat").hidden = t !== "chat" || !ready;
  $("assistant-off").hidden = t !== "chat" || ready || !saved;
  $("quiz").hidden = t !== "quiz";
}
$("tab-chat").onclick = () => setTab("chat");
$("tab-quiz").onclick = () => { setTab("quiz"); quiz.open(); };

function showInfos(doc) {
  shown = "infos:" + doc.id; current = doc;
  screen("infos-page");
  doc.onboarding ? onboarding.show(doc) : onboarding.start(doc);
}

function persist(doc) {
  doc = saveDoc({ ...doc, updatedAt: Date.now() });
  quiz.update(doc);
  if (shown?.split(":")[1] !== doc.id) return doc; // l'élève a quitté ce cours pendant un appel
  current = doc;
  if (shown?.startsWith("cours:")) { syncControls(); setTab($("tab-quiz").getAttribute("aria-selected") === "true" ? "quiz" : "chat"); }
  return doc;
}

$("new-course").onclick = () => $("file").click(); // ouvre l'explorateur de fichiers
$("back").onclick = () => go("repertoire");
$("to-infos").onclick = () => go("infos-" + current.id);
$("infos-back").onclick = backToCourse;

setupImporter($("hero"), $("file"), async (file) => {
  const t = toast({ text: "Import du cours…", progress: true }); // la barre suit la lecture des pages
  try {
    const r = await extractText(file, { onProgress: ({ done, total }) => t.set(done / total) });
    if (!r.text.trim()) throw Object.assign(new Error("Aucun texte trouvé."), { code: "empty" });
    t.set(1);
    const doc = { id: Date.now().toString(36), name: file.name, text: r.text, method: r.method, truncated: r.truncated, importedAt: Date.now() };
    await storage.blob.put(doc.id, file); // l'original (PDF / photo) est gardé avec le cours
    saveDoc({ ...doc, updatedAt: Date.now() });
    go("infos-" + doc.id); // étape suivante : infos du cours (matière détectée, échéance)
  } catch (e) {
    t.close();
    toast({ text: ERRORS[e.code] ?? e.message, tone: "err" });
  }
});

// « Corriger le texte » passe en édition ; « Enregistrer » enregistre le texte corrigé (commentaires relocalisés).
$("edit-text").onclick = () => {
  if (!reader.isEditing()) return view(current, true);
  const text = reader.getText();
  const doc = persist({ ...current, text, comments: relocateAll(text, current.comments ?? []) });
  view(doc, false);
};

rebuildIndex();
route();
