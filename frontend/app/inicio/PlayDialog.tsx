"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================
//  Frontle — popup de "Jugar" de la landing
//
//  MiniPay es la vía principal (es donde vive el reto con premio y donde el
//  equipo de MiniPay quiere a los jugadores); el navegador queda como
//  segunda opción, en texto.
//
//  · Los botones de Jugar de la página siguen siendo <a href="/?play=1">
//    renderizados en el servidor, marcados con `data-play`. Este componente
//    intercepta su clic y abre el popup. Sin JS, el enlace lleva al juego
//    como siempre: nada se queda muerto.
//  · <dialog> nativo con showModal(): trae gratis el foco atrapado, Esc para
//    cerrar y el `inert` del resto de la página.
//  · Logo de MiniPay: el icono oficial de la app, en /minipay-logo.webp
//    (regla del listing: imágenes SVG o WebP). Si no carga, se pinta el
//    nombre en texto — nunca un dibujo inventado de una marca ajena.
// ============================================================

// Enlaces oficiales de descarga (celopedia-skill/references/minipay-guide.md).
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.opera.minipay";
const IOS_URL = "https://apps.apple.com/app/minipay-easy-global-wallet/id6504087257";

interface Copy {
  badge: string;
  title: string;
  lead: string;
  android: string;
  ios: string;
  storeHint: string;
  browser: string;
  close: string;
}

export default function PlayDialog({ copy, browserHref }: { copy: Copy; browserHref: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [logoOk, setLogoOk] = useState(true);

  // Si el logo falló antes de hidratar, React no vio el onError: se mira a mano.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setLogoOk(false);
  }, []);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg || typeof dlg.showModal !== "function") return; // sin <dialog>: el enlace va al juego

    function onClick(e: MouseEvent) {
      // Clic con modificador (nueva pestaña, etc.): se respeta el enlace.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[data-play]");
      if (!a) return;
      e.preventDefault();
      dlg!.showModal();
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  function close() {
    const dlg = ref.current;
    if (!dlg?.open) return;
    // Salida animada: se marca, se espera a la animación y se cierra.
    dlg.dataset.closing = "1";
    const done = () => {
      delete dlg.dataset.closing;
      dlg.close();
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else setTimeout(done, 180);
  }

  return (
    <dialog
      ref={ref}
      className="play-dialog"
      aria-labelledby="play-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // Clic en el fondo (fuera del panel) cierra.
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="pd-panel">
        <button type="button" className="pd-close" onClick={close} aria-label={copy.close}>
          ×
        </button>

        {/* Pines decorativos que flotan alrededor: los colores del juego */}
        <span className="pd-pin pd-pin-a" aria-hidden="true" />
        <span className="pd-pin pd-pin-b" aria-hidden="true" />
        <span className="pd-pin pd-pin-c" aria-hidden="true" />

        <p className="pd-badge">{copy.badge}</p>

        <div className="pd-logo">
          {logoOk ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG estático y diminuto: next/image no aporta nada aquí
            <img ref={imgRef} src="/minipay-logo.webp" alt="MiniPay" width={96} height={96} onError={() => setLogoOk(false)} />
          ) : (
            <span className="pd-wordmark">MiniPay</span>
          )}
        </div>

        <h2 id="play-dialog-title" className="pd-title">
          {copy.title}
        </h2>
        <p className="pd-lead">{copy.lead}</p>

        <p className="pd-hint">{copy.storeHint}</p>
        <div className="pd-stores">
          <a className="pd-store pd-android" href={ANDROID_URL} target="_blank" rel="noopener noreferrer">
            <PlayIcon />
            <span>
              <small>Google Play</small>
              {copy.android}
            </span>
          </a>
          <a className="pd-store pd-ios" href={IOS_URL} target="_blank" rel="noopener noreferrer">
            <PhoneIcon />
            <span>
              <small>App Store</small>
              {copy.ios}
            </span>
          </a>
        </div>

        <a className="pd-browser" href={browserHref}>
          {copy.browser} <span aria-hidden="true">→</span>
        </a>
      </div>
    </dialog>
  );
}

// Iconos genéricos (no los logotipos de las tiendas).
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5Z" fill="currentColor" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="18" r="1.3" fill="currentColor" />
    </svg>
  );
}
