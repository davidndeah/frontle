// ============================================================
//  Frontle — efectos de sonido del juego (Web Audio, sin assets).
//  Mismo motor que el tutorial de Bordy: osciladores sintetizados,
//  volumen bajo. Respeta el mute global (localStorage "frontle-muted").
// ============================================================

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return ctx;
  } catch {
    return null;
  }
}
// Mute de EFECTOS (independiente de la música). Clave histórica "frontle-muted".
export function isSfxMuted(): boolean {
  try { return localStorage.getItem("frontle-muted") === "1"; } catch { return false; }
}
// Alterna el mute de efectos y devuelve el nuevo estado.
export function toggleSfx(): boolean {
  const muted = !isSfxMuted();
  try { localStorage.setItem("frontle-muted", muted ? "1" : "0"); } catch {}
  return muted;
}
function isMuted(): boolean {
  return isSfxMuted();
}

// Secuencia de notas (freq Hz, wave, dur s). Volumen suave.
function play(notes: { f: number; w?: OscillatorType; d?: number; g?: number }[], gap = 0.09) {
  if (isMuted()) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  notes.forEach((n, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = n.w ?? "sine";
    o.frequency.value = n.f;
    const t = t0 + i * gap;
    const dur = n.d ?? 0.22;
    g.gain.setValueAtTime(n.g ?? 0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  });
}

// Acierto en la mejor ruta (verde): dos notas ascendentes alegres.
export function sfxGood() {
  play([{ f: 659 }, { f: 880 }]);
}
// Desvío pequeño (amarillo): dos notas descendentes suaves.
export function sfxLateral() {
  play([{ f: 392, w: "triangle" }, { f: 330, w: "triangle" }], 0.1);
}
// Muy lejos (rojo): tono grave descendente, más marcado.
export function sfxFar() {
  play([{ f: 262, w: "sawtooth", d: 0.16, g: 0.05 }, { f: 175, w: "sawtooth", d: 0.24, g: 0.05 }], 0.11);
}
// Input inválido (país desconocido / no adyacente): "buzz" corto y neutro.
export function sfxInvalid() {
  play([{ f: 220, w: "square", d: 0.09, g: 0.03 }]);
}
// Victoria: fanfarria ascendente.
export function sfxWin() {
  play([{ f: 523 }, { f: 659 }, { f: 784 }, { f: 1046, d: 0.4 }], 0.1);
}
// Compra de pista confirmada: dos notas cristalinas.
export function sfxHint() {
  play([{ f: 784 }, { f: 1046 }], 0.07);
}
