import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site";

// Sitemap del App Router. Frontle es una SPA de una sola pantalla jugable más
// las páginas legales y de transparencia; no hay rutas dinámicas que listar.
export default function sitemap(): MetadataRoute.Sitemap {
  // `/inicio` es la landing de navegador: explica el juego a quien llega de
  // fuera. Va con prioridad alta porque es la puerta que se comparte, aunque
  // la raíz —que es la app— sigue mandando.
  const rutas = ["", "/inicio", "/stats", "/terms", "/privacy"];
  return rutas.map((ruta) => ({
    url: `${SITE_URL}${ruta}`,
    lastModified: new Date(),
    changeFrequency: ruta === "" ? "daily" : "monthly",
    priority: ruta === "" ? 1 : ruta === "/inicio" ? 0.8 : 0.5,
  }));
}
