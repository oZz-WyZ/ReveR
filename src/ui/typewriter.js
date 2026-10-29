const TYPE_MS = 70, ERASE_MS = 30, HOLD_MS = 1500, PAUSE_MS = 350;

/**
 * Simule la frappe des `exemples` dans le placeholder du champ, l'un après l'autre (le placeholder reste gris).
 * S'arrête tout seul quand le champ quitte la page ; sans animation (mouvement réduit), le premier exemple reste affiché.
 */
export function typePlaceholder(input, exemples) {
  if (!exemples.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { input.placeholder = exemples[0]; return; }
  let k = 0, n = 0, erasing = false;
  const tick = () => {
    if (!input.isConnected) return;
    const word = exemples[k];
    if (!erasing) {
      input.placeholder = word.slice(0, ++n) || " "; // « " " » : un placeholder vide ferait sauter la hauteur du champ
      if (n < word.length) return void setTimeout(tick, TYPE_MS);
      erasing = true;
      return void setTimeout(tick, HOLD_MS);
    }
    input.placeholder = word.slice(0, --n) || " ";
    if (n > 0) return void setTimeout(tick, ERASE_MS);
    erasing = false; k = (k + 1) % exemples.length;
    setTimeout(tick, PAUSE_MS);
  };
  input.placeholder = " ";
  tick();
}
