// ============================================================
//  Frontle — Región: Argentina 🇦🇷
//  23 provincias. Adyacencia derivada de la geometría
//  (Natural Earth 10m admin_1) por gen-region.mjs. Revisar bordes dudosos a mano.
// ============================================================
import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Buenos Aires", code: "bue", neighbors: ["Ciudad de Buenos Aires", "Córdoba", "Entre Ríos", "La Pampa", "Río Negro", "Santa Fe"] },
  { name: "Catamarca", code: "cat", neighbors: ["Córdoba", "La Rioja", "Salta", "Santiago del Estero", "Tucumán"] },
  { name: "Chaco", code: "cha", neighbors: ["Corrientes", "Formosa", "Salta", "Santa Fe", "Santiago del Estero"] },
  { name: "Chubut", code: "chu", neighbors: ["Río Negro", "Santa Cruz"] },
  { name: "Ciudad de Buenos Aires", code: "ciu", neighbors: ["Buenos Aires"] },
  { name: "Córdoba", code: "cord", neighbors: ["Buenos Aires", "Catamarca", "La Pampa", "La Rioja", "San Luis", "Santa Fe", "Santiago del Estero"] },
  { name: "Corrientes", code: "cor", neighbors: ["Chaco", "Entre Ríos", "Misiones", "Santa Fe"] },
  { name: "Entre Ríos", code: "ent", neighbors: ["Buenos Aires", "Corrientes", "Santa Fe"] },
  { name: "Formosa", code: "for", neighbors: ["Chaco", "Salta"] },
  { name: "Jujuy", code: "juj", neighbors: ["Salta"] },
  { name: "La Pampa", code: "pam", neighbors: ["Buenos Aires", "Córdoba", "Mendoza", "Neuquén", "Río Negro", "San Luis"] },
  { name: "La Rioja", code: "rio", neighbors: ["Catamarca", "Córdoba", "San Juan", "San Luis"] },
  { name: "Mendoza", code: "men", neighbors: ["La Pampa", "Neuquén", "Río Negro", "San Juan", "San Luis"] },
  { name: "Misiones", code: "mis", neighbors: ["Corrientes"] },
  { name: "Neuquén", code: "neu", neighbors: ["La Pampa", "Mendoza", "Río Negro"] },
  { name: "Río Negro", code: "rion", neighbors: ["Buenos Aires", "Chubut", "La Pampa", "Mendoza", "Neuquén"] },
  { name: "Salta", code: "sal", neighbors: ["Catamarca", "Chaco", "Formosa", "Jujuy", "Santiago del Estero", "Tucumán"] },
  { name: "San Juan", code: "san", neighbors: ["La Rioja", "Mendoza", "San Luis"] },
  { name: "San Luis", code: "sanl", neighbors: ["Córdoba", "La Pampa", "La Rioja", "Mendoza", "San Juan"] },
  { name: "Santa Cruz", code: "sant", neighbors: ["Chubut"] },
  { name: "Santa Fe", code: "santa", neighbors: ["Buenos Aires", "Chaco", "Corrientes", "Córdoba", "Entre Ríos", "Santiago del Estero"] },
  { name: "Santiago del Estero", code: "santi", neighbors: ["Catamarca", "Chaco", "Córdoba", "Salta", "Santa Fe", "Tucumán"] },
  { name: "Tucumán", code: "tuc", neighbors: ["Catamarca", "Salta", "Santiago del Estero"] },
];

export const ARGENTINA: RegionDef = {
  id: "ar",
  title: "Argentina",
  flag: "🇦🇷",
  nounKey: "province",
  entities: E,
};
