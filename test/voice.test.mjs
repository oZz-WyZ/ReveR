import assert from "node:assert/strict";

// Sans API de reconnaissance vocale : rien n'apparaît, pas d'erreur
let { createVoice } = await import("../src/ui/voice.js?none");
const mkEls = () => ({
  input: { value: "", disabled: false },
  button: { hidden: true, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, onclick: null },
  form: { submitted: 0, requestSubmit() { this.submitted++; } },
});
let els = mkEls();
assert.deepEqual(createVoice({ ...els }), { supported: false });
assert.equal(els.button.hidden, true);

// Avec une API simulée
let current;
globalThis.SpeechRecognition = class {
  start() { current = this; this.started = true; }
  stop() { this.onend(); }
};
({ createVoice } = await import("../src/ui/voice.js?with"));
els = mkEls();
const errors = [];
assert.deepEqual(createVoice({ ...els, onError: (m) => errors.push(m) }), { supported: true });
assert.equal(els.button.hidden, false);

// clic : démarre en français, avec résultats intermédiaires
els.button.onclick();
assert.equal(current.lang, "fr-FR");
assert.equal(current.interimResults, true);
assert.equal(els.button.attrs["aria-pressed"], "true");

// le texte dicté remplit le champ pendant qu'on parle, puis la question part à la fin
current.onresult({ results: [[{ transcript: "que dit" }]] });
assert.equal(els.input.value, "que dit");
current.onresult({ results: [[{ transcript: "que dit" }], [{ transcript: "le cours" }]] });
assert.equal(els.input.value, "que dit le cours");
current.onend();
assert.equal(els.button.attrs["aria-pressed"], "false");
assert.equal(els.form.submitted, 1);

// rien entendu : pas d'envoi
els.button.onclick(); current.onerror({ error: "no-speech" }); current.onend();
assert.equal(els.form.submitted, 1);
assert.deepEqual(errors, ["Je n'ai rien entendu, réessaie."]);

// champ désactivé (réponse en cours) : on n'envoie pas
els.button.onclick(); current.onresult({ results: [[{ transcript: "bonjour" }]] }); els.input.disabled = true; current.onend();
assert.equal(els.form.submitted, 1);
els.input.disabled = false;

// 2e clic pendant l'écoute : arrête la dictée
els.button.onclick(); const live = current; let ended = 0; live.onend = () => { ended++; }; els.button.onclick();
assert.equal(ended, 1);

// micro refusé (cadre sandboxé) : message et bouton retiré
els.button.onclick(); current.onerror({ error: "not-allowed" });
assert.equal(els.button.hidden, true);
assert.equal(errors.at(-1), "Le micro n'est pas autorisé ici.");
// erreur « aborted » (arrêt volontaire) : silencieuse
const n = errors.length; els.button.hidden = false; els.button.onclick(); current.onerror({ error: "aborted" });
assert.equal(errors.length, n);
console.log("ok");
