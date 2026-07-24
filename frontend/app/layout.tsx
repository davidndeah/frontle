import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "./lib/theme";
import { SITE_URL } from "./lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Fuente display "playful" (títulos, marca) — estilo GameArena/Chesscito
const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  // Raíz de todas las URLs relativas (canonical, Open Graph). Sin esto, Next
  // no puede emitir un canonical y Google veía la app en dos dominios
  // (frontle.earth y el viejo frontle.vercel.app) como contenido duplicado.
  metadataBase: new URL(SITE_URL),
  title: "Frontle — Connect countries through borders",
  description:
    "Daily geography game: get from one country to another by listing the ones that share a border. Built for MiniPay on Celo.",
  // El dominio bueno es este; el de Vercel sigue vivo, así que hay que
  // decírselo a los buscadores explícitamente.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Frontle",
    title: "Frontle — Connect countries through borders",
    description:
      "Daily geography game: get from one country to another by listing the ones that share a border. Built for MiniPay on Celo.",
  },
  // Verificación de propiedad del proyecto en Talent App (Proof of Ship)
  other: {
    "talentapp:project_verification":
      "f6cbe89fff8ad187d423f134f841edf187b4f3842e330a413e7f9f65520276c66a797b8c53f2c666877bcf9cf6dcfe7c0c022aa62fc3b52defe66791302d4f36",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Tiene que ser el MISMO fondo que pinta la app (--background en
  // globals.css). Estaba en un azul casi negro que no existe en la paleta,
  // así que la barra del navegador no empalmaba con la pantalla.
  themeColor: "#160833",
  // MiniPay dibuja la app a pantalla completa: sin esto, env(safe-area-inset-*)
  // siempre vale 0 y el header queda bajo el notch.
  viewportFit: "cover",
  // En móvil el teclado virtual tapaba el input: el modal de correo de Privy
  // (position:fixed centrado) y el campo de países quedaban debajo del teclado.
  // Con el default "resizes-visual" el layout viewport no se encoge. "resizes-content"
  // reduce el layout viewport (y el 100dvh del body) al abrir el teclado, así el
  // input queda visible por encima.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      // Default global (inglés); page.tsx ajusta document.documentElement.lang
      // al idioma real detectado/elegido, sin romper la hidratación del SSR.
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <head>
        {/* Fija el tema (data-theme) ANTES de pintar, para que no haya destello
            del tema equivocado en la primera carga. Lee localStorage directo. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* Sin Providers: el PrivyProvider ya no envuelve la app. Vive dentro de
          PrivyGate, que page.tsx carga aparte y solo fuera de MiniPay. Antes,
          envolverlo aquí metía el SDK de Privy en TODAS las rutas — /terms
          llegaba a pedir 2.98 MB de JS para mostrar texto. */}
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
