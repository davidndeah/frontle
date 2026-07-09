import type { Metadata } from "next";
import StatsView from "../components/StatsView";

export const metadata: Metadata = { title: "Estadísticas — Frontle" };

// Página pública de estadísticas (requisito del listing de MiniPay).
// El cuerpo vive en StatsView, que es cliente: el idioma se detecta del
// navegador y los números se leen en vivo del contrato y de Supabase.
export default function Stats() {
  return (
    <main className="relative min-h-dvh bg-grid text-white px-5 py-8">
      <StatsView />
    </main>
  );
}
