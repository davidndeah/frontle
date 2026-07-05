// Genera video.html v2: intro de Frontle
//  - Tutorial guiado por la mascota (Portugal→Alemania, con error amarillo)
//  - Speedrun con el reto REAL de hoy
//  - Siluetas de todos los países + proyección rotada (fix Rusia/antimeridiano)
//  - Cierre con QR a la app
import { geoEqualEarth, geoPath, geoCentroid, geoGraticule } from "d3-geo";
import { feature } from "topojson-client";
import { readFileSync, writeFileSync } from "fs";

// ---- 1. Grafo desde countries.ts ----
const src = readFileSync("app/lib/countries.ts", "utf8");
const entryRe = /\{\s*name:\s*"([^"]+)",\s*flag:\s*"([^"]*)",\s*neighbors:\s*\[([^\]]*)\]\s*\}/g;
const raw = {};
let m;
while ((m = entryRe.exec(src)) !== null) {
  raw[m[1]] = { flag: m[2], neighbors: [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]) };
}
const seaBlock = src.match(/SEA_LINKS[^=]*=\s*\[([\s\S]*?)\];/)[1];
for (const x of seaBlock.matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)) {
  const [a, b] = [x[1], x[2]];
  if (raw[a] && raw[b]) {
    if (!raw[a].neighbors.includes(b)) raw[a].neighbors.push(b);
    if (!raw[b].neighbors.includes(a)) raw[b].neighbors.push(a);
  }
}
for (const c in raw) for (const nb of raw[c].neighbors)
  if (raw[nb] && !raw[nb].neighbors.includes(c)) raw[nb].neighbors.push(c);
for (const c in raw) raw[c].neighbors.sort();
const NAMES = Object.keys(raw).sort();
const code = (n) => [...raw[n].flag].map((ch) => ch.codePointAt(0)).filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff).map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65)).join("");

// ---- 2. Reto del día (lógica de game.ts) ----
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shortestPath(a, b) {
  if (a === b) return [a];
  const prev = { [a]: null }; const q = [a];
  while (q.length) {
    const cur = q.shift(); if (cur === b) break;
    for (const nb of raw[cur].neighbors) if (!(nb in prev)) { prev[nb] = cur; q.push(nb); }
  }
  if (!(b in prev)) return null;
  const p = []; let n = b;
  while (n !== null) { p.unshift(n); n = prev[n]; }
  return p;
}
// Speedrun: Sudáfrica → Egipto (ruta épica por África)
const daily = shortestPath("South Africa", "Egypt");
console.log("Speedrun:", daily.join(" → "));

// Tutorial fijo y sencillo: Portugal → Alemania (óptimo 2), error amarillo: Suiza
// (Suiza queda DENTRO del encuadre Portugal–Alemania; Marruecos quedaba fuera)
const TUT = { path: ["Portugal", "Spain", "France", "Germany"], mistake: "Switzerland" };
const d = (a, b) => shortestPath(a, b).length - 1;
const detour = d("Portugal", "Switzerland") + d("Switzerland", "Germany") - d("Portugal", "Germany");
console.log("Detour Switzerland:", detour, "(1-2 = amarillo)");

