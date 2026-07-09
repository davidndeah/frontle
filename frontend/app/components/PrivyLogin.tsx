"use client";

// ============================================================
//  Frontle — Botón "Entrar con correo"
//  Deliberadamente SIN hooks de Privy y sin importar su SDK: si los usara,
//  arrastraría 1.27 MB al bundle inicial de toda la app y exigiría tener al
//  PrivyProvider de ancestro.
//
//  En su lugar pide el login por el bus de eventos. Quien lo atiende es
//  PrivyGate, que se carga aparte y solo fuera de MiniPay.
// ============================================================

import { requestEmailLogin } from "../lib/privy";

export function EmailLoginButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={requestEmailLogin} className={className}>
      {label}
    </button>
  );
}
