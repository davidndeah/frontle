"use client";

// ============================================================
//  FlagRushGame — el modo Flag Rush (reemplaza a "Adivina la bandera").
//
//  10 banderas con 4 opciones y 10 s cada una, una partida por ventana de
//  8 h. El servidor decide todo (lib/flagRush.ts → función `game`): esta
//  pantalla muestra la bandera que le llega, manda lo que toca el jugador y
//  enseña el veredicto. Nunca sabe la respuesta antes de contestar.
//
//  Fases: intro (ventanas del día y XP) → partida → resultado. Tras jugar la
//  ventana queda la práctica libre, que corre en el navegador y no da XP.
//
//  Mismo molde visual que CountryQuizGame (panel, bandera grande, botones
//  brutal). La escena de entrada en 3D llega después; aquí no hay adornos:
//  solo se mueve lo que dice algo (la bandera nueva, el reloj, el veredicto).
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { countryName, t, type Locale } from "../lib/i18n";
import { useTr } from "../lib/useTr";
import Icon3D, { Ico } from "./icons/Icon3D";
import { useEstetica } from "../lib/estetica";
import {
  flagUrl, formatWait, practiceQuestions, rushCanonical, rushClient, slotOf, slotStarts,
  RUSH_ANSWER_MS, RUSH_VERDICT_MS,
  type LocalQuestion, type RushClient, type RushError, type RushQuestion, type RushResult, type RushStatus,
} from "../lib/flagRush";
import { sfxGood, sfxInvalid, sfxWin } from "../lib/sfx";
import type { BordyMood } from "./Bordy";
import dynamic from "next/dynamic";

// La escena de entrada trae three.js (120 KB comprimido): va en su propio
// trozo y se pide al abrir Flag Rush (ver el efecto de precarga), no al
// cargar la app.
const loadIntro = () => import("./FlagRushIntro");
const FlagRushIntro = dynamic(loadIntro, {
  ssr: false,
  // Mientras llega, el mismo fondo de la escena: sin parpadeo de la pantalla de inicio.
  loading: () => <div className="fixed inset-0 z-[60]" style={{ background: "var(--body-grad)" }} />,
});

// Lo que dura el veredicto en pantalla antes de pasar a la siguiente bandera.
// El servidor arranca el reloj de la siguiente al terminar esta pausa
// (VERDICT_MS en rush-core.ts), así que no le resta tiempo al jugador.
const VERDICT_MS = RUSH_VERDICT_MS;

type Pick = { choice: string | null; answer?: string; correct?: boolean };
type Dot = boolean | null;

type Phase =
  | { k: "loading" }
  | { k: "intro"; status: RushStatus | null; error?: RushError }
  | { k: "playing"; sessionId: string; q: RushQuestion; deadline: number; shownAt: number; dots: Dot[]; pick?: Pick; error?: RushError }
  | { k: "result"; result: RushResult; nextSlotAt: string }
  | { k: "practice"; qs: LocalQuestion[]; i: number; deadline: number; dots: Dot[]; pick?: Pick }
  | { k: "practiceDone"; correct: number; dots: Dot[] };

