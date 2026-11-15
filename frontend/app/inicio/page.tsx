import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Archivo, JetBrains_Mono } from "next/font/google";

import "./landing.css";
import { landingCopy } from "./copy";
import Reveal from "./Reveal";
import { Suspense } from "react";
import LiveFacts, { LiveFactsFallback } from "./LiveFacts";
import CountUp from "./CountUp";
import PlayDialog from "./PlayDialog";
import Globe, { type GlobeRoute } from "./Globe";
import { shortestPath } from "../lib/game";
import { COUNTRY_NAMES } from "../lib/countries";
import { CONTRACT_INFO } from "../lib/payments";
import { XP } from "../lib/xp";
import { countryName, DEFAULT_LOCALE, LOCALES, type Locale } from "../lib/i18n";
import { SITE_URL } from "../lib/site";

// ============================================================
//  Frontle — landing web (/inicio)
//
//  Esta página es para NAVEGADOR. La puerta de MiniPay sigue siendo `/`,
//  que es la app: MiniPay entra directo al juego y meterle una landing
//  delante sería un toque extra, justo lo contrario de lo que pidió su
//  equipo. Por eso la landing vive en su propia ruta y `/` no se toca.
//
//  Es un Server Component. Eso importa: el diccionario de textos, la tabla
//  de países y CONTRACT_INFO se resuelven en el servidor y al cliente solo
//  llega HTML. Lo único que se hidrata son islas pequeñas: Reveal, CountUp
//  y el globo del héroe (d3-geo + canvas, sin más dependencias).
// ============================================================

// Tipografía distinta de la de la app a propósito. Fredoka es redonda y
// simpática — funciona dentro del juego y no funciona en una página que tiene
// que dar seriedad a un producto que custodia dinero de jugadores. Archivo en
// ancho expandido lee como portada de atlas; el mono queda para lo que es dato.
// Declaradas aquí y no en el layout: así solo las descarga esta ruta.
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"], // el eje de ancho es la mitad del carácter de la página
  variable: "--font-landing-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-landing-mono",
  display: "swap",
});

// Marca el <main> antes del primer pintado. El CSS del reveal cuelga de este
// atributo, así que sin JS el contenido nace visible en vez de quedarse
// invisible para siempre.
//
// Va en el <main> y no en <html> por dos motivos: <html> lo pinta el layout
// raíz, que es de toda la app y no puedo marcar con `suppressHydrationWarning`
// solo para esta ruta —React avisaba de un atributo que el servidor no había
// emitido—; y así el flag desaparece con la página al salir de aquí.
//
// `document.currentScript` durante el parseo es este mismo <script>, y su
// padre es el <main>. Corre antes de que se pinte nada de la landing.
const JS_FLAG = 'document.currentScript.parentElement.dataset.landingJs="1"';

// Retos que recorre el globo del héroe. Solo se fijan salida y llegada: la
// ruta la calcula `shortestPath`, así que lo que se enseña es siempre una
// solución óptima de verdad. El primero es el mismo del tutorial de la app.
// Nombres canónicos: los traduce `countryName` vía Intl.DisplayNames — regla
// del repo, nunca se escribe un país a mano en otro idioma.
const GLOBE_CHALLENGES: [string, string][] = [
  ["Portugal", "Germany"],
  ["Colombia", "Argentina"],
  ["Kenya", "Namibia"],
  ["India", "Mongolia"],
  ["Canada", "Guatemala"],
];

// Modos jugables: reto diario, regiones, bandera, silueta y práctica. La liga
// semanal no cuenta: es una clasificación sobre esos modos, no un modo más
// (por eso la sección de modos dice "un reto con premio, cuatro para practicar").
const GAME_MODES = 5;

// Países de la cinta que se desplaza bajo el héroe. Una muestra fija (no
// aleatoria) para que el HTML del servidor y el del cliente coincidan.
const TICKER = COUNTRY_NAMES.filter((_, i) => i % 5 === 0).slice(0, 28);

// Los botones de Jugar no apuntan a `/` a secas. En escritorio el proxy
// reescribe `/` a esta misma landing, asi que un enlace pelado devolveria
// al visitante justo de donde viene. `?play` es la senal de "quiero el
// juego": el proxy la deja pasar y ademas deja una cookie, para que las
// visitas siguientes a `/` vayan derechas al juego.
const JUGAR_HREF = "/?play=1";

type Search = Promise<{ [key: string]: string | string[] | undefined }>;

// Idioma sin salto de hidratación: se decide en el servidor con Accept-Language
// (`?lang=` manda, para poder compartir y probar una versión concreta). La app
// lo hace en el cliente porque allí pesa más la preferencia guardada; aquí gana
// que el buscador y el primer pintado vean ya el idioma bueno.
function localeFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.startsWith("q="));
      return { tag: tag.slice(0, 2).toLowerCase(), q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of ranked) {
    if ((LOCALES as string[]).includes(tag)) return tag as Locale;
  }
  return DEFAULT_LOCALE;
}

