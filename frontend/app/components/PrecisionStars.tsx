"use client";

// Estrellas por precisión en la win card (GAM-1): las ganadas caen una a una
// (stagger vía animation-delay) y la tercera destella con el prisma cuando la
// ruta es óptima. Las no ganadas quedan apagadas — el patrón de 3 slots hace
// legible cuánto faltó, no solo cuánto se logró.
export default function PrecisionStars({ count, label }: { count: 1 | 2 | 3; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-3" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => {
        const earned = i < count;
        return (
          <span
            key={i}
            aria-hidden
            className={`text-3xl ${
              earned
                ? `star-pop${count === 3 && i === 2 ? " star-prism" : ""}`
                : "opacity-25 grayscale"
            }`}
            style={earned ? { animationDelay: `${i * 0.15}s` } : undefined}
          >
            ⭐
          </span>
        );
      })}
    </div>
  );
}
