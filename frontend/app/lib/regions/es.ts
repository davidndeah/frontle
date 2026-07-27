// ============================================================
//  Frontle — Región: España 🇪🇸
//  15 subdivisiones (region). Adyacencia derivada de la geometría
//  (Natural Earth 10m admin_1) por gen-region.mjs. Revisar bordes dudosos a mano.
// ============================================================
import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Andalucía", code: "and", neighbors: ["Castilla-La Mancha", "Extremadura", "Murcia"] },
  { name: "Aragón", code: "ara", neighbors: ["Castilla y León", "Castilla-La Mancha", "Cataluña", "Comunidad Valenciana", "La Rioja", "Navarra"] },
  { name: "Asturias", code: "ast", neighbors: ["Cantabria", "Castilla y León", "Galicia"] },
  { name: "Cantabria", code: "can", neighbors: ["Asturias", "Castilla y León", "País Vasco"] },
  { name: "Castilla y León", code: "cast", aliases: ["Castilla Leon"], neighbors: ["Aragón", "Asturias", "Cantabria", "Castilla-La Mancha", "Extremadura", "Galicia", "La Rioja", "Madrid", "País Vasco"] },
  { name: "Castilla-La Mancha", code: "cas", aliases: ["Castilla La Mancha"], neighbors: ["Andalucía", "Aragón", "Castilla y León", "Comunidad Valenciana", "Extremadura", "Madrid", "Murcia"] },
  { name: "Cataluña", code: "cat", aliases: ["Catalunya"], neighbors: ["Aragón", "Comunidad Valenciana"] },
  { name: "Comunidad Valenciana", code: "com", aliases: ["Valencia", "Comunitat Valenciana", "C. Valenciana"], neighbors: ["Aragón", "Castilla-La Mancha", "Cataluña", "Murcia"] },
  { name: "Extremadura", code: "ext", neighbors: ["Andalucía", "Castilla y León", "Castilla-La Mancha"] },
  { name: "Galicia", code: "gal", neighbors: ["Asturias", "Castilla y León"] },
  { name: "La Rioja", code: "rio", aliases: ["Rioja"], neighbors: ["Aragón", "Castilla y León", "Navarra", "País Vasco"] },
  { name: "Madrid", code: "mad", neighbors: ["Castilla y León", "Castilla-La Mancha"] },
  { name: "Murcia", code: "mur", neighbors: ["Andalucía", "Castilla-La Mancha", "Comunidad Valenciana"] },
  { name: "Navarra", code: "nav", neighbors: ["Aragón", "La Rioja", "País Vasco"] },
  { name: "País Vasco", code: "pai", aliases: ["Euskadi"], neighbors: ["Cantabria", "Castilla y León", "La Rioja", "Navarra"] },
];

export const ESPANA: RegionDef = {
  id: "es",
  title: "España",
  flag: "🇪🇸",
  nounKey: "region",
  entities: E,
};
