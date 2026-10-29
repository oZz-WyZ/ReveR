import { extractText } from "./extract/index.js";
import { relocateAll } from "./anchors.js";
import { NON_CLASSE, deleteDoc, entriesOf, listEntries, loadDoc, rebuildIndex, restoreDoc, saveDoc } from "./library.js";
import { classify, isSure } from "./classify.js";
import { loadProfile, saveProfile } from "./profile.js";
import { buildConsigne } from "./chat/consigne.js";
import { storage } from "./storage.js";
import { setupImporter } from "./ui/importer.js";
import { createReader } from "./ui/reader.js";
import { createChat } from "./ui/chat.js";
import { createHighlights } from "./ui/highlights.js";
import { createViewer } from "./ui/viewer.js";
import { createInk } from "./ui/ink.js";
import { createInkBar } from "./ui/inkbar.js";
import { download, exportAnnotated } from "./export.js";
import { createQuiz } from "./ui/quiz.js";
import { renderLibrary } from "./ui/library.js";
import { thumbnail } from "./ui/thumb.js";
import { chooseMatiere, renderSubjects } from "./ui/subjects.js";
import { startSetup } from "./ui/profile-setup.js";
import { toast } from "./ui/toast.js";
import { createVoice } from "./ui/voice.js";

const $ = (id) => document.getElementById(id);
const reader = createReader($("reader"));
const ink = createInk({ onChange: (annotations) => persist({ ...current, annotations }) });
const viewer = createViewer($("pdf-view"), ink);
createInkBar($("ink-bar"), ink, viewer, { onExport: exportPdf });

// Export : l'original + les annotations, en PDF.
async function exportPdf() {
  const d = current, file = await storage.blob.get(d.id);
  if (!file || !d.annotations?.length) return;
  const t = toast({ text: "Export du PDF…", duration: 60000 });
  try {
    download(await exportAnnotated(file, d.annotations), d.name.replace(/\.[^./\\]+$/, "") + "-annote.pdf");
    t?.close?.();
    toast({ text: "PDF annoté exporté", duration: 3000 });
  } catch {
    t?.close?.();
    toast({ text: "L'export du PDF a échoué.", tone: "err" });
  }
}
const chat = createChat({ onPassage: (p) => showRef(p) });
const quiz = createQuiz((dernierQuiz) => persist({ ...current, dernierQuiz }));
const highlights = createHighlights({
  reader,
  viewer,
  getMode: () => mode,
  getDoc: () => withConsigne(current),
  saveComments: (comments) => { const d = persist({ ...current, comments }); highlights.render(d, false); },
});
let profil = loadProfile(); // { niveau, classe..., matieres: [{ id, nom }] } ; absent = onboarding à faire
let current = null; // le cours affiché : { id, name, text, method, truncated, importedAt, matiereId?, comments? }
let shown = null;   // "setup", "home", ou "<écran>:<id>" (matiere / cours)
let mode = "texte"; // affichage du cours : "original" (PDF / photo) ou "texte"
let orig = null;    // { kind, canComment } si l'original est affiché
let viewToken = 0;

const ERRORS = {
  unsupported: "Format non pris en charge (PDF, JPEG ou PNG).",
  too_many_pages: null, // message déjà explicite
  pdf_unreadable: "Ce PDF est illisible.",
  images_unavailable: "La transcription d'images n'est pas disponible ici.",
  not_granted: "Accès refusé : vérifie le code d'accès (ou l'autorisation Claude).",
  rate_limited: "Trop de requêtes : réessaie dans un moment.",
};

// Écrans : onboarding du profil, accueil (cartes par matière), page d'une matière, fiche (cours + assistant / quiz).
const SCREENS = ["setup", "home", "matiere-page", "fiche"];
const screen = (name) => {
  SCREENS.forEach((s) => { $(s).hidden = s !== name; });
  document.body.classList.toggle("setup-open", name === "setup"); // l'onboarding est sur fond blanc
  document.body.classList.toggle("fiche-open", name === "fiche"); // la fiche tient dans la fenêtre : pas de scroll de page
};

const matiereName = (d) => profil?.matieres.find((m) => m.id === d?.matiereId)?.nom ?? null;
// La consigne de l'assistant se déduit du profil et de la matière du cours (aucun appel IA).
const withConsigne = (d) => d && { ...d, consigne: buildConsigne(profil, matiereName(d)) };

