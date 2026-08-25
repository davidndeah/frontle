"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../lib/i18n";

// Las dos cifras vivas de la landing: partidas jugadas (Supabase) y repartido
// a ganadores (los contratos). Son las mismas fuentes que alimentan /stats.
//
// Mientras no hay dato se enseña un hueco marcado, nunca un número de relleno:
// una página pública no puede llevar una cifra inventada ni un instante. Y si
// la fuente no contesta se pone una raya, no "cargando" para siempre — un
// spinner eterno se lee como una página rota.
//
// Los dos módulos se cargan con `import()` dentro del efecto. `payments.ts`
// arrastra viem, que pesa más que toda esta página junta; así no entra en el
// chunk inicial y la landing pinta sin esperarlo.
type Fact = number | "pending" | "unavailable";

export default function LiveFacts({
  locale,
  playsLabel,
  prizesLabel,
  pending,
}: {
  locale: Locale;
  playsLabel: string;
  prizesLabel: string;
  pending: string;
}) {
  const [plays, setPlays] = useState<Fact>("pending");
  const [prizes, setPrizes] = useState<Fact>("pending");

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const { getCommunityStats } = await import("../lib/ranking");
        const s = await getCommunityStats();
        if (alive) setPlays(s ? s.plays : "unavailable");
      } catch {
        if (alive) setPlays("unavailable");
      }
    })();

    void (async () => {
      try {
        const { getPublicStats } = await import("../lib/payments");
        const s = await getPublicStats();
        // Diario (v1 + v2) más la copa semanal: todo lo que ha ido a un ganador.
        if (alive) setPrizes(s ? s.prizesPaid + s.weeklyPrizes : "unavailable");
      } catch {
        if (alive) setPrizes("unavailable");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="fact">
        <p className="n">
          <Value fact={plays} pending={pending} format={(n) => n.toLocaleString(locale)} />
        </p>
        <p className="k">{playsLabel}</p>
      </div>
      <div className="fact">
        <p className="n">
          <Value fact={prizes} pending={pending} format={(n) => formatUsd(n, locale)} />
        </p>
        <p className="k">{prizesLabel}</p>
      </div>
    </>
  );
}

function Value({
  fact,
  pending,
  format,
}: {
  fact: Fact;
  pending: string;
  format: (n: number) => string;
}) {
  if (fact === "pending") return <span className="slot">{pending}</span>;
  if (fact === "unavailable") return <span style={{ opacity: 0.35 }}>—</span>;
  return <>{format(fact)}</>;
}

// Por debajo de 100 se enseñan los centavos: redondear $4,20 a "$4" en una
// sección que presume de transparencia sería justo lo contrario.
function formatUsd(amount: number, locale: Locale): string {
  return amount.toLocaleString(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount < 100 ? 2 : 0,
  });
}
