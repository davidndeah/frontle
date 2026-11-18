import type { NextConfig } from "next";

// Caché de los archivos de `public/`. Por defecto Vercel los sirve con
// `max-age=0, must-revalidate`: el navegador los vuelve a pedir en CADA
// visita (aunque sea un 304, cuenta como petición del CDN y gasta cuota
// del plan). Bordy, las banderas de regiones y los mapas casi nunca
// cambian, así que el navegador puede guardarlos una semana.
//
// OJO: si cambias uno de estos archivos, ponle OTRO nombre (p. ej.
// `base-v2.webp`); con el mismo nombre, quien ya lo tenga seguirá viendo
// el viejo hasta 7 días.
const SEMANA = "public, max-age=604800, stale-while-revalidate=86400";

const nextConfig: NextConfig = {
  // Permite que el dev server acepte requests del túnel ngrok (pruebas en MiniPay).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok-free.dev"],

  async headers() {
    return [
      "/bordy/:path*",
      "/flags/:path*",
      "/maps/:path*",
      "/:file(.+\\.webp)",
      "/:file(.+\\.svg)",
      "/icon.png",
      "/favicon.ico",
    ].map((source) => ({ source, headers: [{ key: "Cache-Control", value: SEMANA }] }));
  },
};

export default nextConfig;
