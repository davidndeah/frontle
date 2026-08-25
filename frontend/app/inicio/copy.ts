// ============================================================
//  Frontle — textos de la landing web (/inicio)
//
//  Viven aparte de `lib/i18n.ts` a propósito: aquello es el
//  diccionario del juego, que se carga en el cliente en TODAS las
//  rutas. Esto es prosa de marketing que solo lee una página, y
//  que además se resuelve en el servidor (la landing es un Server
//  Component). Meterla en el Dict del juego engordaría el bundle
//  de `/` —la ruta con el límite de 2 MB de MiniPay— a cambio de
//  nada.
//
//  Los nombres de país NO están aquí: salen de `countryName()`,
//  que los saca de `Intl.DisplayNames`. Regla del repo: nunca se
//  traduce un país a mano.
//
//  Reglas de copy del listing de MiniPay que aplican a todo este
//  archivo: jamás el token CELO (solo Celo como red), ni «gas»
//  (→ comisión de red), ni «cripto» (→ stablecoin), ni «comprar
//  cripto» (→ depositar). Ninguna dirección 0x… se usa como
//  identidad de una persona.
// ============================================================

import type { Locale } from "../lib/i18n";

export interface LandingCopy {
  meta: { title: string; description: string };
  nav: { how: string; modes: string; network: string; transparency: string; play: string };
  hero: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    lead: string;
    ctaPlay: string;
    ctaHow: string;
    /** Descripción de la cadena para lectores de pantalla. */
    chainAria: (route: string) => string;
    roleStart: string;
    roleEnd: string;
    /** "Resuelto en " + <b>2 países</b> + " · la ruta más corta posible" */
    noteBefore: string;
    noteAfter: string;
    noteCountries: (n: number) => string;
  };
  facts: {
    challenges: string;
    languages: string;
    plays: string;
    prizes: string;
    /** Marca del hueco mientras la cifra viva aún no ha llegado. */
    pending: string;
  };
  how: {
    eyebrow: string;
    title: string;
    lead: string;
    legendGood: string;
    legendClose: string;
    legendFar: string;
    steps: { title: string; text: string }[];
  };
  modes: {
    eyebrow: string;
    title: string;
    prized: string;
    free: string;
    weekly: string;
    inUsdt: string;
    cup: string;
    items: { title: string; text: string }[];
  };
  network: {
    eyebrow: string;
    title: string;
    lead: string;
    points: { title: string; text: string }[];
  };
  transparency: {
    eyebrow: string;
    title: string;
    lead: string;
    verified: string;
    token: string;
    cta: string;
    rows: { game2: string; game1: string; weekly: string; usdt: string };
  };
  close: { eyebrow: string; title: string; lead: string; ctaPlay: string; ctaStats: string };
  footer: { privacy: string; terms: string; stats: string; sep: string };
}

