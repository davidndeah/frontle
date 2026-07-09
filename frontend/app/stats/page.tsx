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
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">
            A dónde va tu dinero
          </h2>
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
            contrato inteligente. La comisión se contabiliza aparte y no toca el premio.
          </p>
        </section>

        <section className="panel p-4 flex flex-col gap-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">
              Los contratos
            </h2>
            <span className="text-[10px] text-neutral-500">
              {CONTRACT_INFO.chainName} · {CONTRACT_INFO.token}
            </span>
          </div>

          <ContractRow
            tag="v2"
            role="En uso · premio por nivel"
            address={CONTRACT_INFO.address}
            href={CONTRACT_INFO.explorer}
            accent
          />
          <ContractRow
            tag="v1"
            role="Histórico · ganador único"
            address={CONTRACT_INFO.addressV1}
            href={CONTRACT_INFO.explorerV1}
          />

          <p className="text-[11px] text-neutral-400 leading-relaxed">
            El v1 ya no recibe pagos y sus premios fueron reclamados; las cifras de arriba suman los dos. Ambos están
            verificados, el código es abierto en{" "}
            <a
              href="https://github.com/davidndeah/frontle"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              GitHub
            </a>{" "}
            y puedes auditar cada transacción en el explorador.
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

// Una fila de contrato: etiqueta de versión, para qué sirve y su dirección.
function ContractRow({
  tag,
  role,
  address,
  href,
  accent = false,
}: {
  tag: string;
  role: string;
  address: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-[#b79ced]/15 p-2.5">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold font-display ${
          accent ? "bg-[#fcff52]/15 text-[#fcff52]" : "bg-white/10 text-neutral-400"
        }`}
      >
        {tag}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-neutral-400 leading-tight">{role}</span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-mono text-[11px] break-all leading-tight ${
            accent ? "text-[#fcff52]" : "text-[#c4b5fd]"
          }`}
        >
          {address}
        </a>
      </div>
    </div>
  );
}
