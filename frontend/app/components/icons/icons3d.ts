// ============================================================
//  Iconos 3D de Frontle — renders inflados a partir de la silueta.
//
//  Cada icono 3D sale de la MISMA definición que el plano (FrontleIcon):
//  cada parte de color se extruye con un bisel generoso ("inflado") y los
//  detalles oscuros quedan como trazos en relieve encima. Así los dos
//  comparten silueta y el 3D se lee bien incluso a 24 px.
//
//  Material: el plástico brillante con barniz de Bordy, más un entorno de
//  estudio (RoomEnvironment) que le da reflejos de producto. Un solo
//  WebGLRenderer para todos; cada icono sale como imagen (data URL). Lo
//  normal es renderizarlos una vez y guardarlos como WebP en /public.
//
//  `neo: true` le pone encima el lenguaje del landing: contorno oscuro
//  grueso y sombra dura desplazada, compuestos sobre el render en 2D.
// ============================================================

import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ICON_DEFS, ICON_TONES, type IconName, type IconTone } from "./FrontleIcon";
import { NEO_BORDER, NEO_SHADOW } from "./neo";

const loader = new SVGLoader();

function pathShapes(d: string) {
  const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${d}"/></svg>`);
  return data.paths.flatMap((p) => SVGLoader.createShapes(p));
}

function strokeGeometry(d: string, width: number) {
  const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${d}" fill="none" stroke="#000" stroke-width="${width}"/></svg>`);
  const geos: THREE.BufferGeometry[] = [];
  for (const p of data.paths) {
    const style = SVGLoader.getStrokeStyle(width, "#000", "round", "round", 4);
    for (const sub of p.subPaths) {
      const g = SVGLoader.pointsToStroke(sub.getPoints(24), style);
      if (g) geos.push(g);
    }
  }
  return geos;
}

const plastic = (tone: IconTone) =>
  new THREE.MeshPhysicalMaterial({
    color: ICON_TONES[tone],
    roughness: tone === "deep" ? 0.45 : 0.32,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.55,
    // Un poco de brillo propio en el dorado: con el tono de la escena el
    // amarillo de la marca se volvía oliva.
    emissive: tone === "gold" ? "#fcff52" : "#000000",
    emissiveIntensity: tone === "gold" ? 0.08 : 0,
  });

/** Arma el icono inflado. Unidades de la cuadrícula de 32 del icono plano. */
function buildPuffy(name: IconName) {
  const def = ICON_DEFS[name];
  const g = new THREE.Group();
  const DEPTH = 2.2, LAYER = 1.4;
  def.parts.forEach((part, i) => {
    const geo = new THREE.ExtrudeGeometry(pathShapes(part.d), {
      depth: DEPTH, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.0, bevelSegments: 6, curveSegments: 24,
    });
    const m = new THREE.Mesh(geo, plastic(part.fill));
    m.position.z = i * LAYER;
    g.add(m);
  });
  const top = (def.parts.length - 1) * LAYER + DEPTH + 1.5 + 0.05;
  (def.details ?? []).forEach((d) => {
    if (d.stroke === "white") return; // los brillos los pone la luz de verdad
    if (d.fill) {
      const geo = new THREE.ExtrudeGeometry(pathShapes(d.d), { depth: 0.5, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 3, curveSegments: 20 });
      const m = new THREE.Mesh(geo, plastic(d.fill));
      m.position.z = top;
      g.add(m);
    }
    if (d.stroke) {
      for (const sg of strokeGeometry(d.d, d.width ?? 2)) {
        const m = new THREE.Mesh(sg, plastic(d.stroke));
        m.position.z = top + (d.fill ? 1.25 : 0.02);
        g.add(m);
      }
    }
  });
  // El SVG tiene la y hacia abajo: se voltea el grupo (three.js corrige la
  // orientación de las caras con escala negativa) y se centra.
  g.scale.set(1, -1, 1);
  g.position.set(-16, 16, 0);
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

// --- Render ---------------------------------------------------------------

let shared: { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; env: THREE.Texture } | null = null;
function getRenderer() {
  if (!shared) {
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    // Tono neutro: ACES desaturaba los colores fuertes de la marca (el oro
    // salía crema, el cian y el fucsia pastel).
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    shared = { renderer, canvas, env };
  }
  return shared;
}

function renderRaw(name: IconName, size: number): HTMLCanvasElement {
  const { renderer, canvas, env } = getRenderer();
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.environment = env;
  // Llave cálida arriba a la izquierda y contraluz lavanda, como Bordy.
  scene.add(new THREE.AmbientLight("#9aa3c4", 0.25));
  const key = new THREE.DirectionalLight("#fff4e0", 1.3);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#b79ced", 1.4);
  rim.position.set(5, 1, -3);
  scene.add(rim);
  const obj = buildPuffy(name);
  // Un leve tres cuartos: se nota el volumen sin perder la silueta.
  obj.rotation.set(0.22, -0.32, 0);
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  const radius = Math.max(sz.x, sz.y) / 2;
  const cam = new THREE.PerspectiveCamera(24, 1, 1, 2000);
  const dist = (radius / Math.tan(THREE.MathUtils.degToRad(12))) * 1.12;
  cam.position.set(center.x, center.y, center.z + dist);
  cam.lookAt(center);
  renderer.clear();
  renderer.render(scene, cam);
  // Copia a un lienzo propio (el del renderer se reutiliza).
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  out.getContext("2d")!.drawImage(canvas, 0, 0);
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | undefined;
    if (mat && !Array.isArray(mat)) mat.dispose();
  });
  return out;
}

// Contorno grueso y sombra dura del landing, sobre la silueta del render.
//
// Antes el render se ENCOGÍA para dejarle sitio al contorno dentro del mismo
// lienzo, y el icono con borde quedaba un 16 % más chico que el mismo icono
// sin borde (David, 19-nov). Ahora el 3D va a tamaño completo y el lienzo
// crece hacia afuera: el borde y la sombra quedan POR FUERA de la caja del
// icono, como en un botón del landing. Icon3D los deja desbordar.
function neoComposite(src: HTMLCanvasElement) {
  const size = src.width;
  const border = Math.round(size * NEO_BORDER);
  const shadow = Math.round(size * NEO_SHADOW);
  const out = document.createElement("canvas");
  out.width = size + border * 2 + shadow;
  out.height = size + border * 2 + shadow;
  const ctx = out.getContext("2d")!;
  const sil = document.createElement("canvas");
  sil.width = size;
  sil.height = size;
  const s = sil.getContext("2d")!;
  s.drawImage(src, 0, 0);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = ICON_TONES.deep;
  s.fillRect(0, 0, size, size);
  // Sombra dura (la silueta engordada, corrida abajo a la derecha)…
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    ctx.drawImage(sil, border + shadow + Math.cos(a) * border, border + shadow + Math.sin(a) * border);
  }
  // …el contorno…
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    ctx.drawImage(sil, border + Math.cos(a) * border, border + Math.sin(a) * border);
  }
  // …y el icono encima, a tamaño completo.
  ctx.drawImage(src, border, border);
  return out;
}

/** Icono 3D como imagen (data URL), fondo transparente. Con `neo`, el lienzo
 *  mide size·(1 + 2·NEO_BORDER + NEO_SHADOW) y el icono empieza en NEO_BORDER. */
export function renderIcon3D(name: IconName, size = 256, neo = false, type = "image/png"): string {
  const raw = renderRaw(name, size);
  const img = neo ? neoComposite(raw) : raw;
  return img.toDataURL(type, 0.92);
}
