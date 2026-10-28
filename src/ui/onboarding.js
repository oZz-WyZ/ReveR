import { detectSubject } from "../onboarding/detect.js";
import { generateConsigne } from "../onboarding/consigne.js";

const $ = (id) => document.getElementById(id);
const FIELDS = { matiere: "ob-matiere", sujet: "ob-sujet", niveau: "ob-niveau" };
const today = () => new Date().toLocaleDateString("sv"); // yyyy-mm-dd, heure locale

/** persist(doc) -> doc sauvegardé (main.js). Le doc porte `onboarding` (voir README). */
export function createOnboarding(persist, onDone) {
  let doc, detecte = null;

  const status = (msg, err = false) => { $("ob-status").textContent = msg; $("ob-status").className = err ? "err" : ""; };
  const warnDate = () => { $("ob-warn").textContent = $("ob-echeance").value && $("ob-echeance").value < today() ? "Cette date est passée." : ""; };
  $("ob-echeance").oninput = warnDate;

  function fill(v, onlyEmpty = false) {
    for (const [k, id] of Object.entries(FIELDS)) if (!onlyEmpty || !$(id).value) $(id).value = v[k] ?? "";
  }

  // La consigne reste interne (system du chat) : l'élève ne la voit pas, seulement le bouton de repli.
  function showConsigne() {
    $("ob-regen").hidden = !doc.onboarding || !!doc.onboarding.consigne;
  }

  async function generate() {
    status("Configuration de l'assistant…");
    try {
      const consigne = await generateConsigne(doc.onboarding);
      doc = persist({ ...doc, onboarding: { ...doc.onboarding, consigne, updatedAt: Date.now() } });
      status("Assistant configuré.");
      showConsigne();
      return true;
    } catch {
      status("L'assistant n'a pas pu être configuré.", true);
      showConsigne();
      return false;
    }
  }
  $("ob-regen").onclick = async () => { if (await generate()) onDone?.(); };

  $("ob-form").onsubmit = async (e) => {
    e.preventDefault();
    const v = {
      matiere: $("ob-matiere").value.trim(),
      sujet: $("ob-sujet").value.trim(),
      niveau: $("ob-niveau").value,
      echeance: $("ob-echeance").value || null,
    };
    const old = doc.onboarding;
    const changed = !old || ["matiere", "sujet", "niveau"].some((k) => old[k] !== v[k]);
    doc = persist({
      ...doc,
      onboarding: { ...old, ...v, consigne: changed ? null : old.consigne, detecte: old?.detecte ?? detecte, updatedAt: Date.now() },
    });
    const ok = doc.onboarding.consigne ? (status("Enregistré."), showConsigne(), true) : await generate();
    if (ok) onDone?.(); // l'assistant est prêt : retour au cours
  };

  return {
    // Cours déjà configuré : réaffiche les valeurs stockées.
    show(d) {
      doc = d;
      fill(d.onboarding);
      $("ob-echeance").value = d.onboarding.echeance ?? "";
      warnDate(); status(""); showConsigne();
    },
    // Nouveau cours : détecte, préremplit, laisse l'élève corriger.
    async start(d) {
      doc = d; detecte = null;
      fill({}); $("ob-echeance").value = ""; warnDate(); showConsigne();
      status("Détection de la matière…");
      try {
        detecte = await detectSubject({ name: d.name, text: d.text });
        fill({ matiere: detecte.matiere, sujet: detecte.sujet, niveau: detecte.niveau_estime }, true);
        const complete = detecte.matiere && detecte.sujet && detecte.niveau_estime;
        status(complete ? "Vérifie et corrige si besoin." : "Détection incomplète : complète les champs.", !complete);
      } catch {
        status("Détection impossible : remplis les champs.", true);
      }
    },
  };
}
