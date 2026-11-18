// ============================================================
//  Bordy 3D — el modelo original.
//
//  Es el mismo de frontend/public/bordy-hero.html con la paleta M2: de ahí
//  salió el render bordy-m2.webp que el juego usa desde julio (comparados
//  lado a lado el 17-nov: idénticos). Aquí solo se separa en piezas para
//  poder animarlas y se le da al visor una pantalla dibujable.
//
//  En un celular corre a 61 fps (medido por David el 17-nov). three.js pesa
//  120 KB comprimido y entra solo en las pantallas que lo importan.
// ============================================================

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Paleta M2 de bordy-hero.html.
export const BORDY_PAL = {
  body: "#1b2a4a", face: "#0b1120", acc1: "#B79CED", acc2: "#8b5cf6", antenna: "#FCFF52", chest: "#FCFF52",
  visor: ["#22d3ee", "#22c55e", "#fbbf24", "#e879f9"], rimL: "#B79CED", rimR: "#FCFF52", metal: 0.15,
};

export interface BordyRig {
  /** Todo Bordy. Su origen está entre los pies; mide ~3 unidades de alto. */
  root: THREE.Group;
  /** Cuerpo con su pose (lo que se ladea, salta y se aplasta). */
  body: THREE.Group;
  visor: THREE.Mesh;
  visorMat: THREE.MeshPhysicalMaterial;
  /** Lienzo que se ve en el visor (512x176). Tras dibujar: `refreshVisor()`. */
  visorCanvas: HTMLCanvasElement;
  refreshVisor: () => void;
  pupils: THREE.Mesh[];
  /** Pivotes de los hombros: rotation.z levanta el brazo (±0,35 en reposo). */
  arms: THREE.Object3D[];
  bulb: THREE.Mesh;
  dispose: () => void;
}

/** Arma a Bordy. La forma es la de bordy-hero.html, sin cambios. */
export function buildBordy(): BordyRig {
  const P = BORDY_PAL;
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.position.y = -0.1;
  root.add(g);

  const soft = (color: string, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.26, metalness: P.metal, clearcoat: 1, clearcoatRoughness: 0.16, ...extra });
  const bodyMat = soft(P.body), faceMat = soft(P.face);

  const head = new THREE.Mesh(new RoundedBoxGeometry(1.85, 1.45, 1.5, 10, 0.62), bodyMat);
  head.position.y = 1.18;
  g.add(head);
  for (const s of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), soft(s < 0 ? P.acc1 : P.acc2));
    pod.position.set(1.0 * s, 1.2, 0);
    pod.scale.set(0.55, 1, 1);
    g.add(pod);
  }
  const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 6, 12), faceMat);
  stem.position.y = 2.05;
  g.add(stem);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), soft(P.antenna, { emissive: P.antenna, emissiveIntensity: 0.9 }));
  bulb.position.y = 2.26;
  g.add(bulb);

  // Visor: la pantalla. El lienzo arranca con el degradado prisma del render.
  const visorCanvas = document.createElement("canvas");
  visorCanvas.width = 512;
  visorCanvas.height = 176;
  const visorTex = new THREE.CanvasTexture(visorCanvas);
  visorTex.colorSpace = THREE.SRGBColorSpace;
  const visorMat = new THREE.MeshPhysicalMaterial({
    map: visorTex, emissiveMap: visorTex, emissive: "#ffffff", emissiveIntensity: 1.15, roughness: 0.14, clearcoat: 1,
  });
  const visor = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.52, 0.24, 8, 0.24), visorMat);
  visor.position.set(0, 1.24, 0.72);
  g.add(visor);
  paintVisorPrism(visorCanvas.getContext("2d")!);
  visorTex.needsUpdate = true;

  const pupils: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), new THREE.MeshBasicMaterial({ color: "#0b0f1c" }));
    pupil.position.set(0.3 * s, 1.25, 0.87);
    g.add(pupil);
    pupils.push(pupil);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 12, 24, Math.PI * 0.75), soft(P.acc2, { emissive: P.acc2, emissiveIntensity: 0.5 }));
  smile.position.set(0, 0.92, 0.78);
  smile.rotation.z = Math.PI + 0.38;
  g.add(smile);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.42, 10, 24), bodyMat);
  torso.position.y = 0.02;
  torso.scale.set(1.15, 1, 0.95);
  g.add(torso);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 14, 32), faceMat);
  ring.position.set(0, 0.12, 0.53);
  g.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 20), soft(P.chest, { emissive: P.chest, emissiveIntensity: 1.1 }));
  core.position.set(0, 0.12, 0.55);
  g.add(core);
  // Brazos: cuelgan de un pivote en el HOMBRO (el extremo de arriba de la
  // cápsula). Si giraran sobre su centro, una cápsula girada casi media
  // vuelta se ve igual que quieta y el brazo nunca parecería levantarse. En
  // reposo (pivote a ±0,35 rad) quedan exactamente donde los pone el render.
  const arms: THREE.Object3D[] = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.77 * s, 0.37, 0.05);
    shoulder.rotation.z = 0.35 * s;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.2, 8, 16), soft(s < 0 ? P.acc1 : P.acc2));
    arm.position.y = -0.23; // media cápsula hacia abajo: el hombro es su punta
    shoulder.add(arm);
    g.add(shoulder);
    arms.push(shoulder);
  }
  for (const s of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 20), faceMat);
    foot.position.set(0.3 * s, -0.52, 0.08);
    foot.scale.set(1.1, 0.62, 1.25);
    g.add(foot);
  }

  return {
    root, body: g, visor, visorMat, visorCanvas,
    refreshVisor: () => { visorTex.needsUpdate = true; },
    pupils, arms, bulb,
    dispose: () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      visorTex.dispose();
    },
  };
}

