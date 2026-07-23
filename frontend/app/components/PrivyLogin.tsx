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

export function EmailLoginButton({
  label,
  className,
  onBeforeLogin,
}: {
  label: string;
  className?: string;
  // Si el botón vive dentro de un sheet/modal, hay que cerrarlo ANTES de abrir
  // el modal de Privy: dejar el sheet montado debajo lo hacía interceptar taps
  // y, al gestionar el foco, cerraba el teclado en móvil apenas se tocaba el
  // input de correo. Cerrar primero deja el modal de Privy limpio y solo.
  onBeforeLogin?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onBeforeLogin?.();
        requestEmailLogin();
      }}
      className={className}
    >
      {label}
    </button>
  );
}
