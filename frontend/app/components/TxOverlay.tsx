"use client";

// ============================================================
//  Frontle — Overlay de transacción en curso
//
//  Tapa la pantalla mientras una operación on-chain viaja. Existe porque el
//  aviso depende de la billetera y NO se puede confiar en ella:
//    · MiniPay y las extensiones abren su propia hoja de confirmación.
//    · La billetera de correo (Privy) firma en silencio, sin enseñar nada.
//  Sin esto, quien entró por correo veía la app congelada y volvía a tocar el
//  botón. El overlay va para todos por igual: donde la billetera ya avisa,
//  queda detrás de su hoja y no estorba; donde no avisa, es lo único que hay.
//
//  Es deliberadamente bloqueante. Una transacción emitida no se puede
//  cancelar desde la UI, así que dejar el resto de la pantalla tocable solo
//  invita a lanzar una segunda encima.
// ============================================================

import type { ReactNode } from "react";
import GlobeLoader from "./GlobeLoader";

export default function TxOverlay({
  label,
  note,
  children,
}: {
  /** Qué se está haciendo, ya traducido. */
  label: string;
  /** Aclaración opcional debajo (p. ej. que el cronómetro quedó en pausa). */
  note?: string;
  /** Contenido extra entre el globo y la nota. */
  children?: ReactNode;
}) {
  return (
    <div
      // aria-modal + role=dialog: mientras esté puesto, lo de atrás no es
      // navegable para un lector de pantalla — coincide con que tampoco es
      // tocable visualmente.
      role="dialog"
      aria-modal
      aria-label={label}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-base/95 px-8 backdrop-blur-sm"
    >
      <GlobeLoader label={label} />
      {children}
      {note && <p className="max-w-xs text-center text-sm text-neutral-300">{note}</p>}
    </div>
  );
}
