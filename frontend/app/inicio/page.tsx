import { Fragment } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Archivo, JetBrains_Mono } from "next/font/google";

import "./landing.css";
import { landingCopy } from "./copy";
import Reveal from "./Reveal";
import LiveFacts from "./LiveFacts";
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
//  llega HTML. Lo único que se hidrata son dos islas mínimas (Reveal y
//  LiveFacts).
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

// Ruta de ejemplo del héroe. Es la misma que usa el tutorial dentro de la app,
// así que lo que se ve aquí es literalmente lo que se encuentra al entrar.
// Nombres canónicos: los traduce `countryName` vía Intl.DisplayNames — regla
// del repo, nunca se escribe un país a mano en otro idioma.
const CHAIN = ["Portugal", "Spain", "France", "Germany"] as const;

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

  const stops = CHAIN.map((canonical) => countryName(canonical, locale));
  // "Resuelto en 2 países": los intermedios, que es lo que puntúa.
  const optimal = stops.length - 2;

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
            <Link className="btn btn-primary btn-sm" href="/" style={{ marginLeft: "1rem" }}>
              {c.nav.play}
            </Link>
          </div>
        </header>

        {/* ============ HÉROE ============ */}
        <section className="hero" id="top">
          <div className="wrap">
            <p className="eyebrow">{c.hero.eyebrow}</p>
            <h1>
              {c.hero.titleLead} <em>{c.hero.titleAccent}</em>
            </h1>
            <p className="lead">{c.hero.lead}</p>
            <div className="actions">
              <Link className="btn btn-primary" href="/">
                {c.hero.ctaPlay}
              </Link>
              <a className="btn btn-ghost" href="#como">
                {c.hero.ctaHow}
              </a>
            </div>
          </div>

          {/* La firma de la página: la mecánica, ejecutándose */}
          <div className="chain-band" role="img" aria-label={c.hero.chainAria(stops.join(" → "))}>
            {/* Fragment y no un <span> envolvente: la secuencia de la
                animación se apoya en `.chain > :nth-child(n)`, así que las
                paradas y los tramos tienen que ser hijos DIRECTOS de .chain. */}
            <div className="chain" aria-hidden="true">
              {stops.map((name, i) => {
                const first = i === 0;
                const last = i === stops.length - 1;
                const role = first ? c.hero.roleStart : last ? c.hero.roleEnd : `+${i}`;
                return (
                  <Fragment key={name}>
                    {i > 0 && <span className="leg" />}
                    <span className={`stop${first ? " is-start" : ""}${last ? " is-end" : ""}`}>
                      <span className="dot" />
                      <span className="name">{name}</span>
                      <span className="role">{role}</span>
                    </span>
                  </Fragment>
                );
              })}
            </div>
          </div>
          <p className="chain-note">
            {c.hero.noteBefore}
            <b>{c.hero.noteCountries(optimal)}</b>
            {c.hero.noteAfter}
          </p>
        </section>

        {/* ============ CIFRAS ============ */}
        <section style={{ paddingTop: "clamp(2.5rem,5vw,4rem)" }}>
          <div className="wrap">
            <div className="facts">
              <div className="fact">
                <p className="n">3</p>
                <p className="k">{c.facts.challenges}</p>
              </div>
              <div className="fact">
                <p className="n">{LOCALES.length}</p>
                <p className="k">{c.facts.languages}</p>
              </div>
              <LiveFacts
                locale={locale}
                playsLabel={c.facts.plays}
                prizesLabel={c.facts.prizes}
                pending={c.facts.pending}
              />
            </div>
          </div>
        </section>

        {/* ============ CÓMO SE JUEGA ============ */}
        <section id="como">
          <div className="wrap how">
            <div>
              <p className="eyebrow">{c.how.eyebrow}</p>
              <h2 style={{ marginTop: "1.3rem" }}>{c.how.title}</h2>
              <p className="lead" style={{ marginTop: "1.3rem" }}>
                {c.how.lead}
              </p>

              <div className="legend">
                <span className="key">
                  <i style={{ background: "var(--good)" }} /> {c.how.legendGood}
                </span>
                <span className="key">
                  <i style={{ background: "var(--gold)" }} /> {c.how.legendClose}
                </span>
                <span className="key">
                  <i style={{ background: "#f87171" }} /> {c.how.legendFar}
                </span>
              </div>
            </div>

            <Reveal>
              <ol className="steps">
                {c.how.steps.map((step, i) => (
                  <li className="step" key={step.title}>
                    <span className="mark">{i + 1}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        <hr className="rule" />

        {/* ============ MODOS ============ */}
        <section id="modos">
          <div className="wrap">
            <p className="eyebrow">{c.modes.eyebrow}</p>
            <h2 style={{ marginTop: "1.3rem", maxWidth: "20ch" }}>{c.modes.title}</h2>

            <Reveal>
              <div className="modes">
                {c.modes.items.map((mode, i) => (
                  <div className={`mode${i === 0 ? " is-flagship" : ""}`} key={mode.title}>
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

        <hr className="rule" />

        {/* ============ POR QUÉ CELO ============ */}
        <section id="red">
          <div className="wrap two">
            <div>
              <p className="eyebrow">{c.network.eyebrow}</p>
              <h2 style={{ marginTop: "1.3rem", maxWidth: "16ch" }}>{c.network.title}</h2>
              <p className="lead" style={{ marginTop: "1.3rem" }}>
                {c.network.lead}
              </p>
            </div>
            <ul className="points">
              {c.network.points.map((point) => (
                <li key={point.title}>
                  <span className="bullet" />
                  <span>
                    <b>{point.title}</b>
                    <span>{point.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <hr className="rule" />

        {/* ============ TRANSPARENCIA ============ */}
        <section id="transparencia">
          <div className="wrap">
            <p className="eyebrow">{c.transparency.eyebrow}</p>
            <h2 style={{ marginTop: "1.3rem", maxWidth: "19ch" }}>{c.transparency.title}</h2>
            <p className="lead" style={{ marginTop: "1.3rem" }}>
              {c.transparency.lead}
            </p>

            <div className="ledger">
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

            <p style={{ marginTop: "1.4rem" }}>
              <Link className="btn btn-ghost btn-sm" href="/stats">
                {c.transparency.cta}
              </Link>
            </p>
          </div>
        </section>

        {/* ============ CIERRE ============ */}
        <section className="close">
          <div className="wrap">
            <p className="eyebrow">{c.close.eyebrow}</p>
            <h2>{c.close.title}</h2>
            <p className="lead">{c.close.lead}</p>
            <div className="actions">
              <Link className="btn btn-primary" href="/">
                {c.close.ctaPlay}
              </Link>
              <Link className="btn btn-ghost" href="/stats">
                {c.close.ctaStats}
              </Link>
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
    </main>
  );
}