const es: LandingCopy = {
  meta: {
    title: "Frontle — Une dos países cruzando fronteras",
    description:
      "Reto diario de geografía: te damos un país de salida y uno de llegada, y escribes los que hay entre medias. Hecho para MiniPay, sobre Celo.",
  },
  nav: {
    how: "Cómo se juega",
    modes: "Modos",
    network: "Por qué Celo",
    transparency: "Transparencia",
    play: "Jugar",
  },
  hero: {
    eyebrow: "Reto diario de geografía",
    titleLead: "Une dos países cruzando",
    titleAccent: "fronteras",
    lead:
      "Te damos un país de salida y uno de llegada. Escribe los países que hay entre medias, uno a uno, hasta que se toquen. Menos países y menos tiempo, mejor puesto.",
    ctaPlay: "Jugar el reto de hoy",
    ctaHow: "Ver cómo se juega",
    chainAria: (route) => `Ejemplo de una ruta resuelta: ${route}.`,
    roleStart: "Salida",
    roleEnd: "Llegada",
    noteBefore: "Resuelto en ",
    noteAfter: " · la ruta más corta posible",
    noteCountries: (n) => (n === 1 ? "1 país" : `${n} países`),
  },
  facts: {
    challenges: "Retos cada día",
    languages: "Idiomas",
    plays: "Partidas jugadas",
    prizes: "Repartido a ganadores",
    pending: "cargando",
  },
  how: {
    eyebrow: "Cómo se juega",
    title: "Tres reglas y ya estás jugando",
    lead:
      "Una partida dura lo que tardes en pensarla. No hay tutorial obligatorio, ni registro, ni nada que descargar.",
    legendGood: "Toca la ruta",
    legendClose: "Cerca, pero no",
    legendFar: "Lejos",
    steps: [
      {
        title: "Recibes salida y llegada",
        text:
          "Dos países, elegidos por el día — los mismos para todo el mundo. Eliges dificultad: fácil, medio o difícil, cada una con su ranking.",
      },
      {
        title: "Escribes países que se tocan",
        text:
          "Cada país que escribes tiene que compartir frontera terrestre con la cadena. El color te dice al momento si vas por buen camino.",
      },
      {
        title: "Cierras la ruta",
        text:
          "Cuando la cadena une salida y llegada, se acabó. Cuentan los países que usaste primero y el tiempo después.",
      },
    ],
  },
  modes: {
    eyebrow: "Modos",
    title: "Un reto con premio, cuatro para practicar",
    prized: "Con premio",
    free: "Gratis",
    weekly: "Semanal",
    inUsdt: "en USDT",
    cup: "copa",
    items: [
      {
        title: "Reto diario",
        text:
          "Tres dificultades, tres rankings y un premio por nivel. El bote vive en el contrato, no en una hoja de cálculo.",
      },
      {
        title: "Regiones",
        text:
          "La misma mecánica dentro de un solo país: departamentos, estados o provincias en vez de países.",
      },
      {
        title: "Adivina la bandera",
        text:
          "Incluye las naciones isleñas, que no tienen frontera terrestre y por eso nunca salen en el reto diario.",
      },
      {
        title: "Adivina el país",
        text: "Solo la silueta, sin nombre y sin bandera. El contorno es lo único que se ve.",
      },
      {
        title: "Modo práctica",
        text: "Retos infinitos, pistas gratis y sin reloj. Para cogerle el pulso al mapa antes de competir.",
      },
      {
        title: "Liga semanal",
        text: "La experiencia que ganas en cualquier modo cuenta para la clasificación de la semana.",
      },
    ],
  },
  network: {
    eyebrow: "Por qué Celo",
    title: "Se juega con dólares, no con un token",
    lead:
      "Frontle está hecho para MiniPay, la billetera de Opera. Eso marca cómo funciona el dinero dentro del juego.",
    points: [
      {
        title: "Todo en un stablecoin",
        text:
          "Los premios y los pagos son en USDT. La comisión de red también se paga con él, así que nunca hace falta otro saldo aparte.",
      },
      {
        title: "Sin registro",
        text:
          "Dentro de MiniPay ya estás dentro: no hay pantalla de conexión, ni contraseña, ni correo. Fuera de MiniPay puedes entrar con tu correo.",
      },
      {
        title: "Cantidades pequeñas de verdad",
        text: "Las pistas y los reintentos cuestan céntimos, y el 80 % de lo que se paga vuelve al bote del día.",
      },
      {
        title: "El premio lo cobras tú",
        text:
          "Ganar deja tu dirección apuntada en el contrato. El cobro lo haces tú cuando quieras: nadie mueve tu dinero por ti.",
      },
    ],
  },
  transparency: {
    eyebrow: "Transparencia",
    title: "Los contratos están publicados y verificados",
    lead:
      "Celo Mainnet · chainId 42220. Cualquiera puede leer el bote, las comisiones acumuladas y los ganadores de cada día sin pedirnos permiso.",
    verified: "Verificado",
    token: "Token",
    cta: "Ver las estadísticas públicas",
    rows: {
      game2: "Juego (v2, en uso)",
      game1: "Juego (v1, histórico)",
      weekly: "Copa semanal",
      usdt: "USDT (6 decimales)",
    },
  },
  close: {
    eyebrow: "Hoy",
    title: "El reto de hoy sigue abierto",
    lead: "Se cierra a medianoche UTC y mañana hay uno nuevo.",
    ctaPlay: "Jugar el reto de hoy",
    ctaStats: "Ver las estadísticas",
  },
  footer: {
    privacy: "Privacidad",
    terms: "Términos",
    stats: "Estadísticas",
    sep: "Frontle · Celo Mainnet",
  },
};

