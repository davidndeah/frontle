// ============================================================
//  Frontle — Grafo de fronteras terrestres
//  Cada país lista sus vecinos por frontera terrestre.
//  El grafo se normaliza a simétrico en build (ver buildGraph):
//  si A declara a B como vecino, B tendrá a A aunque falte.
//  Solo incluimos países con al menos una frontera terrestre
//  (las islas sin frontera no sirven para el juego de cadenas).
// ============================================================

export interface Country {
  name: string;
  flag: string;
  neighbors: string[];
}

// Lista base. Las relaciones se completan/normalizan en buildGraph().
const RAW: Country[] = [
  // ---------------- Sudamérica ----------------
  { name: "Colombia", flag: "🇨🇴", neighbors: ["Venezuela", "Brazil", "Peru", "Ecuador", "Panama"] },
  { name: "Venezuela", flag: "🇻🇪", neighbors: ["Colombia", "Brazil", "Guyana"] },
  { name: "Guyana", flag: "🇬🇾", neighbors: ["Venezuela", "Brazil", "Suriname"] },
  { name: "Suriname", flag: "🇸🇷", neighbors: ["Guyana", "Brazil"] },
  { name: "Brazil", flag: "🇧🇷", neighbors: ["Venezuela", "Guyana", "Suriname", "Colombia", "Peru", "Bolivia", "Paraguay", "Argentina", "Uruguay"] },
  { name: "Ecuador", flag: "🇪🇨", neighbors: ["Colombia", "Peru"] },
  { name: "Peru", flag: "🇵🇪", neighbors: ["Ecuador", "Colombia", "Brazil", "Bolivia", "Chile"] },
  { name: "Bolivia", flag: "🇧🇴", neighbors: ["Peru", "Brazil", "Paraguay", "Argentina", "Chile"] },
  { name: "Paraguay", flag: "🇵🇾", neighbors: ["Bolivia", "Brazil", "Argentina"] },
  { name: "Chile", flag: "🇨🇱", neighbors: ["Peru", "Bolivia", "Argentina"] },
  { name: "Argentina", flag: "🇦🇷", neighbors: ["Chile", "Bolivia", "Paraguay", "Brazil", "Uruguay"] },
  { name: "Uruguay", flag: "🇺🇾", neighbors: ["Brazil", "Argentina"] },

  // ---------------- Centro / Norteamérica ----------------
  { name: "Panama", flag: "🇵🇦", neighbors: ["Colombia", "Costa Rica"] },
  { name: "Costa Rica", flag: "🇨🇷", neighbors: ["Panama", "Nicaragua"] },
  { name: "Nicaragua", flag: "🇳🇮", neighbors: ["Costa Rica", "Honduras"] },
  { name: "Honduras", flag: "🇭🇳", neighbors: ["Nicaragua", "Guatemala", "El Salvador"] },
  { name: "El Salvador", flag: "🇸🇻", neighbors: ["Honduras", "Guatemala"] },
  { name: "Guatemala", flag: "🇬🇹", neighbors: ["Honduras", "El Salvador", "Mexico", "Belize"] },
  { name: "Belize", flag: "🇧🇿", neighbors: ["Guatemala", "Mexico"] },
  { name: "Mexico", flag: "🇲🇽", neighbors: ["Guatemala", "Belize", "United States"] },
  { name: "United States", flag: "🇺🇸", neighbors: ["Mexico", "Canada"] },
  { name: "Canada", flag: "🇨🇦", neighbors: ["United States"] },

  // ---------------- Europa Occidental ----------------
  { name: "Portugal", flag: "🇵🇹", neighbors: ["Spain"] },
  { name: "Spain", flag: "🇪🇸", neighbors: ["Portugal", "France", "Andorra"] },
  { name: "France", flag: "🇫🇷", neighbors: ["Spain", "Andorra", "Belgium", "Luxembourg", "Germany", "Switzerland", "Italy", "Monaco"] },
  { name: "Andorra", flag: "🇦🇩", neighbors: ["Spain", "France"] },
  { name: "Monaco", flag: "🇲🇨", neighbors: ["France"] },
  { name: "Belgium", flag: "🇧🇪", neighbors: ["France", "Netherlands", "Germany", "Luxembourg"] },
  { name: "Netherlands", flag: "🇳🇱", neighbors: ["Belgium", "Germany"] },
  { name: "Luxembourg", flag: "🇱🇺", neighbors: ["France", "Belgium", "Germany"] },
  { name: "Germany", flag: "🇩🇪", neighbors: ["Netherlands", "Belgium", "Luxembourg", "France", "Switzerland", "Austria", "Czech Republic", "Poland", "Denmark"] },
  { name: "Switzerland", flag: "🇨🇭", neighbors: ["France", "Germany", "Austria", "Italy", "Liechtenstein"] },
  { name: "Italy", flag: "🇮🇹", neighbors: ["France", "Switzerland", "Austria", "Slovenia", "San Marino", "Vatican City"] },
  { name: "San Marino", flag: "🇸🇲", neighbors: ["Italy"] },
  { name: "Vatican City", flag: "🇻🇦", neighbors: ["Italy"] },
  { name: "Austria", flag: "🇦🇹", neighbors: ["Germany", "Switzerland", "Italy", "Slovenia", "Hungary", "Slovakia", "Czech Republic", "Liechtenstein"] },
  { name: "Liechtenstein", flag: "🇱🇮", neighbors: ["Switzerland", "Austria"] },
  { name: "Denmark", flag: "🇩🇰", neighbors: ["Germany"] },

  // ---------------- Balcanes / Europa del Este ----------------
  { name: "Slovenia", flag: "🇸🇮", neighbors: ["Italy", "Austria", "Hungary", "Croatia"] },
  { name: "Croatia", flag: "🇭🇷", neighbors: ["Slovenia", "Hungary", "Serbia", "Bosnia and Herzegovina", "Montenegro"] },
  { name: "Bosnia and Herzegovina", flag: "🇧🇦", neighbors: ["Croatia", "Serbia", "Montenegro"] },
  { name: "Montenegro", flag: "🇲🇪", neighbors: ["Croatia", "Bosnia and Herzegovina", "Serbia", "Albania", "Kosovo"] },
  { name: "Serbia", flag: "🇷🇸", neighbors: ["Hungary", "Romania", "Bulgaria", "North Macedonia", "Kosovo", "Montenegro", "Bosnia and Herzegovina", "Croatia"] },
  { name: "Albania", flag: "🇦🇱", neighbors: ["Montenegro", "Kosovo", "North Macedonia", "Greece"] },
  { name: "Kosovo", flag: "🇽🇰", neighbors: ["Serbia", "Montenegro", "Albania", "North Macedonia"] },
  { name: "North Macedonia", flag: "🇲🇰", neighbors: ["Kosovo", "Serbia", "Bulgaria", "Greece", "Albania"] },
  { name: "Greece", flag: "🇬🇷", neighbors: ["Albania", "North Macedonia", "Bulgaria", "Turkey"] },
  { name: "Bulgaria", flag: "🇧🇬", neighbors: ["Romania", "Serbia", "North Macedonia", "Greece", "Turkey"] },
  { name: "Romania", flag: "🇷🇴", neighbors: ["Hungary", "Serbia", "Bulgaria", "Ukraine", "Moldova"] },
  { name: "Hungary", flag: "🇭🇺", neighbors: ["Austria", "Slovakia", "Ukraine", "Romania", "Serbia", "Croatia", "Slovenia"] },
  { name: "Slovakia", flag: "🇸🇰", neighbors: ["Czech Republic", "Poland", "Ukraine", "Hungary", "Austria"] },
  { name: "Czech Republic", flag: "🇨🇿", neighbors: ["Germany", "Poland", "Slovakia", "Austria"] },
  { name: "Poland", flag: "🇵🇱", neighbors: ["Germany", "Czech Republic", "Slovakia", "Ukraine", "Belarus", "Lithuania", "Russia"] },
  { name: "Moldova", flag: "🇲🇩", neighbors: ["Romania", "Ukraine"] },
  { name: "Ukraine", flag: "🇺🇦", neighbors: ["Poland", "Slovakia", "Hungary", "Romania", "Moldova", "Belarus", "Russia"] },
  { name: "Belarus", flag: "🇧🇾", neighbors: ["Poland", "Lithuania", "Latvia", "Russia", "Ukraine"] },
  { name: "Lithuania", flag: "🇱🇹", neighbors: ["Poland", "Belarus", "Latvia", "Russia"] },
  { name: "Latvia", flag: "🇱🇻", neighbors: ["Lithuania", "Belarus", "Russia", "Estonia"] },
  { name: "Estonia", flag: "🇪🇪", neighbors: ["Latvia", "Russia"] },

  // ---------------- Escandinavia / Rusia ----------------
  { name: "Norway", flag: "🇳🇴", neighbors: ["Sweden", "Finland", "Russia"] },
  { name: "Sweden", flag: "🇸🇪", neighbors: ["Norway", "Finland"] },
  { name: "Finland", flag: "🇫🇮", neighbors: ["Norway", "Sweden", "Russia"] },
  { name: "Russia", flag: "🇷🇺", neighbors: ["Norway", "Finland", "Estonia", "Latvia", "Lithuania", "Poland", "Belarus", "Ukraine", "Georgia", "Azerbaijan", "Kazakhstan", "China", "Mongolia", "North Korea"] },

  // ---------------- Cáucaso / Medio Oriente ----------------
  { name: "Turkey", flag: "🇹🇷", neighbors: ["Greece", "Bulgaria", "Georgia", "Armenia", "Azerbaijan", "Iran", "Iraq", "Syria"] },
  { name: "Georgia", flag: "🇬🇪", neighbors: ["Russia", "Turkey", "Armenia", "Azerbaijan"] },
  { name: "Armenia", flag: "🇦🇲", neighbors: ["Georgia", "Azerbaijan", "Iran", "Turkey"] },
  { name: "Azerbaijan", flag: "🇦🇿", neighbors: ["Russia", "Georgia", "Armenia", "Iran", "Turkey"] },
  { name: "Iran", flag: "🇮🇷", neighbors: ["Turkey", "Armenia", "Azerbaijan", "Turkmenistan", "Afghanistan", "Pakistan", "Iraq"] },
  { name: "Iraq", flag: "🇮🇶", neighbors: ["Turkey", "Syria", "Jordan", "Saudi Arabia", "Kuwait", "Iran"] },
  { name: "Syria", flag: "🇸🇾", neighbors: ["Turkey", "Iraq", "Jordan", "Israel", "Lebanon"] },
  { name: "Lebanon", flag: "🇱🇧", neighbors: ["Syria", "Israel"] },
  { name: "Israel", flag: "🇮🇱", neighbors: ["Lebanon", "Syria", "Jordan", "Egypt"] },
  { name: "Jordan", flag: "🇯🇴", neighbors: ["Syria", "Iraq", "Saudi Arabia", "Israel"] },
  { name: "Saudi Arabia", flag: "🇸🇦", neighbors: ["Jordan", "Iraq", "Kuwait", "Qatar", "United Arab Emirates", "Oman", "Yemen"] },
  { name: "Kuwait", flag: "🇰🇼", neighbors: ["Iraq", "Saudi Arabia"] },
  { name: "Qatar", flag: "🇶🇦", neighbors: ["Saudi Arabia"] },
  { name: "United Arab Emirates", flag: "🇦🇪", neighbors: ["Saudi Arabia", "Oman"] },
  { name: "Oman", flag: "🇴🇲", neighbors: ["United Arab Emirates", "Saudi Arabia", "Yemen"] },
  { name: "Yemen", flag: "🇾🇪", neighbors: ["Saudi Arabia", "Oman"] },

  // ---------------- Asia Central / Sur ----------------
  { name: "Kazakhstan", flag: "🇰🇿", neighbors: ["Russia", "China", "Kyrgyzstan", "Uzbekistan", "Turkmenistan"] },
  { name: "Uzbekistan", flag: "🇺🇿", neighbors: ["Kazakhstan", "Kyrgyzstan", "Tajikistan", "Afghanistan", "Turkmenistan"] },
  { name: "Turkmenistan", flag: "🇹🇲", neighbors: ["Kazakhstan", "Uzbekistan", "Afghanistan", "Iran"] },
  { name: "Kyrgyzstan", flag: "🇰🇬", neighbors: ["Kazakhstan", "Uzbekistan", "Tajikistan", "China"] },
  { name: "Tajikistan", flag: "🇹🇯", neighbors: ["Uzbekistan", "Kyrgyzstan", "China", "Afghanistan"] },
  { name: "Afghanistan", flag: "🇦🇫", neighbors: ["Iran", "Turkmenistan", "Uzbekistan", "Tajikistan", "China", "Pakistan"] },
  { name: "Pakistan", flag: "🇵🇰", neighbors: ["Iran", "Afghanistan", "China", "India"] },
  { name: "India", flag: "🇮🇳", neighbors: ["Pakistan", "China", "Nepal", "Bhutan", "Bangladesh", "Myanmar"] },
  { name: "Nepal", flag: "🇳🇵", neighbors: ["India", "China"] },
  { name: "Bhutan", flag: "🇧🇹", neighbors: ["India", "China"] },
  { name: "Bangladesh", flag: "🇧🇩", neighbors: ["India", "Myanmar"] },
  { name: "China", flag: "🇨🇳", neighbors: ["Russia", "Mongolia", "Kazakhstan", "Kyrgyzstan", "Tajikistan", "Afghanistan", "Pakistan", "India", "Nepal", "Bhutan", "Myanmar", "Laos", "Vietnam", "North Korea"] },
  { name: "Mongolia", flag: "🇲🇳", neighbors: ["Russia", "China"] },
  { name: "North Korea", flag: "🇰🇵", neighbors: ["China", "Russia", "South Korea"] },
  { name: "South Korea", flag: "🇰🇷", neighbors: ["North Korea"] },

  // ---------------- Sudeste Asiático ----------------
  { name: "Myanmar", flag: "🇲🇲", neighbors: ["Bangladesh", "India", "China", "Laos", "Thailand"] },
  { name: "Thailand", flag: "🇹🇭", neighbors: ["Myanmar", "Laos", "Cambodia", "Malaysia"] },
  { name: "Laos", flag: "🇱🇦", neighbors: ["Myanmar", "China", "Vietnam", "Cambodia", "Thailand"] },
  { name: "Vietnam", flag: "🇻🇳", neighbors: ["China", "Laos", "Cambodia"] },
  { name: "Cambodia", flag: "🇰🇭", neighbors: ["Thailand", "Laos", "Vietnam"] },
  { name: "Malaysia", flag: "🇲🇾", neighbors: ["Thailand", "Indonesia", "Brunei"] },
  { name: "Brunei", flag: "🇧🇳", neighbors: ["Malaysia"] },
  { name: "Indonesia", flag: "🇮🇩", neighbors: ["Malaysia", "Papua New Guinea", "East Timor"] },
  { name: "Papua New Guinea", flag: "🇵🇬", neighbors: ["Indonesia"] },
  { name: "East Timor", flag: "🇹🇱", neighbors: ["Indonesia"] },

  // ---------------- Norte de África ----------------
  { name: "Egypt", flag: "🇪🇬", neighbors: ["Libya", "Sudan", "Israel"] },
  { name: "Libya", flag: "🇱🇾", neighbors: ["Tunisia", "Algeria", "Niger", "Chad", "Sudan", "Egypt"] },
  { name: "Tunisia", flag: "🇹🇳", neighbors: ["Algeria", "Libya"] },
  { name: "Algeria", flag: "🇩🇿", neighbors: ["Morocco", "Tunisia", "Libya", "Niger", "Mali", "Mauritania", "Western Sahara"] },
  { name: "Morocco", flag: "🇲🇦", neighbors: ["Algeria", "Western Sahara"] },
  { name: "Western Sahara", flag: "🇪🇭", neighbors: ["Morocco", "Algeria", "Mauritania"] },
  { name: "Mauritania", flag: "🇲🇷", neighbors: ["Western Sahara", "Algeria", "Mali", "Senegal"] },

  // ---------------- África Occidental ----------------
  { name: "Mali", flag: "🇲🇱", neighbors: ["Algeria", "Niger", "Burkina Faso", "Ivory Coast", "Guinea", "Senegal", "Mauritania"] },
  { name: "Niger", flag: "🇳🇪", neighbors: ["Algeria", "Libya", "Chad", "Nigeria", "Benin", "Burkina Faso", "Mali"] },
  { name: "Senegal", flag: "🇸🇳", neighbors: ["Mauritania", "Mali", "Guinea", "Guinea-Bissau", "Gambia"] },
  { name: "Gambia", flag: "🇬🇲", neighbors: ["Senegal"] },
  { name: "Guinea-Bissau", flag: "🇬🇼", neighbors: ["Senegal", "Guinea"] },
  { name: "Guinea", flag: "🇬🇳", neighbors: ["Guinea-Bissau", "Senegal", "Mali", "Ivory Coast", "Liberia", "Sierra Leone"] },
  { name: "Sierra Leone", flag: "🇸🇱", neighbors: ["Guinea", "Liberia"] },
  { name: "Liberia", flag: "🇱🇷", neighbors: ["Sierra Leone", "Guinea", "Ivory Coast"] },
  { name: "Ivory Coast", flag: "🇨🇮", neighbors: ["Liberia", "Guinea", "Mali", "Burkina Faso", "Ghana"] },
  { name: "Burkina Faso", flag: "🇧🇫", neighbors: ["Mali", "Niger", "Benin", "Togo", "Ghana", "Ivory Coast"] },
  { name: "Ghana", flag: "🇬🇭", neighbors: ["Ivory Coast", "Burkina Faso", "Togo"] },
  { name: "Togo", flag: "🇹🇬", neighbors: ["Ghana", "Burkina Faso", "Benin"] },
  { name: "Benin", flag: "🇧🇯", neighbors: ["Togo", "Burkina Faso", "Niger", "Nigeria"] },
  { name: "Nigeria", flag: "🇳🇬", neighbors: ["Benin", "Niger", "Chad", "Cameroon"] },

  // ---------------- África Central ----------------
  { name: "Chad", flag: "🇹🇩", neighbors: ["Libya", "Sudan", "Central African Republic", "Cameroon", "Nigeria", "Niger"] },
  { name: "Cameroon", flag: "🇨🇲", neighbors: ["Nigeria", "Chad", "Central African Republic", "Republic of the Congo", "Gabon", "Equatorial Guinea"] },
  { name: "Central African Republic", flag: "🇨🇫", neighbors: ["Chad", "Sudan", "South Sudan", "Democratic Republic of the Congo", "Republic of the Congo", "Cameroon"] },
  { name: "Equatorial Guinea", flag: "🇬🇶", neighbors: ["Cameroon", "Gabon"] },
  { name: "Gabon", flag: "🇬🇦", neighbors: ["Equatorial Guinea", "Cameroon", "Republic of the Congo"] },
  { name: "Republic of the Congo", flag: "🇨🇬", neighbors: ["Gabon", "Cameroon", "Central African Republic", "Democratic Republic of the Congo", "Angola"] },
  { name: "Democratic Republic of the Congo", flag: "🇨🇩", neighbors: ["Central African Republic", "South Sudan", "Uganda", "Rwanda", "Burundi", "Tanzania", "Zambia", "Angola", "Republic of the Congo"] },
  { name: "Angola", flag: "🇦🇴", neighbors: ["Republic of the Congo", "Democratic Republic of the Congo", "Zambia", "Namibia"] },

  // ---------------- Cuerno / África Oriental ----------------
  { name: "Sudan", flag: "🇸🇩", neighbors: ["Egypt", "Libya", "Chad", "Central African Republic", "South Sudan", "Ethiopia", "Eritrea"] },
  { name: "South Sudan", flag: "🇸🇸", neighbors: ["Sudan", "Ethiopia", "Kenya", "Uganda", "Democratic Republic of the Congo", "Central African Republic"] },
  { name: "Ethiopia", flag: "🇪🇹", neighbors: ["Eritrea", "Djibouti", "Somalia", "Kenya", "South Sudan", "Sudan"] },
  { name: "Eritrea", flag: "🇪🇷", neighbors: ["Sudan", "Ethiopia", "Djibouti"] },
  { name: "Djibouti", flag: "🇩🇯", neighbors: ["Eritrea", "Ethiopia", "Somalia"] },
  { name: "Somalia", flag: "🇸🇴", neighbors: ["Djibouti", "Ethiopia", "Kenya"] },
  { name: "Kenya", flag: "🇰🇪", neighbors: ["Ethiopia", "Somalia", "South Sudan", "Uganda", "Tanzania"] },
  { name: "Uganda", flag: "🇺🇬", neighbors: ["South Sudan", "Kenya", "Tanzania", "Rwanda", "Democratic Republic of the Congo"] },
  { name: "Rwanda", flag: "🇷🇼", neighbors: ["Uganda", "Tanzania", "Burundi", "Democratic Republic of the Congo"] },
  { name: "Burundi", flag: "🇧🇮", neighbors: ["Rwanda", "Tanzania", "Democratic Republic of the Congo"] },
  { name: "Tanzania", flag: "🇹🇿", neighbors: ["Kenya", "Uganda", "Rwanda", "Burundi", "Democratic Republic of the Congo", "Zambia", "Malawi", "Mozambique"] },

  // ---------------- África Austral ----------------
  { name: "Zambia", flag: "🇿🇲", neighbors: ["Democratic Republic of the Congo", "Tanzania", "Malawi", "Mozambique", "Zimbabwe", "Botswana", "Namibia", "Angola"] },
  { name: "Malawi", flag: "🇲🇼", neighbors: ["Tanzania", "Zambia", "Mozambique"] },
  { name: "Mozambique", flag: "🇲🇿", neighbors: ["Tanzania", "Malawi", "Zambia", "Zimbabwe", "South Africa", "Eswatini"] },
  { name: "Zimbabwe", flag: "🇿🇼", neighbors: ["Zambia", "Mozambique", "South Africa", "Botswana"] },
  { name: "Botswana", flag: "🇧🇼", neighbors: ["Namibia", "Zambia", "Zimbabwe", "South Africa"] },
  { name: "Namibia", flag: "🇳🇦", neighbors: ["Angola", "Zambia", "Botswana", "South Africa"] },
  { name: "South Africa", flag: "🇿🇦", neighbors: ["Namibia", "Botswana", "Zimbabwe", "Mozambique", "Eswatini", "Lesotho"] },
  { name: "Lesotho", flag: "🇱🇸", neighbors: ["South Africa"] },
  { name: "Eswatini", flag: "🇸🇿", neighbors: ["South Africa", "Mozambique"] },
];

// Construye un grafo simétrico y consistente a partir de RAW.
// Si A lista a B pero B no lista a A, se agrega la arista inversa.
function buildGraph(): Record<string, Country> {
  const graph: Record<string, Country> = {};
  for (const c of RAW) {
    graph[c.name] = { name: c.name, flag: c.flag, neighbors: [...c.neighbors] };
  }
  // Normalizar simetría
  for (const c of RAW) {
    for (const nb of c.neighbors) {
      if (graph[nb] && !graph[nb].neighbors.includes(c.name)) {
        graph[nb].neighbors.push(c.name);
      }
    }
  }
  // Ordenar vecinos para estabilidad
  for (const name in graph) {
    graph[name].neighbors.sort();
  }
  return graph;
}

export const COUNTRIES: Record<string, Country> = buildGraph();

export const COUNTRY_NAMES: string[] = Object.keys(COUNTRIES).sort();

export function getCountry(name: string): Country | undefined {
  return COUNTRIES[name];
}

export function areNeighbors(a: string, b: string): boolean {
  return COUNTRIES[a]?.neighbors.includes(b) ?? false;
}
