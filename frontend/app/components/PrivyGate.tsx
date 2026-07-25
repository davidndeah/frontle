"use client";

// ============================================================
//  Frontle — PrivyGate
//  El ÚNICO módulo que importa @privy-io/react-auth. page.tsx lo carga con
//  next/dynamic({ssr:false}), así que el SDK (~1.27 MB) sale del bundle
//  inicial y no se descarga nunca dentro de MiniPay, donde no hace falta.
//
//  No envuelve la página: el provider vive aquí dentro, junto a los dos
//  únicos consumidores de sus hooks. Los botones de correo repartidos por la
//  UI piden el login por el bus de eventos (lib/privy.ts), no por el hook.
//  Gracias a eso el árbol de la partida nunca se remonta.
//
//  No renderiza nada visible.
// ============================================================

import { useEffect, useRef } from "react";
import { PrivyProvider, useLogin, useWallets, usePrivy, type PrivyClientConfig } from "@privy-io/react-auth";
import { celo } from "viem/chains";
import { setEmbeddedProvider } from "../lib/payments";
import { onEmailLoginRequest, onLogoutRequest, PRIVY_APP_ID } from "../lib/privy";

// Celo con Forno como RPC: la wallet embebida de Privy transmite con esta
// config de cadena. Forno es gratis y siempre disponible.
const CELO_WITH_RPC = {
  ...celo,
  rpcUrls: { ...celo.rpcUrls, default: { http: ["https://forno.celo.org"] } },
};

// Config del provider como CONSTANTE DE MÓDULO — no un objeto literal inline.
// page.tsx re-renderiza cada 250ms (reloj de la partida) y PrivyGate con él;
// si el `config` naciera nuevo en cada render, Privy reinicializaría su cliente
// y DERRIBARÍA el modal de correo abierto: en móvil el teclado aparecía y se
// cerraba al instante porque el input se remontaba. Con identidad estable, un
// re-render de PrivyGate ya no toca al provider.
const PRIVY_CONFIG: PrivyClientConfig = {
  loginMethods: ["email"],
  // La wallet embebida debe nacer en Celo, no en Ethereum.
  defaultChain: CELO_WITH_RPC,
  supportedChains: [CELO_WITH_RPC],
  embeddedWallets: {
    showWalletUIs: false,
    // Solo crea wallet a quien entra por correo y no trae una propia.
    ethereum: { createOnLogin: "users-without-wallets" },
  },
};

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
function IdentityBridge({
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
    if (!embedded) {
      // Ya listo y sin wallet embebida = sesión cerrada. Hay que soltar la
      // marca de "ya registrada": si no, volver a entrar CON EL MISMO correo
      // daría la dirección por registrada y `myId` se quedaría vacío.
      registeredFor.current = null;
      return;
    }
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

// Abre el modal de correo cuando cualquier botón lanza el evento del bus.
function LoginListener() {
  const { login } = useLogin();
  const loginRef = useRef(login);
  loginRef.current = login;

  useEffect(() => onEmailLoginRequest(() => loginRef.current()), []);

  return null;
}

// Cierra la sesión de correo cuando el botón de la UI lanza el evento del bus.
// Privy borra su propio estado persistido; el resto de la limpieza (identidad,
// alias, premios) la hace page.tsx, que es quien la tiene.
function LogoutListener() {
  const { logout } = usePrivy();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => onLogoutRequest(() => void logoutRef.current()), []);

  return null;
}

export default function PrivyGate({
  onIdentity,
  onWelcomeBonus,
}: {
  onIdentity: (address: string) => void;
  onWelcomeBonus?: (amount: string) => void;
}) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={PRIVY_CONFIG}>
      <IdentityBridge onIdentity={onIdentity} onWelcomeBonus={onWelcomeBonus} />
      <LoginListener />
      <LogoutListener />
    </PrivyProvider>
  );
}
