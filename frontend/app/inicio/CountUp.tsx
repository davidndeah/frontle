"use client";

import { useEffect, useRef, useState } from "react";

// Cifra que sube de 0 a su valor la primera vez que entra en pantalla. El
// número final es el real desde el primer render (lo lee un lector de
// pantalla y lo ve quien no tiene JS); la cuenta es solo pintura encima.
//
// Recibe el sufijo ya resuelto y el locale, no una función de formato: la
// usan Server Components, que no pueden pasar funciones a un componente
// cliente.
export default function CountUp({
  value,
  locale,
  suffix = "",
}: {
  value: number;
  locale?: string;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const format = (n: number) => `${locale ? n.toLocaleString(locale) : String(n)}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const DUR = 1200;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / DUR);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setShown(0);
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} aria-label={format(value)}>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}