const en: LandingCopy = {
  meta: {
    title: "Frontle — Link two countries through borders",
    description:
      "Daily geography challenge: we give you a start and an end country, you name the ones in between. Built for MiniPay, on Celo.",
  },
  nav: {
    how: "How to play",
    modes: "Modes",
    network: "Why Celo",
    transparency: "Transparency",
    play: "Play",
  },
  hero: {
    eyebrow: "Daily geography challenge",
    titleLead: "Link two countries through",
    titleAccent: "borders",
    lead:
      "We give you a start country and an end country. Name the ones in between, one at a time, until they touch. Fewer countries and less time, better rank.",
    ctaPlay: "Play today's challenge",
    ctaHow: "See how to play",
    chainAria: (route) => `Example of a solved route: ${route}.`,
    roleStart: "Start",
    roleEnd: "End",
    noteBefore: "Solved in ",
    noteAfter: " · the shortest route possible",
    noteCountries: (n) => (n === 1 ? "1 country" : `${n} countries`),
  },
  facts: {
    challenges: "Challenges a day",
    languages: "Languages",
    plays: "Games played",
    prizes: "Paid out to winners",
    pending: "loading",
  },
  how: {
    eyebrow: "How to play",
    title: "Three rules and you're playing",
    lead:
      "A game lasts as long as you take to think it through. No mandatory tutorial, no sign-up, nothing to download.",
    legendGood: "On the route",
    legendClose: "Close, but no",
    legendFar: "Far off",
    steps: [
      {
        title: "You get a start and an end",
        text:
          "Two countries, picked by the date — the same ones for everybody. You choose the difficulty: easy, medium or hard, each with its own leaderboard.",
      },
      {
        title: "You name countries that touch",
        text:
          "Every country you type has to share a land border with the chain. The colour tells you right away whether you're on track.",
      },
      {
        title: "You close the route",
        text:
          "Once the chain links start to end, that's it. Countries used count first, time counts second.",
      },
    ],
  },
  modes: {
    eyebrow: "Modes",
    title: "One challenge with a prize, four to practise",
    prized: "Prize",
    free: "Free",
    weekly: "Weekly",
    inUsdt: "in USDT",
    cup: "cup",
    items: [
      {
        title: "Daily challenge",
        text:
          "Three difficulties, three leaderboards and a prize per level. The pot lives in the contract, not in a spreadsheet.",
      },
      {
        title: "Regions",
        text: "The same mechanic inside a single country: departments, states or provinces instead of countries.",
      },
      {
        title: "Guess the flag",
        text:
          "Includes island nations, which have no land border and therefore never show up in the daily challenge.",
      },
      {
        title: "Guess the country",
        text: "Just the outline, no name and no flag. The shape is all you get.",
      },
      {
        title: "Practice mode",
        text: "Endless challenges, free hints and no clock. To get a feel for the map before competing.",
      },
      {
        title: "Weekly league",
        text: "The experience you earn in any mode counts towards the week's standings.",
      },
    ],
  },
  network: {
    eyebrow: "Why Celo",
    title: "You play with dollars, not with a token",
    lead:
      "Frontle is built for MiniPay, Opera's wallet. That shapes how money works inside the game.",
    points: [
      {
        title: "All in one stablecoin",
        text:
          "Prizes and payments are in USDT. The network fee is paid with it too, so you never need a second balance on the side.",
      },
      {
        title: "No sign-up",
        text:
          "Inside MiniPay you're already in: no connect screen, no password, no email. Outside MiniPay you can sign in with your email.",
      },
      {
        title: "Genuinely small amounts",
        text: "Hints and retries cost cents, and 80% of what is paid goes back into the day's pot.",
      },
      {
        title: "You claim your own prize",
        text:
          "Winning writes your address into the contract. You claim it whenever you want: nobody moves your money for you.",
      },
    ],
  },
  transparency: {
    eyebrow: "Transparency",
    title: "The contracts are published and verified",
    lead:
      "Celo Mainnet · chainId 42220. Anyone can read the pot, the accrued fees and each day's winners without asking us.",
    verified: "Verified",
    token: "Token",
    cta: "See the public stats",
    rows: {
      game2: "Game (v2, in use)",
      game1: "Game (v1, historical)",
      weekly: "Weekly cup",
      usdt: "USDT (6 decimals)",
    },
  },
  close: {
    eyebrow: "Today",
    title: "Today's challenge is still open",
    lead: "It closes at midnight UTC and there's a new one tomorrow.",
    ctaPlay: "Play today's challenge",
    ctaStats: "See the stats",
  },
  footer: { privacy: "Privacy", terms: "Terms", stats: "Stats", sep: "Frontle · Celo Mainnet" },
};

