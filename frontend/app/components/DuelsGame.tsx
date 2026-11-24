"use client";

// ============================================================
//  DuelsGame — modo Duelos (1 contra 1), en el selector de Jugar.
//
//  Un jugador reta a otro a resolver EL MISMO reto; gana quien use menos
//  países y, a igualdad, menos tiempo. El servidor genera el reto, lleva el
//  reloj y valida la cadena (lib/duels.ts → función `game`), así que la marca
//  de cada uno no se puede editar desde aquí.
//
//  Pantallas: inicio (Pendientes · Retar · Historial) → tablero → enviado
//  (el retador comparte) o resultado (el rival ve quién ganó).
//  Las pistas no se cobran: cada una suma DUEL_HINT_SECONDS a la marca.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tryGuess, nextHintCountry, shortestPath, type PlayState, type Status, type Difficulty } from "../lib/game";
import { getCountry } from "../lib/countries";
import { countryName, resolveLocalized, suggestLocalized, t, type Locale } from "../lib/i18n";
import { formatTime, getAlias } from "../lib/ranking";
import {
  claimDuel,
  createDuel,
  duelLink,
  DUEL_HINT_SECONDS,
  DUEL_XP,
  DUELS_PER_DAY,
  findPlayers,
  finishDuel,
  listDuels,
  markShared,
  normalizeCode,
  recordByOpponent,
  resetDuelIdentity,
  shareText,
  startDuel,
  type Duel,
  type DuelMark,
  type DuelPlay,
  type DuelPlayer,
} from "../lib/duels";
import { bindXpIdentity } from "../lib/xp";
import RecoverIdentity from "./RecoverIdentity";
import WorldMap from "./WorldMap";
import LevelSelect from "./LevelSelect";
import GlobeLoader from "./GlobeLoader";
import type { BordyMood } from "./Bordy";
import { sfxGood, sfxLateral, sfxFar, sfxInvalid, sfxWin } from "../lib/sfx";

type Tr = ReturnType<typeof t>;
type Tab = "pending" | "new" | "history";
type Screen =
  | { kind: "home" }
  | { kind: "play"; play: DuelPlay }
  | { kind: "sent"; duel: Duel }
  | { kind: "result"; duel: Duel }
  | { kind: "invite"; duel: Duel };

const CHIP: Record<Status, string> = {
  start: "border-cyan-400/50 text-cyan-100",
  end: "border-fuchsia-400/50 text-fuchsia-100",
  green: "border-emerald-400/50 text-emerald-100",
  yellow: "border-yellow-400/50 text-yellow-100",
  red: "border-rose-400/50 text-rose-100",
};

