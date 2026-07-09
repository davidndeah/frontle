// ============================================================
//  Frontle — Región: ESTADOS UNIDOS 🇺🇸
//  48 estados contiguos (Alaska y Hawái quedan fuera: sin fronteras
//  terrestres). Sin D.C. (distrito, no estado).
//  Convención Four Corners: AZ–CO y NM–UT se tocan solo en un punto
//  → NO son vecinos (estándar de los juegos del género).
//  Codes = ISO-2 del estado → banderas en flagcdn (us-<code>.svg).
//  Aliases: nombres comunes en español para el input.
// ============================================================

import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Alabama", code: "al", neighbors: ["Florida", "Georgia", "Mississippi", "Tennessee"] },
  { name: "Arizona", code: "az", neighbors: ["California", "Nevada", "New Mexico", "Utah"] },
  { name: "Arkansas", code: "ar", neighbors: ["Louisiana", "Mississippi", "Missouri", "Oklahoma", "Tennessee", "Texas"] },
  { name: "California", code: "ca", neighbors: ["Arizona", "Nevada", "Oregon"] },
  { name: "Colorado", code: "co", neighbors: ["Kansas", "Nebraska", "New Mexico", "Oklahoma", "Utah", "Wyoming"] },
  { name: "Connecticut", code: "ct", neighbors: ["Massachusetts", "New York", "Rhode Island"] },
  { name: "Delaware", code: "de", neighbors: ["Maryland", "New Jersey", "Pennsylvania"] },
  { name: "Florida", code: "fl", neighbors: ["Alabama", "Georgia"] },
  { name: "Georgia", code: "ga", neighbors: ["Alabama", "Florida", "North Carolina", "South Carolina", "Tennessee"] },
  { name: "Idaho", code: "id", neighbors: ["Montana", "Nevada", "Oregon", "Utah", "Washington", "Wyoming"] },
  { name: "Illinois", code: "il", neighbors: ["Indiana", "Iowa", "Kentucky", "Missouri", "Wisconsin"] },
  { name: "Indiana", code: "in", neighbors: ["Illinois", "Kentucky", "Michigan", "Ohio"] },
  { name: "Iowa", code: "ia", neighbors: ["Illinois", "Minnesota", "Missouri", "Nebraska", "South Dakota", "Wisconsin"] },
  { name: "Kansas", code: "ks", neighbors: ["Colorado", "Missouri", "Nebraska", "Oklahoma"] },
  { name: "Kentucky", code: "ky", neighbors: ["Illinois", "Indiana", "Missouri", "Ohio", "Tennessee", "Virginia", "West Virginia"] },
  { name: "Louisiana", code: "la", aliases: ["Luisiana"], neighbors: ["Arkansas", "Mississippi", "Texas"] },
  { name: "Maine", code: "me", neighbors: ["New Hampshire"] },
  { name: "Maryland", code: "md", neighbors: ["Delaware", "Pennsylvania", "Virginia", "West Virginia"] },
  { name: "Massachusetts", code: "ma", neighbors: ["Connecticut", "New Hampshire", "New York", "Rhode Island", "Vermont"] },
  { name: "Michigan", code: "mi", aliases: ["Míchigan"], neighbors: ["Indiana", "Ohio", "Wisconsin"] },
  { name: "Minnesota", code: "mn", neighbors: ["Iowa", "North Dakota", "South Dakota", "Wisconsin"] },
  { name: "Mississippi", code: "ms", aliases: ["Misisipi", "Misisipí"], neighbors: ["Alabama", "Arkansas", "Louisiana", "Tennessee"] },
  { name: "Missouri", code: "mo", aliases: ["Misuri"], neighbors: ["Arkansas", "Illinois", "Iowa", "Kansas", "Kentucky", "Nebraska", "Oklahoma", "Tennessee"] },
  { name: "Montana", code: "mt", neighbors: ["Idaho", "North Dakota", "South Dakota", "Wyoming"] },
  { name: "Nebraska", code: "ne", neighbors: ["Colorado", "Iowa", "Kansas", "Missouri", "South Dakota", "Wyoming"] },
  { name: "Nevada", code: "nv", neighbors: ["Arizona", "California", "Idaho", "Oregon", "Utah"] },
  { name: "New Hampshire", code: "nh", aliases: ["Nuevo Hampshire"], neighbors: ["Maine", "Massachusetts", "Vermont"] },
  { name: "New Jersey", code: "nj", aliases: ["Nueva Jersey"], neighbors: ["Delaware", "New York", "Pennsylvania"] },
  { name: "New Mexico", code: "nm", aliases: ["Nuevo México", "Nuevo Mexico"], neighbors: ["Arizona", "Colorado", "Oklahoma", "Texas"] },
  { name: "New York", code: "ny", aliases: ["Nueva York"], neighbors: ["Connecticut", "Massachusetts", "New Jersey", "Pennsylvania", "Vermont"] },
  { name: "North Carolina", code: "nc", aliases: ["Carolina del Norte"], neighbors: ["Georgia", "South Carolina", "Tennessee", "Virginia"] },
  { name: "North Dakota", code: "nd", aliases: ["Dakota del Norte"], neighbors: ["Minnesota", "Montana", "South Dakota"] },
  { name: "Ohio", code: "oh", neighbors: ["Indiana", "Kentucky", "Michigan", "Pennsylvania", "West Virginia"] },
  { name: "Oklahoma", code: "ok", neighbors: ["Arkansas", "Colorado", "Kansas", "Missouri", "New Mexico", "Texas"] },
  { name: "Oregon", code: "or", aliases: ["Oregón"], neighbors: ["California", "Idaho", "Nevada", "Washington"] },
  { name: "Pennsylvania", code: "pa", aliases: ["Pensilvania"], neighbors: ["Delaware", "Maryland", "New Jersey", "New York", "Ohio", "West Virginia"] },
  { name: "Rhode Island", code: "ri", neighbors: ["Connecticut", "Massachusetts"] },
  { name: "South Carolina", code: "sc", aliases: ["Carolina del Sur"], neighbors: ["Georgia", "North Carolina"] },
  { name: "South Dakota", code: "sd", aliases: ["Dakota del Sur"], neighbors: ["Iowa", "Minnesota", "Montana", "Nebraska", "North Dakota", "Wyoming"] },
  { name: "Tennessee", code: "tn", neighbors: ["Alabama", "Arkansas", "Georgia", "Kentucky", "Mississippi", "Missouri", "North Carolina", "Virginia"] },
  { name: "Texas", code: "tx", aliases: ["Tejas"], neighbors: ["Arkansas", "Louisiana", "New Mexico", "Oklahoma"] },
  { name: "Utah", code: "ut", neighbors: ["Arizona", "Colorado", "Idaho", "Nevada", "Wyoming"] },
  { name: "Vermont", code: "vt", neighbors: ["Massachusetts", "New Hampshire", "New York"] },
  { name: "Virginia", code: "va", neighbors: ["Kentucky", "Maryland", "North Carolina", "Tennessee", "West Virginia"] },
  { name: "Washington", code: "wa", neighbors: ["Idaho", "Oregon"] },
  { name: "West Virginia", code: "wv", aliases: ["Virginia Occidental"], neighbors: ["Kentucky", "Maryland", "Ohio", "Pennsylvania", "Virginia"] },
  { name: "Wisconsin", code: "wi", neighbors: ["Illinois", "Iowa", "Michigan", "Minnesota"] },
  { name: "Wyoming", code: "wy", neighbors: ["Colorado", "Idaho", "Montana", "Nebraska", "South Dakota", "Utah"] },
];

export const USA: RegionDef = {
  id: "us",
  title: "United States",
  flag: "🇺🇸",
  entityNoun: "states",
  entities: E,
};
