import { geoOrthographic, geoPath, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import { writeFileSync } from "fs";

const topo = await (await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")).json();
const land = feature(topo, topo.objects.land);

const cx = 512, cy = 520, r = 300;
const projection = geoOrthographic().scale(r).translate([cx, cy]).rotate([-15, -8]);
const path = geoPath(projection);
const landD = path(land);
const gratD = path(geoGraticule().step([20, 20])());

// Puntos sobre TIERRA (lng,lat) → píxeles, así los 3 caen en continentes.
const P0 = projection([-50, -10]); // Brasil (origen, cyan)
const P1 = projection([22, 2]);    // África central (medio, verde)
const P2 = projection([80, 22]);   // India (destino, fucsia)
// Control de una cuadrática que pasa por P1 en t=0.5 (curva suave por los 3).
const C = [2 * P1[0] - 0.5 * (P0[0] + P2[0]), 2 * P1[1] - 0.5 * (P0[1] + P2[1])];
const routeD = `M ${P0[0]} ${P0[1]} Q ${C[0]} ${C[1]} ${P2[0]} ${P2[1]}`;

const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="44%" r="62%">
      <stop offset="0%" stop-color="#15203a"/>
      <stop offset="55%" stop-color="#0a0d18"/>
      <stop offset="100%" stop-color="#05060c"/>
    </radialGradient>
    <linearGradient id="prism" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22d3ee"/>
      <stop offset="35%" stop-color="#22c55e"/>
      <stop offset="60%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#e879f9"/>
    </linearGradient>
    <radialGradient id="ocean" cx="42%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#101830"/>
      <stop offset="100%" stop-color="#080c1a"/>
    </radialGradient>
    <clipPath id="globeClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="route" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10"/></filter>
  </defs>

  <rect x="0" y="0" width="1024" height="1024" rx="232" fill="url(#bgGlow)"/>
  <ellipse cx="${cx}" cy="560" rx="360" ry="300" fill="url(#prism)" opacity="0.22" filter="url(#soft)"/>

  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ocean)" stroke="rgba(255,255,255,0.14)" stroke-width="3"/>
  <g clip-path="url(#globeClip)">
    <path d="${gratD}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
    <path d="${landD}" fill="#3a5170" fill-opacity="0.75" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  </g>

  <path d="${routeD}" fill="none" stroke="url(#prism)" stroke-width="30" stroke-linecap="round" opacity="0.55" filter="url(#route)"/>
  <path d="${routeD}" fill="none" stroke="url(#prism)" stroke-width="18" stroke-linecap="round"/>

  <circle cx="${P0[0]}" cy="${P0[1]}" r="40" fill="#22d3ee"/>
  <circle cx="${P0[0]}" cy="${P0[1]}" r="16" fill="#ffffff"/>
  <circle cx="${P1[0]}" cy="${P1[1]}" r="20" fill="#22c55e"/>
  <circle cx="${P2[0]}" cy="${P2[1]}" r="40" fill="#e879f9"/>
  <circle cx="${P2[0]}" cy="${P2[1]}" r="16" fill="#ffffff"/>
</svg>
`;
writeFileSync(String(new URL("./public/icon.svg", import.meta.url)).replace("file:///", "").replace(/\//g, "\\"), svg, "utf-8");
console.log("icon.svg generado con mapa mundi");
