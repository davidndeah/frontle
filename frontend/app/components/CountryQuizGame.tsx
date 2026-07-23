"use client";

// ============================================================
//  CountryQuizGame — modos "Adivina la bandera" y "Adivina el contorno".
//  Un solo componente parametrizado por `mode` (PLAN-MODOS-QUIZ.md §2):
//  se muestra el estímulo (bandera grande o silueta) y el jugador escribe
//  el país; la escalera de pistas (culturales + derivadas) se revela de a
//  una y cada pista resta estrellas. Endless: al acertar, "otra ronda".
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { type Difficulty } from "../lib/game";
import { countryName, t, type Locale } from "../lib/i18n";
import { quizCountryInfo, randomQuizCountry, resolveQuizCountry, suggestQuizCountries, quizHints, type QuizMode } from "../lib/quiz";
import CountryOutline from "./CountryOutline";
import { sfxGood, sfxInvalid, sfxWin } from "../lib/sfx";
import { awardQuizCorrect } from "../lib/xp";
import { spendCoins } from "../lib/coins";
import CoinShop from "./CoinShop";
import ScoreCard from "./ScoreCard";
import type { BordyMood } from "./Bordy";

function BigFlag({ name }: { name: string }) {
  const c = quizCountryInfo(name);
  // Si flagcdn no carga (red del usuario, CDN caído), cae al emoji en vez
  // del icono de imagen rota — la ronda sigue siendo jugable.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [name]);
  if (!c) return null;
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-panel border border-lavender/20 flex items-center justify-center py-6">
      {failed ? (
        <span className="text-[96px] leading-none drop-shadow-2xl" aria-hidden>{c.flag}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/${c.code.toLowerCase()}.svg`}
          alt=""
          onError={() => setFailed(true)}
          className="w-[70%] max-w-[260px] rounded shadow-2xl"
        />
      )}
    </div>
  );
}

export default function CountryQuizGame({
  mode, locale, onExit, reactBordy,
}: {
  mode: QuizMode; locale: Locale; onExit: () => void;
  /** Bordy vive en page.tsx (FAB fijo, global); este modo solo le avisa qué sintió. */
  reactBordy?: (m: BordyMood) => void;
}) {
  const tr = t(locale);
  const [level, setLevel] = useState<Difficulty>("easy");
  const [country, setCountry] = useState<string>(() => randomQuizCountry("easy", undefined, mode));
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [revealed, setRevealed] = useState(0); // nº de pistas mostradas
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  // Tienda de monedas: se abre cuando una pista no alcanza el saldo.
  const [shopOpen, setShopOpen] = useState(false);
  async function paidReveal() {
    if (revealed >= hints.length) return;
    const r = await spendCoins("spend_hint", `quiz:${mode}`);
    if (r === "ok") { setRevealed((n) => Math.min(hints.length, n + 1)); reactBordy?.("pensando"); }
    else setShopOpen(true);
  }
  const inputRef = useRef<HTMLInputElement>(null);

  const hints = useMemo(
    () =>
      quizHints(country, locale, {
        continentHint: (n) => tr.quiz.continentIn(n),
        bordersHint: (n) => tr.quiz.borders(n),
        islandHint: tr.quiz.island,
        initialHint: (l) => tr.quiz.initial(l),
      }),
    [country, locale, tr]
  );

  useEffect(() => {
    setSuggestions(input.length >= 2 ? suggestQuizCountries(input, locale) : []);
  }, [input, locale]);

  function newRound(lv: Difficulty = level) {
    setCountry(randomQuizCountry(lv, country, mode));
    setInput("");
    setSuggestions([]);
    setMessage(null);
    setRevealed(0);
    setTries(0);
    setSolved(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submit(value: string) {
    if (solved) return;
    const canonical = resolveQuizCountry(value);
    if (canonical === country) {
      setSolved(true);
      setMessage({ text: tr.quiz.correct(countryName(country, locale)), ok: true });
      sfxWin();
      // Cada ronda ES un reto completo (no hay pasos intermedios como en el
      // mundial), así que el acierto aquí equivale al "solved" de los otros
      // modos, no a un paso verde: reacciona con la celebración grande.
      reactBordy?.("racha");
      // Liga v2: acierto de quiz da XP (tope diario en el servidor).
      awardQuizCorrect(mode);
    } else {
      setTries((n) => n + 1);
      setMessage({ text: canonical ? tr.quiz.wrong : tr.feedback("unknown", { end: "", input: value }), ok: false });
      if (canonical) sfxInvalid(); else sfxInvalid();
      reactBordy?.("fallo");
    }
    setInput("");
    setSuggestions([]);
    inputRef.current?.focus();
  }

  // Estrellas: sin pistas = 3 · 1–2 pistas = 2 · más = 1
  const stars = solved ? (revealed === 0 ? 3 : revealed <= 2 ? 2 : 1) : 0;
  const title = mode === "flag" ? tr.quiz.flagTitle : tr.quiz.outlineTitle;

  return (
    <div className="flex flex-col gap-4">
      {/* volver */}
      <CoinShop tr={tr} open={shopOpen} onClose={() => setShopOpen(false)} />
      <button onClick={onExit} className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit">
        <span className="w-7 h-7 rounded-full bg-white/5 border border-lavender/25 flex items-center justify-center">←</span>
        <span className="font-display font-semibold">{mode === "flag" ? "🏳️" : "🗺️"} {title}</span>
      </button>

      {/* dificultad */}
      <div className="flex justify-center gap-2">
        {(["easy", "medium", "hard"] as Difficulty[]).map((lv) => (
          <button
            key={lv}
            onClick={() => { setLevel(lv); newRound(lv); }}
            className={`brutal-sm brutal-press rounded-lg px-3 py-1.5 text-xs font-semibold ${level === lv ? "bg-gold text-surface" : "bg-surface text-white"}`}
          >
            {tr.levels[lv]}
          </button>
        ))}
      </div>

      {/* estímulo */}
      {mode === "flag" ? <BigFlag name={country} /> : <CountryOutline country={country} loadingLabel={tr.loadingMap} />}
      <p className="text-center text-sm font-semibold text-white -mt-1">{tr.quiz.whichCountry}</p>

      {/* pistas reveladas */}
      {hints.slice(0, revealed).map((h, i) => (
        <p key={i} className="text-center text-sm text-gold">
          💡 {h.kind === "continent" ? tr.quiz.continentIn(tr.continents[h.text as keyof typeof tr.continents]) : h.text}
        </p>
      ))}
      {revealed > 0 && hints[revealed - 1]?.kind === "cross" && (
        <div>
          <p className="text-center text-xs text-neutral-300 mb-2">{mode === "flag" ? tr.quiz.crossOutline : tr.quiz.crossFlag}</p>
          {mode === "flag" ? <CountryOutline country={country} loadingLabel={tr.loadingMap} /> : <BigFlag name={country} />}
        </div>
      )}

      {solved ? (
        <section className="panel p-5 text-center">
          <div className="text-2xl font-black prism-text">{tr.winNormal}</div>
          <div className="text-3xl mt-2">{"⭐".repeat(stars)}<span className="opacity-25">{"⭐".repeat(3 - stars)}</span></div>
          <p className="text-neutral-200 mt-2">{tr.quiz.correct(countryName(country, locale))}</p>
          <div className="mt-4">
            <ScoreCard
              data={{
                modeLabel: mode === "flag" ? tr.quiz.flagTitle : tr.quiz.outlineTitle,
                dateLabel: new Date().toLocaleDateString(locale),
                stars,
                stats: [tr.quiz.tries(tries)],
              }}
              shareText={`Frontle · ${mode === "flag" ? tr.quiz.flagTitle : tr.quiz.outlineTitle}
${"⭐".repeat(stars)}
frontle.vercel.app`}
              label={tr.share}
              copiedLabel={tr.copied}
            />
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <button onClick={() => newRound()} className="brutal-sm brutal-press rounded-xl bg-gold px-6 py-3 font-bold text-surface">
              🔄 {tr.practiceNextRound}
            </button>
            <button onClick={onExit} className="brutal-sm brutal-press rounded-xl bg-surface px-6 py-3 font-bold text-white">
              {tr.region.chooseOtherMode}
            </button>
          </div>
        </section>
      ) : (
        <section className="relative flex flex-col gap-3">
          <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(input); }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr.placeholder}
              autoComplete="off"
              className="flex-1 rounded-xl bg-base border border-lavender/30 px-4 py-3 text-base text-white outline-none focus:border-gold/70 transition"
            />
            <button type="submit" className="brutal-sm brutal-press rounded-xl bg-gold px-5 py-3 font-bold text-surface">OK</button>
          </form>

          {suggestions.length > 0 && (
            <ul className="absolute z-20 top-14 w-full rounded-xl bg-surface border border-lavender/30 overflow-hidden shadow-2xl">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => submit(s)} className="w-full text-left px-4 py-2.5 hover:bg-white/10">
                    {countryName(s, locale)}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {message && (
            <p className={`text-center text-sm ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => void paidReveal()}
              disabled={revealed >= hints.length}
              className="brutal-sm brutal-press rounded-lg bg-surface px-4 py-1.5 text-xs text-white disabled:opacity-50"
            >
              💡 {tr.quiz.hintBtn} ({revealed}/{hints.length}) · {tr.coins.cost(3)}
            </button>
            <span className="text-xs text-neutral-400">{tr.quiz.tries(tries)}</span>
          </div>
        </section>
      )}
    </div>
  );
}
