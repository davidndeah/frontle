import type { Metadata } from "next";
import TermsContent from "./TermsContent";

export const metadata: Metadata = { title: "Terms of use — Frontle" };

// Página de términos (requisito del listing de MiniPay), localizada a los
// 4 idiomas en el componente cliente (el metadata debe vivir en el server).
export default function Terms() {
  return <TermsContent />;
}
