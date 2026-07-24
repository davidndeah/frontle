import type { MetadataRoute } from "next";
import { SITE_URL } from "./lib/site";

// Sitemap del App Router. Frontle es una SPA de una sola pantalla jugable más
// las páginas legales y de transparencia; no hay rutas dinámicas que listar.
export default function sitemap(): MetadataRoute.Sitemap {
  const rutas = ["", "/stats", "/terms", "/privacy"];
  return rutas.map((ruta) => ({
    url: `${SITE_URL}${ruta}`,
    lastModified: new Date(),
    changeFrequency: ruta === "" ? "daily" : "monthly",
    priority: ruta === "" ? 1 : 0.5,
  }));
}
