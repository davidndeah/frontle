"use client";

// ============================================================
//  Frontle v2 — Tarjeta de racha (Fase 3, PLAN §5.2)
//  Racha REAL (derivada en el servidor), congeladores en reserva y, si hay
//  un día perdido dentro de la ventana de 48h, la oferta de repararlo con
//  su precio exacto. Vive en el tab Perfil.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import type { t } from "../lib/i18n";
import {
  FREEZE_COST,
  MAX_FREEZES,
  buyFreeze,
  getFreezes,
  getRepairQuote,
  repairStreak,
  syncStreak,
  type RepairQuote,
  type StreakActionResult,
} from "../lib/streak";

export default function StreakCard({ tr, onStreak }: { tr: ReturnType<typeof t>; onStreak?: (n: number) => void }) {
  const [streak, setStreak] = useState<number | null>(null);
  const [freezes, setFreezes] = useState(0);
  const [quote, setQuote] = useState<RepairQuote | null>(null);
  const [busy, setBusy] = useState<null | "freeze" | "repair">(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refresh = useCallback(async () => {
    const s = await syncStreak();
    setStreak(s);
    onStreak?.(s);
    setFreezes(await getFreezes());
    setQuote(await getRepairQuote());
  }, [onStreak]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function say(res: StreakActionResult, okText: string) {
    if (res === "ok") return setMsg({ text: okText, ok: true });
    if (res === "insufficient") return setMsg({ text: tr.streakCard.needCoins, ok: false });
    if (res === "max") return setMsg({ text: tr.streakCard.freezeMax, ok: false });
    if (res === "identity") return setMsg({ text: tr.streakCard.otherDevice, ok: false });
    if (res === "unavailable") return setMsg({ text: tr.streakCard.notRepairable, ok: false });
    return setMsg({ text: tr.coins.failed, ok: false });
  }

  async function onBuyFreeze() {
    if (busy) return;
    setBusy("freeze");
    setMsg(null);
    const { res } = await buyFreeze();
    say(res, tr.streakCard.freezeBought);
    if (res === "ok") await refresh();
    setBusy(null);
  }

  async function onRepair() {
    if (busy || !quote) return;
    setBusy("repair");
    setMsg(null);
    const { res } = await repairStreak(quote.day);
    say(res, tr.streakCard.repaired);
    if (res === "ok") await refresh();
    setBusy(null);
  }

  return (
    <section className="panel p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold text-white text-xl tabular-nums">
              {streak === null ? "…" : streak}
            </span>
            <span className="text-[11px] text-neutral-400">{tr.streakCard.days}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5" title={tr.streakCard.freezeHint}>
          {Array.from({ length: MAX_FREEZES }, (_, i) => (
            <span key={i} className={`text-lg ${i < freezes ? "" : "opacity-25 grayscale"}`}>❄️</span>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-neutral-400">{tr.streakCard.freezeHint}</p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onBuyFreeze}
          disabled={busy !== null || freezes >= MAX_FREEZES}
          className={`brutal-sm brutal-press rounded-lg bg-[#38bdf8] px-3 py-2 text-xs font-bold text-[#082f49] disabled:opacity-50 ${busy === "freeze" ? "animate-pulse" : ""}`}
        >
          ❄️ {tr.streakCard.buyFreeze} · {tr.coins.cost(FREEZE_COST)}
        </button>

        {quote && (
          <button
            onClick={onRepair}
            disabled={busy !== null}
            className={`brutal-sm brutal-press rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-[#1c0b3e] disabled:opacity-50 ${busy === "repair" ? "animate-pulse" : ""}`}
          >
            🛠️ {tr.streakCard.repair(quote.streakLen)} · {tr.coins.cost(quote.cost)}
          </button>
        )}
      </div>

      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>}
    </section>
  );
}
