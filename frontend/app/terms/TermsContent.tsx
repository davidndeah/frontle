"use client";

// ============================================================
//  Términos de uso — contenido localizado (es/en/pt/fr).
//  El texto vive AQUÍ (no en i18n.ts) a propósito: importar i18n
//  arrastraría countries/game al bundle de /terms, que se mantiene
//  ligera. La detección de idioma replica la de i18n (localStorage
//  "frontle-locale" → navigator.language → en).
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
  sections: [string, string][]; // [título en negrita, cuerpo]
  contactTitle: string;
  contactBody: [string, string, string]; // antes del mail · entre mail y X · después
  footerBuiltOn: string;
  footerPrivacy: string;
  footerStats: string;
}

const L: Record<Locale, Dict> = {
  es: {
    back: "← Volver a Frontle",
    title: "Términos de uso",
    updated: "Última actualización: 7 de julio de 2026",
    sections: [
      ["1. Qué es Frontle.", "Frontle es un juego de geografía diario: conectas dos países nombrando los que comparten frontera. Funciona sobre la red Celo y está pensado para usarse dentro de MiniPay."],
      ["2. Quién opera Frontle.", "Frontle es desarrollado y operado de forma independiente por Santiago Florez Estrada. Frontle no es operado, propiedad ni respaldado por Opera ni por MiniPay. Para soporte, escribe a appfrontle@gmail.com."],
      ["3. El juego es gratis.", "El primer intento de cada reto diario es gratuito. Las pistas y los reintentos son compras opcionales que se pagan en USDT (dólares digitales) desde tu wallet."],
      ["4. Premios.", "Los pagos de pistas y reintentos alimentan el premio del día (80%) y el mantenimiento de la plataforma (20%). Al cierre del día (UTC), el premio se reparte entre los mejores de cada nivel según reglas públicas verificables en el contrato. Los ganadores lo reclaman desde la app; los premios no reclamados pueden reciclarse."],
      ["5. Es un juego de habilidad.", "El resultado depende de tu conocimiento y velocidad, no del azar. Aun así, juega responsablemente y solo con montos que puedas permitirte."],
      ["6. Tu wallet, tus fondos.", "Frontle nunca custodia tu wallet ni tus claves privadas. Los pagos de pistas, reintentos y monedas se envían en USDT a la dirección de tesorería de Frontle y se reenvían al premio público que guarda el contrato inteligente verificado en Celo. Eres responsable de la seguridad de tu wallet y de tu dispositivo."],
      ["7. Identidad y juego limpio.", "El ranking usa tu dirección de wallet como identidad. Está prohibido usar bots, múltiples cuentas para manipular premios, o explotar errores. Podemos excluir del ranking marcas fraudulentas."],
      ["8. Disponibilidad.", "El servicio se ofrece “tal cual”, sin garantía de disponibilidad continua. Las transacciones en blockchain son irreversibles; verifica antes de confirmar."],
      ["9. Edad y jurisdicción.", "Debes tener la edad mínima legal de tu país para usar aplicaciones con pagos digitales, y cumplir tus leyes locales."],
      ["10. Cambios.", "Podemos actualizar estos términos; la fecha de arriba siempre refleja la versión vigente."],
    ],
    contactTitle: "11. Contacto.",
    contactBody: ["¿Dudas o problemas? Escríbenos a", "o por DM en", ". Atendemos las incidencias críticas en menos de 24 horas."],
    footerBuiltOn: "construido sobre",
    footerPrivacy: "Privacidad",
    footerStats: "Transparencia",
  },
  en: {
    back: "← Back to Frontle",
    title: "Terms of use",
    updated: "Last updated: July 7, 2026",
    sections: [
      ["1. What Frontle is.", "Frontle is a daily geography game: you connect two countries by naming the ones that share a border. It runs on the Celo network and is designed to be used inside MiniPay."],
      ["2. Who operates Frontle.", "Frontle is independently developed and operated by Santiago Florez Estrada. Frontle is not operated, owned or endorsed by Opera or MiniPay. For support, contact appfrontle@gmail.com."],
      ["3. The game is free.", "The first attempt at each daily challenge is free. Hints and retries are optional purchases paid in USDT (digital dollars) from your wallet."],
      ["4. Prizes.", "Payments for hints and retries feed the daily prize (80%) and platform maintenance (20%). At the end of the day (UTC), the prize is split among the best players of each level under public rules verifiable in the contract. Winners claim it from the app; unclaimed prizes may be recycled."],
      ["5. It is a game of skill.", "The outcome depends on your knowledge and speed, not on chance. Still, play responsibly and only with amounts you can afford."],
      ["6. Your wallet, your funds.", "Frontle never holds your wallet or private keys. Payments for hints, retries and coins are sent in USDT to Frontle's treasury address and forwarded to the public prize pool held by the verified smart contract on Celo. You are responsible for the security of your wallet and device."],
      ["7. Identity and fair play.", "The ranking uses your wallet address as identity. Using bots, multiple accounts to manipulate prizes, or exploiting bugs is forbidden. We may exclude fraudulent scores from the ranking."],
      ["8. Availability.", "The service is provided “as is”, with no guarantee of continuous availability. Blockchain transactions are irreversible; double-check before confirming."],
      ["9. Age and jurisdiction.", "You must be of the minimum legal age in your country to use apps with digital payments, and comply with your local laws."],
      ["10. Changes.", "We may update these terms; the date above always reflects the current version."],
    ],
    contactTitle: "11. Contact.",
    contactBody: ["Questions or problems? Write to us at", "or DM us on", ". We handle critical issues within 24 hours."],
    footerBuiltOn: "built on",
    footerPrivacy: "Privacy",
    footerStats: "Transparency",
  },
  pt: {
    back: "← Voltar ao Frontle",
    title: "Termos de uso",
    updated: "Última atualização: 7 de julho de 2026",
    sections: [
      ["1. O que é o Frontle.", "O Frontle é um jogo de geografia diário: você conecta dois países nomeando os que compartilham fronteira. Funciona na rede Celo e foi pensado para ser usado dentro do MiniPay."],
      ["2. Quem opera o Frontle.", "O Frontle é desenvolvido e operado de forma independente por Santiago Florez Estrada. O Frontle não é operado, de propriedade nem endossado pela Opera ou pelo MiniPay. Para suporte, escreva para appfrontle@gmail.com."],
      ["3. O jogo é grátis.", "A primeira tentativa de cada desafio diário é gratuita. As dicas e novas tentativas são compras opcionais pagas em USDT (dólares digitais) da sua carteira."],
      ["4. Prêmios.", "Os pagamentos de dicas e novas tentativas alimentam o prêmio do dia (80%) e a manutenção da plataforma (20%). No fechamento do dia (UTC), o prêmio é dividido entre os melhores de cada nível segundo regras públicas verificáveis no contrato. Os vencedores o resgatam pelo app; prêmios não resgatados podem ser reciclados."],
      ["5. É um jogo de habilidade.", "O resultado depende do seu conhecimento e velocidade, não da sorte. Ainda assim, jogue com responsabilidade e apenas com valores que você possa gastar."],
      ["6. Sua carteira, seus fundos.", "O Frontle nunca guarda sua carteira nem suas chaves privadas. Os pagamentos de dicas, novas tentativas e moedas são enviados em USDT para o endereço de tesouraria do Frontle e repassados ao prêmio público mantido pelo contrato inteligente verificado na Celo. Você é responsável pela segurança da sua carteira e do seu dispositivo."],
      ["7. Identidade e jogo limpo.", "O ranking usa o endereço da sua carteira como identidade. É proibido usar bots, múltiplas contas para manipular prêmios ou explorar erros. Podemos excluir do ranking marcas fraudulentas."],
      ["8. Disponibilidade.", "O serviço é oferecido “como está”, sem garantia de disponibilidade contínua. As transações em blockchain são irreversíveis; verifique antes de confirmar."],
      ["9. Idade e jurisdição.", "Você deve ter a idade mínima legal do seu país para usar aplicativos com pagamentos digitais e cumprir as leis locais."],
      ["10. Alterações.", "Podemos atualizar estes termos; a data acima sempre reflete a versão vigente."],
    ],
    contactTitle: "11. Contato.",
    contactBody: ["Dúvidas ou problemas? Escreva para", "ou por DM no", ". Atendemos incidências críticas em menos de 24 horas."],
    footerBuiltOn: "construído na",
    footerPrivacy: "Privacidade",
    footerStats: "Transparência",
  },
  fr: {
    back: "← Retour à Frontle",
    title: "Conditions d'utilisation",
    updated: "Dernière mise à jour : 7 juillet 2026",
    sections: [
      ["1. Ce qu'est Frontle.", "Frontle est un jeu de géographie quotidien : vous reliez deux pays en nommant ceux qui partagent une frontière. Il fonctionne sur le réseau Celo et est conçu pour être utilisé dans MiniPay."],
      ["2. Qui exploite Frontle.", "Frontle est développé et exploité de manière indépendante par Santiago Florez Estrada. Frontle n'est ni exploité, ni détenu, ni approuvé par Opera ou MiniPay. Pour toute assistance, écrivez à appfrontle@gmail.com."],
      ["3. Le jeu est gratuit.", "Le premier essai de chaque défi quotidien est gratuit. Les indices et les nouvelles tentatives sont des achats optionnels payés en USDT (dollars numériques) depuis votre portefeuille."],
      ["4. Prix.", "Les paiements d'indices et de tentatives alimentent le prix du jour (80 %) et la maintenance de la plateforme (20 %). À la clôture de la journée (UTC), le prix est réparti entre les meilleurs de chaque niveau selon des règles publiques vérifiables dans le contrat. Les gagnants le réclament depuis l'app ; les prix non réclamés peuvent être recyclés."],
      ["5. C'est un jeu d'adresse.", "Le résultat dépend de vos connaissances et de votre vitesse, pas du hasard. Jouez néanmoins de façon responsable et uniquement avec des montants que vous pouvez vous permettre."],
      ["6. Votre portefeuille, vos fonds.", "Frontle ne détient jamais votre portefeuille ni vos clés privées. Les paiements d'indices, de tentatives et de pièces sont envoyés en USDT à l'adresse de trésorerie de Frontle, puis transférés à la cagnotte publique détenue par le contrat intelligent vérifié sur Celo. Vous êtes responsable de la sécurité de votre portefeuille et de votre appareil."],
      ["7. Identité et fair-play.", "Le classement utilise l'adresse de votre portefeuille comme identité. Il est interdit d'utiliser des bots, plusieurs comptes pour manipuler les prix, ou d'exploiter des bugs. Nous pouvons exclure du classement les scores frauduleux."],
      ["8. Disponibilité.", "Le service est fourni “tel quel”, sans garantie de disponibilité continue. Les transactions sur la blockchain sont irréversibles ; vérifiez avant de confirmer."],
      ["9. Âge et juridiction.", "Vous devez avoir l'âge légal minimum de votre pays pour utiliser des applications avec paiements numériques, et respecter vos lois locales."],
      ["10. Modifications.", "Nous pouvons mettre à jour ces conditions ; la date ci-dessus reflète toujours la version en vigueur."],
    ],
    contactTitle: "11. Contact.",
    contactBody: ["Des questions ou des problèmes ? Écrivez-nous à", "ou par DM sur", ". Nous traitons les incidents critiques en moins de 24 heures."],
    footerBuiltOn: "construit sur",
    footerPrivacy: "Confidentialité",
    footerStats: "Transparence",
  },
};

export default function TermsContent() {
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
          {d.sections.map(([head, body]) => (
            <p key={head}><b className="text-white">{head}</b> {body}</p>
          ))}
          <p>
            <b className="text-white">{d.contactTitle}</b> {d.contactBody[0]}{" "}
            <a href="mailto:appfrontle@gmail.com" className="text-gold underline">appfrontle@gmail.com</a>{" "}
            {d.contactBody[1]}{" "}
            <a href="https://x.com/frontle_app" target="_blank" rel="noopener noreferrer" className="underline">X @frontle_app</a>
            {d.contactBody[2]}
          </p>
        </section>

        <footer className="text-center text-[11px] text-neutral-500">
          Frontle · {d.footerBuiltOn} <a href="https://celo.org" className="underline" target="_blank" rel="noopener noreferrer">Celo</a> ·{" "}
          <Link href="/privacy" className="underline">{d.footerPrivacy}</Link> ·{" "}
          <Link href="/stats" className="underline">{d.footerStats}</Link>
        </footer>
      </div>
    </main>
  );
}
