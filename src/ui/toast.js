// Petites notifications en bas à droite, avec une barre de progression qui se remplit puis ferme la notification.
// toast({ text, duration, tone, action }) : barre pilotée par le temps.
// toast({ text, progress: true }) : barre pilotée par le code via t.set(0..1) ; ferme à 100 %.
const root = () => document.getElementById("toasts");

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function toast({ text, duration = 4000, tone, action, progress = false }) {
  const t = el("div", "toast" + (tone === "err" ? " err" : ""));
  t.setAttribute("role", tone === "err" ? "alert" : "status");
  const line = el("div", "toast-line");
  line.append(el("span", "toast-text", text));
  const fill = el("div", "fill");
  const track = el("div", "track");
  track.append(fill);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    t.classList.add("out");
    setTimeout(() => t.remove(), 220);
  };
  if (action) {
    const b = el("button", "act", action.label);
    b.type = "button";
    b.onclick = () => { action.onClick(); close(); };
    line.append(b);
  }
  t.append(line, track);
  root().append(t);

  const setFill = (f) => { fill.style.width = Math.max(0, Math.min(1, f)) * 100 + "%"; };
  if (progress) {
    return { close, set(f) { setFill(f); if (f >= 1) setTimeout(close, 350); } };
  }
  const t0 = performance.now();
  (function tick(now) {
    if (closed) return;
    const f = (now - t0) / duration;
    setFill(f);
    f < 1 ? requestAnimationFrame(tick) : close();
  })(t0);
  return { close };
}