function CFlag({ name, size = 28 }: { name: string; size?: number }) {
  const c = getCountry(name);
  if (!c) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/${c.code.toLowerCase()}.svg`} alt="" style={{ width: size, height: "auto", borderRadius: 3 }} />;
}

function markText(tr: Tr, m: DuelMark | null): string {
  return m ? tr.duels.mark(m.countries, formatTime(m.timeMs)) : "—";
}

// "5 h 20 min" / "12 min" hasta el vencimiento.
function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// Progreso local de la partida en curso: si se recarga, el reloj lo sigue
// llevando el servidor, y aquí se recuperan la cadena y las pistas usadas.
const progressKey = (id: string) => `frontle-duel-${id}`;
function loadProgress(id: string): { chain: string[]; hints: number } {
  try {
    const p = JSON.parse(localStorage.getItem(progressKey(id)) ?? "null");
    if (p && Array.isArray(p.chain)) return { chain: p.chain.map(String), hints: Number(p.hints) || 0 };
  } catch {}
  return { chain: [], hints: 0 };
}
function saveProgress(id: string, chain: string[], hints: number) {
  try { localStorage.setItem(progressKey(id), JSON.stringify({ chain, hints })); } catch {}
}
function clearProgress(id: string) {
  try { localStorage.removeItem(progressKey(id)); } catch {}
}

export default function DuelsGame({
  locale, playerId, onExit, reactBordy, initialCode = null, onCodeConsumed, onAskName,
}: {
  locale: Locale;
  /** Wallet del jugador (page.tsx). Llega un momento después de montar. */
  playerId: string;
  onExit: () => void;
  reactBordy?: (m: BordyMood) => void;
  /** Código que llegó por link (?duelo=) o desde fuera del modo. */
  initialCode?: string | null;
  onCodeConsumed?: () => void;
  /** Abre el aviso de nombre (vive en page.tsx). */
  onAskName?: () => void;
}) {
  const tr = t(locale);
  const ready = /^0x[0-9a-f]{40}$/i.test(playerId);
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [tab, setTab] = useState<Tab>("pending");
  const [duels, setDuels] = useState<Duel[] | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const errorText = useCallback(
    (e: string) => tr.duels.codeErrors[e] ?? (e === "identity" ? tr.duels.identity : e === "too_many_duels" ? tr.duels.tooMany : tr.duels.genericError),
    [tr],
  );

  const refresh = useCallback(async () => {
    const r = await listDuels();
    setLoadError(r.ok ? null : r.error);
    if (r.ok) { setDuels(r.data.duels); setLeft(r.data.left); }
  }, []);

  // La identidad se liga aquí y no solo en page.tsx: los efectos del hijo
  // corren antes que los del padre, y sin esto la primera llamada no tendría wallet.
  useEffect(() => {
    if (!ready) return;
    bindXpIdentity(playerId);
    void refresh();
  }, [ready, playerId, refresh]);

  // Código recibido por link: se reclama una vez y se abre la invitación.
  const codeDone = useRef(false);
  useEffect(() => {
    if (!initialCode || codeDone.current || !ready) return;
    bindXpIdentity(playerId);
    codeDone.current = true;
    onCodeConsumed?.();
    void (async () => {
      const r = await claimDuel(initialCode);
      if (r.ok) {
        setScreen(r.data.status === "finished" ? { kind: "result", duel: r.data } : { kind: "invite", duel: r.data });
        void refresh();
      } else {
        setNotice(errorText(r.error));
      }
    })();
  }, [initialCode, ready, playerId, onCodeConsumed, refresh, errorText]);

  async function play(open: () => Promise<{ ok: true; data: DuelPlay } | { ok: false; error: string }>) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const r = await open();
    setBusy(false);
    if (r.ok) setScreen({ kind: "play", play: r.data });
    else { setNotice(errorText(r.error)); void refresh(); }
  }

  async function solved(p: DuelPlay, chain: string[], hints: number) {
    const r = await finishDuel(p.duel.id, chain, hints);
    if (!r.ok) { setNotice(errorText(r.error)); setScreen({ kind: "home" }); void refresh(); return; }
    clearProgress(p.duel.id);
    void refresh();
    setScreen(r.data.role === "challenger" ? { kind: "sent", duel: r.data } : { kind: "result", duel: r.data });
  }

  const back = (
    <button
      onClick={screen.kind === "home" ? onExit : () => { setScreen({ kind: "home" }); void refresh(); }}
      className="flex items-center gap-2 text-sm text-neutral-300 active:scale-95 transition w-fit"
    >
      <span className="w-7 h-7 rounded-full bg-white/5 border border-lavender/25 flex items-center justify-center">←</span>
      <span className="font-display font-semibold">⚔️ {tr.duels.title}</span>
    </button>
  );

  if (!ready) {
    return (
      <div className="flex flex-col gap-5">
        {back}
        <section className="panel p-5 text-center flex flex-col items-center gap-3">
          <span className="text-5xl">⚔️</span>
          <p className="text-sm text-neutral-200">{tr.duels.noWallet}</p>
        </section>
      </div>
    );
  }

  if (screen.kind === "play") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <DuelBoard tr={tr} locale={locale} play={screen.play} reactBordy={reactBordy} onSolved={(c, h) => solved(screen.play, c, h)} />
      </div>
    );
  }

  if (screen.kind === "invite") {
    const d = screen.duel;
    const name = d.opponentName ?? tr.duels.aPlayer;
    return (
      <div className="flex flex-col gap-5">
        {back}
        <section className="panel p-5 flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">⚔️</span>
          <h2 className="font-display text-xl font-bold text-white">{tr.duels.from(name)}</h2>
          <p className="text-sm text-neutral-200">{tr.duels.target(name, markText(tr, d.theirs))}</p>
          <p className="text-xs text-neutral-400">{tr.levels[d.level]} · {tr.duels.expiresIn(timeLeft(d.expiresAt))}</p>
          <p className="text-[11px] text-neutral-400">{tr.duels.hintPenalty(DUEL_HINT_SECONDS)}</p>
          <button disabled={busy} onClick={() => void play(() => startDuel(d.id))} className="btn-3d font-display font-bold text-xl px-12 py-3 mt-1 disabled:opacity-60">
            {d.status === "started" ? tr.duels.resume : tr.duels.play}
          </button>
          {notice && <p className="text-sm text-rose-300" role="status">{notice}</p>}
        </section>
      </div>
    );
  }

  if (screen.kind === "sent") {
    return (
      <div className="flex flex-col gap-5">
        {back}
        <SentView tr={tr} duel={screen.duel} />
      </div>
    );
  }

  if (screen.kind === "result") {
    const d = screen.duel;
    return (
      <div className="flex flex-col gap-5">
        {back}
        <ResultView
          tr={tr}
          duel={d}
          busy={busy}
          onRematch={d.opponentId ? () => void play(() => createDuel(d.level, d.opponentId)) : undefined}
          onAskName={!getAlias() ? onAskName : undefined}
        />
        {notice && <p className="text-center text-sm text-rose-300" role="status">{notice}</p>}
      </div>
    );
  }

  // --- Inicio ---------------------------------------------------------------
  const list = duels ?? [];
  const incoming = list.filter((d) => d.role === "rival" && (d.status === "open" || d.status === "started"));
  const outgoing = list.filter((d) => d.role === "challenger" && (d.status === "open" || d.status === "started" || d.status === "playing"));
  const done = list.filter((d) => d.status === "finished" || d.status === "expired");

  return (
    <div className="flex flex-col gap-4">
      {back}
      <p className="text-xs text-neutral-300 text-center -mt-1">{tr.duels.intro}</p>

      <div className="grid grid-cols-3 gap-1.5" role="tablist">
        {(["pending", "new", "history"] as Tab[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => { setTab(k); setNotice(null); }}
            className={`brutal-sm brutal-press rounded-lg px-2 py-2 text-xs font-bold ${tab === k ? "bg-gold text-surface" : "bg-surface text-white"}`}
          >
            {k === "pending" ? `${tr.duels.tabPending}${incoming.length ? ` · ${incoming.length}` : ""}` : k === "new" ? tr.duels.tabNew : tr.duels.tabHistory}
          </button>
        ))}
      </div>

      {notice && <p className="text-center text-sm text-rose-300" role="status">{notice}</p>}

      {tab === "pending" && (
        <>
          <CodeEntry tr={tr} busy={busy} onJoin={async (code) => {
            setBusy(true);
            setNotice(null);
            const r = await claimDuel(code);
            setBusy(false);
            if (r.ok) { setScreen(r.data.status === "finished" ? { kind: "result", duel: r.data } : { kind: "invite", duel: r.data }); void refresh(); }
            else setNotice(errorText(r.error));
          }} />
          {duels === null && !loadError && <div className="py-6"><GlobeLoader label={tr.loadingMap} /></div>}
          {loadError && (
            <section className="panel p-4 text-center flex flex-col items-center gap-2">
              <p className="text-sm text-neutral-200">{loadError === "identity" ? tr.duels.identity : tr.duels.loadError}</p>
              {/* La wallet está ligada a otro dispositivo (p. ej. MiniPay y
                  ahora el navegador): se activa aquí mismo y se recarga. */}
              {loadError === "identity" && <RecoverIdentity tr={tr} onDone={() => { resetDuelIdentity(); void refresh(); }} />}
              <button onClick={() => void refresh()} className="brutal-sm brutal-press rounded-lg bg-surface px-4 py-2 text-xs font-bold text-white">{tr.duels.retry}</button>
            </section>
          )}
          {duels !== null && incoming.length === 0 && outgoing.length === 0 && (
            <p className="text-center text-sm text-neutral-300 py-4">{tr.duels.emptyPending}</p>
          )}
          {incoming.map((d) => (
            <DuelRow key={d.id} title={tr.duels.from(d.opponentName ?? tr.duels.aPlayer)} sub={`${tr.levels[d.level]} · ${tr.duels.expiresIn(timeLeft(d.expiresAt))}`}
              action={d.status === "started" ? tr.duels.resume : tr.duels.play} onAction={() => setScreen({ kind: "invite", duel: d })} highlight />
          ))}
          {outgoing.map((d) => (
            <DuelRow key={d.id}
              title={d.status === "playing" ? `${tr.levels[d.level]} · ${tr.duels.tabNew}` : tr.duels.waitingFor(d.opponentName)}
              sub={d.status === "playing" ? "" : `${markText(tr, d.mine)} · ${tr.duels.expiresIn(timeLeft(d.expiresAt))}`}
              action={d.status === "playing" ? tr.duels.resume : tr.duels.share}
              onAction={() => (d.status === "playing" ? void play(() => startDuel(d.id)) : setScreen({ kind: "sent", duel: d }))} />
          ))}
        </>
      )}

      {tab === "new" && <NewDuel tr={tr} busy={busy} left={left} onStart={(level, rival) => void play(() => createDuel(level, rival))} />}

      {tab === "history" && (
        <>
          {recordByOpponent(done).slice(0, 6).length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {recordByOpponent(done).slice(0, 6).map((r) => (
                <span key={r.name} className="rounded-full border border-lavender/25 bg-surface/60 px-3 py-1 text-xs text-white">
                  {tr.duels.record(r.wins, r.losses, r.name)}
                </span>
              ))}
            </div>
          )}
          {done.length === 0 && <p className="text-center text-sm text-neutral-300 py-4">{tr.duels.emptyHistory}</p>}
          {done.map((d) => (
            <DuelRow key={d.id}
              title={`${d.status === "expired" ? "⌛" : d.result === "win" ? "🏆" : d.result === "tie" ? "🤝" : "💪"} ${d.opponentName ?? tr.duels.aPlayer}`}
              sub={d.status === "expired" ? tr.duels.expired : `${tr.duels.you}: ${markText(tr, d.mine)} · ${tr.duels.rival}: ${markText(tr, d.theirs)}${d.xp > 0 ? ` · ${tr.duels.xpGained(d.xp)}` : ""}`}
              action={d.opponentId ? tr.duels.rematch : ""}
              onAction={d.opponentId ? () => void play(() => createDuel(d.level, d.opponentId)) : undefined} />
          ))}
        </>
      )}
    </div>
  );
}

function DuelRow({ title, sub, action, onAction, highlight }: {
  title: string; sub: string; action: string; onAction?: () => void; highlight?: boolean;
}) {
  return (
    <div className={`panel p-3 flex items-center gap-3 ${highlight ? "border-gold/50" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-white text-sm truncate">{title}</p>
        {sub && <p className="text-[11px] text-neutral-300 truncate">{sub}</p>}
      </div>
      {action && onAction && (
        <button onClick={onAction} className="shrink-0 brutal-sm brutal-press rounded-lg bg-gold px-3 py-2 text-xs font-bold text-surface">
          {action}
        </button>
      )}
    </div>
  );
}

