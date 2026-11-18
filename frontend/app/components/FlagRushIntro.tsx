"use client";

// ============================================================
//  FlagRushIntro — la entrada a Flag Rush, en 3D.
//
//  Guion (aprobado por David, 17-nov; la ruleta la pidió el mismo día):
//   1. Bordy levanta el brazo, toma impulso y le da un manotazo al globo,
//      que gira como una ruleta: rápido al principio, frenando con un tic
//      cada vez más espaciado, y se asienta con un rebote.
//   2. Diez banderas brotan sobre sus países.
//   3. Vuelan hacia la cámara y bajan al visor de Bordy, que las recibe una a
//      una: cada una entra en la pantalla del visor con un destello.
//   4. Bordy se gira hacia ti, salta, pone ojos felices y sale «¡YA!».
//
//  Todo vive en UNA escena de three.js: el globo es una esfera de verdad
//  (el mapa de Santiago como textura: mismos colores que el reto diario) y
//  Bordy es el modelo original (components/bordy3d/model.ts). Así hay
//  profundidad real: las banderas pasan por delante, Bordy tapa el globo.
//
//  · La escena es una función del tiempo: cada cuadro se calcula a partir de
//    t (ms), no de lo que pasó antes. Por eso `scrub` (laboratorio) puede
//    congelarla en cualquier instante y verse exactamente igual.
//  · Las banderas son de ADORNO: la escena corre antes de pedir la partida
//    al servidor (ni se conocen las de verdad ni deben conocerse) y no le
//    resta tiempo a la primera bandera.
//  · Un toque la salta. Con `prefers-reduced-motion` no hay viaje: el final
//    quieto (Bordy de frente, ojos felices, «¡YA!») y se cierra sola.
//  · Si el teléfono no tiene WebGL, se salta sin más.
// ============================================================

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { geoArea, geoCentroid, geoDistance, geoEquirectangular, geoPath } from "d3-geo";
import type { Polygon } from "geojson";
import { loadAtlas, type AtlasFeature } from "../lib/atlas";
import { COUNTRIES } from "../lib/countries";
import { getIsland } from "../lib/islands";
import { sfxGood, sfxHint, sfxPop, sfxTick } from "../lib/sfx";
import { addBordyLights, buildBordy, flagCardCanvas, paintVisorFlag, paintVisorHappy, paintVisorPrism } from "./bordy3d/model";

// --- Línea de tiempo (ms) -----------------------------------------------------
const WIND = 300; // Bordy levanta el brazo…
const WIND_MS = 320; // …y el globo cede un poco hacia atrás (tensión)
const SWIPE = 640; // el manotazo
const SWIPE_MS = 130;
const SPIN_END = 2050; // la ruleta se detiene
const SPIN_TURNS = 3.2; // vueltas que da desde el manotazo
const WINDUP_BACK = 0.2; // rad que retrocede al tomar impulso
const PIN_0 = 1700; // brota la primera bandera (el globo casi quieto)
const PIN_GAP = 70;
const PIN_MS = 360; // lo que tarda en brotar (con rebote)
const FLY_0 = 2400; // despega la primera
const FLY_GAP = 90; // y cada bandera llega al visor 90 ms después de la anterior
const FLY_MS = 520;
const TURN = 3770; // Bordy se gira hacia ti
const TURN_MS = 420;
const HOP = 3850; // y salta
const HOP_MS = 560;
const GO = 3900; // «¡YA!»
const END = 4600; // se cierra sola
export const FLAG_RUSH_INTRO_MS = END;
const ATLAS_WAIT = 700;
const PINS = 10;
const FLASH_MS = 120; // más corto que el paso entre banderas: cada una se alcanza a ver

// --- Escena (unidades de three.js) --------------------------------------------
const R = 1.5; // radio del globo
const GLOBE_Y = 1.05;
const BORDY_Y = -2.5;
const BORDY_Z = 1.4;
const BORDY_S = 0.8;
const BORDY_TURNED = -0.38; // de tres cuartos, mirando al globo
const C = { ocean: "#5b21b6", land: "#c9b6f5", border: "rgba(13, 4, 32, .55)", halo: "#a855f7", deep: "#0d0420" };

