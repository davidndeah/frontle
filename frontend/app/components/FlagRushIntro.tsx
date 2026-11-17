"use client";

// ============================================================
//  FlagRushIntro — la entrada a Flag Rush.
//
//  Guion (aprobado por David, 17-nov):
//   1. El globo llega girando, como en la entrada del reto diario.
//   2. Diez banderas se clavan sobre sus países, una cada décima.
//   3. Salen volando en fila y aterrizan en el visor de Bordy, que se
//      enciende y empieza a pasarlas.
//   4. Bordy salta y sale «¡YA!». Ahí arranca la partida.
//
//  · El globo es el mismo motor de ChallengeIntro (lienzo + d3-geo,
//    proyección ortográfica, pines con la bandera recortada en círculo y
//    caída con rebote). Se copió aquí a propósito para no tocar el archivo
//    de Santiago; unificarlo es trabajo pendiente con él.
//  · Las banderas son de ADORNO: la escena corre antes de pedir la partida
//    al servidor, así que no se conocen las de verdad (ni deben conocerse).
//    Y por eso tampoco le quita tiempo a la primera bandera.
//  · El vuelo va en el DOM, no en el lienzo: las banderas tienen que salir
//    de la mirilla redonda del globo y cruzar la pantalla hasta Bordy. Se
//    animan con la Web Animations API sobre transform y opacity.
//  · Un toque la salta. Con `prefers-reduced-motion` no hay viaje: se enseña
//    el final (globo quieto, visor encendido, «¡YA!») y se cierra sola.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { geoArea, geoCentroid, geoDistance, geoOrthographic, geoPath } from "d3-geo";
import type { Polygon } from "geojson";
import { loadAtlas, type AtlasFeature } from "../lib/atlas";
import { COUNTRIES } from "../lib/countries";
import { getIsland } from "../lib/islands";
import { sfxGood, sfxHint, sfxTick } from "../lib/sfx";
import Bordy, { type BordyMood } from "./Bordy";

// Mismos colores que la entrada del reto diario.
const C = {
  ocean: "#5b21b6",
  land: "#c9b6f5",
  border: "rgba(13, 4, 32, .55)",
  deep: "#0d0420",
  pinRing: "#fcff52",
};

// Tiempos de la escena, en ms desde que arranca.
const TRAVEL = 1200; // el globo llega
const PIN_0 = 1150; // cae la primera bandera
const PIN_GAP = 95; // una cada ~décima
const PIN_MS = 300; // lo que tarda en clavarse (con rebote)
const FLY = 2250; // empiezan a volar
const FLY_GAP = 45;
const FLY_MS = 520;
const GO = 3150; // «¡YA!»
const END = 3750; // se cierra sola
const ATLAS_WAIT = 700; // si el atlas tarda más, la escena arranca sin él
const PINS = 10;

// Tres vistas del mundo, cada una con muchos países a la vista. Se elige una
// al azar para que la entrada no sea siempre la misma.
const VIEWS: [number, number][] = [
  [-15, -18], // Europa y África
  [72, -8], // las Américas
  [-95, -18], // Asia
];

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Centroide del polígono más grande (igual que ChallengeIntro).
function mainCentroid(f: AtlasFeature): [number, number] {
  const g = f.geometry;
  if (g.type !== "MultiPolygon") return geoCentroid(f);
  let best: Polygon | null = null;
  let bestArea = -1;
  for (const coords of g.coordinates) {
    const p: Polygon = { type: "Polygon", coordinates: coords };
    const a = geoArea(p);
    if (a > bestArea) {
      bestArea = a;
      best = p;
    }
  }
  return best ? geoCentroid(best) : geoCentroid(f);
}

const codeOf = (name: string): string | null => COUNTRIES[name]?.code ?? getIsland(name)?.code ?? null;

interface PinDef {
  code: string;
  at: [number, number];
  img: HTMLImageElement;
}