function CodeEntry({ tr, busy, onJoin }: { tr: Tr; busy: boolean; onJoin: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (code.length === 6) onJoin(code); }}
      className="panel p-3 flex flex-col gap-2"
    >
      <label htmlFor="duel-code" className="text-xs text-neutral-300">{tr.duels.haveCode}</label>
      <div className="flex gap-2">
        <input
          id="duel-code"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder={tr.duels.codePlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          className="flex-1 min-w-0 rounded-xl bg-base border border-lavender/30 px-3 py-2.5 text-base font-mono tracking-[0.25em] text-white outline-none focus:border-gold/70"
        />
        <button type="submit" disabled={busy || code.length !== 6} className="brutal-sm brutal-press rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-surface disabled:opacity-50">
          {tr.duels.join}
        </button>
      </div>
    </form>
  );
}

// Retar: elegir rival (búsqueda por alias o jugadores recientes, o
// "cualquiera con el código") y nivel.
function NewDuel({ tr, busy, left, onStart }: {
  tr: Tr; busy: boolean; left: number | null; onStart: (level: Difficulty, rival: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [players, setPlayers] = useState<DuelPlayer[] | null>(null);
  const [rival, setRival] = useState<DuelPlayer | null>(null);
  const [anyone, setAnyone] = useState(false);
  const [level, setLevel] = useState<Difficulty>("easy");

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      const r = await findPlayers(q.trim().length >= 2 ? q : "");
      if (alive) setPlayers(r.ok ? r.data : []);
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(id); };
  }, [q]);

  const chosen = anyone || rival !== null;
  return (
    <div className="flex flex-col gap-3">
      <section className="panel p-3 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-400">{tr.duels.pickRival}</p>
        <button
          onClick={() => { setAnyone(true); setRival(null); }}
          className={`brutal-sm brutal-press rounded-xl px-3 py-2.5 text-left ${anyone ? "bg-gold text-surface" : "bg-surface text-white"}`}
        >
          <span className="block text-sm font-bold">🔗 {tr.duels.anyone}</span>
          <span className={`block text-[11px] ${anyone ? "text-surface/80" : "text-neutral-400"}`}>{tr.duels.anyoneSub}</span>
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.slice(0, 16))}
          placeholder={tr.duels.searchPlaceholder}
          autoComplete="off"
          className="rounded-xl bg-base border border-lavender/30 px-3 py-2.5 text-base text-white outline-none focus:border-gold/70"
        />
        {q.trim().length < 2 && <p className="text-[11px] text-neutral-400">{tr.duels.recentPlayers}</p>}
        {players === null ? (
          <p className="text-[11px] text-neutral-400">…</p>
        ) : players.length === 0 ? (
          <p className="text-[11px] text-neutral-400">{tr.duels.noPlayers}</p>
        ) : (
          <ul className="flex flex-col gap-1 max-h-56 overflow-y-auto">
            {players.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => { setRival(p); setAnyone(false); }}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm ${rival?.id === p.id ? "bg-gold text-surface font-bold" : "bg-white/5 text-white"}`}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel p-3 flex flex-col items-center gap-3">
        <LevelSelect tr={tr} level={level} onChange={setLevel} />
        <p className="text-[11px] text-neutral-400">{tr.duels.hintPenalty(DUEL_HINT_SECONDS)}</p>
        <p className="text-[11px] text-emerald-300 text-center">{tr.duels.xpRule(DUEL_XP.win, DUEL_XP.lose, DUEL_XP.tie)}</p>
        <button
          disabled={!chosen || busy || left === 0}
          onClick={() => onStart(level, rival?.id ?? null)}
          className="btn-3d font-display font-bold text-lg px-10 py-3 disabled:opacity-50"
        >
          ⚔️ {tr.duels.start}
        </button>
        {left !== null && (
          <p className={`text-xs ${left === 0 ? "text-rose-300" : "text-neutral-300"}`}>
            {left === 0 ? tr.duels.noneLeft : tr.duels.leftToday(left, DUELS_PER_DAY)}
          </p>
        )}
      </section>
    </div>
  );
}

// Tras enviar: código siempre visible + compartir (con respaldo para copiar a
// mano si el menú de compartir no existe o falla, p. ej. en un WebView).
function SentView({ tr, duel }: { tr: Tr; duel: Duel }) {
  const [note, setNote] = useState<string | null>(null);
  const code = duel.code ?? "";
  const link = duelLink(code);
  const message = `${tr.duels.shareText(markText(tr, duel.mine), code)}\n${link}`;
  async function share() {
    const r = await shareText(message);
    if (r === "shared" || r === "copied") markShared(duel.id);
    setNote(r === "copied" ? tr.duels.copied : r === "failed" ? tr.duels.shareFailed : null);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNote(tr.duels.copied); markShared(duel.id); }
    catch { setNote(tr.duels.shareFailed); }
  }
  return (
    <section className="panel p-5 flex flex-col items-center gap-3 text-center">
      <span className="text-5xl">📨</span>
      <h2 className="font-display text-xl font-bold text-white">{tr.duels.sentTitle}</h2>
      <p className="text-sm text-neutral-200">{markText(tr, duel.mine)}</p>
      <p className="text-xs text-neutral-300">{duel.hasOpponent && duel.opponentName ? tr.duels.sentTo(duel.opponentName) : tr.duels.sentOpen}</p>
      <div className="w-full rounded-xl border border-gold/40 bg-base/60 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{tr.duels.codeLabel}</p>
        <p className="font-mono text-3xl font-black tracking-[0.3em] text-gold select-all">{code}</p>
        <button onClick={() => void copy(code)} className="mt-1 text-xs font-bold text-lavender underline">{tr.duels.copy}</button>
      </div>
      <p className="w-full break-all text-[11px] text-neutral-400 select-all">{link}</p>
      <button onClick={() => void share()} className="brutal-sm brutal-press rounded-xl bg-[#38bdf8] px-6 py-3 font-bold text-[#082f49] w-full">
        📤 {tr.duels.share}
      </button>
      {note && <p className="text-[11px] text-emerald-300" role="status">{note}</p>}
    </section>
  );
}

function ResultView({ tr, duel, busy, onRematch, onAskName }: {
  tr: Tr; duel: Duel; busy: boolean; onRematch?: () => void; onAskName?: () => void;
}) {
  const title = duel.status === "expired" ? tr.duels.expired
    : duel.result === "win" ? tr.duels.win : duel.result === "lose" ? tr.duels.lose : tr.duels.tie;
  const penalty = (m: DuelMark | null) => (m && m.hints > 0 ? ` (${tr.duels.penalty(m.hints, DUEL_HINT_SECONDS)})` : "");
  return (
    <section className="panel p-5 flex flex-col items-center gap-3 text-center">
      <span className="text-5xl">{duel.status === "expired" ? "⌛" : duel.result === "win" ? "🏆" : duel.result === "tie" ? "🤝" : "💪"}</span>
      <h2 className="text-2xl font-black prism-text">{title}</h2>
      <div className="w-full grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">{tr.duels.you}</p>
          <p className="text-sm font-bold text-white">{markText(tr, duel.mine)}</p>
          <p className="text-[10px] text-neutral-400">{penalty(duel.mine)}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 truncate">{duel.opponentName ?? tr.duels.rival}</p>
          <p className="text-sm font-bold text-white">{markText(tr, duel.theirs)}</p>
          <p className="text-[10px] text-neutral-400">{penalty(duel.theirs)}</p>
        </div>
      </div>
      {duel.optimal != null && <p className="text-xs text-neutral-300">{tr.optimal(duel.optimal)}</p>}
      {duel.status === "finished" && (duel.xp > 0 ? (
        <p className="rounded-full bg-emerald-400/15 border border-emerald-300/40 px-4 py-1 text-sm font-black text-emerald-300">{tr.duels.xpGained(duel.xp)}</p>
      ) : (
        <p className="text-[11px] text-neutral-400">{tr.duels.noXp}</p>
      ))}
      {onRematch && (
        <button disabled={busy} onClick={onRematch} className="brutal-sm brutal-press rounded-xl bg-gold px-6 py-3 font-bold text-surface w-full disabled:opacity-60">
          🔄 {tr.duels.rematch}
        </button>
      )}
      {onAskName && (
        <div className="w-full rounded-xl border border-lavender/30 p-3 flex flex-col gap-2">
          <p className="text-xs text-neutral-200">{tr.duels.askName}</p>
          <button onClick={onAskName} className="brutal-sm brutal-press rounded-lg bg-surface px-4 py-2 text-xs font-bold text-white">{tr.duels.setName}</button>
        </div>
      )}
    </section>
  );
}

// Tablero del duelo: mismo juego que el diario, sin cobros (el XP lo da el servidor al cerrar). El reloj
// visible = lo que ya contó el servidor + pistas × DUEL_HINT_SECONDS.
function DuelBoard({ tr, locale, play, reactBordy, onSolved }: {
  tr: Tr; locale: Locale; play: DuelPlay; reactBordy?: (m: BordyMood) => void;
  onSolved: (chain: string[], hints: number) => Promise<void>;
}) {
  const { challenge: c, duel } = play;
  const id = duel.id;
  const [state, setState] = useState<PlayState>(() => {
    const saved = loadProgress(id);
    const base: PlayState = {
      challenge: { start: c.start, end: c.end, optimal: c.optimal, path: shortestPath(c.start, c.end) ?? [], level: duel.level },
      chain: [],
      solved: false,
    };
    // Rehace la cadena guardada con las mismas reglas (descarta lo que no encaje).
    let s = base;
    for (const country of saved.chain) {
      const res = tryGuess(s, country, country);
      if (!res.ok || !res.country || !res.quality || res.solved) break;
      s = { ...s, chain: [...s.chain, { country: res.country, quality: res.quality }] };
    }
    return s;
  });
  const [hints, setHints] = useState(() => loadProgress(id).hints);
  const [showInitial, setShowInitial] = useState(false);
  const [showNextSil, setShowNextSil] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  // Inicio de la partida en el reloj local, alineado con lo que ya contó el
  // servidor (al retomar). Se fija al montar, no durante el render.
  const startRef = useRef(0);
  useEffect(() => {
    startRef.current = Date.now() - play.elapsedMs;
  }, [play.elapsedMs]);
  const [elapsed, setElapsed] = useState(play.elapsedMs);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.solved) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 250);
    return () => clearInterval(t);
  }, [state.solved]);

  const suggestions = useMemo(() => (input.length >= 2 ? suggestLocalized(input, locale) : []), [input, locale]);

  const statusByCountry = useMemo(() => {
    const m: Record<string, Status> = { [c.start]: "start", [c.end]: "end" };
    for (const x of state.chain) m[x.country] = x.quality;
    return m;
  }, [state.chain, c.start, c.end]);

  const hintCountry = useMemo(() => (showInitial || showNextSil ? nextHintCountry(state) : null), [state, showInitial, showNextSil]);

  function takeHint(already: boolean, apply: () => void) {
    if (already) return;
    apply();
    setHints((h) => {
      const n = h + 1;
      saveProgress(id, state.chain.map((x) => x.country), n);
      return n;
    });
    reactBordy?.("pensando");
  }

  function submit(value: string) {
    if (state.solved || sending) return;
    const canonical = resolveLocalized(value);
    const res = tryGuess(state, value, canonical);
    const localized = res.country ? countryName(res.country, locale) : "";
    setMessage({
      text: tr.feedback(res.reason, { country: localized, end: countryName(c.end, locale), quality: res.quality, input: res.input }),
      ok: res.ok,
    });
    if (!res.ok) { sfxInvalid(); reactBordy?.("fallo"); }
    else if (res.solved) { sfxWin(); reactBordy?.("acierto"); }
    else if (res.quality === "green") { sfxGood(); reactBordy?.("acierto"); }
    else if (res.quality === "yellow") sfxLateral();
    else if (res.quality === "red") sfxFar();

    if (res.ok && res.country && res.quality) {
      const chain = [...state.chain, { country: res.country, quality: res.quality }];
      setState({ ...state, chain, solved: res.solved });
      setShowInitial(false);
      setShowNextSil(false);
      saveProgress(id, chain.map((x) => x.country), hints);
      if (res.solved) {
        setSending(true);
        void onSolved(chain.map((x) => x.country), hints);
      }
    }
    setInput("");
    inputRef.current?.focus();
  }

  const shownMs = elapsed + hints * DUEL_HINT_SECONDS * 1000;
  return (
    <>
      <section className="panel p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 text-center mb-3">
          ⚔️ {tr.levels[duel.level]}
          {duel.role === "rival" && duel.theirs ? ` · ${tr.duels.target(duel.opponentName ?? tr.duels.aPlayer, markText(tr, duel.theirs))}` : ""}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex flex-col items-center text-center">
            <CFlag name={c.start} size={40} />
            <div className="text-sm font-semibold mt-1 text-cyan-300">{countryName(c.start, locale)}</div>
          </div>
          <div className="text-2xl text-neutral-400">→</div>
          <div className="flex-1 flex flex-col items-center text-center">
            <CFlag name={c.end} size={40} />
            <div className="text-sm font-semibold mt-1 text-fuchsia-300">{countryName(c.end, locale)}</div>
          </div>
        </div>
        <p className="text-center text-xs text-neutral-300 mt-3">{tr.optimal(c.optimal)}</p>
      </section>

      <p className="text-center -my-1">
        <span className="inline-block text-lg font-mono font-bold bg-surface/60 border border-lavender/20 rounded-full px-4 py-1 tabular-nums">
          🕒 {formatTime(shownMs)}
        </span>
        {hints > 0 && <span className="block text-[11px] text-neutral-400 mt-1">{tr.duels.penalty(hints, DUEL_HINT_SECONDS)}</span>}
      </p>

      <WorldMap
        statusByCountry={statusByCountry}
        loadingLabel={tr.loadingMap}
        silhouettes={showNextSil && hintCountry ? [hintCountry] : []}
        showAllOutlines={showAll}
        resetKey={`${c.start}->${c.end}`}
        controls={tr.a11y}
      />

      <section className="flex flex-wrap justify-center gap-2">
        <Chip name={countryName(c.start, locale)} raw={c.start} kind="start" />
        {state.chain.map((x) => <Chip key={x.country} name={countryName(x.country, locale)} raw={x.country} kind={x.quality} />)}
        <Chip name={countryName(c.end, locale)} raw={c.end} kind="end" />
      </section>

      {state.solved ? (
        <div className="py-4"><GlobeLoader label={tr.loadingMap} /></div>
      ) : (
        <section className="relative flex flex-col gap-3">
          <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(input); }} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr.placeholder}
              autoComplete="off"
              autoFocus
              className="flex-1 rounded-xl bg-base border border-lavender/30 px-4 py-3 text-base text-white outline-none focus:border-gold/70 transition"
            />
            <button type="submit" className="brutal-sm brutal-press rounded-xl bg-gold px-5 py-3 font-bold text-surface">OK</button>
          </form>
          {suggestions.length > 0 && (
            <ul className="absolute z-20 top-14 w-full rounded-xl bg-surface border border-lavender/30 overflow-hidden shadow-2xl">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => submit(s)} className="w-full text-left px-4 py-2.5 hover:bg-white/10 flex items-center gap-2">
                    <CFlag name={s} size={22} />
                    <span>{countryName(s, locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {message && <p className={`text-center text-sm ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>}
          {showInitial && hintCountry && (
            <p className="text-center text-sm text-gold">💡 {tr.hintNextInitial(countryName(hintCountry, locale).charAt(0))}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <HintBtn active={showInitial} label={`🔤 ${tr.hintInitial} · +${DUEL_HINT_SECONDS} s`} onClick={() => takeHint(showInitial, () => setShowInitial(true))} />
            <HintBtn active={showNextSil} label={`👤 ${tr.hintSilhouetteNext} · +${DUEL_HINT_SECONDS} s`} onClick={() => takeHint(showNextSil, () => setShowNextSil(true))} />
            <HintBtn active={showAll} label={`🗺️ ${tr.hintSilhouetteAll} · +${DUEL_HINT_SECONDS} s`} onClick={() => takeHint(showAll, () => setShowAll(true))} />
          </div>
          <p className="text-center text-xs text-neutral-400">{tr.used(state.chain.length)}</p>
        </section>
      )}
    </>
  );
}

function Chip({ name, raw, kind }: { name: string; raw: string; kind: Status }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border bg-surface/55 backdrop-blur-sm px-3 py-2 min-w-[84px] ${CHIP[kind]}`}>
      <CFlag name={raw} size={26} />
      <span className="text-[11px] font-medium mt-1 text-center leading-tight">{name}</span>
    </div>
  );
}

function HintBtn({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button onClick={onClick} disabled={active} className="brutal-sm brutal-press rounded-lg bg-surface px-3 py-1.5 text-xs text-white disabled:opacity-50">
      {label} {active ? "✓" : ""}
    </button>
  );
}