// Tres vistas del mundo con muchos países a la vista (centro lon, lat).
const VIEWS: [number, number][] = [
  [15, 22], // Europa y África
  [-72, 4], // las Américas
  [95, 18], // Asia
];

// --- Curvas -------------------------------------------------------------------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeBack = (x: number) => { const t = clamp01(x), c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const flyAt = (i: number) => FLY_0 + i * FLY_GAP;
const landAt = (i: number) => flyAt(i) + FLY_MS;

// Centroide del polígono más grande (igual que ChallengeIntro).
function mainCentroid(f: AtlasFeature): [number, number] {
  const g = f.geometry;
  if (g.type !== "MultiPolygon") return geoCentroid(f);
  let best: Polygon | null = null;
  let bestArea = -1;
  for (const coords of g.coordinates) {
    const p: Polygon = { type: "Polygon", coordinates: coords };
    const a = geoArea(p);
    if (a > bestArea) { bestArea = a; best = p; }
  }
  return best ? geoCentroid(best) : geoCentroid(f);
}
const codeOf = (name: string): string | null => COUNTRIES[name]?.code ?? getIsland(name)?.code ?? null;

// Diez países repartidos por la cara visible: muestreo del punto más lejano,
// para que cubran el globo en vez de amontonarse.
function pickPins(map: Map<string, AtlasFeature>, center: [number, number]) {
  const pool: { code: string; at: [number, number] }[] = [];
  for (const [name, f] of map) {
    const code = codeOf(name);
    if (!code) continue;
    const at = mainCentroid(f);
    if (geoDistance(at, center) < 1.0) pool.push({ code, at });
  }
  const out: { code: string; at: [number, number] }[] = [];
  while (out.length < PINS && pool.length) {
    let best = Math.floor(Math.random() * pool.length);
    if (out.length) {
      let bestD = -1;
      for (let k = 0; k < 14; k++) {
        const c = Math.floor(Math.random() * pool.length);
        const d = Math.min(...out.map((o) => geoDistance(o.at, pool[c].at)));
        if (d > bestD) { bestD = d; best = c; }
      }
    }
    out.push(pool.splice(best, 1)[0]);
  }
  return out;
}

// Punto de la esfera para (lon, lat) en grados, con el mapeo de UV de
// THREE.SphereGeometry (lon 0 mira a +x).
function lonLatToVec(lon: number, lat: number, r: number) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

// El mapa de Santiago en equirectangular, para envolver la esfera.
function paintWorld(ctx: CanvasRenderingContext2D, features: AtlasFeature[]) {
  const { width: w, height: h } = ctx.canvas;
  ctx.fillStyle = C.ocean;
  ctx.fillRect(0, 0, w, h);
  if (!features.length) return;
  const proj = geoEquirectangular().scale(w / (2 * Math.PI)).translate([w / 2, h / 2]);
  const path = geoPath(proj, ctx);
  ctx.beginPath();
  for (const f of features) path(f);
  ctx.fillStyle = C.land;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.3;
  ctx.stroke();
}

