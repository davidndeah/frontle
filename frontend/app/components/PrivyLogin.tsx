"use client";

// ============================================================
//  Frontle — Login por correo (Privy)
//  Encapsula TODO el uso de hooks de Privy. Se monta solo cuando
//  PRIVY_ENABLED es true (hay App ID), de modo que los hooks nunca
//  corren fuera del PrivyProvider.
//
//  - PrivyIdentityBridge: sin UI. Cuando Privy crea la wallet embebida,
//    registra su provider EIP-1193 en payments.ts (setEmbeddedProvider) y
//    avisa la dirección a page.tsx (onIdentity) → identidad para el ranking.
//  - EmailLoginButton: botón que abre el modal de correo de Privy.
// ============================================================

import { useEffect, useRef } from "react";
import { useLogin, useWallets, usePrivy } from "@privy-io/react-auth";
import { setEmbeddedProvider } from "../lib/payments";

// Reclama el bono de bienvenida (una sola vez por usuario). El servidor verifica
// el token de Privy, saca la wallet del usuario y transfiere 0.10 USDT si aplica.
// Es idempotente: si ya se dio, devuelve granted:false sin efecto.
async function claimWelcomeBonus(token: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const r = await fetch(`${url}/functions/v1/welcome-bonus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "x-privy-token": token, // el faucet lo verifica server-side
      },
      body: "{}",
    });
    const j = await r.json();
    return j?.granted ? String(j.amount) : null;
  } catch (e) {
    console.error("[bono] no se pudo reclamar:", e);
    return null;
  }
}

// Puente wallet-embebida → payments + identidad del jugador. No renderiza nada.
export function PrivyIdentityBridge({
  onIdentity,
  onWelcomeBonus,
}: {
  onIdentity: (address: string) => void;
  onWelcomeBonus?: (amount: string) => void;
}) {
  const { wallets, ready } = useWallets();
  const { getAccessToken } = usePrivy();
  const registeredFor = useRef<string | null>(null);
  const bonusFor = useRef<string | null>(null);

  // Callbacks en refs: sus identidades cambian cada render (arrows inline en
  // page.tsx). Guardarlas en refs evita que el efecto se re-ejecute y cancele
  // el async en vuelo (por eso antes el bono se otorgaba pero Bordy no avisaba).
  const onIdentityRef = useRef(onIdentity);
  const onBonusRef = useRef(onWelcomeBonus);
  onIdentityRef.current = onIdentity;
  onBonusRef.current = onWelcomeBonus;

  useEffect(() => {
    if (!ready) return;
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    if (!embedded) return;
    const addr = embedded.address?.toLowerCase();
    if (!addr) return;

    // 1) Identidad (una vez por dirección).
    if (registeredFor.current !== addr) {
      registeredFor.current = addr;
      (async () => {
        try {
          const provider = await embedded.getEthereumProvider();
          setEmbeddedProvider(provider); // payments.ts lo usará como fallback
          onIdentityRef.current(addr); // page.tsx: entra al ranking con esta dirección
        } catch (e) {
          console.error("[privy] no se pudo registrar la wallet embebida:", e);
        }
      })();
    }

    // 2) Bono de bienvenida (una vez por dirección; el server decide si aplica).
    //    Independiente de la identidad y SIN cancelación: es idempotente y
    //    one-shot, así que un re-render no debe abortarlo.
    if (bonusFor.current !== addr && onBonusRef.current) {
      bonusFor.current = addr;
      (async () => {
        try {
          const token = await getAccessToken();
          if (!token) return;
          const amount = await claimWelcomeBonus(token);
          if (amount) onBonusRef.current?.(amount);
        } catch (e) {
          console.error("[bono] no se pudo reclamar:", e);
        }
      })();
    }
  }, [wallets, ready, getAccessToken]);

  return null;
}

// Botón "Entrar con correo". Abre el modal de Privy; la creación de la wallet
// y el alta en el ranking los maneja PrivyIdentityBridge de forma reactiva.
export function EmailLoginButton({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { login } = useLogin();
  return (
    <button type="button" onClick={() => login()} className={className}>
      {label}
    </button>
  );
}