// Diez países bien repartidos por la cara visible. Muestreo del punto más
// lejano: cada pin nuevo es, entre unos candidatos al azar, el más alejado de
// los que ya están. Así cubren el globo en vez de amontonarse en una región
// con muchos países chicos (Europa, el sudeste asiático).
function pickPins(map: Map<string, AtlasFeature>, view: [number, number]): PinDef[] {
  const center: [number, number] = [-view[0], -view[1]];
  const pool: { code: string; at: [number, number] }[] = [];
  for (const [name, f] of map) {
    const code = codeOf(name);
    if (!code) continue;
    const at = mainCentroid(f);
    // Hasta ~63° del centro: más afuera el pin se aplasta contra el borde.
    if (geoDistance(at, center) < 1.1) pool.push({ code, at });
  }
  const out: { code: string; at: [number, number] }[] = [];
  const minTo = (p: { at: [number, number] }) => Math.min(...out.map((o) => geoDistance(o.at, p.at)));
  while (out.length < PINS && pool.length) {
    let best = 0;
    if (out.length) {
      let bestD = -1;
      for (let k = 0; k < 14; k++) {
        const c = Math.floor(Math.random() * pool.length);
        const d = minTo(pool[c]);
        if (d > bestD) { bestD = d; best = c; }
      }
    } else {
      best = Math.floor(Math.random() * pool.length);
    }
    out.push(pool.splice(best, 1)[0]);
  }
  return out.map((p) => {
    const img = new Image();
    img.src = `https://flagcdn.com/w80/${p.code.toLowerCase()}.png`;
    return { ...p, img };
  });
}

