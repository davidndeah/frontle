"use client";

// Textos de la app según el idioma. En la estética nueva (prueba local,
// lib/estetica.tsx) salen sin emojis: los iconos van en el JSX.
import { t, type Locale } from "./i18n";
import { limpiarEmojis, useEstetica } from "./estetica";

export function useTr(locale: Locale) {
  const { nueva } = useEstetica();
  return nueva ? limpiarEmojis(t(locale)) : t(locale);
}
