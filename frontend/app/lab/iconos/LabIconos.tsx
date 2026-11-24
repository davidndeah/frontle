"use client";

// Laboratorio: tres direcciones de iconos para elegir UN estilo para toda la
// app (David, 17-nov: los planos tipo sticker se veían baratos, los 3D no
// llegaban y mezclar dos estilos no combina).
//   A · todo 3D estilo Bordy
//   B · 3D con contorno grueso y sombra dura del landing
//   C · glifos finos de un solo color
// Los mismos 12 iconos y las mismas piezas de la app en las tres. Los rótulos
// van a mano: esta página no se enlaza ni se traduce.

import { useEffect, useState } from "react";
import FrontleIcon, { type IconName } from "../../components/icons/FrontleIcon";
import { renderIcon3D } from "../../components/icons/icons3d";
import { NEO_BORDER, NEO_SHADOW } from "../../components/icons/neo";

const SET: IconName[] = ["globe", "modes", "podium", "bordy", "flag", "xp", "coin", "streak", "trophy", "bag", "gear", "share"];
type Dir = "a" | "b" | "c";
const DIRS: { id: Dir; name: string; note: string }[] = [
  { id: "a", name: "A · Todo 3D estilo Bordy", note: "Plástico brillante con reflejos de estudio, inflado a partir de la silueta." },
  { id: "b", name: "B · 3D con borde neobrutal", note: "El mismo 3D con el contorno grueso y la sombra dura del landing." },
  { id: "c", name: "C · Glifos finos", note: "Trazo fino de un solo color; el activo se pinta de oro." },
];
const T = {
  title: "Iconos · tres direcciones",
  set: "El set", context: "En la app",
  tabs: ["Inicio", "Modos", "Ranking", "Perfil"],
  play: "Jugar", mode: "Flag Rush", xp: "+6 XP",
  shop: "Tienda", settings: "Ajustes", share: "Compartir",
  loading: "Dibujando…",
};
const TAB_ICONS: IconName[] = ["globe", "modes", "podium", "bordy"];

type Renders = Partial<Record<IconName, string>>;

function Ico({ dir, name, size, renders, active = false }: { dir: Dir; name: IconName; size: number; renders: Renders; active?: boolean }) {
  if (dir === "c") {
    return <span style={{ color: active ? "var(--gold)" : "var(--ink)", display: "inline-flex" }}><FrontleIcon name={name} size={size} mono /></span>;
  }
  const src = renders[name];
  if (!src) return <span style={{ width: size, height: size }} className="inline-block animate-pulse rounded-full bg-white/10" />;
  if (dir === "b") {
    // El WebP con borde es más grande que la caja: el contorno y la sombra
    // sobresalen, y el dibujo 3D mide lo mismo que en A.
    const k = 1 + 2 * NEO_BORDER + NEO_SHADOW;
    return (
      <span className="relative inline-block flex-none" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ position: "absolute", maxWidth: "none", left: -NEO_BORDER * size, top: -NEO_BORDER * size, width: k * size, height: k * size }} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className="inline-block" />;
}

export default function LabIconos() {
  const [a, setA] = useState<Renders>({});
  const [b, setB] = useState<Renders>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const n of SET) {
        // Un respiro entre iconos para no trabar la página mientras dibuja.
        await new Promise((r) => setTimeout(r, 0));
        if (!alive) return;
        const ra = renderIcon3D(n, 256, false);
        const rb = renderIcon3D(n, 256, true);
        setA((x) => ({ ...x, [n]: ra }));
        setB((x) => ({ ...x, [n]: rb }));
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1180px] flex-col gap-6 px-4 py-6 text-white">
      <h1 className="font-display text-2xl font-bold">{T.title}</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        {DIRS.map((d) => {
          const r = d.id === "a" ? a : b;
          return (
            <section key={d.id} className="flex flex-col gap-4 rounded-3xl border-2 border-deep bg-[#1c0b3e] p-4" style={{ boxShadow: "5px 5px 0 var(--deep)" }}>
              <div>
                <h2 className="font-display text-lg font-bold">{d.name}</h2>
                <p className="text-sm text-neutral-300">{d.note}</p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{T.set}</p>
                <div className="grid grid-cols-4 gap-2">
                  {SET.map((n) => (
                    <div key={n} className="flex flex-col items-center gap-1 rounded-xl bg-black/20 p-2">
                      <Ico dir={d.id} name={n} size={44} renders={r} />
                      <div className="flex items-end gap-1"><Ico dir={d.id} name={n} size={24} renders={r} /><Ico dir={d.id} name={n} size={16} renders={r} /></div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{T.context}</p>
                {/* Contadores */}
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="inline-flex items-center gap-1"><Ico dir={d.id} name="streak" size={20} renders={r} /> 4</span>
                  <span className="inline-flex items-center gap-1"><Ico dir={d.id} name="coin" size={20} renders={r} /> 35</span>
                  <span className="inline-flex items-center gap-1 text-gold"><Ico dir={d.id} name="xp" size={20} renders={r} /> +6</span>
                </div>
                {/* Botón principal */}
                <button className="btn-3d flex items-center justify-center gap-2 py-3 font-display text-lg font-bold">
                  <Ico dir={d.id} name="flag" size={26} renders={r} /> {T.play}
                </button>
                {/* Ficha de modo */}
                <div className="flex gap-3">
                  <div className="w-[48%] overflow-hidden rounded-2xl border-2 border-deep bg-surface" style={{ boxShadow: "4px 4px 0 var(--deep)" }}>
                    <div className="flex h-[84px] items-center justify-center" style={{ background: "linear-gradient(160deg, #14607a, #0b3348)" }}>
                      <Ico dir={d.id} name="flag" size={64} renders={r} />
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="font-display text-xs font-bold">{T.mode}</span>
                      <span className="text-[10px] font-bold text-gold">{T.xp}</span>
                    </div>
                  </div>
                  {/* Tienda, ajustes, compartir */}
                  <div className="flex flex-1 flex-col gap-1.5">
                    {([["bag", T.shop], ["gear", T.settings], ["share", T.share]] as [IconName, string][]).map(([n, label]) => (
                      <div key={n} className="flex items-center gap-2 rounded-xl border-2 border-deep bg-surface px-2 py-1.5 text-xs font-bold" style={{ boxShadow: "2px 2px 0 var(--deep)" }}>
                        <Ico dir={d.id} name={n} size={22} renders={r} /> {label}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Barra de abajo */}
                <nav className="grid grid-cols-4 rounded-2xl bg-[#0d0420] px-1 py-2">
                  {T.tabs.map((label, i) => (
                    <span key={label} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${i === 1 ? "text-gold" : "text-neutral-400"}`}>
                      <span className={i === 1 && d.id !== "c" ? "-translate-y-0.5 scale-110" : ""}>
                        <Ico dir={d.id} name={TAB_ICONS[i]} size={26} renders={r} active={i === 1} />
                      </span>
                      {label}
                    </span>
                  ))}
                </nav>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
