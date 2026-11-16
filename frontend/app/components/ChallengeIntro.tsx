"use client";

import { useEffect, useRef, useState } from "react";
import { geoArea, geoCentroid, geoDistance, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import type { Polygon } from "geojson";
import { loadAtlas, type AtlasFeature } from "../lib/atlas";
import { STATUS_COLORS } from "../lib/theme";
import { sfxGood, sfxHint } from "../lib/sfx";

// ============================================================
//  ChallengeIntro — la entrada al reto diario.
//
//  Al abrirse la partida el globo llega girando, hace zoom sobre el reto y
//  clava los dos países con su bandera; debajo entran las dos fichas grandes
//  (salida y llegada) y un «¡YA!» cierra la escena. Es el mismo globo de la
//  landing (app/inicio/Globe.tsx) reducido a un solo viaje.
//
//  · Sale DESPUÉS de que el servidor revela el reto: antes no se sabe qué
//    países son. El reloj ya corre, así que dura poco (~2,7 s) y un toque en
//    cualquier parte la salta.
//  · Canvas y no SVG, por lo mismo que en la landing: re-proyectar el mundo
//    a 60 fps en SVG recalcula el DOM entero en cada frame.
//  · El atlas es el compartido (lib/atlas.ts). Si no llega, la escena sigue:
//    las fichas con las banderas no dependen de él.
//  · Con `prefers-reduced-motion` no hay viaje: se enseña el final.
// ============================================================

const C = {
  ocean: "#5b21b6",
  land: "#c9b6f5",
  border: "rgba(13, 4, 32, .55)",
  deep: "#0d0420",
  route: "#fcff52",
};

// Tiempos de la escena, en ms desde que arranca.
const TRAVEL = 1300; // el globo llega y hace zoom
const PIN_A = 850; // cae el pin de salida
const PIN_B = 1150; // cae el de llegada
const ARC = 1350; // empieza el arco entre los dos
const ARC_MS = 500;
const GO = 1900; // «¡YA!»
const END = 2700; // se cierra sola
const ATLAS_WAIT = 700; // si el atlas tarda más, la escena arranca sin él

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// Centroide del polígono más grande (Francia lleva la Guayana en su
// MultiPolygon; el centroide del conjunto caería en el Atlántico).
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

interface Props {
  /** Nombres canónicos (los del grafo) de salida y llegada. */
  start: string;
  end: string;
  /** ISO alpha-2 de cada uno, para la bandera. */
  startCode: string;
  endCode: string;
  /** Nombres ya localizados. */
  startLabel: string;
  endLabel: string;
  roleStart: string;
  roleEnd: string;
  title: string;
  /** Línea bajo las fichas (la ruta óptima). */
  sub: string;
  go: string;
  skip: string;
  onDone: () => void;
}

export default function ChallengeIntro({
  start, end, startCode, endCode, startLabel, endLabel, roleStart, roleEnd, title, sub, go, skip, onDone,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGo, setShowGo] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const projection = geoOrthographic().clipAngle(90).precision(0.6);
    const path = geoPath(projection, ctx);

    let features: AtlasFeature[] = [];
    let fStart: AtlasFeature | null = null;
    let fEnd: AtlasFeature | null = null;
    let a: [number, number] | null = null;
    let b: [number, number] | null = null;
    // Destino del viaje: centrado entre los dos países, con el zoom justo
    // para que ambos queden dentro y bien separados.
    let toRot: [number, number] = [10, -20];
    let toZoom = 1;

    // Banderas para los pines (SVG de flagcdn, igual que el resto del juego).
    const flag = (code: string) => {
      const img = new Image();
      img.src = `https://flagcdn.com/${code.toLowerCase()}.svg`;
      return img;
    };
    const imgA = startCode ? flag(startCode) : null;
    const imgB = endCode ? flag(endCode) : null;

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

    function pin(xy: [number, number], color: string, img: HTMLImageElement | null, s: number, phase: number) {
      const r = Math.max(15, size * 0.075) * s;
      // Onda que late alrededor del pin.
      if (!reduced && s >= 1) {
        ctx!.beginPath();
        ctx!.arc(xy[0], xy[1], r + phase * r * 1.6, 0, Math.PI * 2);
        ctx!.strokeStyle = color;
        ctx!.globalAlpha = 1 - phase;
        ctx!.lineWidth = 3;
        ctx!.stroke();
        ctx!.globalAlpha = 1;
      }
      // Sombra dura.
      ctx!.beginPath();
      ctx!.arc(xy[0] + 3, xy[1] + 3, r, 0, Math.PI * 2);
      ctx!.fillStyle = C.deep;
      ctx!.fill();
      // Bandera recortada en círculo (o el color del rol si aún no cargó).
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      ctx!.clip();
      ctx!.fillStyle = color;
      ctx!.fillRect(xy[0] - r, xy[1] - r, r * 2, r * 2);
      if (img && img.complete && img.naturalWidth > 0) {
        const h = r * 2;
        const w = Math.max(h, (h * img.naturalWidth) / img.naturalHeight);
        ctx!.drawImage(img, xy[0] - w / 2, xy[1] - h / 2, w, h);
      }
      ctx!.restore();
      // Aro del color del rol + contorno.
      ctx!.beginPath();
      ctx!.arc(xy[0], xy[1], r, 0, Math.PI * 2);
      ctx!.lineWidth = Math.max(3, r * 0.2);
      ctx!.strokeStyle = color;
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
      // Llega desde lejos y dando media vuelta: de ahí la sensación de viaje.
      const rot: [number, number] = [toRot[0] + (1 - e) * 150, toRot[1] + (1 - e) * 22];
      const zoom = 0.5 + (toZoom - 0.5) * e;
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
        for (const f of features) if (f !== fStart && f !== fEnd) path(f);
        ctx!.fillStyle = C.land;
        ctx!.fill();
        for (const [f, color] of [[fStart, STATUS_COLORS.start], [fEnd, STATUS_COLORS.end]] as const) {
          if (!f) continue;
          ctx!.beginPath();
          path(f);
          ctx!.fillStyle = color;
          ctx!.fill();
        }
        ctx!.beginPath();
        for (const f of features) path(f);
        ctx!.strokeStyle = C.border;
        ctx!.lineWidth = 0.6;
        ctx!.stroke();
      }

      // Brillo: volumen sin perder lo plano.
      const g = ctx!.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.05, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,.22)");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(13,4,32,.28)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = g;
      ctx!.fill();

      if (!a || !b) return;

      // Arco punteado entre los dos: el camino que falta por descubrir.
      const p = reduced ? 1 : Math.max(0, Math.min(1, (t - ARC) / ARC_MS));
      if (p > 0) {
        const interp = geoInterpolate(a, b);
        const coords: [number, number][] = [];
        for (let k = 0; k <= 32; k++) coords.push(interp((k / 32) * easeOut(p)));
        const line = { type: "LineString" as const, coordinates: coords };
        ctx!.lineCap = "round";
        ctx!.setLineDash([2, 9]);
        ctx!.beginPath();
        path(line);
        ctx!.strokeStyle = C.deep;
        ctx!.lineWidth = 7;
        ctx!.stroke();
        ctx!.beginPath();
        path(line);
        ctx!.strokeStyle = C.route;
        ctx!.lineWidth = 3.5;
        ctx!.stroke();
        ctx!.setLineDash([]);
      }

      // Pines con bandera. Solo en la cara visible del globo.
      const center: [number, number] = [-rot[0], -rot[1]];
      const phase = (now / 1300) % 1;
      for (const [c, at, color, img, off] of [
        [a, PIN_A, STATUS_COLORS.start, imgA, 0],
        [b, PIN_B, STATUS_COLORS.end, imgB, 0.5],
      ] as const) {
        const tp = reduced ? 1 : (t - at) / 340;
        if (tp <= 0) continue;
        if (geoDistance(c, center) > Math.PI / 2 - 0.05) continue;
        const xy = projection(c);
        if (!xy) continue;
        pin(xy, color, img, easeBack(Math.min(1, tp)), (phase + off) % 1);
      }
    }

    // --- línea de tiempo ---
    let raf = 0;
    let t0 = 0;
    let started = false;
    let alive = true;
    let firedA = false;
    let firedB = false;
    let firedGo = false;

    function frame(now: number) {
      if (!alive) return;
      const t = started ? now - t0 : 0;
      draw(t, now);
      if (started) {
        if (!firedA && t >= PIN_A) { firedA = true; sfxHint(); }
        if (!firedB && t >= PIN_B) { firedB = true; sfxHint(); }
        if (!firedGo && t >= GO) { firedGo = true; setShowGo(true); sfxGood(); }
        if (t >= END) return finish();
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
    raf = requestAnimationFrame(frame);
    const fallback = setTimeout(begin, ATLAS_WAIT);

    void loadAtlas()
      .then((map) => {
        if (!alive) return;
        features = Array.from(map.values());
        fStart = map.get(start) ?? null;
        fEnd = map.get(end) ?? null;
        a = fStart ? mainCentroid(fStart) : null;
        b = fEnd ? mainCentroid(fEnd) : null;
        const pts = [a, b].filter(Boolean) as [number, number][];
        if (pts.length === 2) {
          const mid = geoInterpolate(pts[0], pts[1])(0.5);
          toRot = [-mid[0], -mid[1]];
          // Cada país queda a d/2 del centro y se proyecta a r·sin(d/2).
          const half = geoDistance(pts[0], pts[1]) / 2;
          toZoom = Math.max(1, Math.min(2.6, 0.6 / Math.max(0.05, Math.sin(half))));
        } else if (pts.length === 1) {
          toRot = [-pts[0][0], -pts[0][1]];
          toZoom = 1.6;
        }
        begin();
      })
      .catch(() => begin());

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      ro.disconnect();
    };
    // La escena se monta una vez por partida: sus props no cambian en vida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-label={`${title}: ${startLabel} → ${endLabel}`}
      onClick={finish}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-4 px-6"
      style={{ background: "var(--body-grad)" }}
    >
      <p className="intro-fade font-display text-xs font-bold uppercase tracking-[0.22em] text-lavender">{title}</p>

      {/* El globo vive en una mirilla redonda: al hacer zoom se sale del
          lienzo y el recorte lo convierte en lente, no en un corte brusco. */}
      <div className="relative w-[min(74vw,320px)]">
        <div
          ref={wrapRef}
          className="intro-globe aspect-square w-full overflow-hidden rounded-full border-4 border-deep bg-[#5b21b6]"
          style={{ boxShadow: "7px 7px 0 var(--deep)" }}
        >
          <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
        </div>
        {showGo && (
          <span className="intro-go pointer-events-none absolute inset-0 flex items-center justify-center font-display text-7xl font-black text-gold [text-shadow:4px_4px_0_var(--deep)]">
            {go}
          </span>
        )}
      </div>

      {/* Las dos fichas: bandera grande, nombre y rol. Entran una por cada
          lado, a la vez que su pin cae en el globo. */}
      <div className="flex w-full max-w-sm items-stretch justify-center gap-2">
        {([
          [startCode, startLabel, roleStart, STATUS_COLORS.start, "intro-from-left", PIN_A],
          [endCode, endLabel, roleEnd, STATUS_COLORS.end, "intro-from-right", PIN_B],
        ] as const).map(([code, label, role, color, anim, delay], i) => (
          <div key={i} className="contents">
            {i === 1 && (
              <span aria-hidden className="intro-fade flex items-center font-display text-2xl font-black text-gold" style={{ animationDelay: `${ARC}ms` }}>
                →
              </span>
            )}
            <div
              className={`${anim} flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 bg-surface px-2 py-3 text-center`}
              style={{ borderColor: color, boxShadow: "4px 4px 0 var(--deep)", animationDelay: `${delay}ms` }}
            >
              {code ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
                  alt=""
                  className="h-[54px] w-[84px] rounded-md border-2 border-deep object-cover"
                />
              ) : (
                <span className="text-5xl">🏳️</span>
              )}
              <span className="w-full break-words font-display text-base font-black leading-tight text-white">{label}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{role}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="intro-fade rounded-full border-2 border-deep bg-gold px-3 py-1 font-display text-xs font-bold text-deep" style={{ animationDelay: `${ARC + 150}ms` }}>
        {sub}
      </p>
      <p className="intro-fade text-[11px] text-neutral-400" style={{ animationDelay: "600ms" }}>{skip}</p>
    </div>
  );
}
