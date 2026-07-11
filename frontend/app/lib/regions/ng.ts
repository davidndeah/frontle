// ============================================================
//  Frontle — Región: Nigeria 🇳🇬
//  37 estados. Adyacencia derivada de la geometría
//  (Natural Earth 10m admin_1) por gen-region.mjs. Revisar bordes dudosos a mano.
// ============================================================
import type { RegionDef, RegionEntity } from "./types";

const E: RegionEntity[] = [
  { name: "Abia", code: "abi", neighbors: ["Akwa Ibom", "Anambra", "Cross River", "Ebonyi", "Enugu", "Imo", "Rivers"] },
  { name: "Adamawa", code: "ada", neighbors: ["Borno", "Gombe", "Taraba"] },
  { name: "Akwa Ibom", code: "akw", neighbors: ["Abia", "Cross River", "Rivers"] },
  { name: "Anambra", code: "ana", neighbors: ["Abia", "Delta", "Enugu", "Imo", "Kogi", "Rivers"] },
  { name: "Bauchi", code: "bau", neighbors: ["Gombe", "Jigawa", "Kaduna", "Kano", "Plateau", "Taraba", "Yobe"] },
  { name: "Bayelsa", code: "bay", neighbors: ["Delta", "Rivers"] },
  { name: "Benue", code: "ben", neighbors: ["Cross River", "Ebonyi", "Enugu", "Kogi", "Nassarawa", "Taraba"] },
  { name: "Borno", code: "bor", neighbors: ["Adamawa", "Gombe", "Yobe"] },
  { name: "Cross River", code: "cro", neighbors: ["Abia", "Akwa Ibom", "Benue", "Ebonyi"] },
  { name: "Delta", code: "del", neighbors: ["Anambra", "Bayelsa", "Edo", "Ondo", "Rivers"] },
  { name: "Ebonyi", code: "ebo", neighbors: ["Abia", "Benue", "Cross River", "Enugu"] },
  { name: "Edo", code: "edo", neighbors: ["Delta", "Kogi", "Ondo"] },
  { name: "Ekiti", code: "eki", neighbors: ["Kogi", "Kwara", "Ondo", "Osun"] },
  { name: "Enugu", code: "enu", neighbors: ["Abia", "Anambra", "Benue", "Ebonyi", "Kogi"] },
  { name: "Federal Capital Territory", code: "fed", aliases: ["Abuja", "FCT"], neighbors: ["Kaduna", "Kogi", "Nassarawa", "Niger"] },
  { name: "Gombe", code: "gom", neighbors: ["Adamawa", "Bauchi", "Borno", "Taraba", "Yobe"] },
  { name: "Imo", code: "imo", neighbors: ["Abia", "Anambra", "Rivers"] },
  { name: "Jigawa", code: "jig", neighbors: ["Bauchi", "Kano", "Katsina", "Yobe"] },
  { name: "Kaduna", code: "kad", neighbors: ["Bauchi", "Federal Capital Territory", "Kano", "Katsina", "Nassarawa", "Niger", "Plateau", "Zamfara"] },
  { name: "Kano", code: "kan", neighbors: ["Bauchi", "Jigawa", "Kaduna", "Katsina"] },
  { name: "Katsina", code: "kat", neighbors: ["Jigawa", "Kaduna", "Kano", "Zamfara"] },
  { name: "Kebbi", code: "keb", neighbors: ["Niger", "Sokoto", "Zamfara"] },
  { name: "Kogi", code: "kog", neighbors: ["Anambra", "Benue", "Edo", "Ekiti", "Enugu", "Federal Capital Territory", "Kwara", "Nassarawa", "Niger", "Ondo"] },
  { name: "Kwara", code: "kwa", neighbors: ["Ekiti", "Kogi", "Niger", "Osun", "Oyo"] },
  { name: "Lagos", code: "lag", neighbors: ["Ogun"] },
  { name: "Nassarawa", code: "nas", aliases: ["Nasarawa"], neighbors: ["Benue", "Federal Capital Territory", "Kaduna", "Kogi", "Plateau", "Taraba"] },
  { name: "Niger", code: "nig", neighbors: ["Federal Capital Territory", "Kaduna", "Kebbi", "Kogi", "Kwara", "Zamfara"] },
  { name: "Ogun", code: "ogu", neighbors: ["Lagos", "Ondo", "Osun", "Oyo"] },
  { name: "Ondo", code: "ond", neighbors: ["Delta", "Edo", "Ekiti", "Kogi", "Ogun", "Osun"] },
  { name: "Osun", code: "osu", neighbors: ["Ekiti", "Kwara", "Ogun", "Ondo", "Oyo"] },
  { name: "Oyo", code: "oyo", neighbors: ["Kwara", "Ogun", "Osun"] },
  { name: "Plateau", code: "pla", neighbors: ["Bauchi", "Kaduna", "Nassarawa", "Taraba"] },
  { name: "Rivers", code: "riv", neighbors: ["Abia", "Akwa Ibom", "Anambra", "Bayelsa", "Delta", "Imo"] },
  { name: "Sokoto", code: "sok", neighbors: ["Kebbi", "Zamfara"] },
  { name: "Taraba", code: "tar", neighbors: ["Adamawa", "Bauchi", "Benue", "Gombe", "Nassarawa", "Plateau"] },
  { name: "Yobe", code: "yob", neighbors: ["Bauchi", "Borno", "Gombe", "Jigawa"] },
  { name: "Zamfara", code: "zam", neighbors: ["Kaduna", "Katsina", "Kebbi", "Niger", "Sokoto"] },
];

export const NIGERIA: RegionDef = {
  id: "ng",
  title: "Nigeria",
  flag: "🇳🇬",
  entityNoun: "estados",
  entities: E,
};
