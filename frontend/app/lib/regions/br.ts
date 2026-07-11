// ============================================================
//  Frontle — Región: Brasil 🇧🇷
//  27 estados. Adyacencia derivada de la geometría
//  (Natural Earth 10m admin_1) por gen-region.mjs. Revisar bordes dudosos a mano.
// ============================================================
import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Acre", code: "acr", neighbors: ["Amazonas", "Rondônia"] },
  { name: "Alagoas", code: "ala", neighbors: ["Bahia", "Pernambuco", "Sergipe"] },
  { name: "Amapá", code: "ama", neighbors: ["Pará"] },
  { name: "Amazonas", code: "amaz", neighbors: ["Acre", "Mato Grosso", "Pará", "Rondônia", "Roraima"] },
  { name: "Bahia", code: "bah", neighbors: ["Alagoas", "Espírito Santo", "Goiás", "Minas Gerais", "Pernambuco", "Piauí", "Sergipe", "Tocantins"] },
  { name: "Ceará", code: "cea", neighbors: ["Paraíba", "Pernambuco", "Piauí", "Rio Grande do Norte"] },
  { name: "Distrito Federal", code: "dis", neighbors: ["Goiás", "Minas Gerais"] },
  { name: "Espírito Santo", code: "esp", neighbors: ["Bahia", "Minas Gerais", "Rio de Janeiro"] },
  { name: "Goiás", code: "goi", neighbors: ["Bahia", "Distrito Federal", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Tocantins"] },
  { name: "Maranhão", code: "mar", neighbors: ["Pará", "Piauí", "Tocantins"] },
  { name: "Mato Grosso", code: "mato", neighbors: ["Amazonas", "Goiás", "Mato Grosso do Sul", "Pará", "Rondônia", "Tocantins"] },
  { name: "Mato Grosso do Sul", code: "mat", neighbors: ["Goiás", "Mato Grosso", "Minas Gerais", "Paraná", "São Paulo"] },
  { name: "Minas Gerais", code: "min", neighbors: ["Bahia", "Distrito Federal", "Espírito Santo", "Goiás", "Mato Grosso do Sul", "Rio de Janeiro", "São Paulo"] },
  { name: "Pará", code: "par", neighbors: ["Amapá", "Amazonas", "Maranhão", "Mato Grosso", "Roraima", "Tocantins"] },
  { name: "Paraíba", code: "parai", neighbors: ["Ceará", "Pernambuco", "Rio Grande do Norte"] },
  { name: "Paraná", code: "para", neighbors: ["Mato Grosso do Sul", "Santa Catarina", "São Paulo"] },
  { name: "Pernambuco", code: "per", neighbors: ["Alagoas", "Bahia", "Ceará", "Paraíba", "Piauí"] },
  { name: "Piauí", code: "pia", neighbors: ["Bahia", "Ceará", "Maranhão", "Pernambuco", "Tocantins"] },
  { name: "Rio de Janeiro", code: "rioj", neighbors: ["Espírito Santo", "Minas Gerais", "São Paulo"] },
  { name: "Rio Grande do Norte", code: "riog", neighbors: ["Ceará", "Paraíba"] },
  { name: "Rio Grande do Sul", code: "rio", neighbors: ["Santa Catarina"] },
  { name: "Rondônia", code: "ron", neighbors: ["Acre", "Amazonas", "Mato Grosso"] },
  { name: "Roraima", code: "ror", neighbors: ["Amazonas", "Pará"] },
  { name: "Santa Catarina", code: "san", neighbors: ["Paraná", "Rio Grande do Sul"] },
  { name: "São Paulo", code: "sao", neighbors: ["Mato Grosso do Sul", "Minas Gerais", "Paraná", "Rio de Janeiro"] },
  { name: "Sergipe", code: "ser", neighbors: ["Alagoas", "Bahia"] },
  { name: "Tocantins", code: "toc", neighbors: ["Bahia", "Goiás", "Maranhão", "Mato Grosso", "Pará", "Piauí"] },
];

export const BRASIL: RegionDef = {
  id: "br",
  title: "Brasil",
  flag: "🇧🇷",
  entityNoun: "estados",
  entities: E,
};
