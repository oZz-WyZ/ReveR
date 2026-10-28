// Saisie vocale (API Web Speech du navigateur) : un clic sur le micro dicte la question ; elle reste dans le champ,
// l'élève la relit, la corrige si besoin et l'envoie lui-même.
// Le bouton n'apparaît que si le navigateur sait faire de la reconnaissance vocale. Dans certains contextes (cadre
// sandboxé d'un artifact, micro refusé) elle échoue : on prévient l'élève et on cache le bouton.
const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;

const ERRORS = {
  "not-allowed": "Le micro n'est pas autorisé ici.",
  "service-not-allowed": "La dictée n'est pas disponible ici.",
  "audio-capture": "Aucun micro détecté.",
  "no-speech": "Je n'ai rien entendu, réessaie.",
  network: "La dictée a besoin d'une connexion.",
};

export function createVoice({ input, button, onError }) {
  if (!Recognition) return { supported: false };
  button.hidden = false;
  let rec = null, heard = "";

  const setOn = (on) => { button.setAttribute("aria-pressed", String(on)); button.title = on ? "Arrêter la dictée" : "Dicter ta question"; };

  function start() {
    rec = new Recognition();
    rec.lang = "fr-FR";
    rec.interimResults = true;   // le texte s'affiche pendant qu'on parle
    rec.continuous = false;      // s'arrête à la fin de la phrase
    heard = "";
    rec.onresult = (e) => {
      heard = [...e.results].map((r) => r[0].transcript).join(" ").trim();
      input.value = heard;
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      onError?.(ERRORS[e.error] ?? "La dictée a échoué.");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") button.hidden = true; // inutile d'insister
    };
    rec.onend = () => {
      setOn(false);
      rec = null;
      if (heard && !input.disabled) input.focus(); // la question reste dans le champ : relecture puis envoi par l'élève
    };
    try { rec.start(); setOn(true); } catch { rec = null; onError?.("La dictée n'a pas pu démarrer."); }
  }

  button.onclick = () => (rec ? rec.stop() : start());
  return { supported: true };
}
