// ============================================================
//  Frontle — Región: Ghana 🇬🇭
//  16 regiones. Adyacencia derivada de la geometría
//  (Natural Earth 10m admin_1) por gen-region.mjs. Revisar bordes dudosos a mano.
// ============================================================
import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Ahafo", code: "aha", neighbors: ["Ashanti", "Bono", "Western North"] },
  { name: "Ashanti", code: "ash", neighbors: ["Ahafo", "Bono", "Bono East", "Central", "Eastern", "Western North"] },
  { name: "Bono", code: "bono", neighbors: ["Ahafo", "Ashanti", "Bono East", "Savannah", "Western North"] },
  { name: "Bono East", code: "bon", neighbors: ["Ashanti", "Bono", "Eastern", "Oti", "Savannah"] },
  { name: "Central", code: "cen", neighbors: ["Ashanti", "Eastern", "Greater Accra", "Western", "Western North"] },
  { name: "Eastern", code: "eas", neighbors: ["Ashanti", "Bono East", "Central", "Greater Accra", "Volta"] },
  { name: "Greater Accra", code: "gre", neighbors: ["Central", "Eastern", "Volta"] },
  { name: "North East", code: "nor", neighbors: ["Northern", "Savannah", "Upper East", "Upper West"] },
  { name: "Northern", code: "nort", neighbors: ["North East", "Oti", "Savannah"] },
  { name: "Oti", code: "oti", neighbors: ["Bono East", "Northern", "Savannah", "Volta"] },
  { name: "Savannah", code: "sav", neighbors: ["Bono", "Bono East", "North East", "Northern", "Oti", "Upper West"] },
  { name: "Upper East", code: "uppe", neighbors: ["North East", "Upper West"] },
  { name: "Upper West", code: "upp", neighbors: ["North East", "Savannah", "Upper East"] },
  { name: "Volta", code: "vol", neighbors: ["Eastern", "Greater Accra", "Oti"] },
  { name: "Western", code: "west", neighbors: ["Central", "Western North"] },
  { name: "Western North", code: "wes", neighbors: ["Ahafo", "Ashanti", "Bono", "Central", "Western"] },
];

export const GHANA: RegionDef = {
  id: "gh",
  title: "Ghana",
  flag: "🇬🇭",
  nounKey: "region",
  entities: E,
};
