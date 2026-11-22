import type { Metadata } from "next";
import LabIconos from "./LabIconos";

// Laboratorio de los iconos Frontle. Sin enlace y sin indexar.
export const metadata: Metadata = {
  title: "Frontle · iconos",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LabIconos />;
}