const pt: LandingCopy = {
  meta: {
    title: "Frontle — Una dois países atravessando fronteiras",
    description:
      "Desafio diário de geografia: damos um país de partida e um de chegada, e você escreve os que ficam no meio. Feito para a MiniPay, na Celo.",
  },
  nav: {
    how: "Como jogar",
    modes: "Modos",
    network: "Por que Celo",
    transparency: "Transparência",
    play: "Jogar",
  },
  hero: {
    eyebrow: "Desafio diário de geografia",
    titleLead: "Una dois países atravessando",
    titleAccent: "fronteiras",
    lead:
      "Damos um país de partida e um de chegada. Escreva os países que ficam no meio, um a um, até se tocarem. Menos países e menos tempo, melhor colocação.",
    ctaPlay: "Jogar o desafio de hoje",
    ctaHow: "Ver como se joga",
    chainAria: (route) => `Exemplo de uma rota resolvida: ${route}.`,
    roleStart: "Partida",
    roleEnd: "Chegada",
    noteBefore: "Resolvido em ",
    noteAfter: " · a rota mais curta possível",
    noteCountries: (n) => (n === 1 ? "1 país" : `${n} países`),
  },
  facts: {
    challenges: "Desafios por dia",
    languages: "Idiomas",
    plays: "Partidas jogadas",
    prizes: "Pago aos vencedores",
    pending: "carregando",
  },
  how: {
    eyebrow: "Como jogar",
    title: "Três regras e você já está jogando",
    lead:
      "Uma partida dura o tempo que você levar para pensar. Sem tutorial obrigatório, sem cadastro, sem nada para baixar.",
    legendGood: "Está na rota",
    legendClose: "Perto, mas não",
    legendFar: "Longe",
    steps: [
      {
        title: "Você recebe partida e chegada",
        text:
          "Dois países, escolhidos pelo dia — os mesmos para todo mundo. Você escolhe a dificuldade: fácil, médio ou difícil, cada uma com seu ranking.",
      },
      {
        title: "Você escreve países que se tocam",
        text:
          "Cada país que você escreve precisa dividir fronteira terrestre com a cadeia. A cor diz na hora se você está no caminho certo.",
      },
      {
        title: "Você fecha a rota",
        text:
          "Quando a cadeia une partida e chegada, acabou. Contam primeiro os países que você usou e depois o tempo.",
      },
    ],
  },
  modes: {
    eyebrow: "Modos",
    title: "Um desafio com prêmio, quatro para treinar",
    prized: "Com prêmio",
    free: "Grátis",
    weekly: "Semanal",
    inUsdt: "em USDT",
    cup: "copa",
    items: [
      {
        title: "Desafio diário",
        text:
          "Três dificuldades, três rankings e um prêmio por nível. O prêmio fica no contrato, não numa planilha.",
      },
      {
        title: "Regiões",
        text: "A mesma mecânica dentro de um só país: estados, departamentos ou províncias em vez de países.",
      },
      {
        title: "Adivinhe a bandeira",
        text:
          "Inclui as nações insulares, que não têm fronteira terrestre e por isso nunca aparecem no desafio diário.",
      },
      {
        title: "Adivinhe o país",
        text: "Só a silhueta, sem nome e sem bandeira. O contorno é tudo o que se vê.",
      },
      {
        title: "Modo treino",
        text: "Desafios infinitos, dicas grátis e sem relógio. Para pegar o jeito do mapa antes de competir.",
      },
      {
        title: "Liga semanal",
        text: "A experiência que você ganha em qualquer modo conta para a classificação da semana.",
      },
    ],
  },
  network: {
    eyebrow: "Por que Celo",
    title: "Joga-se com dólares, não com um token",
    lead:
      "O Frontle foi feito para a MiniPay, a carteira da Opera. Isso define como o dinheiro funciona dentro do jogo.",
    points: [
      {
        title: "Tudo em um stablecoin",
        text:
          "Os prêmios e os pagamentos são em USDT. A taxa de rede também é paga com ele, então nunca é preciso outro saldo à parte.",
      },
      {
        title: "Sem cadastro",
        text:
          "Dentro da MiniPay você já está dentro: sem tela de conexão, sem senha, sem e-mail. Fora da MiniPay dá para entrar com o seu e-mail.",
      },
      {
        title: "Quantias realmente pequenas",
        text: "Dicas e tentativas custam centavos, e 80 % do que se paga volta para o prêmio do dia.",
      },
      {
        title: "O prêmio quem saca é você",
        text:
          "Vencer deixa o seu endereço anotado no contrato. O saque é você que faz, quando quiser: ninguém mexe no seu dinheiro por você.",
      },
    ],
  },
  transparency: {
    eyebrow: "Transparência",
    title: "Os contratos estão publicados e verificados",
    lead:
      "Celo Mainnet · chainId 42220. Qualquer pessoa pode ler o prêmio, as taxas acumuladas e os vencedores de cada dia sem pedir permissão.",
    verified: "Verificado",
    token: "Token",
    cta: "Ver as estatísticas públicas",
    rows: {
      game2: "Jogo (v2, em uso)",
      game1: "Jogo (v1, histórico)",
      weekly: "Copa semanal",
      usdt: "USDT (6 casas decimais)",
    },
  },
  close: {
    eyebrow: "Hoje",
    title: "O desafio de hoje ainda está aberto",
    lead: "Fecha à meia-noite UTC e amanhã tem um novo.",
    ctaPlay: "Jogar o desafio de hoje",
    ctaStats: "Ver as estatísticas",
  },
  footer: {
    privacy: "Privacidade",
    terms: "Termos",
    stats: "Estatísticas",
    sep: "Frontle · Celo Mainnet",
  },
};

