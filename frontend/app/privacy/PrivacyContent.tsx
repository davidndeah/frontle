"use client";

// ============================================================
//  Privacidad — contenido localizado (es/en/pt/fr).
//  Igual que TermsContent: el texto vive aquí para mantener la ruta
//  ligera (sin importar i18n.ts, que arrastra el motor del juego).
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";

type Locale = "es" | "en" | "pt" | "fr";
const LOCALES = ["es", "en", "pt", "fr"];

function detect(): Locale {
  try {
    const saved = localStorage.getItem("frontle-locale");
    if (saved && LOCALES.includes(saved)) return saved as Locale;
  } catch {}
  const lang = (navigator.language || "en").slice(0, 2).toLowerCase();
  return (LOCALES.includes(lang) ? lang : "en") as Locale;
}

interface Dict {
  back: string;
  title: string;
  updated: string;
  intro: [string, string];
  s1: [string, string];
  s1Items: [string, string][];
  sections: [string, string][];
  contactTitle: string;
  contactPre: string;
  contactMid: string;
  footerBuiltOn: string;
  footerTerms: string;
  footerStats: string;
}

const L: Record<Locale, Dict> = {
  es: {
    back: "← Volver a Frontle",
    title: "Privacidad",
    updated: "Última actualización: 7 de julio de 2026",
    intro: ["Lo primero:", "Frontle está diseñado para pedir lo mínimo. Sin registro con datos personales, sin contraseñas, sin rastreadores de publicidad."],
    s1: ["1. Qué guardamos y dónde.", ""],
    s1Items: [
      ["En tu dispositivo", "(localStorage): tu partida del día, mejores marcas, racha, preferencias (sonido, idioma, moneda) y el nombre de perfil que elijas. Nunca sale de tu navegador salvo el nombre, que acompaña tus marcas en el ranking."],
      ["En nuestro ranking", "(base de datos): día, nivel, nº de países, tiempo, tu dirección de wallet, el nombre de perfil (opcional) y el país de tu conexión."],
      ["En la blockchain de Celo", "(pública por naturaleza): tus pagos de pistas/reintentos y los reclamos de premios, asociados a tu dirección."],
    ],
    sections: [
      ["2. Sobre tu IP.", "Usamos un servicio de geolocalización solo para obtener el código de país (la bandera del ranking). No almacenamos tu dirección IP."],
      ["3. Wallet.", "Si entras con MiniPay u otra wallet, solo leemos tu dirección pública. Si entras con correo, la wallet embebida la gestiona Privy (proveedor de autenticación) bajo sus propias políticas; nosotros no vemos ni guardamos tu correo en nuestro ranking."],
      ["4. Qué NO hacemos.", "No vendemos datos. No hay cookies de publicidad ni analytics de terceros. No pedimos nombre real, teléfono ni documentos."],
      ["5. Borrar tus datos.", "Lo local se elimina limpiando los datos del sitio en tu navegador. Para retirar tu nombre/marcas del ranking, escríbenos con tu dirección de wallet. Lo publicado en blockchain es inmutable por diseño y no puede borrarse."],
      ["6. Menores.", "Frontle con pagos no está dirigido a menores de la edad legal de su jurisdicción."],
    ],
    contactTitle: "7. Contacto.",
    contactPre: "Escríbenos a",
    contactMid: "o por DM en",
    footerBuiltOn: "construido sobre",
    footerTerms: "Términos",
    footerStats: "Transparencia",
  },
  en: {
    back: "← Back to Frontle",
    title: "Privacy",
    updated: "Last updated: July 7, 2026",
    intro: ["First things first:", "Frontle is designed to ask for the bare minimum. No sign-up with personal data, no passwords, no advertising trackers."],
    s1: ["1. What we store and where.", ""],
    s1Items: [
      ["On your device", "(localStorage): your game of the day, best scores, streak, preferences (sound, language, currency) and the profile name you choose. It never leaves your browser except the name, which goes with your scores to the ranking."],
      ["In our ranking", "(database): day, level, number of countries, time, your wallet address, the profile name (optional) and the country of your connection."],
      ["On the Celo blockchain", "(public by nature): your payments for hints/retries and prize claims, tied to your address."],
    ],
    sections: [
      ["2. About your IP.", "We use a geolocation service only to get the country code (the flag in the ranking). We do not store your IP address."],
      ["3. Wallet.", "If you sign in with MiniPay or another wallet, we only read your public address. If you sign in with email, the embedded wallet is managed by Privy (authentication provider) under its own policies; we don't see or store your email in our ranking."],
      ["4. What we DON'T do.", "We don't sell data. No advertising cookies or third-party analytics. We don't ask for your real name, phone or documents."],
      ["5. Deleting your data.", "Local data is removed by clearing the site data in your browser. To remove your name/scores from the ranking, write to us with your wallet address. What's published on the blockchain is immutable by design and cannot be deleted."],
      ["6. Minors.", "Frontle with payments is not aimed at people under the legal age of their jurisdiction."],
    ],
    contactTitle: "7. Contact.",
    contactPre: "Write to us at",
    contactMid: "or DM us on",
    footerBuiltOn: "built on",
    footerTerms: "Terms",
    footerStats: "Transparency",
  },
  pt: {
    back: "← Voltar ao Frontle",
    title: "Privacidade",
    updated: "Última atualização: 7 de julho de 2026",
    intro: ["Antes de tudo:", "O Frontle foi desenhado para pedir o mínimo. Sem cadastro com dados pessoais, sem senhas, sem rastreadores de publicidade."],
    s1: ["1. O que guardamos e onde.", ""],
    s1Items: [
      ["No seu dispositivo", "(localStorage): sua partida do dia, melhores marcas, sequência, preferências (som, idioma, moeda) e o nome de perfil que você escolher. Nunca sai do seu navegador, exceto o nome, que acompanha suas marcas no ranking."],
      ["No nosso ranking", "(banco de dados): dia, nível, nº de países, tempo, o endereço da sua carteira, o nome de perfil (opcional) e o país da sua conexão."],
      ["Na blockchain da Celo", "(pública por natureza): seus pagamentos de dicas/tentativas e os resgates de prêmios, associados ao seu endereço."],
    ],
    sections: [
      ["2. Sobre seu IP.", "Usamos um serviço de geolocalização apenas para obter o código do país (a bandeira do ranking). Não armazenamos seu endereço IP."],
      ["3. Carteira.", "Se você entra com o MiniPay ou outra carteira, lemos apenas seu endereço público. Se entra com e-mail, a carteira embutida é gerida pela Privy (provedora de autenticação) sob suas próprias políticas; não vemos nem guardamos seu e-mail no nosso ranking."],
      ["4. O que NÃO fazemos.", "Não vendemos dados. Sem cookies de publicidade nem analytics de terceiros. Não pedimos nome real, telefone nem documentos."],
      ["5. Apagar seus dados.", "O local se elimina limpando os dados do site no seu navegador. Para retirar seu nome/marcas do ranking, escreva para nós com o endereço da sua carteira. O publicado na blockchain é imutável por design e não pode ser apagado."],
      ["6. Menores.", "O Frontle com pagamentos não é dirigido a menores da idade legal da sua jurisdição."],
    ],
    contactTitle: "7. Contato.",
    contactPre: "Escreva para",
    contactMid: "ou por DM no",
    footerBuiltOn: "construído na",
    footerTerms: "Termos",
    footerStats: "Transparência",
  },
  fr: {
    back: "← Retour à Frontle",
    title: "Confidentialité",
    updated: "Dernière mise à jour : 7 juillet 2026",
    intro: ["D'abord :", "Frontle est conçu pour demander le strict minimum. Pas d'inscription avec des données personnelles, pas de mots de passe, pas de traceurs publicitaires."],
    s1: ["1. Ce que nous stockons et où.", ""],
    s1Items: [
      ["Sur votre appareil", "(localStorage) : votre partie du jour, meilleurs scores, série, préférences (son, langue, devise) et le nom de profil que vous choisissez. Rien ne quitte votre navigateur sauf le nom, qui accompagne vos scores dans le classement."],
      ["Dans notre classement", "(base de données) : jour, niveau, nombre de pays, temps, l'adresse de votre portefeuille, le nom de profil (optionnel) et le pays de votre connexion."],
      ["Sur la blockchain Celo", "(publique par nature) : vos paiements d'indices/tentatives et les réclamations de prix, associés à votre adresse."],
    ],
    sections: [
      ["2. À propos de votre IP.", "Nous utilisons un service de géolocalisation uniquement pour obtenir le code pays (le drapeau du classement). Nous ne stockons pas votre adresse IP."],
      ["3. Portefeuille.", "Si vous entrez avec MiniPay ou un autre portefeuille, nous ne lisons que votre adresse publique. Si vous entrez avec un e-mail, le portefeuille intégré est géré par Privy (fournisseur d'authentification) selon ses propres politiques ; nous ne voyons ni ne stockons votre e-mail dans notre classement."],
      ["4. Ce que nous ne faisons PAS.", "Nous ne vendons pas de données. Pas de cookies publicitaires ni d'analytics tiers. Nous ne demandons ni nom réel, ni téléphone, ni documents."],
      ["5. Supprimer vos données.", "Le local s'efface en supprimant les données du site dans votre navigateur. Pour retirer votre nom/scores du classement, écrivez-nous avec l'adresse de votre portefeuille. Ce qui est publié sur la blockchain est immuable par conception et ne peut pas être effacé."],
      ["6. Mineurs.", "Frontle avec paiements ne s'adresse pas aux personnes n'ayant pas l'âge légal de leur juridiction."],
    ],
    contactTitle: "7. Contact.",
    contactPre: "Écrivez-nous à",
    contactMid: "ou par DM sur",
    footerBuiltOn: "construit sur",
    footerTerms: "Conditions",
    footerStats: "Transparence",
  },
};

