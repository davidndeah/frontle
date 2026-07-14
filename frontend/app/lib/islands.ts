// ============================================================
//  Frontle — Países SIN frontera terrestre (islas y afines).
//  No pertenecen al grafo de fronteras (countries.ts) porque el juego
//  de cadenas no puede usarlos, pero los modos quiz ("Adivina la
//  bandera" / "Adivina el país") sí: la bandera de Japón o Reino Unido
//  no puede faltar en un quiz de banderas.
//  `outline` indica si el atlas 110m trae su silueta (los microestados
//  y archipiélagos pequeños no aparecen a esa resolución → solo se
//  usan en el modo bandera). Verificado por scripts/check-visuals.mjs.
// ============================================================
import { flagToCode } from "./countries";

export type IslandTier = "easy" | "medium" | "hard";

export interface IslandCountry {
  name: string;   // nombre canónico en inglés (igual criterio que countries.ts)
  flag: string;   // emoji; el código ISO se deriva de aquí (flagToCode)
  code: string;
  tier: IslandTier;
  outline: boolean; // true = tiene silueta en world-atlas 110m
}

const RAW: Omit<IslandCountry, "code">[] = [
  // ---- fáciles (muy reconocidos) ----
  { name: "Japan", flag: "🇯🇵", tier: "easy", outline: true },
  { name: "United Kingdom", flag: "🇬🇧", tier: "easy", outline: true },
  { name: "Ireland", flag: "🇮🇪", tier: "easy", outline: true },
  { name: "Cuba", flag: "🇨🇺", tier: "easy", outline: true },
  { name: "Australia", flag: "🇦🇺", tier: "easy", outline: true },
  { name: "New Zealand", flag: "🇳🇿", tier: "easy", outline: true },
  { name: "Iceland", flag: "🇮🇸", tier: "easy", outline: true },
  { name: "Philippines", flag: "🇵🇭", tier: "easy", outline: true },
  { name: "Dominican Republic", flag: "🇩🇴", tier: "easy", outline: true },
  { name: "Jamaica", flag: "🇯🇲", tier: "easy", outline: true },
  { name: "Singapore", flag: "🇸🇬", tier: "easy", outline: false },
  { name: "Malta", flag: "🇲🇹", tier: "easy", outline: false },
  // ---- medios ----
  { name: "Haiti", flag: "🇭🇹", tier: "medium", outline: true },
  { name: "Sri Lanka", flag: "🇱🇰", tier: "medium", outline: true },
  { name: "Madagascar", flag: "🇲🇬", tier: "medium", outline: true },
  { name: "Taiwan", flag: "🇹🇼", tier: "medium", outline: true },
  { name: "Cyprus", flag: "🇨🇾", tier: "medium", outline: true },
  { name: "Bahamas", flag: "🇧🇸", tier: "medium", outline: true },
  { name: "Fiji", flag: "🇫🇯", tier: "medium", outline: true },
  { name: "Maldives", flag: "🇲🇻", tier: "medium", outline: false },
  { name: "Bahrain", flag: "🇧🇭", tier: "medium", outline: false },
  { name: "Trinidad and Tobago", flag: "🇹🇹", tier: "medium", outline: true },
  { name: "Mauritius", flag: "🇲🇺", tier: "medium", outline: false },
  { name: "Cape Verde", flag: "🇨🇻", tier: "medium", outline: false },
  // ---- difíciles ----
  { name: "Comoros", flag: "🇰🇲", tier: "hard", outline: false },
  { name: "Seychelles", flag: "🇸🇨", tier: "hard", outline: false },
  { name: "São Tomé and Príncipe", flag: "🇸🇹", tier: "hard", outline: false },
  { name: "Vanuatu", flag: "🇻🇺", tier: "hard", outline: true },
  { name: "Solomon Islands", flag: "🇸🇧", tier: "hard", outline: true },
  { name: "Samoa", flag: "🇼🇸", tier: "hard", outline: false },
  { name: "Tonga", flag: "🇹🇴", tier: "hard", outline: false },
  { name: "Kiribati", flag: "🇰🇮", tier: "hard", outline: false },
  { name: "Palau", flag: "🇵🇼", tier: "hard", outline: false },
  { name: "Marshall Islands", flag: "🇲🇭", tier: "hard", outline: false },
  { name: "Micronesia", flag: "🇫🇲", tier: "hard", outline: false },
  { name: "Nauru", flag: "🇳🇷", tier: "hard", outline: false },
  { name: "Tuvalu", flag: "🇹🇻", tier: "hard", outline: false },
  { name: "Barbados", flag: "🇧🇧", tier: "hard", outline: false },
  { name: "Saint Lucia", flag: "🇱🇨", tier: "hard", outline: false },
  { name: "Grenada", flag: "🇬🇩", tier: "hard", outline: false },
  { name: "Dominica", flag: "🇩🇲", tier: "hard", outline: false },
  { name: "Antigua and Barbuda", flag: "🇦🇬", tier: "hard", outline: false },
  { name: "Saint Vincent and the Grenadines", flag: "🇻🇨", tier: "hard", outline: false },
  { name: "Saint Kitts and Nevis", flag: "🇰🇳", tier: "hard", outline: false },
];

export const ISLANDS: IslandCountry[] = RAW.map((i) => ({ ...i, code: flagToCode(i.flag) }));

const BY_NAME: Record<string, IslandCountry> = Object.fromEntries(ISLANDS.map((i) => [i.name, i]));

export function getIsland(name: string): IslandCountry | undefined {
  return BY_NAME[name];
}

export const ISLAND_NAMES: string[] = ISLANDS.map((i) => i.name);
