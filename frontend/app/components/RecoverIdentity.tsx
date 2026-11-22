"use client";

// ============================================================
//  Frontle — Botón "Activar este dispositivo"
//  Aparece donde el servidor contesta que la wallet es de otro dispositivo
//  (monedas, racha, Flag Rush). Manda la tx de prueba de 0 USDT y, si el
//  servidor la acepta, avisa con `onDone` para reintentar lo que falló.
//  Ver lib/secret.ts → recoverIdentity.
// ============================================================

import { useState } from "react";
import type { t } from "../lib/i18n";
import { recoverIdentity, type RecoverResult } from "../lib/secret";

export default function RecoverIdentity({ tr, onDone }: { tr: ReturnType<typeof t>; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RecoverResult | null>(null);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    setRes(null);
    const r = await recoverIdentity();
    setBusy(false);
    setRes(r);
    if (r === "success") onDone?.();
  }

  const t = tr.identity;
  const note =
    res === "success" ? t.done
    : res === "cancelled" ? t.cancelled
    : res === "wrong_wallet" ? t.wrongWallet
    : res === "no_funds" || res === "no_gas" ? t.noFunds
    : res ? t.failed
    : t.hint;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {res !== "success" && (
        <button
          onClick={onClick}
          disabled={busy}
          className={`brutal-sm brutal-press rounded-lg bg-amber-300 px-4 py-2 min-h-[44px] text-xs font-bold text-surface disabled:opacity-60 ${busy ? "animate-pulse" : ""}`}
        >
          {busy ? t.recovering : t.recover}
        </button>
      )}
      <p className={`text-[11px] max-w-[34ch] text-center ${res === "success" ? "text-emerald-400" : "text-neutral-400"}`}>{note}</p>
    </div>
  );
}
