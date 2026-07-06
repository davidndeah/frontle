import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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
  title: "Frontle — Connect countries through borders",
  description:
    "Juego de geografía diario: llega de un país a otro listando los que comparten frontera. Construido para MiniPay sobre Celo.",
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
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
