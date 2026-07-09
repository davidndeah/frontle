import type { Metadata } from "next";
import Link from "next/link";
import StatsNumbers from "../components/StatsNumbers";
import { CONTRACT_INFO } from "../lib/payments";

export const metadata: Metadata = { title: "Transparencia — Frontle" };

// Página pública de transparencia (requisito del listing de MiniPay).
// El copy se prerenderiza; los números los lee StatsNumbers del contrato,
// por RPC público: sin wallet, sin backend, sin claves.
export default function Stats() {
  return (
    <main className="relative min-h-dvh bg-grid text-white px-5 py-8">
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-5">
        <header>
          <Link href="/" className="text-sm text-[#c4b5fd] underline">← Volver a Frontle</Link>
          <h1 className="font-display text-3xl font-bold mt-3">Transparencia</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Datos leídos en vivo del contrato en {CONTRACT_INFO.chainName}. Nadie los edita a mano.
          </p>
        </header>

        <StatsNumbers />

        <section className="panel p-4 flex flex-col gap-3 text-sm text-neutral-200 leading-relaxed">
          <h2 className="font-display text-lg font-bold text-white">A dónde va tu dinero</h2>
          <p>
            El primer intento de cada reto diario es <b className="text-white">gratis</b>. Las pistas y los reintentos
            son compras opcionales en USDT.
          </p>
          <p>
            De cada compra, el <b className="text-[#fcff52]">80%</b> alimenta el premio del día y el{" "}
            <b className="text-white">20%</b> cubre el mantenimiento de la plataforma. Al cierre del día (UTC) el premio
            se reparte entre los mejores de cada nivel, y los ganadores lo reclaman desde la app.
          </p>
          <p>
            Frontle <b className="text-white">nunca custodia tus fondos</b>: los pagos van directo de tu wallet al
            contrato inteligente.
          </p>
        </section>

        <section className="panel p-4 flex flex-col gap-2 text-sm">
          <h2 className="font-display text-lg font-bold text-white">El contrato</h2>
          <Row label="Red">
            {CONTRACT_INFO.chainName} (id {CONTRACT_INFO.chainId})
          </Row>
          <Row label="Moneda">{CONTRACT_INFO.token}</Row>
          <Row label="Dirección">
            <a
              href={CONTRACT_INFO.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#fcff52] underline font-mono text-xs break-all"
            >
              {CONTRACT_INFO.address}
            </a>
          </Row>
          <p className="text-[11px] text-neutral-400 mt-1">
            Contrato verificado y código abierto en{" "}
            <a
              href="https://github.com/davidndeah/frontle"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              GitHub
            </a>
            . Puedes auditar cada transacción en el explorador.
          </p>
        </section>

        <footer className="text-center text-[11px] text-neutral-500">
          Frontle · construido sobre{" "}
          <a href="https://celo.org" className="underline" target="_blank" rel="noopener noreferrer">Celo</a> ·{" "}
          <Link href="/terms" className="underline">Términos</Link> ·{" "}
          <Link href="/privacy" className="underline">Privacidad</Link>
        </footer>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-neutral-400">{label}</span>
      <span className="text-neutral-200">{children}</span>
    </div>
  );
}
