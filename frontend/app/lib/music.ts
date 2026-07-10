// ============================================================
//  Frontle — música de fondo (Web Audio, sin assets).
//  Loop ambiental chill generado con osciladores: pads suaves +
//  arpegio ligero sobre una progresión maj7/min7, filtro paso-bajo
//  para calidez. Volumen bajo para no tapar los SFX ni molestar.
//  Mute propio, independiente de los efectos (localStorage).
// ============================================================

const MUSIC_KEY = "frontle-music-muted";

export function isMusicMuted(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) === "1";
  } catch {
    return false;
  }
}
function setMusicMuted(m: boolean): void {
  try {
    localStorage.setItem(MUSIC_KEY, m ? "1" : "0");
  } catch {}
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0; // próximo tiempo (s) por programar
let step = 0; // paso del patrón
let running = false;

// Progresión chill (Cmaj7 · Am7 · Fmaj7 · G6), notas base en Hz.
// Cada acorde dura un compás; el arpegio recorre sus notas.
const CHORDS: number[][] = [
  [130.81, 164.81, 196.0, 246.94], // Cmaj7  C E G B
  [110.0, 130.81, 164.81, 196.0], // Am7    A C E G
  [87.31, 110.0, 130.81, 164.81], // Fmaj7  F A C E
  [98.0, 123.47, 146.83, 164.81], // G6     G B D E
];

const BPM = 64;
const BEAT = 60 / BPM; // s por negra
const STEP = BEAT / 2; // corcheas: cada paso del scheduler
const STEPS_PER_BAR = 8; // 8 corcheas por compás
const LOOKAHEAD = 0.1; // programar 100 ms hacia adelante

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.0; // arranca en silencio; sube al iniciar
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      master.connect(lp).connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

// Una nota con envolvente suave (attack/decay largos = sensación de pad).
function voice(a: AudioContext, freq: number, t: number, dur: number, gain: number, type: OscillatorType) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function scheduleStep(a: AudioContext, s: number, t: number) {
  const bar = Math.floor(s / STEPS_PER_BAR) % CHORDS.length;
  const chord = CHORDS[bar];
  const beat = s % STEPS_PER_BAR;

  // Pad: al inicio de cada compás, acorde sostenido y muy suave.
  if (beat === 0) {
    const barDur = STEP * STEPS_PER_BAR;
    chord.forEach((f, i) => voice(a, f, t, barDur * 0.98, i === 0 ? 0.09 : 0.06, "sine"));
  }
  // Arpegio: una nota por corchea, subiendo y con octava ocasional.
  const arpNote = chord[beat % chord.length] * (beat >= 4 ? 2 : 1);
  voice(a, arpNote, t, STEP * 1.4, 0.05, "triangle");
}

function loop() {
  const a = ac();
  if (!a || !running) return;
  while (nextTime < a.currentTime + LOOKAHEAD) {
    scheduleStep(a, step, nextTime);
    step += 1;
    nextTime += STEP;
  }
}

// Inicia la música (idempotente). Debe llamarse tras un gesto del usuario
// (política de autoplay). No hace nada si está muteada.
export function startMusic(): void {
  if (isMusicMuted()) return;
  const a = ac();
  if (!a || running) return;
  a.resume?.();
  running = true;
  nextTime = a.currentTime + 0.15;
  master!.gain.cancelScheduledValues(a.currentTime);
  master!.gain.setValueAtTime(0.0001, a.currentTime);
  master!.gain.exponentialRampToValueAtTime(0.38, a.currentTime + 2.5); // fade-in
  timer = setInterval(loop, 25);
}

export function stopMusic(): void {
  const a = ctx;
  running = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (a && master) {
    master.gain.cancelScheduledValues(a.currentTime);
    master.gain.setValueAtTime(master.gain.value, a.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6); // fade-out
  }
}

// Alterna el mute de música y arranca/detiene. Devuelve el nuevo estado muted.
export function toggleMusic(): boolean {
  const muted = !isMusicMuted();
  setMusicMuted(muted);
  if (muted) stopMusic();
  else startMusic();
  return muted;
}
