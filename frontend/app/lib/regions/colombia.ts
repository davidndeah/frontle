// ============================================================
//  Frontle — Región: COLOMBIA 🇨🇴
//  32 entidades: 31 departamentos con frontera terrestre + Bogotá D.C.
//  San Andrés y Providencia queda fuera (isla, sin fronteras terrestres).
//
//  Fuentes de adyacencia: límites oficiales DANE / IGAC. Casos limítrofes
//  verificados a mano:
//   - Boyacá–Meta: sí (borde corto por San Luis de Gaceno / Barranca de Upía)
//   - Cundinamarca–Casanare: sí (Paratebueno / Villanueva)
//   - Risaralda–Tolima: sí (páramo, borde corto)
//   - Bogotá D.C.: limita con Cundinamarca, Meta y Huila (Sumapaz)
//   - Caldas–Boyacá: sí (Magdalena medio, Puerto Boyacá)
// ============================================================

import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Amazonas", code: "ama", neighbors: ["Caquetá", "Putumayo", "Vaupés"] },
  { name: "Antioquia", code: "ant", neighbors: ["Bolívar", "Boyacá", "Caldas", "Chocó", "Córdoba", "Risaralda", "Santander"] },
  { name: "Arauca", code: "ara", neighbors: ["Boyacá", "Casanare", "Vichada"] },
  { name: "Atlántico", code: "atl", neighbors: ["Bolívar", "Magdalena"] },
  { name: "Bogotá D.C.", code: "bog", aliases: ["Bogotá", "Bogota DC", "Distrito Capital"], neighbors: ["Cundinamarca", "Huila", "Meta"] },
  { name: "Bolívar", code: "bol", neighbors: ["Antioquia", "Atlántico", "Cesar", "Córdoba", "Magdalena", "Santander", "Sucre"] },
  { name: "Boyacá", code: "boy", neighbors: ["Antioquia", "Arauca", "Caldas", "Casanare", "Cundinamarca", "Meta", "Norte de Santander", "Santander"] },
  { name: "Caldas", code: "cal", neighbors: ["Antioquia", "Boyacá", "Cundinamarca", "Risaralda", "Tolima"] },
  { name: "Caquetá", code: "caq", neighbors: ["Amazonas", "Cauca", "Guaviare", "Huila", "Meta", "Putumayo", "Vaupés"] },
  { name: "Casanare", code: "cas", neighbors: ["Arauca", "Boyacá", "Cundinamarca", "Meta", "Vichada"] },
  { name: "Cauca", code: "cau", neighbors: ["Caquetá", "Huila", "Nariño", "Putumayo", "Tolima", "Valle del Cauca"] },
  { name: "Cesar", code: "ces", neighbors: ["Bolívar", "La Guajira", "Magdalena", "Norte de Santander", "Santander"] },
  { name: "Chocó", code: "cho", neighbors: ["Antioquia", "Risaralda", "Valle del Cauca"] },
  { name: "Córdoba", code: "cor", neighbors: ["Antioquia", "Bolívar", "Sucre"] },
  { name: "Cundinamarca", code: "cun", neighbors: ["Bogotá D.C.", "Boyacá", "Caldas", "Casanare", "Huila", "Meta", "Tolima"] },
  { name: "Guainía", code: "gua", neighbors: ["Guaviare", "Vaupés", "Vichada"] },
  { name: "Guaviare", code: "guv", neighbors: ["Caquetá", "Guainía", "Meta", "Vaupés", "Vichada"] },
  { name: "Huila", code: "hui", neighbors: ["Bogotá D.C.", "Caquetá", "Cauca", "Cundinamarca", "Meta", "Tolima"] },
  { name: "La Guajira", code: "lag", aliases: ["Guajira"], neighbors: ["Cesar", "Magdalena"] },
  { name: "Magdalena", code: "mag", neighbors: ["Atlántico", "Bolívar", "Cesar", "La Guajira"] },
  { name: "Meta", code: "met", neighbors: ["Bogotá D.C.", "Boyacá", "Caquetá", "Casanare", "Cundinamarca", "Guaviare", "Huila", "Vichada"] },
  { name: "Nariño", code: "nar", neighbors: ["Cauca", "Putumayo"] },
  { name: "Norte de Santander", code: "nsa", aliases: ["Norte de Santander", "N. de Santander"], neighbors: ["Boyacá", "Cesar", "Santander"] },
  { name: "Putumayo", code: "put", neighbors: ["Amazonas", "Caquetá", "Cauca", "Nariño"] },
  { name: "Quindío", code: "qui", neighbors: ["Risaralda", "Tolima", "Valle del Cauca"] },
  { name: "Risaralda", code: "ris", neighbors: ["Antioquia", "Caldas", "Chocó", "Quindío", "Tolima", "Valle del Cauca"] },
  { name: "Santander", code: "san", neighbors: ["Antioquia", "Bolívar", "Boyacá", "Cesar", "Norte de Santander"] },
  { name: "Sucre", code: "suc", neighbors: ["Bolívar", "Córdoba"] },
  { name: "Tolima", code: "tol", neighbors: ["Caldas", "Cauca", "Cundinamarca", "Huila", "Quindío", "Risaralda", "Valle del Cauca"] },
  { name: "Valle del Cauca", code: "val", aliases: ["Valle"], neighbors: ["Cauca", "Chocó", "Quindío", "Risaralda", "Tolima"] },
  { name: "Vaupés", code: "vau", neighbors: ["Amazonas", "Caquetá", "Guainía", "Guaviare"] },
  { name: "Vichada", code: "vic", neighbors: ["Arauca", "Casanare", "Guainía", "Guaviare", "Meta"] },
];

export const COLOMBIA: RegionDef = {
  id: "co",
  title: "Colombia",
  flag: "🇨🇴",
  nounKey: "department",
  entities: E,
};
