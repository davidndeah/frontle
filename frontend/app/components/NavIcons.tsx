// ============================================================
//  NavIcons — set propio de iconos del bottom-nav (TAB-4).
//  Los emojis del sistema (🌍🏆👤❓) se ven distintos en cada
//  dispositivo; estos SVG inline dan el mismo peso visual en
//  Android/iOS y heredan el color del tab (currentColor), así que
//  los estados activo/inactivo salen gratis del texto del botón.
//  Trazos a mano, 24×24, stroke 2, puntas redondeadas.
// ============================================================

const SVG_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// 🌍 Inicio — globo con ecuador y meridiano (el grafo de fronteras es el juego)
function GlobeIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <ellipse cx="12" cy="12" rx="4.2" ry="9" />
    </svg>
  );
}

// 🏆 Ranking — copa con asas, tallo y base
function TrophyIcon() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3z" />
      <path d="M7 4H4v1.5A3.5 3.5 0 0 0 7.5 9" />
      <path d="M17 4h3v1.5A3.5 3.5 0 0 1 16.5 9" />
      <path d="M12 14v4" />
      <path d="M8 21h8" />
      <path d="M12 18c-2 0-3 1.2-3 3" />
      <path d="M12 18c2 0 3 1.2 3 3" />
    </svg>
  );
}

// 👤 Perfil — cabeza y hombros
function UserIcon() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5" />
    </svg>
  );
}

// 🎮 Modos — rejilla de cuatro fichas (los modos son una rejilla de fichas)
function ModesIcon() {
  return (
    <svg {...SVG_PROPS}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </svg>
  );
}

export type NavIconName = "jugar" | "modos" | "ranking" | "perfil";

const ICONS: Record<NavIconName, () => React.JSX.Element> = {
  jugar: GlobeIcon,
  ranking: TrophyIcon,
  perfil: UserIcon,
  modos: ModesIcon,
};

export default function NavIcon({ name }: { name: NavIconName }) {
  const Icon = ICONS[name];
  return <Icon />;
}