export default function FlagRushIntro({
  title, go, skip, onDone, scrub = null,
}: {
  title: string;
  go: string;
  skip: string;
  onDone: () => void;
  /**
   * Solo laboratorio: congela la escena en este instante (ms) para revisarla
   * cuadro por cuadro. Con un valor, no suena ni se cierra sola.
   */
  scrub?: number | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flightRef = useRef<HTMLDivElement>(null);
  const bordyRef = useRef<HTMLDivElement>(null);
  const [visor, setVisor] = useState<string[] | null>(null);
  const [showGo, setShowGo] = useState(false);
  const [mood, setMood] = useState<BordyMood>("idle");
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const scrubRef = useRef(scrub);
  useEffect(() => {
    onDoneRef.current = onDone;
    scrubRef.current = scrub;
  }, [onDone, scrub]);

  function finish() {
    if (doneRef.current || scrubRef.current != null) return;
    doneRef.current = true;
    onDoneRef.current();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const flight = flightRef.current;
    if (!canvas || !wrap || !flight) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const projection = geoOrthographic().clipAngle(90).precision(0.6);
    const path = geoPath(projection, ctx);
    const view = VIEWS[Math.floor(Math.random() * VIEWS.length)];

    let features: AtlasFeature[] = [];
    let pins: PinDef[] = [];
    const flown = new Set<number>(); // pines que ya salieron del globo

    let size = 0;
    let dpr = 1;
    function resize() {
      const w = wrap!.clientWidth;
      if (!w) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = w;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(w * dpr);
    }

    // Rotación del globo en el instante t: llega dando media vuelta y luego
    // sigue girando despacio, para que no se quede muerto.
    const rotAt = (t: number): [number, number] => {
      const e = reduced ? 1 : easeOut(Math.min(1, t / TRAVEL));
      const drift = reduced ? 0 : Math.max(0, t - TRAVEL) * 0.004;
      return [view[0] + (1 - e) * 150 + drift, view[1] + (1 - e) * 22];
    };

    function pinRadius() {
      return Math.max(10, size * 0.052);
    }

    function pin(xy: [number, number], img: HTMLImageElement, s: number, phase: number) {
      const r = pinRadius() * s;
      if (!reduced && s >= 1) {
        ctx!.beginPath();
        ctx!.arc(xy[0], xy[1], r + phase * r * 1.4, 0, Math.PI * 2);
        ctx!.strokeStyle = C.pinRing;
        ctx!.globalAlpha = (1 - phase) * 0.8;
        ctx!.lineWidth = 2.5;
        ctx!.stroke();
        ctx!.globalAlpha = 1;
      }
      ctx!.beginPath();
      ctx!.arc(xy[0] + 2.5, xy[1] + 2.5, r, 0, Math.PI * 2);
      ctx!.fillStyle = C.deep;
      ctx!.fill();
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      ctx!.clip();
      ctx!.fillStyle = "#ffffff";
      ctx!.fillRect(xy[0] - r, xy[1] - r, r * 2, r * 2);
      if (img.complete && img.naturalWidth > 0) {
        const h = r * 2;
        const w = Math.max(h, (h * img.naturalWidth) / img.naturalHeight);
        ctx!.drawImage(img, xy[0] - w / 2, xy[1] - h / 2, w, h);
      }
      ctx!.restore();
      ctx!.beginPath();
      ctx!.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      ctx!.lineWidth = Math.max(2.5, r * 0.18);
      ctx!.strokeStyle = C.pinRing;
      ctx!.stroke();
      ctx!.beginPath();
      ctx!.arc(xy[0], xy[1], r + Math.max(1.5, r * 0.1), 0, Math.PI * 2);
      ctx!.lineWidth = 2;
      ctx!.strokeStyle = C.deep;
      ctx!.stroke();
    }

    function draw(t: number, now: number) {
      if (!size) return;
      const e = reduced ? 1 : easeOut(Math.min(1, t / TRAVEL));
      const rot = rotAt(t);
      const zoom = 0.55 + 0.45 * e;
      const cx = size / 2;
      const cy = size / 2;
      const r = (size / 2) * 0.96 * zoom;
      projection.scale(r).translate([cx, cy]).rotate([rot[0], rot[1], 0]);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, size, size);

      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = C.ocean;
      ctx!.fill();

      if (features.length) {
        ctx!.beginPath();
        for (const f of features) path(f);
        ctx!.fillStyle = C.land;
        ctx!.fill();
        ctx!.strokeStyle = C.border;
        ctx!.lineWidth = 0.6;
        ctx!.stroke();
      }

      const g = ctx!.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.05, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,.22)");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(13,4,32,.28)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = g;
      ctx!.fill();

      if (reduced) return; // el final quieto no lleva pines: ya volaron
      const center: [number, number] = [-rot[0], -rot[1]];
      const phase = (now / 1300) % 1;
      pins.forEach((p, i) => {
        if (flown.has(i)) return;
        const tp = (t - (PIN_0 + i * PIN_GAP)) / PIN_MS;
        if (tp <= 0) return;
        if (geoDistance(p.at, center) > Math.PI / 2 - 0.05) return;
        const xy = projection(p.at);
        if (!xy) return;
        pin(xy, p.img, easeBack(Math.min(1, tp)), (phase + i * 0.1) % 1);
      });
    }

    // Lanza la bandera i desde su pin hasta el visor de Bordy.
    function launch(i: number, t: number): { el: HTMLImageElement; anim: Animation } | null {
      const p = pins[i];
      const rig = bordyRef.current?.querySelector(".bordy-rig");
      if (!p || !rig) return null;
      flown.add(i);
      const rot = rotAt(t);
      const center: [number, number] = [-rot[0], -rot[1]];
      const xy = geoDistance(p.at, center) < Math.PI / 2 ? projection(p.at) : null;
      const cr = canvas!.getBoundingClientRect();
      const fr = flight!.getBoundingClientRect();
      const rr = rig.getBoundingClientRect();
      // Origen: el pin (o el centro del globo si quedó del otro lado).
      const scale = cr.width / size;
      const x0 = cr.left - fr.left + (xy ? xy[0] : size / 2) * scale;
      const y0 = cr.top - fr.top + (xy ? xy[1] : size / 2) * scale;
      // Destino: el centro del visor (medidas del arte, ver .br-visor).
      const x1 = rr.left - fr.left + rr.width * 0.4694;
      const y1 = rr.top - fr.top + rr.height * 0.3563;
      const s0 = (pinRadius() * 2 * scale) / 36; // la bandera mide 36px de alto
      const el = document.createElement("img");
      el.src = p.img.src;
      el.alt = "";
      // Estilo en línea y no en globals.css: la bandera la crea este efecto y
      // así no depende de que la hoja global esté cargada.
      el.style.cssText =
        "position:absolute;top:0;left:0;width:54px;height:36px;object-fit:cover;" +
        "border:2px solid var(--deep);border-radius:5px;box-shadow:3px 3px 0 var(--deep);will-change:transform,opacity";
      flight!.appendChild(el);
      // Arco: sube un poco antes de caer en el visor.
      const mx = (x0 + x1) / 2 + (i % 2 ? 18 : -18);
      const my = Math.min(y0, y1) - 40;
      const anim = el.animate(
        [
          { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(${s0}) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${mx}px, ${my}px) translate(-50%, -50%) scale(${s0 * 1.25}) rotate(${i % 2 ? 12 : -12}deg)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.5) rotate(0deg)`, opacity: 1, offset: 0.92 },
          { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%) scale(0.4) rotate(0deg)`, opacity: 0 },
        ],
        { duration: FLY_MS, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" },
      );
      return { el, anim };
    }

    // --- línea de tiempo ---
    let raf = 0;
    let t0 = 0;
    let started = false;
    let alive = true;
    let pinsFired = 0;
    let visorOn = false;
    let goOn = false;
    const flights: ({ el: HTMLImageElement; anim: Animation } | null)[] = [];
    const visorAt = () => FLY + Math.max(0, pins.length - 1) * FLY_GAP + FLY_MS * 0.9;

    function frame(now: number) {
      if (!alive) return;
      const scrubT = scrubRef.current;
      const live = scrubT == null;
      const t = !live ? scrubT : started ? now - t0 : 0;
      draw(t, now);
      if (started || !live) {
        // Pines: en vivo suenan al clavarse.
        while (live && pinsFired < pins.length && t >= PIN_0 + pinsFired * PIN_GAP) {
          pinsFired++;
          sfxTick();
        }
        // Vuelos. Congelados, cada uno se pone en su instante (y se deshace
        // si la barra vuelve antes de que despegara).
        pins.forEach((_, i) => {
          const at = FLY + i * FLY_GAP;
          if (t >= at && !flights[i]) flights[i] = launch(i, at);
          if (t < at && flights[i]) {
            flights[i]!.el.remove();
            flights[i] = null;
            flown.delete(i);
          }
          const f = flights[i];
          if (f && !live) {
            f.anim.pause();
            f.anim.currentTime = Math.min(FLY_MS, t - at);
          }
        });
        const vOn = t >= visorAt();
        if (vOn !== visorOn) {
          visorOn = vOn;
          setVisor(vOn ? (pins.length ? pins.map((p) => p.code) : ["CO", "NG", "KE", "IN", "BR", "GH"]) : null);
          if (vOn && live) sfxHint();
        }
        const gOn = t >= GO;
        if (gOn !== goOn) {
          goOn = gOn;
          setShowGo(gOn);
          setMood(gOn ? "acierto" : "idle");
          if (gOn && live) sfxGood();
        }
        if (live && t >= END) return finish();
      }
      raf = requestAnimationFrame(frame);
    }

    function begin() {
      if (started || !alive) return;
      started = true;
      t0 = performance.now();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let reducedTimer: ReturnType<typeof setTimeout> | undefined;
    if (reduced) {
      // Sin viaje: el final quieto y se cierra sola.
      void loadAtlas().then((map) => {
        if (!alive) return;
        features = Array.from(map.values());
        draw(0, 0);
      }).catch(() => draw(0, 0));
      draw(0, 0);
      reducedTimer = setTimeout(() => {
        setVisor(["CO", "NG", "KE", "IN", "BR", "GH"]);
        setShowGo(true);
      }, 0);
      const close = setTimeout(finish, 1400);
      return () => {
        alive = false;
        clearTimeout(reducedTimer);
        clearTimeout(close);
        ro.disconnect();
      };
    }

    raf = requestAnimationFrame(frame);
    const fallback = setTimeout(begin, ATLAS_WAIT);
    void loadAtlas()
      .then((map) => {
        if (!alive) return;
        features = Array.from(map.values());
        pins = pickPins(map, view);
        begin();
      })
      .catch(() => begin());

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      ro.disconnect();
    };
    // La escena se monta una vez: sus props no cambian en vida.
  }, []);

  return (
    <div
      role="dialog"
      aria-label={title}
      onClick={finish}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2 px-6 overflow-hidden"
      style={{ background: "var(--body-grad)" }}
    >
      <p className="intro-fade font-display text-xs font-bold uppercase tracking-[0.22em] text-lavender">🚩 {title}</p>

      <div className="relative w-[min(70vw,300px)]">
        <div
          ref={wrapRef}
          className="intro-globe aspect-square w-full overflow-hidden rounded-full border-4 border-deep bg-[#5b21b6]"
          style={{ boxShadow: "7px 7px 0 var(--deep)" }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
        </div>
        {showGo && (
          <span className="intro-go pointer-events-none absolute inset-0 z-10 flex items-center justify-center font-display text-7xl font-black text-gold [text-shadow:4px_4px_0_var(--deep)]">
            {go}
          </span>
        )}
      </div>

      {/* Bordy recibe las banderas en el visor. */}
      <div ref={bordyRef} className="intro-fade w-[150px] -mt-1" style={{ animationDelay: "250ms" }}>
        <Bordy mood={mood} float banderas={visor ?? undefined} imgClassName="drop-shadow-xl" alt="" />
      </div>

      <p className="intro-fade text-[11px] text-neutral-400" style={{ animationDelay: "600ms" }}>{skip}</p>

      {/* Capa del vuelo: por encima de todo y sin capturar toques. */}
      <div ref={flightRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
    </div>
  );
}
