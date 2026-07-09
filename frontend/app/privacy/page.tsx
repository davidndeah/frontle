import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacidad — Frontle" };

// Página estática de privacidad (requisito del listing de MiniPay).
export default function Privacy() {
  return (
    <main className="relative min-h-dvh bg-grid text-white px-5 py-8">
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-5">
        <header>
          <Link href="/" className="text-sm text-[#c4b5fd] underline">← Volver a Frontle</Link>
          <h1 className="font-display text-3xl font-bold mt-3">Privacidad</h1>
          <p className="text-xs text-neutral-400 mt-1">Última actualización: 7 de julio de 2026</p>
        </header>

        <section className="panel p-4 flex flex-col gap-3 text-sm text-neutral-200 leading-relaxed">
          <p><b className="text-white">Lo primero:</b> Frontle está diseñado para pedir lo mínimo. Sin registro con datos personales, sin contraseñas, sin rastreadores de publicidad.</p>
          <p><b className="text-white">1. Qué guardamos y dónde.</b></p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li><b className="text-white">En tu dispositivo</b> (localStorage): tu partida del día, mejores marcas, racha, preferencias (sonido, idioma, moneda) y el nombre de perfil que elijas. Nunca sale de tu navegador salvo el nombre, que acompaña tus marcas en el ranking.</li>
            <li><b className="text-white">En nuestro ranking</b> (base de datos): día, nivel, nº de países, tiempo, tu dirección de wallet, el nombre de perfil (opcional) y el país de tu conexión.</li>
            <li><b className="text-white">En la blockchain de Celo</b> (pública por naturaleza): tus pagos de pistas/reintentos y los reclamos de premios, asociados a tu dirección.</li>
          </ul>
          <p><b className="text-white">2. Sobre tu IP.</b> Usamos un servicio de geolocalización solo para obtener el <b className="text-white">código de país</b> (la bandera del ranking). No almacenamos tu dirección IP.</p>
          <p><b className="text-white">3. Wallet.</b> Si entras con MiniPay u otra wallet, solo leemos tu dirección pública. Si entras con correo, la wallet embebida la gestiona Privy (proveedor de autenticación) bajo sus propias políticas; nosotros no vemos ni guardamos tu correo en nuestro ranking.</p>
          <p><b className="text-white">4. Qué NO hacemos.</b> No vendemos datos. No hay cookies de publicidad ni analytics de terceros. No pedimos nombre real, teléfono ni documentos.</p>
          <p><b className="text-white">5. Borrar tus datos.</b> Lo local se elimina limpiando los datos del sitio en tu navegador. Para retirar tu nombre/marcas del ranking, escríbenos con tu dirección de wallet. Lo publicado en blockchain es inmutable por diseño y no puede borrarse.</p>
          <p><b className="text-white">6. Menores.</b> Frontle con pagos no está dirigido a menores de la edad legal de su jurisdicción.</p>
          <p><b className="text-white">7. Contacto.</b> Escríbenos a <a href="mailto:appfrontle@gmail.com" className="text-[#fcff52] underline">appfrontle@gmail.com</a> o por DM en <a href="https://x.com/frontle_app" target="_blank" rel="noopener noreferrer" className="underline">X @frontle_app</a>.</p>
        </section>

        <footer className="text-center text-[11px] text-neutral-500">
          Frontle · construido sobre <a href="https://celo.org" className="underline" target="_blank" rel="noopener noreferrer">Celo</a> ·{" "}
          <Link href="/terms" className="underline">Términos</Link> ·{" "}
          <Link href="/stats" className="underline">Transparencia</Link>
        </footer>
      </div>
    </main>
  );
}
