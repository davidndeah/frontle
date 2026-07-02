"use client";

// ============================================================
//  Frontle — Providers de cliente (Privy)
//  Envuelve la app para ofrecer login por CORREO a quien no tiene wallet.
//  Tres caminos de identidad conviven:
//    1. MiniPay  → window.ethereum inyectado (auto-conecta, ya existía)
//    2. Navegador→ "Conectar wallet" (window.ethereum de extensión, ya existía)
//    3. Correo   → Privy crea una wallet embebida en Celo (ESTO es lo nuevo)
//  El puente de esa wallet embebida hacia payments.ts vive en page.tsx
//  (registra su provider EIP-1193 vía setEmbeddedProvider).
// ============================================================

import { PrivyProvider } from "@privy-io/react-auth";
import { celo } from "viem/chains";
import type { ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

// ¿Está el login por correo disponible? Solo si hay App ID. `page.tsx` lo usa
// para renderizar el botón/bridge de Privy únicamente cuando el PrivyProvider
// existe — así los hooks de Privy nunca se llaman fuera de su contexto.
export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

// Celo con Forno como RPC por defecto: la wallet embebida de Privy transmite
// usando esta config de cadena. Forno es gratis y siempre disponible.
const CELO_WITH_RPC = {
  ...celo,
  rpcUrls: {
    ...celo.rpcUrls,
    default: { http: ["https://forno.celo.org"] },
  },
};

export function Providers({ children }: { children: ReactNode }) {
  // Sin App ID configurado, Privy no puede inicializar → renderiza la app tal
  // cual (MiniPay y "conectar wallet" siguen funcionando; solo falta el correo).
  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        // La wallet embebida debe nacer en Celo, no en Ethereum.
        defaultChain: CELO_WITH_RPC,
        supportedChains: [CELO_WITH_RPC],
        embeddedWallets: {
          showWalletUIs: false,
          ethereum: {
            // Solo crea wallet a quien entra por correo y no trae una propia.
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
