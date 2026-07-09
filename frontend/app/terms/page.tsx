import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Términos de uso — Frontle" };

// Página estática de términos (requisito del listing de MiniPay).
export default function Terms() {
  return (
    <main className="relative min-h-dvh bg-grid text-white px-5 py-8">
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-5">
        <header>
          <Link href="/" className="text-sm text-[#c4b5fd] underline">← Volver a Frontle</Link>
          <h1 className="font-display text-3xl font-bold mt-3">Términos de uso</h1>
          <p className="text-xs text-neutral-400 mt-1">Última actualización: 7 de julio de 2026</p>
        </header>

        <section className="panel p-4 flex flex-col gap-3 text-sm text-neutral-200 leading-relaxed">
          <p><b className="text-white">1. Qué es Frontle.</b> Frontle es un juego de geografía diario: conectas dos países nombrando los que comparten frontera. Funciona sobre la red Celo y está pensado para usarse dentro de MiniPay.</p>
          <p><b className="text-white">2. El juego es gratis.</b> El primer intento de cada reto diario es gratuito. Las pistas y los reintentos son compras opcionales que se pagan en USDT (dólares digitales) desde tu wallet.</p>
          <p><b className="text-white">3. Premios.</b> Los pagos de pistas y reintentos alimentan el premio del día (80%) y el mantenimiento de la plataforma (20%). Al cierre del día (UTC), el premio se reparte entre los mejores de cada nivel según reglas públicas verificables en el contrato. Los ganadores lo reclaman desde la app; los premios no reclamados pueden reciclarse.</p>
          <p><b className="text-white">4. Es un juego de habilidad.</b> El resultado depende de tu conocimiento y velocidad, no del azar. Aun así, juega responsablemente y solo con montos que puedas permitirte.</p>
          <p><b className="text-white">5. Tu wallet, tus fondos.</b> Frontle nunca custodia tu dinero: los pagos van directo del jugador al contrato inteligente (verificado públicamente en Celo). Eres responsable de la seguridad de tu wallet y de tu dispositivo.</p>
          <p><b className="text-white">6. Identidad y juego limpio.</b> El ranking usa tu dirección de wallet como identidad. Está prohibido usar bots, múltiples cuentas para manipular premios, o explotar errores. Podemos excluir del ranking marcas fraudulentas.</p>
          <p><b className="text-white">7. Disponibilidad.</b> El servicio se ofrece &quot;tal cual&quot;, sin garantía de disponibilidad continua. Las transacciones en blockchain son irreversibles; verifica antes de confirmar.</p>
          <p><b className="text-white">8. Edad y jurisdicción.</b> Debes tener la edad mínima legal de tu país para usar aplicaciones con pagos digitales, y cumplir tus leyes locales.</p>
          <p><b className="text-white">9. Cambios.</b> Podemos actualizar estos términos; la fecha de arriba siempre refleja la versión vigente.</p>
          <p><b className="text-white">10. Contacto.</b> ¿Dudas o problemas? Escríbenos a <a href="mailto:appfrontle@gmail.com" className="text-[#fcff52] underline">appfrontle@gmail.com</a> o por DM en <a href="https://x.com/frontle_app" target="_blank" rel="noopener noreferrer" className="underline">X @frontle_app</a>. Atendemos las incidencias críticas en menos de 24 horas.</p>
        </section>

        <footer className="text-center text-[11px] text-neutral-500">
          Frontle · construido sobre <a href="https://celo.org" className="underline" target="_blank" rel="noopener noreferrer">Celo</a> ·{" "}
          <Link href="/privacy" className="underline">Privacidad</Link> ·{" "}
          <Link href="/stats" className="underline">Transparencia</Link>
        </footer>
      </div>
    </main>
  );
}
