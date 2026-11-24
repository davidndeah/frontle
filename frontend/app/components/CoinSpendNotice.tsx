"use client";

// ============================================================
//  Frontle — Por qué no se pudo gastar monedas
//  Antes, cualquier fallo de una pista o ronda pagada abría la tienda, aunque
//  el jugador tuviera saldo de sobra: si la cuenta estaba activa en otro
//  dispositivo (secret de otro navegador) parecía que "no alcanzaba". Ahora
//  la tienda solo sale cuando de verdad faltan monedas (o no hay wallet), y
//  lo demás se explica aquí, con el botón para activar este dispositivo.
// ============================================================

import type { t } from "../lib/i18n";
import { xpPlayerId } from "../lib/xp";
import RecoverIdentity from "./RecoverIdentity";
import Sheet from "./Sheet";

export type SpendIssue = "identity" | "error";

// A dónde lleva un gasto fallido: la tienda o este aviso.
export function routeSpendFailure(r: string): "shop" | SpendIssue {
  if (r === "insufficient") return "shop";
  if (r === "identity") {
    // Sin wallet no hay nada que activar: la tienda ya explica que hace falta una.
    return /^0x[0-9a-f]{40}$/.test(xpPlayerId()) ? "identity" : "shop";
  }
  return "error";
}

export default function CoinSpendNotice({
  tr,
  issue,
  onClose,
}: {
  tr: ReturnType<typeof t>;
  issue: SpendIssue | null;
  onClose: () => void;
}) {
  if (!issue) return null;
  return (
    <Sheet onClose={onClose} label={tr.coins.shop} title={`🪙 ${tr.coins.shop}`}>
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="max-w-xs text-sm text-neutral-200">
          {issue === "identity" ? tr.coins.otherDevice : tr.coins.spendFailed}
        </p>
        {issue === "identity" ? (
          // Activado: se cierra y el jugador vuelve a tocar la pista.
          <RecoverIdentity tr={tr} onDone={() => setTimeout(onClose, 1200)} />
        ) : (
          <button onClick={onClose} className="brutal-sm brutal-press rounded-lg bg-gold px-5 py-2 min-h-[44px] text-xs font-bold text-surface">
            OK
          </button>
        )}
      </div>
    </Sheet>
  );
}