// ---- 3. Mapa: proyección rotada al centroide (fix antimeridiano) ----
const topo = await (await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")).json();
const world = feature(topo, topo.objects.countries);
function normName(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/\./g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}
const NE_ALIAS = { "united states of america": "United States", "dem rep congo": "Democratic Republic of the Congo", "congo": "Republic of the Congo", "cote divoire": "Ivory Coast", "czechia": "Czech Republic", "bosnia and herz": "Bosnia and Herzegovina", "timorleste": "East Timor", "lao pdr": "Laos", "republic of korea": "South Korea", "dem rep korea": "North Korea", "macedonia": "North Macedonia", "republic of serbia": "Serbia", "united republic of tanzania": "Tanzania", "brunei darussalam": "Brunei", "swaziland": "Eswatini", "w sahara": "Western Sahara", "central african rep": "Central African Republic", "eq guinea": "Equatorial Guinea", "s sudan": "South Sudan" };
const featBy = {};
for (const f of world.features) {
  const ne = normName(f.properties.name || "");
  const my = NE_ALIAS[ne] || NAMES.find((n) => normName(n) === ne);
  if (my) featBy[my] = f;
}
// El encuadre se FIJA a origen+destino (igual que la app); los demás países
// jugados se dibujan con esa misma proyección.
function board(anchorNames, playNames) {
  const anchors = anchorNames.map((n) => featBy[n]).filter(Boolean);
  const fc = { type: "FeatureCollection", features: anchors };
  const [lon] = geoCentroid(fc);
  const proj = geoEqualEarth().rotate([Number.isFinite(lon) ? -lon : 0, 0]).fitExtent([[24, 20], [616, 340]], fc);
  const pg = geoPath(proj);
  // Graticule (paralelos/meridianos) recortado al área visible
  const corners = [[0, 0], [640, 0], [0, 360], [640, 360], [320, 0], [320, 360]]
    .map((p) => proj.invert(p)).filter(Boolean);
  const lons = corners.map((c) => c[0]), lats = corners.map((c) => c[1]);
  const grat = pg(geoGraticule()
    .extent([[Math.min(...lons) - 5, Math.min(...lats) - 5], [Math.max(...lons) + 5, Math.max(...lats) + 5]])
    .step([10, 10])()) || "";
  return {
    grat,
    all: world.features.map((f) => pg(f) || ""),          // siluetas de TODOS
    play: playNames.map((n) => (featBy[n] ? pg(featBy[n]) : "")),
  };
}
const tutPlay = [TUT.path[0], TUT.path[1], TUT.mistake, TUT.path[2], TUT.path[3]];
const tutBoard = board([TUT.path[0], TUT.path[3]], tutPlay);
const dayBoard = board([daily[0], daily[daily.length - 1]], daily);

const DATA = {
  tut: {
    countries: tutPlay.map((n) => ({ name: n, code: code(n) })),
    // índices: 0=start,1=Spain(verde),2=Switzerland(amarillo),3=France(verde),4=end
    mapGrat: tutBoard.grat,
    mapAll: tutBoard.all,
    mapPlay: tutBoard.play,
  },
  day: {
    countries: daily.map((n) => ({ name: n, code: code(n) })),
    optimal: daily.length - 2,
    mapGrat: dayBoard.grat,
    mapAll: dayBoard.all,
    mapPlay: dayBoard.play,
  },
};

// ---- 4. Bordy M2 (mascota oficial, PNG 3D renderizado con Three.js) ----
const robotIMG = `<img src="bordy-m2.png" alt="Bordy" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 24px 32px rgba(0,0,0,0.45))">`;

// ---- 5. HTML ----
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" rel="stylesheet">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#130729; width:1280px; height:720px; overflow:hidden; font-family: Arial, Helvetica, sans-serif; }
#stage { position:relative; width:1280px; height:720px; overflow:hidden;
  background: radial-gradient(120% 90% at 50% 0%, #2a1257 0%, #1c0b3e 50%, #130729 100%); }
.abs { position:absolute; }
.disp { font-family:'Fredoka', Arial, sans-serif; }
#bgGlow { inset:0; background: radial-gradient(60% 55% at 50% 55%, #31165e33 0%, transparent 70%); opacity:0; }
#bgPrism { left:15%; top:25%; width:70%; height:60%; border-radius:50%; filter: blur(70px); opacity:0;
  background: linear-gradient(100deg,#7c3aed,#a855f7,#fcff52,#c084fc); }
#bgGrid { inset:0; opacity:0;
  background-image: linear-gradient(to right, rgba(183,156,237,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(183,156,237,0.10) 1px, transparent 1px);
  background-size: 56px 56px; }
.prismText { background: linear-gradient(100deg,#c084fc 0%,#a855f7 28%,#ffffff 52%,#fcff52 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
#hello { left:0; right:0; top:320px; text-align:center; font-family: Consolas, monospace; font-size:56px; color:#4ade80; opacity:0; }
#introducing { left:0; right:0; top:250px; text-align:center; font-size:34px; letter-spacing:8px; color:#cbb8f0; opacity:0; }
#brand { left:0; right:0; top:295px; text-align:center; font-size:120px; font-weight:700; letter-spacing:4px; opacity:0; font-family:'Fredoka', Arial, sans-serif; }
#tagline { left:0; right:0; top:452px; text-align:center; font-size:28px; color:#e7ecf6; opacity:0; }
#robotWrap { left:390px; top:110px; width:500px; height:560px; opacity:0; transform-origin:center; }
.card { left:70px; top:44px; width:1140px; height:656px; opacity:0; }
.gHead { position:absolute; left:0; top:0; width:640px; height:80px;
  background:linear-gradient(160deg, rgba(138,92,245,0.26), rgba(76,29,149,0.30)); border:1px solid rgba(183,156,237,0.28);
  border-radius:18px; display:flex; align-items:center; justify-content:center; gap:20px; }
.gHead img { width:48px; border-radius:4px; }
.cname { font-size:23px; font-weight:bold; }
.gArrow { color:#b79ced; font-size:26px; }
.gSub { position:absolute; left:0; top:86px; width:640px; text-align:center; font-size:16px; color:#cbb8f0; }
.mapBox { position:absolute; left:0; top:114px; width:640px; height:360px; background:#0f0524; border:1px solid rgba(183,156,237,0.20); border-radius:18px; overflow:hidden; }
.mapBox svg { width:100%; height:100%; }
.timer { position:absolute; right:0; top:0; width:180px; height:56px; background:rgba(28,11,62,0.8); border:1px solid rgba(183,156,237,0.25); border-radius:28px;
  display:flex; align-items:center; justify-content:center; font-family:Consolas,monospace; font-size:28px; color:#fff; }
.inputRow { position:absolute; left:0; top:490px; width:640px; height:58px; display:flex; gap:12px; }
.inputBox { flex:1; background:#160833; border:1.5px solid rgba(183,156,237,0.30); border-radius:15px; display:flex; align-items:center;
  padding:0 20px; font-size:22px; color:#fff; }
.caret { display:inline-block; width:2.5px; height:28px; background:#fff; margin-left:2px; }
.okBtn { width:88px; background:linear-gradient(180deg,#ffff86,#fcff52 45%,#e6e63a); color:#1c0b3e; border-radius:15px; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:bold;
  box-shadow:0 4px 0 #b3b32e; font-family:'Fredoka', Arial, sans-serif; }
.chips { position:absolute; left:0; top:566px; width:1140px; display:flex; gap:10px; }
.chip { display:flex; flex-direction:column; align-items:center; padding:8px 12px; border-radius:13px; border:1.5px solid; background:rgba(28,11,62,0.7);
  opacity:0; transform:scale(0.6); min-width:88px; }
.chip img { width:32px; border-radius:3px; }
.chip span { font-size:12px; color:#fff; margin-top:4px; font-weight:600; text-align:center; }
#bubble { position:absolute; left:750px; top:345px; width:460px; background:rgba(28,11,62,0.95); border:1.5px solid #b79ced;
  border-radius:18px; padding:16px 22px; font-size:22px; color:#fff; line-height:1.4; opacity:0; }
#bubble:after { content:""; position:absolute; left:158px; bottom:-12px; width:22px; height:22px; background:rgba(28,11,62,0.95); transform:rotate(45deg);
  border-right:1.5px solid #b79ced; border-bottom:1.5px solid #b79ced; }
#legendT { position:absolute; left:680px; top:70px; width:460px; font-size:18px; color:#cbb8f0; opacity:0; line-height:1.9; }
.dot { display:inline-block; width:13px; height:13px; border-radius:50%; margin-right:7px; vertical-align:-1px; }
#tutWin { position:absolute; left:680px; top:176px; width:460px; text-align:center; opacity:0; }
#tutWinT { font-size:38px; font-weight:700; color:#fff; font-family:'Fredoka', Arial, sans-serif; }
#dayCap { position:absolute; left:680px; top:96px; width:460px; font-size:30px; color:#fff; font-weight:600; opacity:0; font-family:'Fredoka', Arial, sans-serif; }
#win { position:absolute; left:660px; top:300px; width:500px; text-align:center; opacity:0; }
#winT { font-size:52px; font-weight:700; font-family:'Fredoka', Arial, sans-serif; }
#winS { font-size:23px; color:#e7ecf6; margin-top:10px; }
#confetti { inset:0; pointer-events:none; }
.cf { position:absolute; width:10px; height:10px; border-radius:2px; opacity:0; }
#cta { left:0; right:0; top:250px; text-align:center; opacity:0; }
#ctaT { font-size:76px; font-weight:700; color:#fff; font-family:'Fredoka', Arial, sans-serif; }
#ctaS { font-size:32px; margin-top:18px; color:#e2d7f7; }
#ctaS b { color:#fcff52; }
#ctaBtn { display:inline-block; margin-top:38px; background:linear-gradient(180deg,#ffff86,#fcff52 45%,#e6e63a); color:#1c0b3e; font-size:28px; font-weight:600; padding:16px 46px; border-radius:20px;
  box-shadow:0 6px 0 #b3b32e, 0 12px 24px rgba(252,255,82,0.28); font-family:'Fredoka', Arial, sans-serif; }
#tease { left:0; right:0; top:150px; text-align:center; opacity:0; }
#teaseT { font-size:48px; font-style:italic; color:#e7ecf6; }
#qrBox { display:inline-block; margin-top:36px; background:#fff; border-radius:22px; padding:14px; }
#qrBox img { width:210px; display:block; }
#teaseU { font-size:24px; color:#cbb8f0; margin-top:16px; }
#fade { inset:0; background:#130729; opacity:0; pointer-events:none; }
</style></head><body>
<div id="stage">
  <div class="abs" id="bgGlow"></div><div class="abs" id="bgPrism"></div><div class="abs" id="bgGrid"></div>
  <div class="abs" id="hello">&gt; Hello, world<span id="hCaret">_</span></div>
  <div class="abs" id="introducing">INTRODUCING</div>
  <div class="abs prismText" id="brand">FRONTLE</div>
  <div class="abs" id="tagline">Connect countries through borders</div>

  <div class="abs card" id="gameT">
    <div class="gHead" id="headT"></div>
    <div class="gSub">Tutorial — connect the two countries by naming neighbors</div>
    <div class="mapBox"><svg viewBox="0 0 640 360" id="mapT"></svg></div>
    <div class="timer" id="timerT">00:00</div>
    <div class="inputRow"><div class="inputBox"><span id="inTextT"></span><span class="caret" id="caretT"></span></div><div class="okBtn">OK</div></div>
    <div class="chips" id="chipsT"></div>
    <div id="legendT">
      <span class="dot" style="background:#22d3ee"></span>Start&nbsp;&nbsp;<span class="dot" style="background:#e879f9"></span>Destination<br>
      <span class="dot" style="background:#22c55e"></span>Best route&nbsp;&nbsp;<span class="dot" style="background:#eab308"></span>Sideways&nbsp;&nbsp;<span class="dot" style="background:#ef4444"></span>Too far
    </div>
    <div id="tutWin"><div id="tutWinT">Route complete! &#127937;</div></div>
  </div>
  <div class="abs" id="bubble"></div>

  <div class="abs card" id="gameD">
    <div class="gHead" id="headD"></div>
    <div class="gSub" id="subD"></div>
    <div class="mapBox"><svg viewBox="0 0 640 360" id="mapD"></svg></div>
    <div class="timer" id="timerD">00:00</div>
    <div class="inputRow"><div class="inputBox"><span id="inTextD"></span><span class="caret" id="caretD"></span></div><div class="okBtn">OK</div></div>
    <div class="chips" id="chipsD"></div>
    <div id="dayCap">Full speed &#9889;</div>
    <div id="win"><div class="prismText" id="winT">Perfect route! &#127942;</div><div id="winS"></div></div>
  </div>

  <div class="abs" id="robotWrap">${robotIMG}</div>
  <div class="abs" id="confetti"></div>
  <div class="abs" id="cta">
    <div id="ctaT">Play for free</div>
    <div id="ctaS">or sign in with your wallet to <b>earn</b></div>
    <div id="ctaBtn">&#9654;&nbsp; frontle.vercel.app</div>
  </div>
  <div class="abs" id="tease">
    <div id="teaseT">New modes coming soon...</div>
    <div id="qrBox"><img src="qr.png"></div>
    <div id="teaseU">Scan to play &#183; frontle.vercel.app</div>
  </div>
  <div class="abs" id="fade"></div>
</div>
<script>
var DATA = ${JSON.stringify(DATA)};
var CY = "#22d3ee", GR = "#22c55e", YE = "#eab308", FU = "#e879f9";
var TCOL = [CY, GR, YE, GR, FU]; // colores por chip del tutorial

function buildBoard(prefix, d, cols) {
  var n = d.countries.length;
  var last = d.countries[n - 1], first = d.countries[0];
  document.getElementById("head" + prefix).innerHTML =
    '<img src="https://flagcdn.com/' + first.code.toLowerCase() + '.svg"><span class="cname" style="color:' + CY + '">' + first.name +
    '</span><span class="gArrow">&#8594;</span><img src="https://flagcdn.com/' + last.code.toLowerCase() + '.svg"><span class="cname" style="color:' + FU + '">' + last.name + '</span>';
  var svg = '<path d="' + d.mapGrat + '" fill="none" stroke="rgba(183,156,237,0.16)" stroke-width="0.5"/>';
  for (var a = 0; a < d.mapAll.length; a++)
    svg += '<path d="' + d.mapAll[a] + '" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.10)" stroke-width="0.7"/>';
  for (var i = 0; i < n; i++)
    svg += '<path id="mp' + prefix + '_' + i + '" d="' + d.mapPlay[i] + '" fill="transparent" stroke="rgba(255,255,255,0.30)" stroke-width="1"/>';
  document.getElementById("map" + prefix).innerHTML = svg;
  var ch = "";
  for (var j = 0; j < n; j++)
    ch += '<div class="chip" id="chip' + prefix + '_' + j + '" style="border-color:' + cols[j] + '">' +
      '<img src="https://flagcdn.com/' + d.countries[j].code.toLowerCase() + '.svg"><span>' + d.countries[j].name + '</span></div>';
  document.getElementById("chips" + prefix).innerHTML = ch;
}
(function init(){
  buildBoard("T", DATA.tut, TCOL);
  var nd = DATA.day.countries.length, dcols = [];
  for (var i = 0; i < nd; i++) dcols.push(i === 0 ? CY : (i === nd - 1 ? FU : GR));
  buildBoard("D", DATA.day, dcols);
  document.getElementById("subD").textContent = "Speedrun \\u00b7 Optimal route: " + DATA.day.optimal + " countries";
  var cf = document.getElementById("confetti"), s = "";
  var cols = [CY, GR, "#fcff52", FU, "#b79ced"];
  for (var k = 0; k < 26; k++) s += '<div class="cf" id="cf_' + k + '" style="background:' + cols[k % 5] + '"></div>';
  cf.innerHTML = s;
})();

function clamp(u){ return u < 0 ? 0 : u > 1 ? 1 : u; }
function ph(t, a, b){ return clamp((t - a) / (b - a)); }
function ease(u){ return u * u * (3 - 2 * u); }
function S(id, st){ var e = document.getElementById(id); for (var k in st) e.style[k] = st[k]; }
function pad(n){ return (n < 10 ? "0" : "") + n; }
function lerp(a, b, u){ return a + (b - a) * u; }
function paint(pre, i, on, color){
  var e = document.getElementById("mp" + pre + "_" + i); if (!e) return;
  e.style.fill = on ? color : "transparent";
  e.style.stroke = on ? color : "rgba(255,255,255,0.30)";
  e.style.filter = on ? "drop-shadow(0 0 6px " + color + ")" : "none";
}
function chipS(pre, i, op){
  var e = document.getElementById("chip" + pre + "_" + i); if (!e) return;
  e.style.opacity = op; e.style.transform = "scale(" + (0.6 + 0.4 * op) + ")";
}

// ---- cronología ----
// Tutorial: card 11.0s in · moves Spain(13.0-14.4)→ok, Morocco(16.8-18.0)→amarillo,
// France(20.4-21.6)→ok+win 22.0 · out 25.2
var TUT_IN = 11000, TUT_T0 = 11800;
var tutMoves = [
  { idx: 1, t0: 13000, t1: 14400, col: GR },
  { idx: 2, t0: 16800, t1: 18000, col: YE },
  { idx: 3, t0: 20400, t1: 21600, col: GR },
];
var TUT_WIN = 22000, TUT_OUT = 25200;
// Daily: in 25.8 · moves rápidos desde 26.6 (620ms c/u) · win + confetti · out 32.6
var DAY_IN = 25800, DAY_T0 = 26200, DAY_M0 = 26600, STEP = 620;
var dayMids = DATA.day.countries.length - 2;
var DAY_WIN = DAY_M0 + dayMids * STEP + 250;
var DAY_OUT = DAY_WIN + 2100;
// CTA / tease
var CTA_IN = DAY_OUT + 300, CTA_OUT = CTA_IN + 3600;
var TEASE_IN = CTA_OUT + 300, FADE = TEASE_IN + 3200;
window.DUR = FADE + 700;

var bubbles = [
  { t0: 11900, t1: 15600, txt: "Hi! I'm Bordy \\uD83D\\uDC4B Let's connect Portugal to Germany!" },
  { t0: 15800, t1: 18300, txt: "Green = you're on the best route \\u2705" },
  { t0: 18600, t1: 21200, txt: "Oops \\u2014 yellow! Switzerland is a detour \\uD83D\\uDEA6" },
  { t0: 22300, t1: 25000, txt: "You made it! Now watch a speedrun \\u26A1" },
];

function seek(ms){
  var bg = ease(ph(ms, 3200, 4200));
  S("bgGlow", { opacity: bg }); S("bgGrid", { opacity: bg * 0.9 }); S("bgPrism", { opacity: bg * 0.16 });

  // S1 hello
  var chars = Math.floor(ph(ms, 400, 2000) * 14);
  document.getElementById("hello").childNodes[0].nodeValue = "> " + "Hello, world!".slice(0, chars);
  S("hCaret", { opacity: (Math.floor(ms / 420) % 2) ? 0 : 1 });
  S("hello", { opacity: ph(ms, 200, 500) * (1 - ease(ph(ms, 2800, 3300))) });

  // S2 introducing
  var s2o = 1 - ease(ph(ms, 6300, 6900));
  S("introducing", { opacity: ease(ph(ms, 3500, 4100)) * s2o });
  S("brand", { opacity: ease(ph(ms, 3700, 4500)) * s2o, transform: "scale(" + (0.82 + 0.18 * ease(ph(ms, 3700, 4600))) + ")" });
  S("tagline", { opacity: ease(ph(ms, 4600, 5200)) * s2o });

  // S3 robot: grande + guiño → se mueve a guiar el tutorial → sale
  var rIn = ease(ph(ms, 6900, 7500));
  var mv = ease(ph(ms, 10400, 11400));            // big → tutor spot
  var rOut = 1 - ease(ph(ms, TUT_OUT - 400, TUT_OUT + 300));
  var left = lerp(390, 670, mv), top = lerp(110, 330, mv), sc = lerp(1, 0.52, mv) * (0.6 + 0.4 * rIn);
  var bob = Math.sin(ms / 480) * 6;
  // Saludo de Bordy: doble salto con squash & stretch (9.0s–9.9s)
  var hopU = ph(ms, 9000, 9900);
  var hop = hopU > 0 && hopU < 1 ? Math.abs(Math.sin(hopU * Math.PI * 2)) : 0;
  var squash = 1 - 0.06 * Math.sin(hopU * Math.PI * 4);
  S("robotWrap", {
    opacity: rIn * rOut, left: left + "px", top: (top + bob - hop * 26) + "px",
    transform: "scale(" + (sc * (2 - squash)) + "," + (sc * squash) + ") rotate(" + (hopU > 0 && hopU < 1 ? hop * 4 - 2 : 0) + "deg)",
  });

  // ---- TUTORIAL ----
  var tIn = ease(ph(ms, TUT_IN, TUT_IN + 600)) * (1 - ease(ph(ms, TUT_OUT, TUT_OUT + 600)));
  S("gameT", { opacity: tIn });
  var showT = ms >= TUT_IN;
  paint("T", 0, showT ? 1 : 0, CY); paint("T", 4, showT ? 1 : 0, FU);
  chipS("T", 0, showT ? 1 : 0); chipS("T", 4, showT ? 1 : 0);
  var typT = "";
  for (var i = 0; i < tutMoves.length; i++) {
    var mvv = tutMoves[i], u = ph(ms, mvv.t0, mvv.t1);
    var nm = DATA.tut.countries[mvv.idx].name;
    if (u > 0 && u < 1) typT = nm.slice(0, Math.ceil(u * nm.length));
    var done = ms >= mvv.t1 + 150;
    paint("T", mvv.idx, done ? 1 : 0, mvv.col);
    chipS("T", mvv.idx, done ? ease(ph(ms, mvv.t1 + 150, mvv.t1 + 450)) : 0);
  }
  document.getElementById("inTextT").textContent = typT;
  S("caretT", { opacity: tIn > 0 && (Math.floor(ms / 380) % 2) ? 1 : 0 });
  var secT = Math.floor(Math.max(0, Math.min(ms, TUT_WIN) - TUT_T0) / 1000);
  document.getElementById("timerT").textContent = pad(Math.floor(secT / 60)) + ":" + pad(secT % 60);
  S("legendT", { opacity: ms >= 15800 && ms < TUT_OUT ? ease(ph(ms, 15800, 16300)) * tIn : 0 });
  var tw = ease(ph(ms, TUT_WIN, TUT_WIN + 450));
  S("tutWin", { opacity: tw * tIn, transform: "scale(" + (0.85 + 0.15 * tw) + ")" });

  // burbuja de la mascota
  var bTxt = "", bOp = 0;
  for (var b = 0; b < bubbles.length; b++) {
    var bb = bubbles[b];
    if (ms >= bb.t0 && ms < bb.t1) { bTxt = bb.txt; bOp = ease(ph(ms, bb.t0, bb.t0 + 350)) * (1 - ease(ph(ms, bb.t1 - 350, bb.t1))); }
  }
  var bubEl = document.getElementById("bubble");
  if (bTxt) bubEl.textContent = bTxt;
  S("bubble", { opacity: bOp });

  // ---- DAILY ----
  var dIn = ease(ph(ms, DAY_IN, DAY_IN + 550)) * (1 - ease(ph(ms, DAY_OUT, DAY_OUT + 600)));
  S("gameD", { opacity: dIn });
  var nd = DATA.day.countries.length;
  var showD = ms >= DAY_IN;
  paint("D", 0, showD ? 1 : 0, CY); paint("D", nd - 1, showD ? 1 : 0, FU);
  chipS("D", 0, showD ? 1 : 0); chipS("D", nd - 1, showD ? 1 : 0);
  var typD = "";
  for (var j = 1; j <= dayMids; j++) {
    var t0 = DAY_M0 + (j - 1) * STEP, t1 = t0 + STEP * 0.8;
    var ud = ph(ms, t0, t1);
    var nmd = DATA.day.countries[j].name;
    if (ud > 0 && ud < 1) typD = nmd.slice(0, Math.ceil(ud * nmd.length));
    var dd = ms >= t1;
    paint("D", j, dd ? 1 : 0, GR);
    chipS("D", j, dd ? ease(ph(ms, t1, t1 + 250)) : 0);
  }
  document.getElementById("inTextD").textContent = typD;
  S("caretD", { opacity: dIn > 0 && (Math.floor(ms / 300) % 2) ? 1 : 0 });
  S("dayCap", { opacity: dIn * (1 - ease(ph(ms, DAY_WIN, DAY_WIN + 400))) });
  var shownD = 0;
  if (ms >= DAY_T0) shownD = (Math.min(ms, DAY_WIN) - DAY_T0) * 5;
  var secD = Math.floor(shownD / 1000);
  document.getElementById("timerD").textContent = pad(Math.floor(secD / 60)) + ":" + pad(secD % 60);
  var w = ease(ph(ms, DAY_WIN, DAY_WIN + 500));
  S("win", { opacity: w * dIn, transform: "scale(" + (0.8 + 0.2 * w) + ")" });
  document.getElementById("winS").textContent = "Solved in " + Math.floor((DAY_WIN - DAY_T0) * 5 / 1000) + "s \\u00b7 optimal route";
  for (var k = 0; k < 26; k++) {
    var cu = ph(ms, DAY_WIN + k * 18, DAY_WIN + 1900 + k * 18);
    var x = 640 + Math.sin(k * 12.9898) * 520;
    var y = 300 + cu * 360 + Math.sin(k * 3 + cu * 9) * 22;
    S("cf_" + k, { opacity: cu > 0 && cu < 1 ? (1 - cu) * dIn : 0, left: x + "px", top: y + "px", transform: "rotate(" + (cu * 540 + k * 40) + "deg)" });
  }

  // CTA / tease
  var c6 = ease(ph(ms, CTA_IN, CTA_IN + 600)) * (1 - ease(ph(ms, CTA_OUT, CTA_OUT + 600)));
  S("cta", { opacity: c6, transform: "translateY(" + (18 * (1 - ease(ph(ms, CTA_IN, CTA_IN + 800)))) + "px)" });
  S("tease", { opacity: ease(ph(ms, TEASE_IN, TEASE_IN + 600)) });
  S("fade", { opacity: ease(ph(ms, FADE, FADE + 700)) });
}
window.seek = seek;
seek(0);
</script></body></html>`;

writeFileSync("public/video.html", html, "utf-8");
console.log("video.html v2 generado. Duración total:", "ver window.DUR (~" + "40s)");
