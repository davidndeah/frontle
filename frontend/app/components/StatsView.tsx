"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONTRACT_INFO, getPublicStats, type PublicStats } from "../lib/payments";
import { getCommunityStats, getTopCountries, type CommunityStats, type CountryStat } from "../lib/ranking";
import { codeToFlag, detectLocale, regionName, t, type Locale } from "../lib/i18n";

// Cuerpo de /stats. Cliente porque el idioma se detecta del navegador y los
// números se leen en vivo (contrato por RPC público + vistas de Supabase).
// Ninguna de las dos fuentes necesita wallet ni claves privadas.
export default function StatsView() {
  const [locale, setLocale] = useState<Locale>("es");
  const [chain, setChain] = useState<PublicStats | null>(null);
  const [community, setCommunity] = useState<CommunityStats | null>(null);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => setLocale(detectLocale()), []);

  useEffect(() => {
    Promise.all([getPublicStats(), getCommunityStats(), getTopCountries()]).then(([c, s, top]) => {
      setChain(c);
      setCommunity(s);
      setCountries(top);
      setDone(true);
    });
  }, []);

  const tr = t(locale).stats;
  const usdt = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n: number) => n.toLocaleString(locale);

  // La barra de cada país se mide contra el líder, no contra el total: así el
  // primero llena la barra y la comparación entre países se lee de un vistazo.
  // Ojo: el ancho va en CSS crudo, sin toLocaleString (en es daría "45 %").
  const maxPlays = countries.reduce((a, c) => Math.max(a, c.plays), 0);

  return (
    <div className="relative z-10 w-full max-w-md mx-auto flex flex-col gap-6">
      <header>
        <Link href="/" className="text-sm text-[#c4b5fd] underline">
          {tr.back}
        </Link>
        <h1 className="font-display text-3xl font-bold mt-3">{tr.title}</h1>
        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{tr.subtitle(CONTRACT_INFO.chainName)}</p>
      </header>

      <Section title={tr.today} aside={chain ? tr.dayNo(chain.day) : undefined} cols={3}>
        <Stat label={tr.prize} value={chain && usdt(chain.potToday)} unit={CONTRACT_INFO.token} done={done} />
        <Stat label={tr.plays} value={community && num(community.playsToday)} done={done} />
        <Stat label={tr.players} value={community && num(community.playersToday)} done={done} />
      </Section>

      <Section
        title={tr.community}
        aside={community ? tr.since(fmtDate(community.firstPlay, locale)) : undefined}
      >
        <Stat label={tr.plays} value={community && num(community.plays)} done={done} />
        <Stat label={tr.players} value={community && num(community.players)} done={done} />
        <Stat label={tr.daysPlayed} value={community && num(community.daysPlayed)} done={done} />
        <Stat label={tr.countries} value={community && num(community.countriesReached)} done={done} />
      </Section>

      {countries.length > 0 && (
        <section>
          <SectionHead title={tr.topCountries} aside={tr.last30d} />
          <div className="panel p-3 flex flex-col gap-2.5">
            {countries.map((c) => (
              <div key={c.code} className="flex items-center gap-2.5">
                <span className="text-lg leading-none w-6 shrink-0" aria-hidden="true">
                  {codeToFlag(c.code)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-neutral-200 truncate">{regionName(c.code, locale)}</span>
                    <span className="text-[11px] text-neutral-400 tabular-nums shrink-0">
                      {num(c.plays)} · {num(c.players)} {tr.players.toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#a855f7] to-[#fcff52]"
                      style={{ width: maxPlays > 0 ? `${(c.plays / maxPlays) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Section title={tr.economy} aside={tr.bothContracts}>
        <Stat label={tr.prizesPaid} value={chain && usdt(chain.prizesPaid)} unit={CONTRACT_INFO.token} done={done} />
        <Stat label={tr.daysClosed} value={chain && num(chain.daysClosed)} done={done} />
        <Stat
          label={tr.playerFunds}
          value={chain && usdt(chain.playerFunds)}
          unit={CONTRACT_INFO.token}
          hint={tr.playerFundsHint}
          done={done}
        />
        <Stat
          label={tr.protocolFees}
          value={chain && usdt(chain.protocolFees)}
          unit={CONTRACT_INFO.token}
          hint={tr.protocolFeesHint}
          done={done}
        />
      </Section>

      <section className="panel p-4 flex flex-col gap-3 text-sm text-neutral-200 leading-relaxed">
        <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">{tr.moneyTitle}</h2>
        <p>{tr.money1}</p>
        <p>{tr.money2("80%", "20%")}</p>
        <p>{tr.money3}</p>
      </section>

      <section className="panel p-4 flex flex-col gap-3 text-sm">
        <SectionHead title={tr.contractsTitle} aside={`${CONTRACT_INFO.chainName} · ${CONTRACT_INFO.token}`} bare />
        <ContractRow tag="v2" role={tr.contractInUse} address={CONTRACT_INFO.address} href={CONTRACT_INFO.explorer} accent />
        <ContractRow tag="v1" role={tr.contractLegacy} address={CONTRACT_INFO.addressV1} href={CONTRACT_INFO.explorerV1} />
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          {tr.contractsNote}{" "}
          <a
            href="https://github.com/davidndeah/frontle"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {tr.sourceOpen}
          </a>
          .
        </p>
      </section>

      <footer className="text-center text-[11px] text-neutral-500">
        Frontle ·{" "}
        <a href="https://celo.org" className="underline" target="_blank" rel="noopener noreferrer">
          Celo
        </a>{" "}
        · <Link href="/terms" className="underline">{tr.footerTerms}</Link> ·{" "}
        <Link href="/privacy" className="underline">{tr.footerPrivacy}</Link>
      </footer>
    </div>
  );
}

function fmtDate(iso: string, locale: Locale): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function SectionHead({ title, aside, bare = false }: { title: string; aside?: string; bare?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${bare ? "" : "mb-2 px-0.5"}`}>
      <h2 className="font-display text-xs font-bold uppercase tracking-[0.18em] text-[#c4b5fd]">{title}</h2>
      {aside && <span className="text-[10px] text-neutral-500 tabular-nums">{aside}</span>}
    </div>
  );
}

function Section({
  title,
  aside,
  cols = 2,
  children,
}: {
  title: string;
  aside?: string;
  cols?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHead title={title} aside={aside} />
      <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{children}</div>
    </section>
  );
}

// `value` null = aún cargando; si ya terminó, es que la fuente no respondió.
function Stat({
  label,
  value,
  unit,
  hint,
  done,
}: {
  label: string;
  value: string | null;
  unit?: string;
  hint?: string;
  done: boolean;
}) {
  return (
    <div className="panel p-3 flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-neutral-400 leading-tight">{label}</span>
      {value !== null ? (
        <span className="font-display text-2xl font-bold text-white tabular-nums leading-none">
          {value}
          {unit && <span className="ml-1 text-xs font-semibold text-neutral-400">{unit}</span>}
        </span>
      ) : done ? (
        <span className="font-display text-2xl font-bold text-neutral-600 leading-none">—</span>
      ) : (
        <span className="h-6 w-16 rounded bg-white/10 animate-pulse" />
      )}
      {hint && <span className="text-[10px] text-neutral-500 leading-tight">{hint}</span>}
    </div>
  );
}

// Una fila de contrato: etiqueta de versión, para qué sirve y su dirección.
function ContractRow({
  tag,
  role,
  address,
  href,
  accent = false,
}: {
  tag: string;
  role: string;
  address: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-[#b79ced]/15 p-2.5">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold font-display ${
          accent ? "bg-[#fcff52]/15 text-[#fcff52]" : "bg-white/10 text-neutral-400"
        }`}
      >
        {tag}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-neutral-400 leading-tight">{role}</span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline font-mono text-[11px] break-all leading-tight ${
            accent ? "text-[#fcff52]" : "text-[#c4b5fd]"
          }`}
        >
          {address}
        </a>
      </div>
    </div>
  );
}
