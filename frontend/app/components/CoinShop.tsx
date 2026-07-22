"use client";

// ============================================================
//  Frontle v2 — Tienda de monedas 🪙 (Fase 2, PLAN-FRONTLE-V2 §5)
//  Sheet con el saldo y los 3 paquetes. La compra es un transfer de USDT
//  (requiere wallet); la acreditación la verifica el servidor. Se abre
//  desde los modos de la liga cuando una pista no alcanza, o a demanda.
// ============================================================

import { useEffect, useState } from "react";
import type { t } from "../lib/i18n";
import { COIN_PACKS, buyCoinPack, getCoinBalance, retryPendingCredit } from "../lib/coins";

// Tarjeta de entrada a la tienda (Home y Perfil). Muestra el saldo y abre el
// sheet. `balance === null` = aún cargando o sin wallet: se enseña la pista.
export function CoinShopCard({
  tr,
  balance,
  onOpen,
}: {
  tr: ReturnType<typeof t>;
  balance: number | null;
  onOpen: () => void;
}) {
  return (
    <section className="brutal rounded-2xl bg-surface p-4 flex items-center gap-3">
      <span className="text-3xl" aria-hidden>🪙</span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-white text-lg leading-tight">{tr.coins.shop}</div>
        <div className="text-xs text-neutral-300 truncate">
          {balance === null ? tr.coins.shopSub : tr.coins.balance(balance)}
        </div>
      </div>
      <button
        onClick={onOpen}
        className="brutal-sm brutal-press rounded-lg bg-gold px-4 py-2 text-xs font-bold text-surface flex-none"
      >
        {tr.coins.buy}
      </button>
    </section>
  );
}

export default function CoinShop({
  tr,
  open,
  onClose,
}: {
  tr: ReturnType<typeof t>;
  open: boolean;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [buying, setBuying] = useState<number | null>(null); // índice del paquete en curso
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    retryPendingCredit().then(() => getCoinBalance().then(setBalance));
  }, [open]);

  if (!open) return null;

  async function buy(i: number) {
    if (buying !== null) return;
    setBuying(i);
    setMsg(null);
    const { res, coins } = await buyCoinPack(COIN_PACKS[i]);
    setBuying(null);
    if (res === "success") {
      setMsg({ text: tr.coins.bought(coins ?? COIN_PACKS[i].coins), ok: true });
      setBalance(await getCoinBalance());
    } else if (res === "credit_pending") {
      setMsg({ text: tr.coins.pending, ok: true });
    } else if (res === "cancelled") {
      setMsg({ text: tr.payCancelled, ok: false });
    } else if (res === "no_funds") {
      setMsg({ text: tr.coins.noFunds, ok: false });
    } else if (res === "no_gas") {
      setMsg({ text: tr.payNoGas, ok: false });
    } else {
      setMsg({ text: tr.coins.failed, ok: false });
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-surface border-t border-lavender/25 px-5 pt-3 pb-8">
        <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-4" />
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="text-white font-bold text-base">🪙 {tr.coins.shop}</h3>
          <span className="text-sm font-mono tabular-nums text-amber-200">
            {balance === null ? "…" : tr.coins.balance(balance)}
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 mb-3">{tr.coins.blurb}</p>

        <div className="flex flex-col gap-2">
          {COIN_PACKS.map((p, i) => (
            <button
              key={p.coins}
              onClick={() => buy(i)}
              disabled={buying !== null}
              className={`brutal-sm brutal-press rounded-xl bg-gold px-4 py-3 font-bold text-surface flex items-center justify-between ${
                buying === i ? "animate-pulse" : buying !== null ? "opacity-50" : ""
              }`}
            >
              <span>🪙 {p.coins}</span>
              <span className="font-mono text-sm">{p.usdt.toFixed(2)} USDT</span>
            </button>
          ))}
        </div>

        {msg && (
          <p className={`text-center text-sm mt-3 ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>
        )}
      </div>
    </>
  );
}
