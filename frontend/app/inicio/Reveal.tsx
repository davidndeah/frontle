"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Aparición discreta al entrar en pantalla. Es la única animación de scroll
// de la landing.
//
// El estado "todavía oculto" NO vive aquí: vive en CSS, colgado de
// `[data-landing-js]`, que un script en línea pone antes del primer pintado.
// Si se hiciera con estado de React, el bloque se pintaría visible y se
// escondería al hidratar — un parpadeo justo en lo primero que se lee.
//
// La clase `in` se pone tocando el DOM en vez de con `setState` a propósito:
// no hay nada más que re-renderizar, y así no se dispara un render por cada
// bloque que entra en pantalla.
export default function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Sin IntersectionObserver el contenido se queda visible, no invisible.
    if (!("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="reveal">
      {children}
    </div>
  );
}