// Navigation par hash : #repertoire, #matiere-<id>, #cours-<id>. go() appelle route() aussi, au cas où hashchange ne partirait pas.
const go = (hash) => { location.hash = hash; route(); };
function route() {
  if (!profil) return shown === "setup" ? undefined : showSetup();
  const [, kind, id] = location.hash.slice(1).match(/^([a-z]+)-(.+)$/) ?? [];
  const key = id && ["cours", "matiere"].includes(kind) ? `${kind}:${id}` : "home";
  if (key === shown) return;
  if (key === "home") return showHome();
  if (kind === "matiere") return showMatiere(id);
  const doc = loadDoc(id);
  if (!doc) { showHome(); location.hash = "repertoire"; return; }
  showFiche(doc);
}
window.addEventListener("hashchange", route);

function showSetup() {
  shown = "setup"; current = null;
  screen("setup");
  startSetup({
    onDone: (p) => { saveProfile(p); profil = p; go("repertoire"); },
  });
}

function showHome() {
  shown = "home"; current = null;
  screen("home");
  const entries = listEntries();
  const known = new Set(profil.matieres.map((m) => m.id));
  renderSubjects(
    profil.matieres,
    (id) => entries.filter((e) => e.matiereId === id).length,
    entries.filter((e) => !e.matiereId || !known.has(e.matiereId)).length,
    (id) => go("matiere-" + id),
  );
}

function showMatiere(id) {
  shown = "matiere:" + id; current = null;
  screen("matiere-page");
  $("matiere-title").textContent = id === NON_CLASSE ? "Non classé" : (profil.matieres.find((m) => m.id === id)?.nom ?? "Matière");
  renderLibrary(entriesOf(id, profil.matieres), { onOpen: (cid) => go("cours-" + cid), onDelete: removeCourse, thumb: async (cid) => thumbnail(cid, await storage.blob.get(cid)) });
}

const refreshList = () => (shown?.startsWith("matiere:") ? showMatiere(shown.slice(8)) : shown === "home" ? showHome() : undefined);

