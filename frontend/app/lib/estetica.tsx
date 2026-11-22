"use client";

// ============================================================
//  Estética nueva (prueba local, 19-nov)
//
//  Interruptor para comparar en el celular la app de hoy contra la apuesta
//  nueva: iconos 3D con borde neobrutal en vez de emojis, estilo del landing
//  (contorno grueso, sombra dura, auroras) y Bordy v2. Aparte, la tipografía:
//  la del juego (Fredoka + Geist) o la del landing (Archivo + JetBrains Mono).
//
//  Solo existe si se compila con NEXT_PUBLIC_ESTETICA_LAB=1. Sin esa
//  variable todo queda como hoy y no aparece la pastilla: producción no cambia.
//
//  El estado vive en <html data-estetica data-fuente>, fijado antes de pintar
//  (ESTETICA_INIT_SCRIPT), así el CSS cambia sin parpadeo y sin que React
//  tenga que volver a pintar cada pieza.
// ============================================================

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export const ESTETICA_LAB = process.env.NEXT_PUBLIC_ESTETICA_LAB === "1";

type Estetica = "nueva" | "hoy";
type Fuente = "landing" | "juego";
/** Zona destacada de Inicio: los dos héroes uno sobre otro, o en carrusel. */
export type Destacado = "apilado" | "carrusel";
const K_EST = "frontle-estetica";
const K_FUENTE = "frontle-fuente";
const K_DEST = "frontle-destacado";

/** Va en el <head>: pone los atributos antes del primer pintado. */
export const ESTETICA_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var e=localStorage.getItem("${K_EST}")||"nueva";var f=localStorage.getItem("${K_FUENTE}")||"landing";d.dataset.estetica=e;d.dataset.fuente=f;d.dataset.destacado=localStorage.getItem("${K_DEST}")||"apilado";}catch(_){document.documentElement.dataset.estetica="nueva";document.documentElement.dataset.fuente="landing";}})();`;

const Ctx = createContext<{ nueva: boolean; fuente: Fuente; destacado: Destacado }>({ nueva: false, fuente: "juego", destacado: "apilado" });

/** ¿Está activa la estética nueva? Siempre false fuera de la prueba. */
export function useEstetica() {
  return useContext(Ctx);
}

// El estado lo guarda <html> (data-estetica, data-fuente). React se suscribe
// a él: en el servidor y en la hidratación vale "hoy" (lo que se pintó), y
// justo después lee lo que dejó el script del <head>.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const readEst = (): Estetica => (ESTETICA_LAB && document.documentElement.dataset.estetica !== "hoy" ? "nueva" : "hoy");
const readFuente = (): Fuente => (ESTETICA_LAB && document.documentElement.dataset.fuente !== "juego" ? "landing" : "juego");
const readDest = (): Destacado => (ESTETICA_LAB && document.documentElement.dataset.destacado === "carrusel" ? "carrusel" : "apilado");
function write(attr: "estetica" | "fuente" | "destacado", key: string, v: string) {
  document.documentElement.dataset[attr] = v;
  try { localStorage.setItem(key, v); } catch { /* modo privado: solo dura la sesión */ }
  listeners.forEach((fn) => fn());
}

export function EsteticaRoot({ children }: { children: ReactNode }) {
  const est = useSyncExternalStore(subscribe, readEst, () => "hoy" as Estetica);
  const fuente = useSyncExternalStore(subscribe, readFuente, () => "juego" as Fuente);
  const toggleEst = () => write("estetica", K_EST, est === "nueva" ? "hoy" : "nueva");
  const destacado = useSyncExternalStore(subscribe, readDest, () => "apilado" as Destacado);
  const toggleFuente = () => write("fuente", K_FUENTE, fuente === "landing" ? "juego" : "landing");
  const toggleDest = () => write("destacado", K_DEST, destacado === "apilado" ? "carrusel" : "apilado");

  const value = useMemo(() => ({ nueva: ESTETICA_LAB && est === "nueva", fuente, destacado }), [est, fuente, destacado]);

  // La entrada escalonada de las tarjetas (.est-stagger) se ve solo al abrir
  // la app. Cambiar de pestaña pasa decenas de veces al día: repetirla ahí
  // hace sentir lenta la navegación. Al terminar la primera, se apaga.
  useEffect(() => {
    const id = setTimeout(() => { document.documentElement.dataset.entrada = "hecha"; }, 1200);
    return () => clearTimeout(id);
  }, []);

  return (
    <Ctx.Provider value={value}>
      {value.nueva && (
        // Auroras del landing: tres manchas que derivan muy despacio. Solo
        // transform (lo hace la GPU), gradientes y no filter: blur.
        <div className="est-aurora" aria-hidden="true"><span className="a1" /><span className="a2" /><span className="a3" /></div>
      )}
      {children}
      {ESTETICA_LAB && (
        <div className="est-pill" role="group" aria-label="Prueba de estética">
          <button type="button" onClick={toggleEst} aria-pressed={est === "nueva"}>{est === "nueva" ? "Nuevo" : "Hoy"}</button>
          <button type="button" onClick={toggleFuente} aria-pressed={fuente === "landing"}>{fuente === "landing" ? "Archivo" : "Fredoka"}</button>
          <button type="button" onClick={toggleDest} aria-pressed={destacado === "carrusel"}>{destacado === "carrusel" ? "Carrusel" : "Apilado"}</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

// --- Textos sin emojis ------------------------------------------------------
// En la estética nueva los textos traducidos (mensajes, avisos) van sin
// emojis: donde hace falta un icono se pone en el JSX, no dentro del texto.
// Las banderas de país (indicadores regionales) se quedan: son información.
const EMOJI = /(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*️?)\s?/gu;

export function sinEmojis(s: string): string {
  return s.replace(EMOJI, "").replace(/ {2,}/g, " ").trim();
}

const limpios = new WeakMap<object, unknown>();

/** Copia del diccionario con todos sus textos sin emojis (cacheada). */
export function limpiarEmojis<T>(dict: T): T {
  const go = (v: unknown): unknown => {
    if (typeof v === "string") return sinEmojis(v);
    if (typeof v === "function") {
      const f = v as (...a: unknown[]) => unknown;
      return (...a: unknown[]) => go(f(...a));
    }
    if (Array.isArray(v)) return v.map(go);
    if (v && typeof v === "object") {
      if (limpios.has(v)) return limpios.get(v);
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = go(x);
      limpios.set(v, out);
      return out;
    }
    return v;
  };
  return go(dict) as T;
}