async function resolveLocale(searchParams: Search): Promise<Locale> {
  const asked = (await searchParams).lang;
  const tag = Array.isArray(asked) ? asked[0] : asked;
  if (tag && (LOCALES as string[]).includes(tag)) return tag as Locale;
  return localeFromHeader((await headers()).get("accept-language"));
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const locale = await resolveLocale(searchParams);
  const { meta } = landingCopy(locale);
  return {
    title: meta.title,
    description: meta.description,
    // El canónico es esta ruta, no `/`: son dos páginas distintas y sin esto
    // los buscadores las leerían como contenido duplicado de la app.
    alternates: { canonical: "/inicio" },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/inicio`,
      siteName: "Frontle",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function Inicio({ searchParams }: { searchParams: Search }) {
  const locale = await resolveLocale(searchParams);
  const c = landingCopy(locale);

  const routes: GlobeRoute[] = GLOBE_CHALLENGES.map(([from, to]) => {
    const path = shortestPath(from, to) ?? [from, to];
    return {
      stops: path.map((canonical) => ({ canonical, label: countryName(canonical, locale) })),
      // "Resuelto en 2 países": los intermedios, que es lo que puntúa.
      note: c.hero.noteCountries(path.length - 2),
    };
  });
  const tickerNames = TICKER.map((n) => countryName(n, locale));

  const modeTags = [
    `${c.modes.prized} · `,
    `${c.modes.free} · `,
    `${c.modes.free} · `,
    `${c.modes.free} · `,
    `${c.modes.free} · `,
    `${c.modes.weekly} · `,
  ];
  const modeValues = [
    c.modes.inUsdt,
    `+${XP.region} XP`,
    `+${XP.quiz} XP`,
    `+${XP.quiz} XP`,
    `+${XP.practice} XP`,
    c.modes.cup,
  ];

  const ledger = [
    { what: c.transparency.rows.game2, addr: CONTRACT_INFO.address, href: CONTRACT_INFO.explorer, state: c.transparency.verified },
    { what: c.transparency.rows.game1, addr: CONTRACT_INFO.addressV1, href: CONTRACT_INFO.explorerV1, state: c.transparency.verified },
    // Sin desplegar/configurar no se anuncia: mejor una fila menos que una
    // dirección vacía en la sección que presume de verificable.
    ...(CONTRACT_INFO.addressWeekly
      ? [{ what: c.transparency.rows.weekly, addr: CONTRACT_INFO.addressWeekly, href: CONTRACT_INFO.explorerWeekly, state: c.transparency.verified }]
      : []),
    { what: c.transparency.rows.usdt, addr: CONTRACT_INFO.tokenAddress, href: CONTRACT_INFO.explorerToken, state: c.transparency.token },
  ];

  return (
    // El atributo lo escribe el script de abajo, no el servidor: sin
    // `suppressHydrationWarning` React lo denuncia como desajuste.
    <main
      lang={locale}
      suppressHydrationWarning
      className={`landing ${display.variable} ${mono.variable}`}
    >
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />

      {/* Fondo: auroras violeta que derivan despacio. Sustituye a la
          retícula, que envejecía la página. Solo transform: lo mueve la GPU
          sin repintar nada. */}
      <div className="aurora" aria-hidden="true">
        <span className="a1" />
        <span className="a2" />
        <span className="a3" />
      </div>

      <div className="shell">
        <header className="nav">
          <div className="wrap">
            <a className="brand" href="#top">
              Fron<span>tle</span>
            </a>
            <nav>
              <a href="#como">{c.nav.how}</a>
              <a href="#modos">{c.nav.modes}</a>
              <a href="#red">{c.nav.network}</a>
              <a href="#transparencia">{c.nav.transparency}</a>
            </nav>
            <a className="btn btn-primary btn-sm" href={JUGAR_HREF} data-play>
              {c.nav.play}
            </a>
          </div>
        </header>

        {/* ============ HÉROE ============ */}
        <section className="hero" id="top">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{c.hero.eyebrow}</p>
              <h1>
                {c.hero.titleLead} <em>{c.hero.titleAccent}</em>
              </h1>
              <p className="lead">{c.hero.lead}</p>
              <div className="actions">
                <a className="btn btn-primary btn-lg btn-pulse" href={JUGAR_HREF} data-play>
                  {c.hero.ctaPlay} <span aria-hidden="true">→</span>
                </a>
                <a className="btn btn-ghost btn-lg" href="#como">
                  {c.hero.ctaHow}
                </a>
              </div>
            </div>

            {/* La firma de la página: el juego, ejecutándose sobre el globo. */}
            <Globe
              routes={routes}
              roleStart={c.hero.roleStart}
              roleEnd={c.hero.roleEnd}
              noteBefore={c.hero.noteBefore}
              noteAfter={c.hero.noteAfter}
              ariaLabel={c.hero.chainAria(routes[0].stops.map((s) => s.label).join(" → "))}
            />
          </div>
        </section>

        {/* ============ CINTA ============ */}
        <div className="ticker" aria-hidden="true">
          {/* Dos copias seguidas: cuando la primera sale, la segunda ocupa
              su sitio y el bucle no se nota. */}
          <div className="ticker-track">
            {[0, 1].map((copy) => (
              <span className="ticker-run" key={copy}>
                {tickerNames.map((name) => (
                  <span key={`${copy}-${name}`}>
                    {name}
                    <i>→</i>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ============ CIFRAS ============ */}
        <section className="facts-section">
          <div className="wrap">
            <Reveal>
              <div className="facts stagger">
                <div className="fact card">
                  <p className="n">
                    <CountUp value={3} />
                  </p>
                  <p className="k">{c.facts.challenges}</p>
                </div>
                <div className="fact card">
                  <p className="n">
                    <CountUp value={GAME_MODES} />
                  </p>
                  <p className="k">{c.facts.modes}</p>
                </div>
                {/* Cifras vivas: se calculan en el servidor (con caché de un
                    día) y llegan en el mismo stream sin frenar el resto. */}
                <Suspense
                  fallback={
                    <LiveFactsFallback
                      txLabel={c.facts.transactions}
                      playersLabel={c.facts.players}
                      pending={c.facts.pending}
                    />
                  }
                >
                  <LiveFacts locale={locale} txLabel={c.facts.transactions} playersLabel={c.facts.players} />
                </Suspense>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ CÓMO SE JUEGA ============ */}
        <section id="como">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">{c.how.eyebrow}</p>
              <h2>{c.how.title}</h2>
              <p className="lead">{c.how.lead}</p>
            </div>

            <Reveal>
              <ol className="steps stagger">
                {c.how.steps.map((step, i) => (
                  <li className="step card" key={step.title}>
                    <span className="mark">{i + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </li>
                ))}
              </ol>
            </Reveal>

            {/* Semáforo: el sistema de aciertos, explicado una vez */}
            <div className="legend">
              <span className="key key-good">{c.how.legendGood}</span>
              <span className="key key-close">{c.how.legendClose}</span>
              <span className="key key-far">{c.how.legendFar}</span>
            </div>
          </div>
        </section>

        {/* ============ MODOS ============ */}
        <section id="modos">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">{c.modes.eyebrow}</p>
              <h2>{c.modes.title}</h2>
            </div>

            <Reveal>
              <div className="modes stagger">
                {c.modes.items.map((mode, i) => (
                  <div className={`mode card${i === 0 ? " is-flagship" : ""}`} key={mode.title}>
                    <p className="tag">
                      {modeTags[i]}
                      <b>{modeValues[i]}</b>
                    </p>
                    <h3>{mode.title}</h3>
                    <p>{mode.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============ POR QUÉ CELO ============ */}
        <section id="red">
          <div className="wrap two">
            <div className="section-head">
              <p className="eyebrow">{c.network.eyebrow}</p>
              <h2>{c.network.title}</h2>
              <p className="lead">{c.network.lead}</p>
            </div>
            <Reveal>
              <ul className="points stagger">
                {c.network.points.map((point, i) => (
                  <li key={point.title} className="card">
                    <span className="bullet">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <b>{point.title}</b>
                      <span>{point.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ============ TRANSPARENCIA ============ */}
        <section id="transparencia">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">{c.transparency.eyebrow}</p>
              <h2>{c.transparency.title}</h2>
              <p className="lead">{c.transparency.lead}</p>
            </div>

            <Reveal>
              <div className="ledger card">
                {ledger.map((row) => (
                  <div className="row" key={row.addr}>
                    <span className="what">{row.what}</span>
                    {/* La dirección enlaza al explorador: en una sección que dice
                        "compruébalo tú" el texto suelto no basta. */}
                    <a className="addr" href={row.href} target="_blank" rel="noopener noreferrer">
                      {row.addr}
                    </a>
                    <span className="state">{row.state}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            <p className="after-ledger">
              <Link className="btn btn-ghost btn-sm" href="/stats">
                {c.transparency.cta}
              </Link>
            </p>
          </div>
        </section>

        {/* ============ CIERRE ============ */}
        <section className="close">
          <div className="wrap">
            <div className="close-slab">
              <p className="eyebrow">{c.close.eyebrow}</p>
              <h2>{c.close.title}</h2>
              <p className="lead">{c.close.lead}</p>
              <div className="actions">
                <a className="btn btn-dark btn-lg" href={JUGAR_HREF} data-play>
                  {c.close.ctaPlay} <span aria-hidden="true">→</span>
                </a>
                <Link className="btn btn-outline-dark btn-lg" href="/stats">
                  {c.close.ctaStats}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <footer>
          <div className="wrap">
            <Link href="/privacy">{c.footer.privacy}</Link>
            <Link href="/terms">{c.footer.terms}</Link>
            <Link href="/stats">{c.footer.stats}</Link>
            <span className="sep">{c.footer.sep}</span>
          </div>
        </footer>
      </div>

      {/* Los botones de Jugar (data-play) abren esto: MiniPay primero. */}
      <PlayDialog copy={c.playDialog} browserHref={JUGAR_HREF} />
    </main>
  );
}