// Suppression d'un cours : immédiate, avec un message qui permet d'annuler pendant quelques secondes.
async function removeCourse(id) {
  const blob = await storage.blob.get(id);
  const snap = deleteDoc(id);
  await storage.blob.remove(id);
  refreshList();
  toast({
    text: "Cours supprimé",
    duration: 5000,
    action: {
      label: "Annuler",
      onClick: async () => {
        restoreDoc(snap);
        if (blob) await storage.blob.put(id, blob);
        refreshList();
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
  // note discrète, seulement quand elle s'applique
  const note = mode === "original"
    ? ""
    : [current.method === "ocr" && "Transcrit par l'IA : relis et corrige.", current.truncated && "Attention : transcription peut-être incomplète."].filter(Boolean).join(" ");
  $("ink-bar").hidden = mode !== "original" || editing; // annotations : seulement sur l'original
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

// Affiche l'original (PDF page par page, photo) s'il est disponible ; sinon on reste sur le texte.
async function loadOriginal(doc, edit) {
  const my = ++viewToken;
  viewer.close(); orig = null;
  ink.setStrokes(doc.annotations ?? []);
  $("pdf-view").hidden = $("reader").hidden = !edit; // pas de clignotement texte -> PDF
  const file = await storage.blob.get(doc.id);
  const r = file ? await viewer.open({ doc, blob: file }) : { ok: false };
  if (my !== viewToken) return r.ok && viewer.close();
  orig = r.ok ? r : null;
  if (orig) viewer.setComments(doc.comments);
  setMode(orig && !edit ? "original" : "texte");
}

// Passage cité par l'assistant : surligné dans la visionneuse (même jaune que les commentaires) et mis en vue.
function showRef(passage) {
  const start = current?.text.indexOf(passage) ?? -1;
  highlights.setRef(start < 0 ? null : { start, end: start + passage.length });
  if (start >= 0) highlights.reveal();
}

function showFiche(doc, edit = false) {
  shown = "cours:" + doc.id;
  highlights.setRef(null, false); // pas de surlignage d'un autre cours
  // texte modifié depuis : on relocalise les commentaires (les introuvables deviennent orphelins)
  const comments = relocateAll(doc.text, doc.comments ?? []);
  if (JSON.stringify(comments) !== JSON.stringify(doc.comments ?? [])) doc = persist({ ...doc, comments });
  current = doc;
  screen("fiche");
  renderMatiereChip();
  view(doc, edit);
  loadOriginal(doc, edit);
  chat.show(withConsigne(doc));
  quiz.show(withConsigne(doc)); // nouveau cours : quiz remis à zéro
  setTab("chat");
}

// Matière du cours : puce dans la barre d'outils (change la matière) et retour vers la liste de cette matière.
function renderMatiereChip() {
  const nom = matiereName(current) ?? "Non classé";
  $("fiche-matiere-nom").textContent = nom;
}
$("fiche-matiere").onclick = async () => {
  const choice = await chooseMatiere({ matieres: profil.matieres, titre: "Changer de matière", sous: current.name, dismissable: true, current: current.matiereId });
  if (choice === null) return;
  const d = persist({ ...current, matiereId: choice === NON_CLASSE ? null : choice });
  renderMatiereChip();
  chat.show(withConsigne(d)); // l'assistant s'adapte à la nouvelle matière
  quiz.update(withConsigne(d));
};

// Panneau de droite : « ReveR » (assistant) ou « Me tester » (quiz), l'un à la place de l'autre.
// Changer d'onglet ne remet pas le quiz à zéro.
function setTab(t) {
  $("tab-chat").parentElement.dataset.active = t; // fait glisser le curseur du toggle de l'assistant
  $("tab-chat").setAttribute("aria-selected", String(t === "chat"));
  $("tab-quiz").setAttribute("aria-selected", String(t === "quiz"));
  $("fiche").dataset.tab = t; // le CSS floute le cours pendant « Me tester »
  $("chat").hidden = t !== "chat";
  $("quiz").hidden = t !== "quiz";
}
$("tab-chat").onclick = () => setTab("chat");
$("tab-quiz").onclick = () => { setTab("quiz"); quiz.open(); };

function persist(doc) {
  doc = saveDoc({ ...doc, updatedAt: Date.now() });
  quiz.update(withConsigne(doc));
  if (shown !== "cours:" + doc.id) return doc; // l'élève a quitté ce cours pendant un appel
  current = doc;
  syncControls();
  return doc;
}

// Saisie vocale pour l'assistant : la question dictée remplit le champ, l'élève l'envoie quand il veut.
createVoice({ input: $("chat-input"), button: $("chat-mic"), onError: (msg) => toast({ text: msg, tone: "err" }) });

$("new-course").onclick = () => $("file").click(); // ouvre l'explorateur de fichiers
$("back").onclick = () => go("repertoire");
$("matiere-back").onclick = () => go("repertoire");

// Import : texte extrait, puis classement dans la bonne matière. Si l'app n'est pas sûre, elle demande tout de suite à l'élève.
setupImporter($("hero"), $("file"), async (file) => {
  const t = toast({ text: "Import du cours…", progress: true }); // la barre suit la lecture des pages
  try {
    const r = await extractText(file, { onProgress: ({ done, total }) => t.set((0.85 * done) / total) });
    if (!r.text.trim()) throw Object.assign(new Error("Aucun texte trouvé."), { code: "empty" });
    const doc = { id: Date.now().toString(36), name: file.name, text: r.text, method: r.method, truncated: r.truncated, importedAt: Date.now() };
    await storage.blob.put(doc.id, file); // l'original (PDF / photo) est gardé avec le cours
    t.set(0.9);
    let choix = await classify({ name: file.name, text: r.text, matieres: profil.matieres }).then((c) => (isSure(c) ? c.matiereId : undefined), () => undefined);
    if (choix === undefined) {
      choix = await chooseMatiere({ matieres: profil.matieres, titre: "Dans quelle matière ranger ce cours ?", sous: file.name });
    }
    saveDoc({ ...doc, matiereId: choix === NON_CLASSE ? null : choix, updatedAt: Date.now() });
    t.set(1);
    go("cours-" + doc.id);
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

// Bouton « Reset » (provisoire, pour retester l'onboarding) : efface tout, après un second clic de confirmation.
let resetTimer;
const disarmReset = () => { clearTimeout(resetTimer); $("reset").textContent = "Reset"; };
$("reset").onclick = async () => {
  if ($("reset").textContent === "Reset") {
    $("reset").textContent = "Confirmer ?";
    resetTimer = setTimeout(disarmReset, 4000);
    return;
  }
  disarmReset();
  await storage.blob.clear();
  storage.clear();
  profil = null; current = null;
  location.hash = "";
  showSetup();
};

rebuildIndex();
route();
