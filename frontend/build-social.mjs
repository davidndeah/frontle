import { geoOrthographic, geoPath, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import { writeFileSync, readFileSync } from "fs";

// Logo real de Celo (embebido como base64)
const celoB64 = readFileSync("C:\\Users\\david\\Downloads\\CELO.jpg").toString("base64");
const celoHref = `data:image/jpeg;base64,${celoB64}`;

const topo = await (await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")).json();
const countries = feature(topo, topo.objects.countries);
const colombia = countries.features.find((f) => f.properties.name === "Colombia");

const W = 1600, H = 900;
const cx = 500, cy = 490, r = 330;
const projection = geoOrthographic().scale(r).translate([cx, cy]).rotate([65, 5]);
const path = geoPath(projection);
const landD = countries.features.map((f) => path(f)).filter(Boolean).join(" ");
const colombiaD = path(colombia);
const gratD = path(geoGraticule().step([20, 20])());

const P0 = projection([-74, 4.6]); // Colombia
// Badge del logo Celo (destino)
const BX = 1120, BY = 270, BS = 190; // centro y tamaño
const P2 = [BX - BS / 2 + 10, BY + BS / 2 - 10];
const C = [(P0[0] + P2[0]) / 2 + 40, Math.min(P0[1], P2[1]) - 170];
const routeD = `M ${P0[0]} ${P0[1]} Q ${C[0]} ${C[1]} ${P2[0]} ${P2[1]}`;

// Robot 3D-look: gradientes de volumen, ojos glossy, sombra flotante,
// logo real de Celo en el pecho.
function robot(x, y, s) {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="112" rx="78" ry="14" fill="#000" opacity="0.55"/>
    <ellipse cx="0" cy="112" rx="46" ry="8" fill="#22d3ee" opacity="0.25"/>
    <line x1="0" y1="-100" x2="0" y2="-76" stroke="#20d47e" stroke-width="6" stroke-linecap="round"/>
    <circle cx="0" cy="-108" r="10" fill="url(#antGrad)"/>
    <circle cx="-3.5" cy="-111.5" r="3" fill="#eafff4" opacity="0.9"/>

    <rect x="-56" y="-76" width="112" height="84" rx="26" fill="url(#headGrad)" stroke="url(#prism)" stroke-width="3.5"/>
    <rect x="-48" y="-70" width="96" height="30" rx="15" fill="#ffffff" opacity="0.07"/>

    <circle cx="-22" cy="-36" r="12" fill="url(#eyeGrad)"/>
    <circle cx="22" cy="-36" r="12" fill="url(#eyeGrad)"/>
    <circle cx="-25.5" cy="-40" r="4" fill="#ffffff" opacity="0.95"/>
    <circle cx="18.5" cy="-40" r="4" fill="#ffffff" opacity="0.95"/>
    <path d="M -14 -13 Q 0 -5 14 -13" stroke="#e879f9" stroke-width="4.5" fill="none" stroke-linecap="round"/>

    <rect x="-68" y="22" width="18" height="46" rx="9" fill="url(#limbGrad)" stroke="#22d3ee" stroke-width="2.5"/>
    <rect x="50" y="22" width="18" height="46" rx="9" fill="url(#limbGrad)" stroke="#e879f9" stroke-width="2.5"/>

    <rect x="-46" y="14" width="92" height="76" rx="22" fill="url(#bodyGrad)" stroke="url(#prism)" stroke-width="3.5"/>
    <rect x="-38" y="19" width="76" height="24" rx="12" fill="#ffffff" opacity="0.06"/>

    <g>
      <rect x="-19" y="33" width="38" height="38" rx="9" fill="#FCFF52"/>
      <image href="${celoHref}" x="-16" y="36" width="32" height="32" preserveAspectRatio="xMidYMid slice" clip-path="url(#chestClip)"/>
    </g>
  </g>`;
}

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <radialGradient id="bgGlow" cx="42%" cy="50%" r="72%">
      <stop offset="0%" stop-color="#121a33"/>
      <stop offset="55%" stop-color="#090c16"/>
      <stop offset="100%" stop-color="#03040a"/>
    </radialGradient>
    <linearGradient id="prism" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="35%" stop-color="#22c55e"/>
      <stop offset="60%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#e879f9"/>
    </linearGradient>
    <linearGradient id="routeCelo" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="55%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#FCFF52"/>
    </linearGradient>
    <radialGradient id="ocean" cx="40%" cy="36%" r="72%">
      <stop offset="0%" stop-color="#15204a"/>
      <stop offset="100%" stop-color="#070b18"/>
    </radialGradient>
    <linearGradient id="colFlag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FCD116"/><stop offset="50%" stop-color="#FCD116"/>
      <stop offset="50%" stop-color="#003893"/><stop offset="75%" stop-color="#003893"/>
      <stop offset="75%" stop-color="#CE1126"/><stop offset="100%" stop-color="#CE1126"/>
    </linearGradient>
    <radialGradient id="headGrad" cx="35%" cy="25%" r="90%">
      <stop offset="0%" stop-color="#2a3a5f"/><stop offset="60%" stop-color="#141d33"/><stop offset="100%" stop-color="#0b1020"/>
    </radialGradient>
    <radialGradient id="bodyGrad" cx="35%" cy="20%" r="95%">
      <stop offset="0%" stop-color="#26355a"/><stop offset="60%" stop-color="#121a2f"/><stop offset="100%" stop-color="#0a0f1e"/>
    </radialGradient>
    <radialGradient id="limbGrad" cx="30%" cy="25%" r="90%">
      <stop offset="0%" stop-color="#223050"/><stop offset="100%" stop-color="#0c1122"/>
    </radialGradient>
    <radialGradient id="eyeGrad" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#9ff2ff"/><stop offset="55%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#0891b2"/>
    </radialGradient>
    <radialGradient id="antGrad" cx="35%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#8dffc9"/><stop offset="100%" stop-color="#16a34a"/>
    </radialGradient>
    <clipPath id="globeClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <clipPath id="badgeClip"><rect x="${BX - BS / 2}" y="${BY - BS / 2}" width="${BS}" height="${BS}" rx="34"/></clipPath>
    <clipPath id="chestClip"><rect x="-16" y="36" width="32" height="32" rx="6"/></clipPath>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="route" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <ellipse cx="820" cy="520" rx="640" ry="330" fill="url(#prism)" opacity="0.14" filter="url(#soft)"/>

  <g fill="#ffffff">
    <circle cx="1180" cy="90" r="2" opacity="0.7"/><circle cx="1420" cy="150" r="1.6" opacity="0.5"/>
    <circle cx="980" cy="60" r="1.6" opacity="0.5"/><circle cx="1530" cy="330" r="2" opacity="0.6"/>
    <circle cx="900" cy="820" r="1.6" opacity="0.4"/><circle cx="1260" cy="480" r="1.6" opacity="0.5"/>
    <circle cx="140" cy="760" r="1.6" opacity="0.4"/><circle cx="70" cy="300" r="2" opacity="0.5"/>
  </g>

  <circle cx="${cx}" cy="${cy}" r="${r + 14}" fill="none" stroke="url(#prism)" stroke-width="1.5" opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ocean)" stroke="rgba(255,255,255,0.16)" stroke-width="2.5"/>
  <g clip-path="url(#globeClip)">
    <path d="${gratD}" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1.6"/>
    <path d="${landD}" fill="#3a5170" fill-opacity="0.72" stroke="rgba(255,255,255,0.16)" stroke-width="1.2"/>
    <path d="${colombiaD}" fill="url(#colFlag)" stroke="#ffffff" stroke-width="2"/>
  </g>

  <path d="${routeD}" fill="none" stroke="url(#routeCelo)" stroke-width="26" stroke-linecap="round" opacity="0.5" filter="url(#route)"/>
  <path d="${routeD}" fill="none" stroke="url(#routeCelo)" stroke-width="14" stroke-linecap="round" stroke-dasharray="2 26"/>

  <circle cx="${P0[0]}" cy="${P0[1]}" r="30" fill="#FCD116" opacity="0.35"/>
  <circle cx="${P0[0]}" cy="${P0[1]}" r="16" fill="#FCD116"/>
  <circle cx="${P0[0]}" cy="${P0[1]}" r="7" fill="#ffffff"/>

  <rect x="${BX - BS / 2 - 14}" y="${BY - BS / 2 - 14}" width="${BS + 28}" height="${BS + 28}" rx="42" fill="#FCFF52" opacity="0.16" filter="url(#soft)"/>
  <image href="${celoHref}" x="${BX - BS / 2}" y="${BY - BS / 2}" width="${BS}" height="${BS}" preserveAspectRatio="xMidYMid slice" clip-path="url(#badgeClip)"/>
  <rect x="${BX - BS / 2}" y="${BY - BS / 2}" width="${BS}" height="${BS}" rx="34" fill="none" stroke="#FCFF52" stroke-width="3"/>

  ${robot(1360, 620, 1.25)}

  <text x="${P0[0]}" y="${P0[1] + 56}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#ffffff" text-anchor="middle">Colombia</text>
  <text x="${BX}" y="${BY + BS / 2 + 48}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#FCFF52" text-anchor="middle">Celo</text>

  <text x="80" y="118" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="900" fill="#ffffff" letter-spacing="2">FRONTLE</text>
  <text x="82" y="166" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#c3cbdd">Putting Colombia on the map — literally 🌍</text>

  <text x="80" y="${H - 52}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#8791a8">www.frontle.earth</text>
  <text x="${W - 80}" y="${H - 52}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#8791a8" text-anchor="end">@frontle_app · built on @Celo</text>
</svg>
`;

writeFileSync("public/social-colombia-celo.svg", svg, "utf-8");
console.log("SVG generado con logo real de Celo");
