import type { Metadata } from "next";
import PrivacyContent from "./PrivacyContent";

export const metadata: Metadata = { title: "Privacy — Frontle" };

// Página de privacidad (requisito del listing de MiniPay), localizada a los
// 4 idiomas en el componente cliente (el metadata debe vivir en el server).
export default function Privacy() {
  return <PrivacyContent />;
}
