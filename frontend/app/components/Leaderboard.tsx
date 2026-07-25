"use client";

// ============================================================
//  Frontle — Piezas compartidas de las tablas de clasificación
//
//  Las usan la liga semanal y el ranking diario. Viven juntas porque lo
//  delicado es el podio: el nº1 va CENTRADO y elevado, pero eso es orden
//  visual — en el DOM la lista sigue siendo 1, 2, 3 y solo se reordena con
//  `order`, para que un lector de pantalla la lea por puesto y no de
//  izquierda a derecha. Duplicar eso en dos sitios era pedir que uno de los
//  dos se quedara atrás.
//
//  Lenguaje visual: el neo-brutalismo que la app ya usa en botones y niveles
//  (borde grueso, sombra dura desplazada, esquinas poco redondeadas, bloques
//  de acento macizos). Ver `.brutal-sm` en globals.css.
// ============================================================

import type { ReactNode } from "react";

// --- Avatar -----------------------------------------------------------------
// No hay fotos de perfil: la identidad es una wallet. Se genera un avatar con
// la inicial sobre un color estable por jugador — la misma wallet saca siempre
// el mismo color, así la tabla se vuelve reconocible de un vistazo.
// La paleta es la del ícono de la app (public/icon.svg), como el GlobeLoader.
const AVATAR_COLORS = ["#c084fc", "#a855f7", "#22d3ee", "#e879f9", "#fbbf24"];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function PlayerAvatar({ id, label, size }: { id: string; label: string; size: number }) {
  // `[...label]` y no `label[0]`: un nombre que empiece por emoji o por una
  // letra fuera del plano básico se partiría a la mitad con índice directo.
  const ch = ([...label.trim()][0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="brutal-sm grid flex-none place-items-center rounded-full font-display font-black text-surface"
      style={{ width: size, height: size, background: avatarColor(id), fontSize: Math.round(size * 0.44) }}
    >
      {ch}
    </span>
  );
}

// --- Modelo -----------------------------------------------------------------

export interface LeaderEntry {
  /** Identidad (wallet). Solo se usa para el color del avatar y como key. */
  id: string;
  /** Nombre ya resuelto y listo para pintar, incluido el "(Tú)" si aplica. */
  label: string;
  mine: boolean;
  /** Métrica principal, a la derecha. */
  stat: ReactNode;
  /** Métrica secundaria, bajo la principal. */
  sub?: ReactNode;
  /** Adorno antes del nombre (p. ej. la bandera del país). */
  badge?: ReactNode;
}

// Rejilla común de cabecera y filas: sin ella los textos de la cabecera no
// caerían sobre sus columnas.
export const RANK_GRID = "grid grid-cols-[1.75rem_1fr_auto] items-center gap-2";

// Reordenado visual del podio (2 · 1 · 3) sin tocar el orden del DOM.
const PODIUM_ORDER = ["order-2", "order-1", "order-3"];

// Literales completos: Tailwind escanea el texto del fuente, así que una clase
// construida con plantilla (`grid-cols-${n}`) no se generaría.
const PODIUM_COLS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

// --- Podio ------------------------------------------------------------------

export function Podium({ items }: { items: LeaderEntry[] }) {
  if (items.length === 0) return null;
  const full = items.length === 3;
  return (
    <ol className={`mt-1 grid items-end justify-items-center gap-2 ${PODIUM_COLS[items.length]}`}>
      {items.map((e, i) => {
        const first = i === 0;
        return (
          // Con menos de 3 jugadores no hay podio que escalonar: se centran.
          // El borde va SIEMPRE, transparente si no es la fila propia: si solo
          // lo llevara el jugador, su columna mediría 4px más que las otras y
          // el podio quedaría descuadrado.
          <li
            key={e.id}
            className={`flex w-full flex-col items-center rounded-xl border-2 py-1 ${
              e.mine ? "border-gold bg-gold/10" : "border-transparent"
            } ${full ? PODIUM_ORDER[i] : ""}`}
          >
            {/* La corona sustituye al "más alto": en móvil no hay sitio para
                pedestales de verdad sin robárselo a los nombres. `invisible`
                y no ausente, para que los tres avatares queden alineados. */}
            <span className={`text-xl leading-none ${first ? "" : "invisible"}`} aria-hidden>
              👑
            </span>
            <PlayerAvatar id={e.id} label={e.label} size={first ? 58 : 46} />
            <span
              className={`-mt-2.5 grid h-6 w-6 place-items-center rounded-full border-2 border-deep font-display text-[11px] font-black text-surface ${
                first ? "bg-gold" : "bg-lavender"
              }`}
            >
              {i + 1}
            </span>
            <span className="mt-1 flex w-full items-center justify-center gap-1">
              {e.badge}
              <span
                className={`truncate text-center text-xs font-bold ${e.mine ? "text-gold" : "text-white"}`}
                title={e.label}
              >
                {e.label}
              </span>
            </span>
            <span className="font-mono text-[11px] tabular-nums text-neutral-300">{e.stat}</span>
            {e.sub && <span className="font-mono text-[10px] tabular-nums text-neutral-400">{e.sub}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// --- Fila (del 4.º en adelante) ---------------------------------------------
// Devuelve un <li>: el llamador la envuelve en su propio <ol>.

export function RankRow({ pos, entry }: { pos: number; entry: LeaderEntry }) {
  const { mine } = entry;
  return (
    <li
      className={`brutal-sm ${RANK_GRID} rounded-lg px-2 py-2 ${
        // La fila propia va en bloque dorado SÓLIDO, no un tinte: en el
        // sistema de referencia el acento es macizo, y así se encuentra sin
        // buscarla.
        mine ? "bg-gold text-surface" : "bg-surface text-neutral-100"
      }`}
    >
      <span className={`text-center font-display text-sm font-black ${mine ? "text-surface" : "text-lavender"}`}>
        {pos}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <PlayerAvatar id={entry.id} label={entry.label} size={26} />
        {entry.badge}
        <span className="truncate text-sm font-semibold" title={entry.label}>
          {entry.label}
        </span>
      </span>
      <span className="flex flex-col items-end leading-tight">
        <span className={`font-mono text-sm font-bold tabular-nums ${mine ? "text-surface" : "text-white"}`}>
          {entry.stat}
        </span>
        {entry.sub && (
          <span className={`font-mono text-[10px] tabular-nums ${mine ? "text-surface/70" : "text-neutral-400"}`}>
            {entry.sub}
          </span>
        )}
      </span>
    </li>
  );
}