export default function PrivacyContent() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    setLocale(detect());
    document.documentElement.lang = detect();
  }, []);
  const d = L[locale];

  return (
    <main className="relative min-h-dvh bg-grid text-white px-5 py-8">
      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-5">
        <header>
          <Link href="/" className="text-sm text-[#c4b5fd] underline">{d.back}</Link>
          <h1 className="font-display text-3xl font-bold mt-3">{d.title}</h1>
          <p className="text-xs text-neutral-400 mt-1">{d.updated}</p>
        </header>

        <section className="panel p-4 flex flex-col gap-3 text-sm text-neutral-200 leading-relaxed">
          <p><b className="text-white">{d.intro[0]}</b> {d.intro[1]}</p>
          <p><b className="text-white">{d.s1[0]}</b></p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            {d.s1Items.map(([head, body]) => (
              <li key={head}><b className="text-white">{head}</b> {body}</li>
            ))}
          </ul>
          {d.sections.map(([head, body]) => (
            <p key={head}><b className="text-white">{head}</b> {body}</p>
          ))}
          <p>
            <b className="text-white">{d.contactTitle}</b> {d.contactPre}{" "}
            <a href="mailto:appfrontle@gmail.com" className="text-[#fcff52] underline">appfrontle@gmail.com</a>{" "}
            {d.contactMid}{" "}
            <a href="https://x.com/frontle_app" target="_blank" rel="noopener noreferrer" className="underline">X @frontle_app</a>.
          </p>
        </section>

        <footer className="text-center text-[11px] text-neutral-500">
          Frontle · {d.footerBuiltOn} <a href="https://celo.org" className="underline" target="_blank" rel="noopener noreferrer">Celo</a> ·{" "}
          <Link href="/terms" className="underline">{d.footerTerms}</Link> ·{" "}
          <Link href="/stats" className="underline">{d.footerStats}</Link>
        </footer>
      </div>
    </main>
  );
}
