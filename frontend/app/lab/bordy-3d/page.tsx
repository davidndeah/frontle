import type { Metadata } from "next";
import LabBordy3D from "./LabBordy3D";

// PRUEBA de Bordy 3D (three.js). Sin enlace y sin indexar.
export const metadata: Metadata = {
  title: "Frontle · prueba Bordy 3D",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LabBordy3D />;
}