/** Las luces de bordy-hero.html: llave cálida y dos contraluces de color. */
export function addBordyLights(scene: THREE.Scene) {
  const P = BORDY_PAL;
  scene.add(new THREE.AmbientLight("#9aa3c4", 0.62));
  const key = new THREE.DirectionalLight("#fff4e0", 2.2);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rL = new THREE.DirectionalLight(P.rimL, 2.5);
  rL.position.set(-4, 1.6, -2);
  scene.add(rL);
  const rR = new THREE.DirectionalLight(P.rimR, 2.5);
  rR.position.set(4, 1.2, -2.4);
  scene.add(rR);
}

// ---------------------------------------------------------------------------
//  La pantalla del visor. Todo se dibuja en el lienzo de 512x176 y el
//  material lo emite (por eso se ve encendido). Tres caras:
//   · prisma — el degradado del render (con los ojos 3D encima)
//   · bandera — la bandera ENTERA al centro y, de fondo, la misma bandera
//     desenfocada llenando el visor (como un video vertical en una pantalla
//     ancha). Nunca se recorta: el visor mide 2,9:1 y una bandera 3:2.
//   · feliz — los ojos "^ ^" dibujados (los ojos 3D se ocultan)
//  Encima de las dos últimas van líneas de pantalla y el brillo del vidrio.
// ---------------------------------------------------------------------------

export function paintVisorPrism(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  const gr = ctx.createLinearGradient(0, 0, w, 0);
  BORDY_PAL.visor.forEach((col, i) => gr.addColorStop(i / (BORDY_PAL.visor.length - 1), col));
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
}

