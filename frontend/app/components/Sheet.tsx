"use client";

// ============================================================
//  Frontle — Bottom sheet reutilizable
//
//  El patrón (overlay oscuro + panel anclado abajo con grip) estaba copiado
//  a mano en cada sheet de page.tsx. Además de la duplicación, ninguna copia
//  cerraba con Escape ni se anunciaba como diálogo, así que quien navega con
//  teclado o lector de pantalla quedaba atrapado dentro.
//
//  Aquí se resuelve una vez:
//   - Escape cierra
//   - role="dialog" + aria-modal + aria-label
//   - el foco entra al panel al abrir y VUELVE al elemento que lo abrió
//   - el fondo no hace scroll mientras el sheet está abierto
//
//  Deliberadamente NO trae animación de entrada propia: quien la quiera pasa
//  `className="pop-in"` (así lo hace el prompt de nombre) y así el resto no
//  paga una animación que no pidió.
// ============================================================

import { useEffect, useRef, type ReactNode } from "react";

export default function Sheet({
  onClose,
  title,
  label,
  children,
  className = "",
  z = 40,
}: {
  onClose: () => void;
  /** Encabezado visible. Si se omite, pasa `label` para el lector de pantalla. */
  title?: ReactNode;
  /** Nombre accesible cuando no hay título visible (o cuando el título es un nodo). */
  label?: string;
  children: ReactNode;
  className?: string;
  /** z-index del overlay; el panel usa z+1. Sube esto para apilar sobre otro sheet. */
  z?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // ¿El gesto de cierre empezó sobre el overlay? (ver comentario abajo)
  const presionadoAqui = useRef(false);

  // Un título de texto plano ya sirve de nombre accesible; si es un nodo
  // (icono + subtítulo), hace falta el `label` explícito.
  const tituloPlano = typeof title === "string" ? title : null;
  const nombreAccesible = label ?? tituloPlano ?? undefined;

  useEffect(() => {
    // Quién tenía el foco antes de abrir: hay que devolvérselo al cerrar, o el
    // foco cae al principio de la página y el usuario de teclado se pierde.
    const abridor = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // El fondo no debe deslizarse detrás del sheet.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflowPrevio;
      abridor?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      {/* El overlay cierra solo si el gesto EMPEZÓ y TERMINÓ sobre él.
          Sin esto pasan dos cosas feas:
          · el mismo click que abre el sheet aterriza en el overlay recién
            montado y lo cierra en el acto (con el sheet abriéndose desde
            otro sheet era sistemático: la tienda nunca llegaba a verse);
          · arrastrar desde dentro del panel y soltar fuera lo cerraba. */}
      <div
        className="fixed inset-0 bg-black/55"
        style={{ zIndex: z }}
        onPointerDown={(e) => {
          presionadoAqui.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (presionadoAqui.current && e.target === e.currentTarget) onClose();
          presionadoAqui.current = false;
        }}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={nombreAccesible}
        tabIndex={-1}
        style={{ zIndex: z + 1 }}
        className={`fixed inset-x-0 bottom-0 rounded-t-3xl bg-[#1c0b3e] border-t border-[#b79ced]/25 px-5 pt-3 pb-8 outline-none max-h-[85vh] overflow-y-auto ${className}`}
      >
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4" />
        {tituloPlano !== null ? (
          <h3 className="text-white font-bold text-base mb-3">{tituloPlano}</h3>
        ) : (
          title
        )}
        {children}
      </div>
    </>
  );
}
