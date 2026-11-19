"use client";

// Laboratorio (solo desarrollo): dibuja todos los iconos 3D con borde
// neobrutal y los guarda como WebP en public/icons/neo/ vía /api/lab/iconos.
// Se corre una vez cada vez que cambia un icono; la app usa los WebP y no
// carga three.js.

import { useState } from "react";
import { ICON_NAMES } from "../../../components/icons/FrontleIcon";

const ICON_PX = 192; // 3x del icono más grande de la app (64 px)

export default function ExportarIconos() {
  const [log, setLog] = useState<string[]>([]);
  const run = async () => {
    const { renderIcon3D } = await import("../../../components/icons/icons3d");
    for (const n of ICON_NAMES) {
      await new Promise((r) => setTimeout(r, 0));
      const dataUrl = renderIcon3D(n, ICON_PX, true, "image/webp");
      const res = await fetch("/api/lab/iconos", { method: "POST", body: JSON.stringify({ name: n, dataUrl }) });
      const j = res.ok ? await res.json() : { bytes: 0 };
      setLog((l) => [...l, `${n}: ${res.ok ? `${j.bytes} B` : `error ${res.status}`}`]);
    }
    setLog((l) => [...l, "listo"]);
  };
  return (
    <main className="min-h-dvh p-6 text-white">
      <button onClick={run} className="btn-3d px-5 py-3 font-bold">Exportar iconos</button>
      <pre id="log" className="mt-4 text-xs">{log.join("\n")}</pre>
    </main>
  );
}
