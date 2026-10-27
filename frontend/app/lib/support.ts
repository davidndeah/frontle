// ============================================================
//  Frontle — Canales de soporte
//  MiniPay exige un enlace de soporte alcanzable DESDE DENTRO de la Mini App,
//  y solo acepta Telegram, WhatsApp, correo o portal web. El DM de X no cuenta
//  como canal válido, así que los oficiales son el correo y el grupo de
//  Telegram; X queda de apoyo.
//
//  El SLA de listado es arreglar incidencias críticas en 24 h.
// ============================================================

export const SUPPORT_EMAIL = "appfrontle@gmail.com";
export const SUPPORT_X = "frontle_app";
export const SUPPORT_TELEGRAM = "frontle";

export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Soporte Frontle")}`;
export const SUPPORT_X_URL = `https://x.com/${SUPPORT_X}`;
export const SUPPORT_TELEGRAM_URL = `https://t.me/${SUPPORT_TELEGRAM}`;
