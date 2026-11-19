"use client";

// Icono 3D con borde neobrutal (prerenderizado en public/icons/neo/ por
// /lab/iconos/exportar). La caja mide `size`; el contorno y la sombra dura
// sobresalen por fuera, así el dibujo mide lo mismo que el icono sin borde.
//
// `Ico` es el que se usa en la app durante la prueba: muestra el icono en la
// estética nueva y el emoji de siempre en la de hoy.

import type { CSSProperties } from "react";
import type { IconName } from "./FrontleIcon";
import { neoBox } from "./neo";
import { useEstetica } from "../../lib/estetica";

const BOX = neoBox();

export default function Icon3D({
  name, size = 24, className = "", style, title,
}: {
  name: IconName;
  size?: number;
  /** Clases de la caja: aquí van las animaciones (ico-*). */
  className?: string;
  style?: CSSProperties;
  /** Si el icono dice algo por sí solo (sin texto al lado), su nombre. */
  title?: string;
}) {
  return (
    <span
      className={`ico3d ${className}`}
      style={{ width: size, height: size, ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/icons/neo/${name}.webp`}
        alt=""
        draggable={false}
        style={{
          left: -BOX.offset * size,
          top: -BOX.offset * size,
          width: BOX.scale * size,
          height: BOX.scale * size,
        }}
      />
    </span>
  );
}

/** Icono en la estética nueva, emoji en la de hoy. */
export function Ico({
  name, emoji, size = 20, className = "", title,
}: {
  name: IconName;
  emoji: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const { nueva } = useEstetica();
  if (!nueva) return <>{emoji}</>;
  return <Icon3D name={name} size={size} className={className} title={title} />;
}