export default function FlagRushIntro({
  title, go, skip, onDone, scrub = null,
}: {
  title: string;
  go: string;
  skip: string;
  onDone: () => void;
  /** Solo laboratorio: congela la escena en este instante (ms). Con valor, no suena ni se cierra. */
  scrub?: number | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGo, setShowGo] = useState(false);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const scrubRef = useRef(scrub);
  useEffect(() => {
    onDoneRef.current = onDone;
    scrubRef.current = scrub;
  }, [onDone, scrub]);

  function finish() {
    if (doneRef.current || scrubRef.current != null) return;
    doneRef.current = true;
    onDoneRef.current();
  }

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      // Sin WebGL no hay escena: se pasa directo a la partida.
      const id = setTimeout(finish, 0);
      return () => clearTimeout(id);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    addBordyLights(scene);

    // --- Globo ---
    const view = VIEWS[Math.floor(Math.random() * VIEWS.length)];
    const worldCanvas = document.createElement("canvas");
    worldCanvas.width = 2048;
    worldCanvas.height = 1024;
    const wctx = worldCanvas.getContext("2d")!;
    paintWorld(wctx, []);
    const worldTex = new THREE.CanvasTexture(worldCanvas);
    worldTex.colorSpace = THREE.SRGBColorSpace;
    worldTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const globeTilt = new THREE.Group(); // inclina hacia la latitud de la vista
    globeTilt.position.set(0, GLOBE_Y, 0);
    globeTilt.rotation.x = THREE.MathUtils.degToRad(view[1]);
    scene.add(globeTilt);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(R, 96, 64),
      new THREE.MeshPhysicalMaterial({ map: worldTex, roughness: 0.62, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
    );
    globeTilt.add(globe);
    // Halo: la atmósfera morada, por detrás y sumando luz.
    // Sombreado de atmósfera clásico: la cara interior de una esfera algo más
    // grande, con brillo que crece hacia el borde del globo y se apaga hacia
    // afuera. Un color plano se veía como un aro.
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.06, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: { color: { value: new THREE.Color(C.halo) } },
        vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        // La franja visible va de dot = -0,33 (pegado al globo) a 0 (borde de la
        // capa): brillo máximo junto al globo y cero en el borde. Delgada a
        // propósito: con una capa más ancha el globo se veía chico.
        fragmentShader: "uniform vec3 color; varying vec3 vN; void main(){ float k = pow(clamp(-dot(vN, vec3(0.0, 0.0, 1.0)) / 0.33, 0.0, 1.0), 1.5); gl_FragColor = vec4(color * k * 0.7, 1.0); }",
        side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }),
    );
    halo.position.copy(globeTilt.position);
    scene.add(halo);
    const restSpin = THREE.MathUtils.degToRad(-view[0]) - Math.PI / 2; // la vista de frente
    const total = SPIN_TURNS * Math.PI * 2;
    // Ruleta: quieto → cede hacia atrás al tomar impulso → sale disparado con
    // el manotazo y frena con curva de cuarto grado (rápido al principio, muy
    // lento al final, como una ruleta de verdad) → se asienta con un rebote.
    const spinAt = (t: number) => {
      const start = restSpin - total;
      if (t < WIND) return start;
      if (t < SWIPE) return start - WINDUP_BACK * easeOut((t - WIND) / WIND_MS);
      if (t < SPIN_END) {
        const p = (t - SWIPE) / (SPIN_END - SWIPE);
        return restSpin - (total + WINDUP_BACK) * Math.pow(1 - p, 4);
      }
      const dt = t - SPIN_END;
      return restSpin + 0.045 * Math.sin(dt / 65) * Math.exp(-dt / 170);
    };
    const globeScaleAt = (t: number) => 0.78 + 0.22 * easeBack(t / 600);
    // Rapidez del giro, de 0 (quieto) a 1 (justo después del manotazo).
    const spinSpeedAt = (t: number) => (t < SWIPE || t >= SPIN_END ? 0 : Math.pow(1 - (t - SWIPE) / (SPIN_END - SWIPE), 3));

    // --- Impacto del manotazo: aro dorado y chispas en el borde del globo ---
    // El brazo de Bordy es corto y no llega a tocar el globo: el contacto se
    // cuenta con el salto y con este destello, como en los videojuegos.
    const GOLD = "#fcff52";
    const impactAt = new THREE.Vector3(0.62, -0.7, 0.36).normalize().multiplyScalar(R).add(new THREE.Vector3(0, GLOBE_Y, 0));
    const ringMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 48), ringMat);
    ring.position.copy(impactAt);
    scene.add(ring);
    const sparkGeo = new THREE.PlaneGeometry(0.07, 0.07);
    const sparks = Array.from({ length: 8 }, (_, k) => {
      const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: k % 2 ? GOLD : "#ffffff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      const a = (k / 8) * Math.PI * 2 + 0.3;
      scene.add(m);
      return { m, dir: new THREE.Vector3(Math.cos(a), Math.sin(a), 0.2) };
    });
    // Estelas de velocidad: arcos que dan vueltas alrededor del globo mientras
    // gira rápido y se apagan al frenar.
    const streakMat = new THREE.MeshBasicMaterial({ color: "#e9d5ff", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const streaks = new THREE.Group();
    streaks.position.set(0, GLOBE_Y, 0);
    for (let k = 0; k < 3; k++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(R * (1.06 + k * 0.05), 0.012, 6, 64, Math.PI * 0.55), streakMat);
      arc.rotation.x = Math.PI / 2 + 0.18; // casi en el ecuador, algo inclinado hacia la cámara
      arc.rotation.z = (k * Math.PI * 2) / 3;
      streaks.add(arc);
    }
    scene.add(streaks);

    // --- Bordy ---
    const rig = buildBordy();
    rig.root.position.set(0, BORDY_Y, BORDY_Z);
    rig.root.scale.setScalar(BORDY_S);
    scene.add(rig.root);
    const vctx = rig.visorCanvas.getContext("2d")!;

    // --- Banderas ---
    interface Pin { code: string; local: THREE.Vector3; card: THREE.Mesh; img: HTMLImageElement; mats: THREE.MeshBasicMaterial[] }
    const pins: Pin[] = [];
    // 16:11, la proporción del lienzo de flagCardCanvas (256x176).
    const cardGeo = new THREE.PlaneGeometry(0.52, 0.3575);
    const textures: THREE.Texture[] = [];
    function addPins(list: { code: string; at: [number, number] }[]) {
      for (const p of list) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = `https://flagcdn.com/w160/${p.code.toLowerCase()}.png`;
        // La tarjeta es la bandera con un borde oscuro que sigue su silueta
        // (Nepal no es un rectángulo: con un fondo rectangular se veía el
        // hueco relleno de oscuro).
        const tex = new THREE.CanvasTexture(flagCardCanvas(img));
        tex.colorSpace = THREE.SRGBColorSpace;
        img.onload = () => {
          tex.image = flagCardCanvas(img);
          tex.needsUpdate = true;
        };
        textures.push(tex);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
        const card = new THREE.Mesh(cardGeo, mat);
        card.visible = false;
        scene.add(card);
        pins.push({ code: p.code, local: lonLatToVec(p.at[0], p.at[1], R * 1.02), card, img, mats: [mat] });
      }
    }

    // --- Encuadre: que globo y Bordy quepan en cualquier pantalla ---
    let baseDist = 12;
    const lookY = -0.33;
    function resize() {
      const w = wrap!.clientWidth, h = wrap!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // A lo ancho manda el globo: en un celular ocupa el 83 % del ancho
      // (antes, 75 %: se veía chico). Más ancho tapaba el título y cortaba
      // las banderas de los bordes.
      baseDist = Math.max(3.05 / tanV, (R * 1.2) / (tanV * camera.aspect));
      camera.updateProjectionMatrix();
    }

    // Posición en el mundo de un punto del globo en el instante t.
    const tmpV = new THREE.Vector3();
    function globePointAt(local: THREE.Vector3, t: number, out: THREE.Vector3) {
      const keepSpin = globe.rotation.y, keepScale = globeTilt.scale.x;
      globe.rotation.y = spinAt(t);
      globeTilt.scale.setScalar(globeScaleAt(t));
      globeTilt.updateMatrixWorld(true);
      out.copy(local);
      globe.localToWorld(out);
      globe.rotation.y = keepSpin;
      globeTilt.scale.setScalar(keepScale);
      globeTilt.updateMatrixWorld(true);
      return out;
    }

    // --- Un cuadro en el instante t ---
    let visorKey = "";
    const visorPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), pc = new THREE.Vector3();

    function render(t: number) {
      // Cámara: se acerca al empezar y da un pequeño paso al «¡YA!».
      const dolly = 1 + 0.05 * (1 - easeOut(t / 1600)) - 0.03 * easeOut((t - GO) / 400);
      camera.position.set(0, lookY, baseDist * dolly);
      camera.lookAt(0, lookY, 0);
      camera.getWorldDirection(camDir);

      // Globo.
      globe.rotation.y = spinAt(t);
      globeTilt.scale.setScalar(globeScaleAt(t));
      halo.scale.setScalar(globeScaleAt(t));
      globeTilt.updateMatrixWorld(true);

      // Bordy: flota; mira al globo mientras brotan las banderas; recibe cada
      // una con un pequeño golpe; se gira hacia ti y salta con estiramiento.
      const lookUp = easeInOut(t / 450) * (1 - easeInOut((t - (TURN - 250)) / 400));
      let recoil = 0;
      for (let i = 0; i < pins.length; i++) {
        const dt = t - landAt(i);
        if (dt > 0 && dt < 260) recoil += Math.sin((dt / 260) * Math.PI) * 0.07 * (1 - dt / 260);
      }
      const turn = easeOut((t - TURN) / TURN_MS);
      rig.root.rotation.y = BORDY_TURNED * (1 - turn);
      rig.body.rotation.x = -0.24 * lookUp + recoil;
      // La ruleta: sube el brazo (anticipación), barre por encima de la cabeza
      // en el manotazo y vuelve. El cuerpo acompaña: se carga hacia el brazo y
      // se suelta hacia el otro lado.
      const raise = easeOut((t - WIND) / WIND_MS);
      const swipe = easeInOut((t - SWIPE) / SWIPE_MS);
      const back = easeInOut((t - (SWIPE + SWIPE_MS + 160)) / 380);
      const spinArm = (2.25 * raise + 0.95 * swipe) * (1 - back);
      rig.body.rotation.z = (-0.1 * raise + 0.24 * swipe) * (1 - back);
      // Salto: anticipación (aplasta), vuelo (estira) y aterrizaje (aplasta y vuelve).
      const h = (t - HOP) / HOP_MS;
      let jump = 0, sx = 1, sy = 1;
      if (h > 0 && h < 1) {
        if (h < 0.15) { const k = Math.sin((h / 0.15) * Math.PI / 2); sy = 1 - 0.1 * k; sx = 1 + 0.06 * k; }
        else if (h < 0.75) { const k = (h - 0.15) / 0.6; jump = Math.sin(k * Math.PI) * 0.55; sy = 1 + 0.08 * Math.sin(k * Math.PI); sx = 1 - 0.04 * Math.sin(k * Math.PI); }
        else { const k = (h - 0.75) / 0.25; const s = Math.sin(k * Math.PI); sy = 1 - 0.08 * s; sx = 1 + 0.05 * s; }
      }
      // Salto del manotazo: se agacha al tomar impulso y salta para alcanzar el
      // globo; pega en lo alto del salto y vuelve a caer.
      const sj = (t - (WIND + 40)) / 560;
      if (sj > 0 && sj < 1) {
        if (sj < 0.18) { const k = Math.sin((sj / 0.18) * Math.PI / 2); sy *= 1 - 0.1 * k; sx *= 1 + 0.06 * k; }
        else { const k = (sj - 0.18) / 0.82; jump += Math.sin(k * Math.PI) * 0.62; sy *= 1 + 0.07 * Math.sin(k * Math.PI); }
      }
      const float = Math.sin(t * 0.0026) * 0.05;
      rig.root.position.y = BORDY_Y + float + jump;
      rig.root.scale.set(BORDY_S * sx, BORDY_S * sy, BORDY_S * sx);
      // Brazos: se mecen, se abren al recibir y suben al festejar.
      const cheer = easeOut((t - HOP) / 220) * (1 - easeOut((t - (HOP + HOP_MS + 150)) / 300));
      const catchArms = clamp01(recoil * 8);
      const sway = Math.sin(t * 0.0045) * 0.1;
      rig.arms[0].rotation.z = -0.35 - sway - 0.35 * catchArms - 1.9 * cheer;
      rig.arms[1].rotation.z = 0.35 + sway + 0.35 * catchArms + 1.9 * cheer + spinArm;
      rig.bulb.scale.setScalar(t > GO ? 1 + 0.25 * Math.max(0, Math.sin(((t - GO) / 500) * Math.PI)) : 1);

      // Impacto: el aro crece y se apaga; las chispas salen disparadas.
      const ip = (t - (SWIPE + 50)) / 320;
      if (ip > 0 && ip < 1) {
        ring.visible = true;
        ring.quaternion.copy(camera.quaternion);
        ring.scale.setScalar(0.4 + 2.2 * easeOut(ip));
        ringMat.opacity = 1 - ip;
        sparks.forEach(({ m, dir }, k) => {
          m.visible = true;
          m.quaternion.copy(camera.quaternion);
          m.position.copy(impactAt).addScaledVector(dir, 0.15 + 0.75 * easeOut(ip) * (0.8 + 0.4 * (k % 3) / 2));
          m.rotateZ(ip * 4);
          (m.material as THREE.MeshBasicMaterial).opacity = 1 - ip;
        });
      } else {
        ring.visible = false;
        sparks.forEach(({ m }) => (m.visible = false));
      }
      // Estelas: giran con el globo y se ven solo mientras va rápido.
      const sp = spinSpeedAt(t);
      streaks.visible = sp > 0.02;
      streaks.rotation.y = globe.rotation.y * 1.0;
      streakMat.opacity = 0.55 * sp;

      // Visor: prisma con ojos → cada bandera que llega → ojos felices.
      let landed = -1;
      for (let i = 0; i < pins.length; i++) if (t >= landAt(i)) landed = i;
      const happy = t >= TURN + 60;
      const flash = !happy && landed >= 0 ? clamp01(1 - (t - landAt(landed)) / FLASH_MS) : 0;
      const key = happy ? "happy" : landed >= 0 ? `f${landed}:${Math.round(flash * 20)}` : "eyes";
      if (key !== visorKey) {
        visorKey = key;
        if (happy) paintVisorHappy(vctx);
        else if (landed >= 0) paintVisorFlag(vctx, pins[landed].img, flash, flash * 12);
        else paintVisorPrism(vctx);
        rig.refreshVisor();
      }
      rig.pupils.forEach((p) => (p.visible = landed < 0 && !happy));
      // Con bandera, menos brillo propio: con el del prisma (1,15) los colores
      // de la bandera salían lavados por el tono de la escena.
      rig.visorMat.emissiveIntensity = landed >= 0 && !happy ? 0.72 + 0.45 * flash : 1.15;

      // Banderas: brotan sobre su país, vuelan hacia la cámara y bajan al visor.
      rig.root.updateMatrixWorld(true);
      rig.visor.getWorldPosition(visorPos);
      visorPos.z += 0.25;
      pins.forEach((p, i) => {
        const born = (t - (PIN_0 + i * PIN_GAP)) / PIN_MS;
        const fly = (t - flyAt(i)) / FLY_MS;
        const card = p.card;
        if (born <= 0 || fly >= 1) { card.visible = false; return; }
        card.visible = true;
        card.quaternion.copy(camera.quaternion); // siempre de frente
        if (fly <= 0) {
          // En el globo: sigue a su país; se esconde si queda del otro lado.
          globePointAt(p.local, t, p0);
          tmpV.copy(p0).sub(globeTilt.position).normalize();
          const facing = -tmpV.dot(camDir);
          card.position.copy(p0).addScaledVector(tmpV, 0.12);
          card.scale.setScalar((0.45 + 0.55 * easeBack(born)) * 0.78);
          const op = clamp01(born * 3) * clamp01((facing - 0.05) * 5);
          p.mats.forEach((m) => (m.opacity = op));
        } else {
          // En vuelo: curva que pasa cerca de la cámara y cae en el visor.
          globePointAt(p.local, flyAt(i), p0);
          tmpV.copy(p0).sub(globeTilt.position).normalize();
          p0.addScaledVector(tmpV, 0.12);
          p1.copy(visorPos);
          pc.copy(p0).lerp(p1, 0.5);
          pc.y += 1.1;
          pc.z += 3.0;
          pc.x += (i % 2 ? 1 : -1) * 0.5;
          const e = easeInOut(fly);
          const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
          card.position.set(a * p0.x + b * pc.x + c * p1.x, a * p0.y + b * pc.y + c * p1.y, a * p0.z + b * pc.z + c * p1.z);
          card.scale.setScalar(0.78 * (1 + 0.85 * Math.sin(e * Math.PI)) * (1 - 0.72 * e));
          p.mats.forEach((m) => (m.opacity = 1 - clamp01((fly - 0.9) * 10)));
          card.rotateZ((i % 2 ? 1 : -1) * Math.sin(e * Math.PI) * 0.35);
        }
      });

      renderer.render(scene, camera);
    }

    // --- Bucle ---
    let raf = 0;
    let t0 = 0;
    let started = false;
    let alive = true;
    let pinsFired = 0, landedFired = 0;
    let lastNotch = Math.floor((restSpin - total) / (Math.PI / 9));
    let lastTickAt = -1e9;
    let goOn = false;

    function frame(now: number) {
      if (!alive) return;
      const scrubT = scrubRef.current;
      const live = scrubT == null;
      const t = !live ? scrubT : reduced ? END - 300 : started ? now - t0 : 0;
      render(t);
      if (live && started && !reduced) {
        // Ruleta: un tic cada 20° de giro (como los topes de una ruleta), con
        // un mínimo de 45 ms entre tics. Al frenar, se espacian solos.
        if (t >= SWIPE && t < SPIN_END + 200) {
          const notch = Math.floor(globe.rotation.y / (Math.PI / 9));
          if (notch !== lastNotch && now - lastTickAt > 45) { sfxTick(); lastTickAt = now; }
          lastNotch = notch;
        }
        while (pinsFired < pins.length && t >= PIN_0 + pinsFired * PIN_GAP) { pinsFired++; sfxPop(); }
        while (landedFired < pins.length && t >= landAt(landedFired)) {
          if (landedFired === 0) sfxHint();
          landedFired++;
        }
        if (t >= END) return finish();
      }
      const g = t >= GO;
      if (g !== goOn) {
        goOn = g;
        setShowGo(g);
        if (g && live && !reduced) sfxGood();
      }
      raf = requestAnimationFrame(frame);
    }
    function begin() {
      if (started || !alive) return;
      started = true;
      t0 = performance.now();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    raf = requestAnimationFrame(frame);

    let fallback: ReturnType<typeof setTimeout> | undefined;
    let closeReduced: ReturnType<typeof setTimeout> | undefined;
    if (reduced) closeReduced = setTimeout(finish, 1400);
    else fallback = setTimeout(begin, ATLAS_WAIT);
    void loadAtlas()
      .then((map) => {
        if (!alive) return;
        paintWorld(wctx, Array.from(map.values()));
        worldTex.needsUpdate = true;
        if (!reduced) addPins(pickPins(map, view));
        begin();
      })
      .catch(() => begin());

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      clearTimeout(closeReduced);
      ro.disconnect();
      rig.dispose();
      textures.forEach((x) => x.dispose());
      worldTex.dispose();
      cardGeo.dispose();
      ring.geometry.dispose();
      ringMat.dispose();
      sparkGeo.dispose();
      sparks.forEach(({ m }) => (m.material as THREE.Material).dispose());
      streaks.children.forEach((c) => (c as THREE.Mesh).geometry.dispose());
      streakMat.dispose();
      pins.forEach((p) => p.mats.forEach((m) => m.dispose()));
      globe.geometry.dispose();
      (globe.material as THREE.Material).dispose();
      halo.geometry.dispose();
      (halo.material as THREE.Material).dispose();
      renderer.dispose();
    };
    // La escena se monta una vez: sus props no cambian en vida.
  }, []);

  return (
    <div
      role="dialog"
      aria-label={title}
      onClick={finish}
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: "var(--body-grad)" }}
    >
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
      </div>
      <p className="intro-fade pointer-events-none absolute inset-x-0 top-[6%] text-center font-display text-xs font-bold uppercase tracking-[0.22em] text-lavender">
        🚩 {title}
      </p>
      {showGo && (
        <span className="intro-go pointer-events-none absolute inset-x-0 top-[30%] flex justify-center font-display text-7xl font-black text-gold [text-shadow:4px_4px_0_var(--deep)]">
          {go}
        </span>
      )}
      <p className="intro-fade pointer-events-none absolute inset-x-0 bottom-[4%] text-center text-[11px] text-neutral-400" style={{ animationDelay: "600ms" }}>
        {skip}
      </p>
    </div>
  );
}