export default function FlagRushGame({
  locale, onExit, reactBordy, client: clientProp,
}: {
  locale: Locale;
  onExit: () => void;
  /** Bordy vive en page.tsx (FAB global); este modo solo le avisa qué sintió. */
  reactBordy?: (m: BordyMood) => void;
  /** Para el laboratorio: forzar el simulador. Por defecto, rushClient(). */
  client?: RushClient;
}) {
  const tr = useTr(locale);
  const { nueva } = useEstetica();
  const [client] = useState<RushClient>(() => clientProp ?? rushClient());
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [busy, setBusy] = useState(false);
  // Escena de entrada (FlagRushIntro). Corre ANTES de pedir la partida al
  // servidor, así no le resta tiempo a la primera bandera.
  const [introOn, setIntroOn] = useState(false);
  // Precarga de la escena: cuando se toque Jugar ya estará descargada.
  useEffect(() => { void loadIntro(); }, []);
  // Salió con una bandera a la vista y contó como fallo: se explica con un
  // aviso sobre el tablero hasta que conteste la siguiente.
  const [leftNote, setLeftNote] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const answering = useRef(false);
  const name = useCallback((code: string) => countryName(rushCanonical(code), locale), [locale]);

  const toIntro = (r: Awaited<ReturnType<RushClient["status"]>>): Phase =>
    r.ok ? { k: "intro", status: r.data } : { k: "intro", status: null, error: r.error };
  const loadStatus = useCallback(async () => {
    setPhase(toIntro(await client.status()));
  }, [client]);

  // Primera carga. setPhase ocurre cuando vuelve la promesa, no durante el
  // efecto; si la pantalla se cierra antes, la respuesta se descarta.
  useEffect(() => {
    let alive = true;
    void client.status().then((r) => { if (alive) setPhase(toIntro(r)); });
    return () => { alive = false; };
  }, [client]);

  // Reloj de la pantalla: 5 veces por segundo en partida (el número de
  // segundos y el corte a 0), una vez por segundo en el resto.
  const playing = phase.k === "playing" || phase.k === "practice";
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), playing ? 200 : 1000);
    return () => clearInterval(id);
  }, [playing]);

  // ---- Partida real ---------------------------------------------------------
  async function begin() {
    if (busy) return;
    setBusy(true);
    const r = await client.start();
    setBusy(false);
    if (!r.ok) {
      if (r.error === "played") return void loadStatus();
      setPhase((p) => ({ k: "intro", status: p.k === "intro" ? p.status : null, error: r.error }));
      return;
    }
    const d = r.data;
    if (d.left) setLeftNote(true);
    if (d.done) return void finish(d.result, d.nextSlotAt);
    setPhase({
      k: "playing", sessionId: d.sessionId, q: d.question,
      deadline: Date.now() + d.question.leftMs, shownAt: Date.now(),
      // Al retomar, el servidor dice cómo le fue en las ya contestadas.
      dots: Array.from({ length: d.question.total }, (_, i) => (i < d.question.index ? (d.results?.[i] ?? null) : null)),
    });
  }

  function finish(result: RushResult, nextSlotAt: string) {
    setPhase({ k: "result", result, nextSlotAt });
    if (result.correct >= 5) sfxWin();
    reactBordy?.(result.correct >= 9 ? "racha" : result.correct >= 5 ? "acierto" : "fallo");
  }

  async function answer(choice: string | null, opts: { left?: boolean } = {}) {
    if (phase.k !== "playing" || phase.pick || answering.current) return;
    answering.current = true;
    if (!opts.left) setLeftNote(false);
    const { sessionId, q, dots } = phase;
    setPhase({ ...phase, pick: { choice }, error: undefined });
    const r = await client.answer(sessionId, choice);
    if (!r.ok) {
      answering.current = false;
      // "stale": otra pestaña ya contestó esta bandera. Retomar pone todo al día.
      if (r.error === "stale" || r.error === "finished") return void begin();
      setPhase({ ...phase, pick: undefined, error: r.error });
      return;
    }
    const v = r.data;
    const nextDots = dots.map((d, i) => (i === q.index ? v.correct : d));
    setPhase({ ...phase, dots: nextDots, pick: { choice, answer: v.answer, correct: v.correct } });
    if (v.correct) { sfxGood(); reactBordy?.("acierto"); }
    else { sfxInvalid(); reactBordy?.("fallo"); }
    // leftMs de la siguiente se cuenta desde que llegó la respuesta (ya
    // incluye la pausa del veredicto).
    const receivedAt = Date.now();
    setTimeout(() => {
      answering.current = false;
      if (v.done) return finish(v.result, v.nextSlotAt);
      setPhase({ k: "playing", sessionId, q: v.question, deadline: receivedAt + v.question.leftMs, shownAt: Date.now(), dots: nextDots });
    }, VERDICT_MS);
  }

  // Salir con una bandera a la vista (bloquear el celular, cambiar de app,
  // minimizar MiniPay) la cuenta como fallo en ese momento: se manda la
  // respuesta vacía. El servidor hace lo mismo si se sale y se vuelve a
  // entrar (rush_start con `left`), así que no depende solo de esto.
  const waitingAnswer = phase.k === "playing" && !phase.pick;
  useEffect(() => {
    if (!waitingAnswer) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      setLeftNote(true);
      void answer(null, { left: true });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
    // Se vuelve a enganchar con cada bandera (roundId); `answer` cambia en
    // cada render y no debe reengancharlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingAnswer, phase.k === "playing" ? phase.q.index : -1]);

  // ---- Práctica (navegador, sin XP) ----------------------------------------
  function practice() {
    const qs = practiceQuestions();
    // Se precargan las 10: en la práctica la bandera llega como enlace.
    for (const q of qs) { const img = new Image(); img.src = flagUrl(q.a); }
    setPhase({ k: "practice", qs, i: 0, deadline: Date.now() + RUSH_ANSWER_MS, dots: Array(qs.length).fill(null) });
  }

  function practiceAnswer(choice: string | null) {
    if (phase.k !== "practice" || phase.pick) return;
    const q = phase.qs[phase.i];
    const correct = choice === q.a;
    const dots = phase.dots.map((d, i) => (i === phase.i ? correct : d));
    setPhase({ ...phase, dots, pick: { choice, answer: q.a, correct } });
    if (correct) sfxGood(); else sfxInvalid();
    const snapshot = phase;
    setTimeout(() => {
      const next = snapshot.i + 1;
      if (next >= snapshot.qs.length) {
        setPhase({ k: "practiceDone", correct: dots.filter(Boolean).length, dots });
        return;
      }
      setPhase({ ...snapshot, i: next, dots, pick: undefined, deadline: Date.now() + RUSH_ANSWER_MS });
    }, VERDICT_MS);
  }

  // Se acabó el tiempo: cuenta como fallo. Un temporizador por bandera que
  // vence en el plazo exacto; si el jugador contesta antes, se cancela.
  const deadline = "deadline" in phase ? phase.deadline : 0;
  const waitingPick = playing && !("pick" in phase && phase.pick);
  const roundId = phase.k === "playing" ? `${phase.sessionId}-${phase.q.index}` : phase.k === "practice" ? `p-${phase.i}` : "";
  useEffect(() => {
    if (!waitingPick) return;
    const id = setTimeout(() => {
      if (phase.k === "playing") void answer(null);
      else if (phase.k === "practice") practiceAnswer(null);
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
    // Solo importa la bandera en curso: se rearma al cambiar de bandera o al
    // contestar. Las funciones cambian en cada render y no deben rearmarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, waitingPick, deadline]);

  // Al llegar la próxima ventana, la pantalla de espera se actualiza sola.
  const waitUntil = phase.k === "result" ? phase.nextSlotAt : phase.k === "intro" ? phase.status?.nextSlotAt : undefined;
  useEffect(() => {
    if (!waitUntil) return;
    const id = setTimeout(() => void loadStatus(), Math.max(0, new Date(waitUntil).getTime() - Date.now()) + 1500);
    return () => clearTimeout(id);
  }, [waitUntil, loadStatus]);

  // ---- Pantallas -------------------------------------------------------------
  const header = (
    <div className="flex items-center justify-between">
      <button onClick={onExit} className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit">
        {nueva ? (
          <Icon3D name="back" size={28} />
        ) : (
          <span className="w-7 h-7 rounded-full bg-white/5 border border-lavender/25 flex items-center justify-center">←</span>
        )}
        <span className="font-display font-semibold"><Ico name="flag" emoji="🚩" size={18} /> {tr.rush.title}</span>
      </button>
      {client.mock && (
        <span className="rounded-full border border-gold/40 bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
          {tr.rush.mockBadge}
        </span>
      )}
    </div>
  );

  if (phase.k === "loading") {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <section className="panel p-6 text-center text-sm text-neutral-300" role="status">{tr.rush.loading}</section>
      </div>
    );
  }

  if (phase.k === "intro") {
    const st = phase.status;
    const wait = st ? formatWait(new Date(st.nextSlotAt).getTime() - now, tr.rush.lessThanMinute) : "";
    return (
      <div className="flex flex-col gap-5">
        {header}
        <section className="panel p-5 flex flex-col items-center gap-4 text-center">
          <span className="text-5xl" aria-hidden><Ico name="flag" emoji="🚩" size={64} className="ico-float" /></span>
          <div>
            <h2 className="font-display text-xl font-bold text-white">{tr.rush.title}</h2>
            <p className="text-xs text-neutral-300 mt-0.5">{tr.rush.sub}</p>
          </div>
          <p className="text-sm text-neutral-200 max-w-[34ch]">{tr.rush.rules}</p>
          <p className="max-w-[34ch] rounded-xl border-2 border-gold/50 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">
            <Ico name="warning" emoji="⚠️" size={16} /> {tr.rush.leaveWarning}
          </p>

          {st && <Windows status={st} tr={tr} locale={locale} now={now} />}
          {st && <XpBar xp={st.xpToday} max={st.maxXpToday} label={tr.rush.xpToday(st.xpToday, st.maxXpToday)} />}

          {phase.error && <ErrorNote error={phase.error} tr={tr} />}

          {st?.state === "played" ? (
            <>
              <div>
                <p className="font-display font-bold text-white">{tr.rush.playedTitle}</p>
                <p className="text-sm text-lavender mt-0.5">{tr.rush.nextIn(wait)}</p>
              </div>
              <PracticeButton tr={tr} onClick={practice} />
            </>
          ) : st ? (
            <button
              // Partida nueva: primero la escena. Retomar va directo.
              onClick={() => (st.state === "open" ? void begin() : setIntroOn(true))}
              disabled={busy || introOn}
              className="btn-3d font-display font-bold text-xl px-12 py-3 mt-1 disabled:opacity-60"
            >
              {st.state === "open" ? tr.rush.resume : tr.rush.play}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {phase.error !== "no_player" && (
                <button onClick={() => void loadStatus()} className="brutal-sm brutal-press rounded-xl bg-gold px-6 py-3 font-bold text-surface">
                  {tr.rush.retry}
                </button>
              )}
              <PracticeButton tr={tr} onClick={practice} />
            </div>
          )}
        </section>
        {introOn && (
          <FlagRushIntro
            title={tr.rush.title}
            go={tr.go}
            skip={tr.challenge.skipIntro}
            onDone={() => { setIntroOn(false); void begin(); }}
          />
        )}
      </div>
    );
  }

  if (phase.k === "result") {
    const { result } = phase;
    const wait = formatWait(new Date(phase.nextSlotAt).getTime() - now, tr.rush.lessThanMinute);
    const note =
      result.correct >= 5 && result.xp === 0 ? tr.rush.sanctioned
      : result.gained > 0 ? tr.rush.gained(result.gained)
      : result.xp > 0 ? tr.rush.capped
      : tr.rush.noXp;
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="panel p-5 flex flex-col items-center gap-3 text-center">
          <div className="font-display text-4xl font-black prism-text">{tr.rush.score(result.correct, result.total)}</div>
          <p className={`text-sm font-bold ${result.gained > 0 ? "text-gold" : "text-neutral-300"}`}>{note}</p>
          <XpBar xp={result.xpToday} max={result.maxXpToday} label={tr.rush.xpToday(result.xpToday, result.maxXpToday)} />
          <p className="text-sm text-lavender">{tr.rush.nextIn(wait)}</p>
          <div className="flex flex-col gap-2 w-full mt-1">
            <PracticeButton tr={tr} onClick={practice} />
            <button onClick={onExit} className="brutal-sm brutal-press rounded-xl bg-surface px-6 py-3 font-bold text-white">{tr.rush.back}</button>
          </div>
        </section>
      </div>
    );
  }

  if (phase.k === "practiceDone") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="panel p-5 flex flex-col items-center gap-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-lavender">{tr.rush.practiceTag}</span>
          <div className="font-display text-4xl font-black text-white">{tr.rush.score(phase.correct, phase.dots.length)}</div>
          <Dots dots={phase.dots} current={-1} />
          <p className="text-xs text-neutral-400">{tr.rush.practiceNote}</p>
          <div className="flex flex-col gap-2 w-full mt-1">
            <button onClick={practice} className="brutal-sm brutal-press rounded-xl bg-gold px-6 py-3 font-bold text-surface"><Ico name="retry" emoji="🔄" size={18} /> {tr.rush.practiceAgain}</button>
            <button onClick={() => { setPhase({ k: "loading" }); void loadStatus(); }} className="brutal-sm brutal-press rounded-xl bg-surface px-6 py-3 font-bold text-white">
              ← {tr.rush.title}
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ---- Tablero (partida real o práctica) -------------------------------------
  const isPractice = phase.k === "practice";
  const index = isPractice ? phase.i : phase.q.index;
  const total = isPractice ? phase.qs.length : phase.q.total;
  const options = isPractice ? phase.qs[phase.i].o : phase.q.options;
  const image = isPractice ? flagUrl(phase.qs[phase.i].a) : phase.q.image;
  // Lo que quedaba cuando la bandera apareció (la barra arranca desde ahí).
  const startLeft = isPractice ? RUSH_ANSWER_MS : Math.min(RUSH_ANSWER_MS, phase.deadline - phase.shownAt);
  // Tope en 10 s: `now` se actualiza cada 200 ms y, recién llegada la
  // bandera, puede ir atrasado (se veía "11 s" un instante).
  const left = Math.min(RUSH_ANSWER_MS, Math.max(0, phase.deadline - now));
  const pick = phase.pick;
  const roundKey = `${isPractice ? "p" : phase.sessionId}-${index}`;
  const onPick = (code: string) => (isPractice ? practiceAnswer(code) : void answer(code));

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-neutral-300">
          {isPractice ? <span className="text-lavender">{tr.rush.practiceTag} · </span> : null}
          {tr.rush.progress(index + 1, total)}
        </span>
        <span className={`font-mono text-sm font-bold tabular-nums ${left <= 3000 && !pick ? "text-rose-400" : "text-white"}`} aria-live="off">
          {tr.rush.secondsLeft(Math.ceil(left / 1000))}
        </span>
      </div>

      <Dots dots={phase.dots} current={index} />

      {leftNote && !isPractice && (
        <p role="status" className="rounded-xl border-2 border-gold/50 bg-gold/10 px-3 py-2 text-center text-sm font-semibold text-gold">
          <Ico name="warning" emoji="⚠️" size={16} /> {tr.rush.leftFail}
        </p>
      )}

      <div className="relative w-full rounded-2xl overflow-hidden bg-panel border border-lavender/20 flex flex-col items-center justify-center pt-6 pb-5">
        {/* key por bandera: cada una entra con su propio movimiento. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={roundKey} src={image} alt="" className="rush-flag-in w-[70%] max-w-[260px] aspect-[3/2] object-cover rounded shadow-2xl" />
        <TimerBar key={`t-${roundKey}`} leftMs={startLeft} answerMs={RUSH_ANSWER_MS} stopped={!!pick} />
      </div>

      <p className="text-center text-sm font-semibold text-white -mt-1" aria-live="polite">
        {pick?.answer
          ? pick.correct ? tr.rush.right : pick.choice ? tr.rush.wasIt(name(pick.answer)) : `${tr.rush.timeUp} ${tr.rush.wasIt(name(pick.answer))}`
          : tr.quiz.whichCountry}
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {options.map((code) => {
          const isAnswer = pick?.answer === code;
          const isChosen = pick?.choice === code;
          const state =
            !pick ? "idle"
            : pick.answer === undefined ? (isChosen ? "sent" : "dim")
            : isAnswer ? "right"
            : isChosen ? "wrong"
            : "dim";
          return (
            <button
              key={code}
              onClick={() => onPick(code)}
              disabled={!!pick}
              className={`rush-option brutal-sm rounded-xl px-3 py-3 min-h-[56px] text-left text-sm font-semibold leading-tight ${
                state === "right" ? "bg-[#16a34a] text-white"
                : state === "wrong" ? "bg-[#e11d48] text-white"
                : state === "sent" ? "bg-surface text-white ring-2 ring-gold"
                : state === "dim" ? "bg-surface text-white opacity-45"
                : "brutal-press bg-surface text-white"
              }`}
            >
              {name(code)}
            </button>
          );
        })}
      </div>

      {"error" in phase && phase.error && (
        <div className="flex flex-col items-center gap-2">
          <ErrorNote error={phase.error} tr={tr} />
          <button onClick={() => void begin()} className="brutal-sm brutal-press rounded-xl bg-gold px-5 py-2 text-sm font-bold text-surface">{tr.rush.retry}</button>
        </div>
      )}
    </div>
  );
}

// ---- Piezas -----------------------------------------------------------------

type Tr = ReturnType<typeof t>;

/** Las 10 banderas del intento: verde acertada, roja fallada, la actual con borde. */
function Dots({ dots, current }: { dots: Dot[]; current: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-hidden>
      {dots.map((d, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            d === true ? "bg-[#22c55e]" : d === false ? "bg-[#f43f5e]" : i === current ? "bg-white" : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Barra del reloj. Se encoge con la Web Animations API sobre `transform`
 * (va en el compositor, no se traba si la página está ocupada). Lineal: es
 * tiempo que pasa, no algo que entra o sale. Al contestar se congela donde
 * iba, para que el veredicto se lea sobre el tiempo que quedaba.
 */
function TimerBar({ leftMs, answerMs, stopped }: { leftMs: number; answerMs: number; stopped: boolean }) {
  const bar = useRef<HTMLSpanElement>(null);
  const anim = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const from = Math.max(0, Math.min(1, leftMs / answerMs));
    anim.current = el.animate([{ transform: `scaleX(${from})` }, { transform: "scaleX(0)" }], {
      duration: Math.max(1, leftMs), easing: "linear", fill: "forwards",
    });
    return () => anim.current?.cancel();
  }, [leftMs, answerMs]);
  useEffect(() => {
    if (stopped) anim.current?.pause();
  }, [stopped]);
  return (
    <span className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30" aria-hidden>
      <span ref={bar} className="block h-full w-full origin-left bg-gold" />
    </span>
  );
}

function XpBar({ xp, max, label }: { xp: number; max: number; label: string }) {
  return (
    <div className="w-full max-w-[260px]">
      <p className="text-[11px] font-semibold text-neutral-300 mb-1">{label}</p>
      <div className="h-2.5 rounded-full bg-black/40 border border-lavender/20 overflow-hidden">
        <div className="h-full w-full origin-left bg-gold" style={{ transform: `scaleX(${max ? Math.min(1, xp / max) : 0})` }} />
      </div>
    </div>
  );
}

/** Las 3 ventanas del día con su hora local de inicio y su estado. */
function Windows({ status, tr, locale, now }: { status: RushStatus; tr: Tr; locale: Locale; now: number }) {
  const starts = slotStarts(new Date(now));
  const current = slotOf(new Date(now));
  const played = new Set(status.attempts.map((a) => a.slot));
  const fmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  return (
    <div className="w-full">
      <p className="est-eyebrow text-[11px] font-display font-semibold uppercase tracking-[0.14em] text-neutral-400 mb-2">{tr.rush.windows}</p>
      <div className="grid grid-cols-3 gap-2">
        {starts.map((d, s) => {
          const st = played.has(s) || (s === current && status.state === "played") ? "jugada"
            : s === current ? "abierta"
            : s < current ? "pasada"
            : "pendiente";
          return (
            <div
              key={s}
              className={`rounded-xl border-2 border-deep px-2 py-2 ${st === "abierta" ? "bg-gold text-surface" : "bg-surface text-white"} ${st === "pasada" ? "opacity-50" : ""}`}
            >
              <div className="font-mono text-sm font-bold tabular-nums">{fmt.format(d)}</div>
              <div className={`text-[10px] font-semibold ${st === "abierta" ? "" : st === "jugada" ? "text-[#86efac]" : "text-neutral-400"}`}>
                {st === "jugada" ? <><Ico name="check" emoji="✓" size={11} />{" "}</> : ""}{tr.rush.windowState[st]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PracticeButton({ tr, onClick }: { tr: Tr; onClick: () => void }) {
  return (
    <button onClick={onClick} className="brutal-sm brutal-press rounded-xl bg-surface px-6 py-3 font-bold text-white">
      <Ico name="target" emoji="🎯" size={18} /> {tr.rush.practice}
    </button>
  );
}

function ErrorNote({ error, tr }: { error: RushError; tr: Tr }) {
  const text =
    error === "no_player" ? tr.rush.errNoPlayer
    : error === "identity" ? tr.rush.errIdentity
    : error === "image_unavailable" ? tr.rush.errImage
    : tr.rush.errNetwork;
  return <p className="text-sm text-rose-300 max-w-[34ch] text-center">{text}</p>;
}
