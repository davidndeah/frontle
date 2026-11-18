import type { Metadata } from "next";
import LabFlagRushGame from "./LabFlagRushGame";

// Laboratorio de Flag Rush: no está enlazado desde ningún lado y no se
// indexa. Juega contra el simulador (lib/flagRush.ts), nunca contra Supabase:
// solo existe el proyecto de producción.
export const metadata: Metadata = {
  title: "Frontle · laboratorio Flag Rush",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LabFlagRushGame />;
}