const fr: LandingCopy = {
  meta: {
    title: "Frontle — Reliez deux pays en traversant les frontières",
    description:
      "Défi de géographie quotidien : on vous donne un pays de départ et un pays d'arrivée, à vous d'écrire ceux du milieu. Conçu pour MiniPay, sur Celo.",
  },
  nav: {
    how: "Comment jouer",
    modes: "Modes",
    network: "Pourquoi Celo",
    transparency: "Transparence",
    play: "Jouer",
  },
  hero: {
    eyebrow: "Défi de géographie quotidien",
    titleLead: "Reliez deux pays en traversant les",
    titleAccent: "frontières",
    lead:
      "On vous donne un pays de départ et un pays d'arrivée. Écrivez ceux qui se trouvent entre les deux, un par un, jusqu'à ce qu'ils se touchent. Moins de pays et moins de temps, meilleur classement.",
    ctaPlay: "Jouer le défi du jour",
    ctaHow: "Voir comment jouer",
    chainAria: (route) => `Exemple d'un itinéraire résolu : ${route}.`,
    roleStart: "Départ",
    roleEnd: "Arrivée",
    noteBefore: "Résolu en ",
    noteAfter: " · l'itinéraire le plus court possible",
    noteCountries: (n) => (n === 1 ? "1 pays" : `${n} pays`),
  },
  facts: {
    challenges: "Défis par jour",
    languages: "Langues",
    plays: "Parties jouées",
    prizes: "Versé aux gagnants",
    pending: "chargement",
  },
  how: {
    eyebrow: "Comment jouer",
    title: "Trois règles et vous jouez déjà",
    lead:
      "Une partie dure le temps que vous mettez à réfléchir. Pas de tutoriel obligatoire, pas d'inscription, rien à télécharger.",
    legendGood: "Sur l'itinéraire",
    legendClose: "Proche, mais non",
    legendFar: "Loin",
    steps: [
      {
        title: "Vous recevez un départ et une arrivée",
        text:
          "Deux pays, choisis par la date — les mêmes pour tout le monde. Vous choisissez la difficulté : facile, moyen ou difficile, chacune avec son classement.",
      },
      {
        title: "Vous écrivez des pays qui se touchent",
        text:
          "Chaque pays que vous écrivez doit partager une frontière terrestre avec la chaîne. La couleur vous dit tout de suite si vous êtes sur la bonne voie.",
      },
      {
        title: "Vous fermez l'itinéraire",
        text:
          "Dès que la chaîne relie le départ à l'arrivée, c'est fini. Les pays utilisés comptent d'abord, le temps ensuite.",
      },
    ],
  },
  modes: {
    eyebrow: "Modes",
    title: "Un défi avec prix, quatre pour s'entraîner",
    prized: "Avec prix",
    free: "Gratuit",
    weekly: "Hebdo",
    inUsdt: "en USDT",
    cup: "coupe",
    items: [
      {
        title: "Défi quotidien",
        text:
          "Trois difficultés, trois classements et un prix par niveau. La cagnotte vit dans le contrat, pas dans un tableur.",
      },
      {
        title: "Régions",
        text:
          "La même mécanique à l'intérieur d'un seul pays : départements, États ou provinces au lieu de pays.",
      },
      {
        title: "Devinez le drapeau",
        text:
          "Inclut les nations insulaires, qui n'ont pas de frontière terrestre et n'apparaissent donc jamais dans le défi quotidien.",
      },
      {
        title: "Devinez le pays",
        text: "Rien que la silhouette, sans nom et sans drapeau. Le contour est tout ce que vous voyez.",
      },
      {
        title: "Mode entraînement",
        text: "Défis infinis, indices gratuits et sans chrono. Pour prendre le pouls de la carte avant de concourir.",
      },
      {
        title: "Ligue hebdomadaire",
        text: "L'expérience gagnée dans n'importe quel mode compte pour le classement de la semaine.",
      },
    ],
  },
  network: {
    eyebrow: "Pourquoi Celo",
    title: "On joue avec des dollars, pas avec un token",
    lead:
      "Frontle est conçu pour MiniPay, le portefeuille d'Opera. Cela détermine comment l'argent fonctionne dans le jeu.",
    points: [
      {
        title: "Tout dans un stablecoin",
        text:
          "Les prix et les paiements sont en USDT. Les frais de réseau se paient avec lui aussi, il n'y a donc jamais besoin d'un autre solde à côté.",
      },
      {
        title: "Sans inscription",
        text:
          "Dans MiniPay vous êtes déjà dedans : pas d'écran de connexion, pas de mot de passe, pas d'e-mail. Hors de MiniPay, vous pouvez entrer avec votre e-mail.",
      },
      {
        title: "De vraies petites sommes",
        text: "Les indices et les reprises coûtent des centimes, et 80 % de ce qui est payé revient à la cagnotte du jour.",
      },
      {
        title: "C'est vous qui touchez le prix",
        text:
          "Gagner inscrit votre adresse dans le contrat. Le retrait, c'est vous qui le faites, quand vous voulez : personne ne déplace votre argent à votre place.",
      },
    ],
  },
  transparency: {
    eyebrow: "Transparence",
    title: "Les contrats sont publiés et vérifiés",
    lead:
      "Celo Mainnet · chainId 42220. N'importe qui peut lire la cagnotte, les commissions accumulées et les gagnants de chaque jour sans nous demander la permission.",
    verified: "Vérifié",
    token: "Token",
    cta: "Voir les statistiques publiques",
    rows: {
      game2: "Jeu (v2, en service)",
      game1: "Jeu (v1, historique)",
      weekly: "Coupe hebdomadaire",
      usdt: "USDT (6 décimales)",
    },
  },
  close: {
    eyebrow: "Aujourd'hui",
    title: "Le défi du jour est encore ouvert",
    lead: "Il ferme à minuit UTC et il y en a un nouveau demain.",
    ctaPlay: "Jouer le défi du jour",
    ctaStats: "Voir les statistiques",
  },
  footer: {
    privacy: "Confidentialité",
    terms: "Conditions",
    stats: "Statistiques",
    sep: "Frontle · Celo Mainnet",
  },
};

const COPY: Record<Locale, LandingCopy> = { es, en, pt, fr };

export function landingCopy(locale: Locale): LandingCopy {
  return COPY[locale] ?? COPY.en;
}
