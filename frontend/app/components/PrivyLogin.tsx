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
import { useLogin, useWallets } from "@privy-io/react-auth";
import { setEmbeddedProvider } from "../lib/payments";

// Puente wallet-embebida → payments + identidad del jugador. No renderiza nada.
export function PrivyIdentityBridge({
  onIdentity,
}: {
  onIdentity: (address: string) => void;
}) {
  const { wallets, ready } = useWallets();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const embedded = wallets.find((w) => w.walletClientType === "privy");
    if (!embedded) return;
    const addr = embedded.address?.toLowerCase();
    if (!addr || registeredFor.current === addr) return;

    let cancelled = false;
    (async () => {
      try {
        const provider = await embedded.getEthereumProvider();
        if (cancelled) return;
        setEmbeddedProvider(provider); // payments.ts lo usará como fallback
        registeredFor.current = addr;
        onIdentity(addr); // page.tsx: entra al ranking con esta dirección
      } catch (e) {
        console.error("[privy] no se pudo registrar la wallet embebida:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallets, ready, onIdentity]);

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
