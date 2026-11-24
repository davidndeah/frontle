"use client";

// ============================================================
//  PRUEBA (laboratorio): Bordy en 3D con three.js.
//
//  El modelo es el original (components/bordy3d/model.ts, sacado de
//  frontend/public/bordy-hero.html). Aquí solo se mueve: flota, mece los
//  brazos y cada 3 s se gira hacia ti. Con `flagCode`, el visor muestra la
//  bandera como en la entrada de Flag Rush. Sirvió para medir: 61 fps en el
//  celular de David (17-nov).
// ============================================================

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { addBordyLights, buildBordy, paintVisorFlag } from "../../components/bordy3d/model";

export default function Bordy3D({ flagCode, onFps }: { flagCode?: string; onFps?: (fps: number) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
    cam.position.set(0.55, 1.05, 6.6);
    cam.lookAt(0, 0.55, 0);
    addBordyLights(scene);
    const rig = buildBordy();
    rig.root.rotation.y = -0.16;
    scene.add(rig.root);

    if (flagCode) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        rig.pupils.forEach((p) => (p.visible = false));
        paintVisorFlag(rig.visorCanvas.getContext("2d")!, img);
        rig.refreshVisor();
      };
      img.src = `https://flagcdn.com/w160/${flagCode.toLowerCase()}.png`;
    }

    let raf = 0;
    const t0 = performance.now();
    let frames = 0;
    let lastFps = t0;
    const REST = -0.16;
    const e = (x: number) => 1 - Math.pow(1 - x, 3);
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      rig.root.position.y = Math.sin(t * 1.4) * 0.06;
      const cycle = t % 3;
      rig.root.rotation.y = cycle < 1.2 ? -0.9 : cycle < 1.7 ? -0.9 + (REST + 0.9) * e((cycle - 1.2) / 0.5) : REST;
      rig.arms[0].rotation.z = -0.35 - Math.sin(t * 2.2) * 0.12;
      rig.arms[1].rotation.z = 0.35 + Math.sin(t * 2.2) * 0.12;
      renderer.render(scene, cam);
      frames++;
      if (now - lastFps >= 1000) {
        onFps?.(Math.round((frames * 1000) / (now - lastFps)));
        frames = 0;
        lastFps = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      rig.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [flagCode, onFps]);

  return <div ref={mountRef} className="h-full w-full" />;
}