function screenFinish(ctx: CanvasRenderingContext2D) {
  const { width: w, height: h } = ctx.canvas;
  // Líneas de pantalla.
  ctx.fillStyle = "rgba(6, 4, 20, 0.16)";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
  // Brillo del vidrio arriba y sombra abajo.
  const gl = ctx.createLinearGradient(0, 0, 0, h);
  gl.addColorStop(0, "rgba(255,255,255,0.28)");
  gl.addColorStop(0.32, "rgba(255,255,255,0.04)");
  gl.addColorStop(0.75, "rgba(0,0,0,0)");
  gl.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Bandera en el visor. `flash` (0..1) es el destello al entrar y `split`
 * (px) el corrimiento de color de la señal que llega; los dos se apagan solos
 * en pocos cuadros.
 */
export function paintVisorFlag(ctx: CanvasRenderingContext2D, img: HTMLImageElement, flash = 0, split = 0) {
  const { width: w, height: h } = ctx.canvas;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#0b0a14";
  ctx.fillRect(0, 0, w, h);
  if (img.complete && img.naturalWidth) {
    const ar = img.naturalWidth / img.naturalHeight;
    // Fondo: la misma bandera a todo lo ancho, desenfocada y oscurecida.
    ctx.filter = "blur(14px) saturate(1.3) brightness(0.62)";
    const bw = w * 1.15, bh = bw / ar;
    ctx.drawImage(img, (w - bw) / 2, (h - bh) / 2, bw, bh);
    ctx.filter = "none";
    // Centro: la bandera entera, a casi todo el alto.
    const fh = h * 0.86, fw = fh * ar;
    const fx = (w - fw) / 2, fy = (h - fh) / 2;
    if (split > 0.5) {
      // Corrimiento de color: dos copias teñidas a los lados.
      ctx.globalAlpha = 0.55;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(img, fx - split, fy, fw, fh);
      ctx.drawImage(img, fx + split, fy, fw, fh);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
    // Borde que sigue la silueta (Nepal no es un rectángulo) y la bandera.
    drawOutlined(ctx, img, fx, fy, fw, fh, 3);
  }
  screenFinish(ctx);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.45 * flash})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// Silueta oscura de la imagen (lo opaco, pintado de un color).
function silhouette(img: HTMLImageElement, w: number, h: number, color: string) {
  const c = document.createElement("canvas");
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0, w, h);
  x.globalCompositeOperation = "source-in";
  x.fillStyle = color;
  x.fillRect(0, 0, w, h);
  return c;
}

/**
 * Dibuja la bandera con un borde oscuro que sigue su silueta: la silueta se
 * estampa corrida en 16 direcciones y la bandera va encima. En una bandera
 * rectangular el resultado es el borde de siempre; en Nepal (que tiene
 * huecos transparentes) el borde abraza los dos triángulos y no queda un
 * rectángulo oscuro de fondo.
 */
export function drawOutlined(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, border: number, color = "#0d0420") {
  const sil = silhouette(img, w, h, color);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ctx.drawImage(sil, x + Math.cos(a) * border, y + Math.sin(a) * border, w, h);
  }
  ctx.drawImage(img, x, y, w, h);
}

/**
 * Tarjeta de bandera para el globo y el vuelo: la bandera entera (sin
 * recortar, con su forma) y su borde oscuro de silueta, sobre transparente.
 * 256x176 px, para un plano de proporción 16:11.
 */
export function flagCardCanvas(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 176;
  const ctx = c.getContext("2d")!;
  if (img.complete && img.naturalWidth) {
    const pad = 14;
    const ar = img.naturalWidth / img.naturalHeight;
    let fw = c.width - pad * 2, fh = fw / ar;
    if (fh > c.height - pad * 2) { fh = c.height - pad * 2; fw = fh * ar; }
    drawOutlined(ctx, img, (c.width - fw) / 2, (c.height - fh) / 2, fw, fh, 7);
  }
  return c;
}

/** Ojos felices "^ ^" sobre el prisma (los ojos 3D se ocultan aparte). */
export function paintVisorHappy(ctx: CanvasRenderingContext2D) {
  paintVisorPrism(ctx);
  const { height: h } = ctx.canvas;
  ctx.strokeStyle = "#0b0f1c";
  ctx.lineWidth = 15;
  ctx.lineCap = "round";
  // Mismas posiciones que los ojos 3D (±0,3 de 1,5 de visor → ±102 px).
  for (const cx of [256 - 102, 256 + 102]) {
    ctx.beginPath();
    ctx.moveTo(cx - 30, h * 0.6);
    ctx.quadraticCurveTo(cx, h * 0.22, cx + 30, h * 0.6);
    ctx.stroke();
  }
  screenFinish(ctx);
}
