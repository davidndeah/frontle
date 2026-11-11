"use client";

import { useEffect, useRef, useState } from "react";
import { geoArea, geoCentroid, geoDistance, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";

// ============================================================
//  Frontle — el globo del héroe de la landing
//
//  Es el juego en miniatura: el globo viaja a un reto, marca salida (cian) y
//  llegada (fucsia) desde el principio —como en la partida— y los países de
//  en medio se van revelando uno a uno, con su tramo de frontera, hasta que
//  la cadena se toca. Luego pasa al siguiente reto.
//
//  · Las rutas NO están escritas a mano: las calcula el servidor con
//    `shortestPath`, así que lo que se enseña es siempre una solución óptima
//    de verdad, no una ilustración.
//  · Canvas y no SVG: 170 países re-proyectados a 60 fps en SVG obligan al
//    navegador a recalcular el DOM entero en cada frame.
//  · El atlas es el mismo de WorldMap (world-atlas 110m de jsdelivr). Mientras
//    llega se pinta la esfera vacía, que ya es un globo y no un hueco.
//  · Se pausa fuera de pantalla y con la pestaña oculta; con
//    `prefers-reduced-motion` no gira ni avanza solo: enseña la ruta entera.
// ============================================================

const ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Nombres de Natural Earth que no coinciden con el nombre canónico del grafo.
const NE_ALIAS: Record<string, string> = {
  "United States of America": "United States",
};

export interface GlobeStop {
  canonical: string;
  label: string;
}
export interface GlobeRoute {
  stops: GlobeStop[];
  note: string;
}

interface Props {
  routes: GlobeRoute[];
  roleStart: string;
  roleEnd: string;
  noteBefore: string;
  noteAfter: string;
  ariaLabel: string;
}

// Mismos colores semánticos que el juego (lib/theme.ts): origen cian,
// destino fucsia. Los intermedios en oro, el acento de marca.
const C = {
  ocean: "#5b21b6",
  land: "#c9b6f5",
  border: "rgba(13, 4, 32, .55)",
  deep: "#0d0420",
  start: "#22d3ee",
  end: "#e879f9",
  mid: "#fcff52",
};

// Tiempos del ciclo de un reto, en ms.
const TRAVEL = 1400; // el globo gira hasta el reto
const LEG = 700; // cada tramo de frontera
const HOLD = 2800; // cadena completa, quieta para leerla
const DRIFT = 0.004; // grados por ms de giro lento mientras espera

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// Rebote corto para el "pop" de los pines.
const easeBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

type Rot = [number, number];

// Centroide del polígono más grande: Francia lleva la Guayana dentro de su
// MultiPolygon y EE. UU. lleva Alaska; el centroide del conjunto caería en
// mitad del Atlántico o de Canadá.
function mainCentroid(f: Feature<Geometry>): [number, number] {
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

function routeDuration(n: number) {
  return TRAVEL + (n - 1) * LEG + HOLD;
}

// Cuántas paradas se ven a los `t` ms del reto. Salida y llegada, siempre.
function revealedAt(t: number, n: number) {
  if (t < TRAVEL) return 0;
  return Math.min(n - 2, Math.floor((t - TRAVEL) / LEG));
}

export default function Globe({ routes, roleStart, roleEnd, noteBefore, noteAfter, ariaLabel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [routeIdx, setRouteIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  // Pedido de salto desde los puntos de abajo; lo consume el bucle.
  const jumpRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const font = getComputedStyle(wrap).fontFamily || "system-ui, sans-serif";

    let countries: Feature<Geometry, { name: string }>[] = [];
    const byName = new Map<string, Feature<Geometry, { name: string }>>();
    const centers = new Map<string, [number, number]>();

    let size = 0;
    let dpr = 1;
    const projection = geoOrthographic().clipAngle(90).precision(0.6);
    const path = geoPath(projection, ctx);

    // --- estado del bucle (mutable, fuera de React: 60 fps sin renders) ---
    let idx = 0;
    let elapsed = reduced ? Infinity : 0;
    let travelling = !reduced;
    let rot: Rot = [10, -25];
    let from: Rot = rot;
    let to: Rot = rot;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let shownIdx = -1;
    let shownRev = -1;

    const point = (canonical: string) => centers.get(canonical) ?? null;

    function targetFor(i: number): Rot {
      const pts = routes[i].stops.map((s) => point(s.canonical)).filter(Boolean) as [number, number][];
      if (!pts.length) return rot;
      const [lon, lat] = geoCentroid({ type: "MultiPoint", coordinates: pts });
      // Un poco de inclinación hacia el ecuador: se ve el reto y algo de globo.
      return [-lon, -lat * 0.85];
    }

    function startRoute(i: number) {
      idx = i;
      from = [rot[0], rot[1]];
      to = targetFor(i);
      // Giro por el camino corto: de 170° a -170° son 20°, no 340°.
      let d = to[0] - from[0];
      d = ((((d + 180) % 360) + 360) % 360) - 180;
      to = [from[0] + d, to[1]];
      if (reduced) {
        rot = to;
        elapsed = Infinity;
        travelling = false;
      } else {
        elapsed = 0;
        travelling = true;
      }
    }

    function resize() {
      const w = wrap!.clientWidth;
      if (!w) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = w;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(w * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${w}px`;
    }

    function syncReact() {
      const n = routes[idx].stops.length;
      const rev = revealedAt(elapsed, n);
      if (idx !== shownIdx) {
        shownIdx = idx;
        setRouteIdx(idx);
      }
      if (rev !== shownRev) {
        shownRev = rev;
        setRevealed(rev);
      }
    }

    function draw() {
      if (!size) return;
      const shadow = Math.max(6, size * 0.022);
      const r = size / 2 - shadow - 4;
      const cx = size / 2 - shadow / 2;
      const cy = size / 2 - shadow / 2;
      projection.scale(r).translate([cx, cy]).rotate([rot[0], rot[1], 0]);

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, size, size);

      // 1. Sombra dura desplazada: el globo es una pieza neobrutalista más.
      ctx!.beginPath();
      ctx!.arc(cx + shadow, cy + shadow, r, 0, Math.PI * 2);
      ctx!.fillStyle = C.deep;
      ctx!.fill();

      // 2. Océano.
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = C.ocean;
      ctx!.fill();

      const route = routes[idx];
      const n = route.stops.length;
      const startName = route.stops[0].canonical;
      const endName = route.stops[n - 1].canonical;
      const rev = revealedAt(elapsed, n);

      // 3. Tierra, con los países del reto pintados en su color.
      if (countries.length) {
        const colorOf = new Map<string, string>();
        colorOf.set(startName, C.start);
        colorOf.set(endName, C.end);
        for (let i = 1; i <= rev; i++) colorOf.set(route.stops[i].canonical, C.mid);

        ctx!.beginPath();
        for (const f of countries) if (!colorOf.has(f.properties.name)) path(f);
        ctx!.fillStyle = C.land;
        ctx!.fill();
        for (const [name, color] of colorOf) {
          const f = byName.get(name);
          if (!f) continue;
          ctx!.beginPath();
          path(f);
          ctx!.fillStyle = color;
          ctx!.fill();
        }
        ctx!.beginPath();
        for (const f of countries) path(f);
        ctx!.strokeStyle = C.border;
        ctx!.lineWidth = 0.6;
        ctx!.stroke();
      }

      // 4. Brillo: volumen sin perder lo plano.
      const g = ctx!.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.05, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,.22)");
      g.addColorStop(0.45, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(13,4,32,.28)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = g;
      ctx!.fill();

      // 5. Contorno grueso.
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.strokeStyle = C.deep;
      ctx!.lineWidth = Math.max(2.5, size * 0.008);
      ctx!.stroke();

      if (!countries.length) return;

      // 6. Tramos de frontera: se dibujan en orden, como cuando aciertas.
      const pts = route.stops.map((s) => point(s.canonical));
      for (let i = 0; i < n - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (!a || !b) continue;
        const p = Math.max(0, Math.min(1, (elapsed - TRAVEL - i * LEG) / LEG));
        if (p <= 0) continue;
        const interp = geoInterpolate(a, b);
        const coords: [number, number][] = [];
        const steps = 24;
        for (let k = 0; k <= steps; k++) coords.push(interp((k / steps) * easeInOut(p)));
        const line = { type: "LineString" as const, coordinates: coords };
        ctx!.lineCap = "round";
        ctx!.beginPath();
        path(line);
        ctx!.strokeStyle = C.deep;
        ctx!.lineWidth = 7;
        ctx!.stroke();
        ctx!.beginPath();
        path(line);
        ctx!.strokeStyle = C.mid;
        ctx!.lineWidth = 3.2;
        ctx!.stroke();
      }

      // 7. Pines + etiquetas. Solo los de la cara visible.
      const center: [number, number] = [-rot[0], -rot[1]];
      ctx!.font = `700 ${Math.round(Math.max(10, size * 0.026))}px ${font}`;
      ctx!.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        const c = pts[i];
        if (!c) continue;
        const isStart = i === 0;
        const isEnd = i === n - 1;
        // Salida y llegada aparecen al llegar el globo; los demás, al acertarlos.
        const appearAt = isStart || isEnd ? TRAVEL * 0.55 : TRAVEL + i * LEG;
        const tp = (elapsed - appearAt) / 320;
        if (tp <= 0) continue;
        if (geoDistance(c, center) > Math.PI / 2 - 0.05) continue;
        const xy = projection(c);
        if (!xy) continue;
        const s = easeBack(Math.min(1, tp));
        const color = isStart ? C.start : isEnd ? C.end : C.mid;
        const pr = Math.max(5, size * 0.016) * s;

        // Onda que late en salida y llegada.
        if ((isStart || isEnd) && !reduced) {
          const ph = ((performance.now() / 1400) + (isEnd ? 0.5 : 0)) % 1;
          ctx!.beginPath();
          ctx!.arc(xy[0], xy[1], pr + ph * pr * 2.4, 0, Math.PI * 2);
          ctx!.strokeStyle = color;
          ctx!.globalAlpha = 1 - ph;
          ctx!.lineWidth = 2;
          ctx!.stroke();
          ctx!.globalAlpha = 1;
        }

        ctx!.beginPath();
        ctx!.arc(xy[0] + 2, xy[1] + 2, pr, 0, Math.PI * 2);
        ctx!.fillStyle = C.deep;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(xy[0], xy[1], pr, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();
        ctx!.lineWidth = 2.2;
        ctx!.strokeStyle = C.deep;
        ctx!.stroke();

        // Etiqueta tipo pegatina; alterna arriba/abajo para que dos países
        // vecinos (Portugal y España) no se pisen.
        if (s > 0.6) {
          const label = route.stops[i].label.toUpperCase();
          const padX = 6;
          const h = Math.max(18, size * 0.042);
          const w = ctx!.measureText(label).width + padX * 2;
          const above = i % 2 === 0;
          const lx = Math.min(Math.max(xy[0] - w / 2, 4), size - w - 8);
          const ly = above ? xy[1] - pr - h - 6 : xy[1] + pr + 6;
          ctx!.globalAlpha = Math.min(1, (s - 0.6) / 0.4);
          ctx!.fillStyle = C.deep;
          ctx!.fillRect(lx + 3, ly + 3, w, h);
          ctx!.fillStyle = color;
          ctx!.fillRect(lx, ly, w, h);
          ctx!.lineWidth = 2;
          ctx!.strokeStyle = C.deep;
          ctx!.strokeRect(lx, ly, w, h);
          ctx!.fillStyle = C.deep;
          ctx!.fillText(label, lx + padX, ly + h / 2 + 1);
          ctx!.globalAlpha = 1;
        }
      }
    }

    function frame(now: number) {
      const dt = Math.min(50, now - last);
      last = now;

      if (jumpRef.current !== null) {
        startRoute(jumpRef.current);
        jumpRef.current = null;
      }

      if (!reduced && countries.length) {
        elapsed += dt;
        if (!dragging) {
          if (travelling && elapsed < TRAVEL) {
            const e = easeInOut(elapsed / TRAVEL);
            rot = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
          } else {
            travelling = false;
            rot = [rot[0] + dt * DRIFT, rot[1]];
          }
        }
        if (elapsed > routeDuration(routes[idx].stops.length)) startRoute((idx + 1) % routes.length);
      }

      draw();
      syncReact();
      raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    }

    function kick() {
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    // --- arrastre ---
    function onDown(e: PointerEvent) {
      dragging = true;
      travelling = false;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas!.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!dragging) return;
      const k = 180 / Math.max(1, size);
      rot = [rot[0] + (e.clientX - lastX) * k, Math.max(-70, Math.min(70, rot[1] - (e.clientY - lastY) * k))];
      lastX = e.clientX;
      lastY = e.clientY;
      if (reduced) draw();
    }
    function onUp() {
      dragging = false;
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(wrap);
    resize();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(wrap);
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);

    let alive = true;
    void (async () => {
      try {
        const res = await fetch(ATLAS_URL);
        const topo = await res.json();
        if (!alive) return;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
        countries = fc.features.map((f) => {
          const name = NE_ALIAS[f.properties.name] ?? f.properties.name;
          return { ...f, properties: { name } };
        });
        for (const f of countries) byName.set(f.properties.name, f);
        for (const r of routes)
          for (const s of r.stops) {
            const f = byName.get(s.canonical);
            if (f && !centers.has(s.canonical)) centers.set(s.canonical, mainCentroid(f));
          }
        startRoute(0);
        draw();
        kick();
      } catch {
        // Sin atlas queda la esfera: decorativa, nunca un error en pantalla.
      }
    })();

    kick();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [routes]);

  const route = routes[routeIdx];
  const n = route.stops.length;

  return (
    <div className="globe-block">
      <div className="globe" ref={wrapRef}>
        <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
      </div>

      {/* La tarjeta del reto: lo mismo que el globo, en texto. Los intermedios
          salen como «?» hasta que el globo los revela, igual que en la partida. */}
      <div className="route-card" aria-live="polite">
        <ol className="route-stops">
          {route.stops.map((s, i) => {
            const isStart = i === 0;
            const isEnd = i === n - 1;
            const shown = isStart || isEnd || i <= revealed;
            const cls = isStart ? "is-start" : isEnd ? "is-end" : shown ? "is-mid" : "is-hidden";
            return (
              <li key={`${routeIdx}-${s.canonical}`} className={`route-stop ${cls}`}>
                <span className="route-name">{shown ? s.label : "?"}</span>
                <span className="route-role">{isStart ? roleStart : isEnd ? roleEnd : `+${i}`}</span>
              </li>
            );
          })}
        </ol>
        <div className="route-foot">
          <p className="route-note">
            {noteBefore}
            <b>{route.note}</b>
            {noteAfter}
          </p>
          <div className="route-dots">
            {routes.map((r, i) => (
              <button
                key={r.stops[0].canonical}
                type="button"
                className={i === routeIdx ? "on" : ""}
                aria-label={`${r.stops[0].label} → ${r.stops[r.stops.length - 1].label}`}
                aria-pressed={i === routeIdx}
                onClick={() => {
                  jumpRef.current = i;
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
