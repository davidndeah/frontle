# Auditoría de listing MiniPay — Frontle

> **Fecha:** 2026-07-24
> **Auditado contra:** `.agents/skills/celopedia-skill/references/minipay-requirements.md` (Stage 2, la lista contra la que MiniPay evalúa en el formulario de readiness).
> **Método:** cada punto verificado contra el código y contra fuentes en vivo (Celoscan, Blockscout, la app en producción), no de memoria.

El listing es un proceso de **dos etapas**:
1. **Intake** (`https://minipay.to/mini-apps`) — formulario básico; si gusta, agendan una primera llamada.
2. **Readiness** — tras la llamada, MiniPay manda el formulario completo. El Stage 2 de abajo es lo que evalúan ahí.

⚠️ **No consta si ya se tuvo la primera llamada con MiniPay.** Si aún no, lo prioritario son los items de intake (Stage 1) y **no** enviar una app a medias — MiniPay despriorializa el seguimiento de envíos flojos.

---

## Estado global

**En cuanto a CÓDIGO del repositorio, no quedan huecos abiertos conocidos.** Lo pendiente son items que no son código: capturar PageSpeed, redirigir el dominio viejo, montar el agente de soporte (hueco 5) y preparar los materiales del formulario.

| # | Hueco | Estado | Cierre |
|---|-------|--------|--------|
| 1 | `/stats` sin las 3 métricas on-chain que exige el §8 | ✅ Cerrado | commit `99270ba` |
| 2 | v2 y liga aparecían "sin verificar" en Blockscout | ✅ Cerrado | `forge verify-contract` (los 3 verificados) |
| 3 | PageSpeed sin capturar · JS inicial sin medir · SEO | ⚠️ Parcial | JS medido (OK) + SEO commit `4a37eb1`; PageSpeed pendiente |
| 4 | 360×640 sin verificar en la UI nueva | ✅ Verificado | sin código (medición en navegador) |
| 5 | Agente de soporte en Telegram (SLA 24h) | ⬜ Pendiente | proyecto aparte — ver abajo |

---

## Huecos cerrados

### 1 — Métricas on-chain de `/stats` (commit `99270ba`)

El §8 del checklist exige, además de lo que ya había (DAU, MAU, retención, top países, comisión de plataforma, tasa de fallos, tx por método), tres métricas que faltaban:

- **Transacciones por periodo** (24 h / 7 d / 30 d) — el total de por vida no deja ver si la app sigue viva.
- **Volumen movido en USDT** — suma de transferencias que entran/salen de los tres contratos, deduplicadas por `hash+partes+importe`.
- **Comisiones de red en USD** — antes se omitían porque Blockscout las da en unidad nativa y mostrar ese token está prohibido; ahora se convierten con el precio de DefiLlama y se muestra solo el importe en USD (sin el token). Si el precio no responde, la métrica no se pinta. Solo cuenta las tx de jugadores.

De paso: `buyCoins` no estaba en `USER_METHODS`, así que las compras de monedas se etiquetaban como "Administración" y su comprador no contaba como usuario único. Corregido.

### 2 — Verificación en Blockscout

Los tres contratos ya estaban verificados en **Celoscan** (que es lo que exige el checklist), pero `lib/onchain.ts` lee de **Blockscout**, donde v2 y la liga aparecían "sin verificar" a la vista de un revisor. Tras `forge verify-contract`, los tres quedan verificados en ambos exploradores:

| Contrato | Dirección | Celoscan | Blockscout |
|----------|-----------|----------|------------|
| FrontleGame v2 (diario) | `0xaDcA9A707F394509C8aA906B89B93cb222f2BeBE` | ✅ | ✅ |
| FrontleWeekly (semanal) | `0x766A12333AA5249CDEf2259Cc9D3aD0c746c8132` | ✅ | ✅ |
| FrontleGame v1 (histórico) | `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09` | ✅ | ✅ |

### 3 — Rendimiento y SEO

- **JS inicial de `/`: 1.32 MB** (17 scripts, medido en producción). Dentro del presupuesto de MiniPay (< 2 MB por ruta). Los dos chunks gordos (~262 + ~222 KB) son los mapas (`d3-geo` + `topojson`) — ahí está el margen si algún día aprieta.
- **SEO (commit `4a37eb1`):** al medir se descubrió que la app estaba indexable en dos dominios (`frontle.earth` y el viejo `frontle.vercel.app`, que sigue respondiendo 200) sin `canonical`, y `robots.txt`/`sitemap.xml` daban 404. Se centralizó el dominio en `lib/site.ts`, se configuró `metadataBase` + canonical + Open Graph, y se añadieron `robots.ts` y `sitemap.ts`. Los 13 `frontle.vercel.app` escritos a mano pasaron a `www.frontle.earth`.
- **PageSpeed: pendiente de capturar** (ver "Acciones manuales").

### 4 — Responsive a 360×640 (verificado 2026-07-24)

Las tres pantallas nuevas de esta tanda, medidas por DOM a 360px de ancho, sin desbordes:

| Pantalla | Layout | Desborde |
|----------|--------|----------|
| Rejilla de monedas sueltas (1/2/5/10) | 4 col × 74px | ninguno |
| Podio semanal (🥇🥈🥉) | 3 col × 94px | ninguno |
| Popup de XP (peor caso "#100 de 100") | 1 línea | ninguno |

También sin desbordes: home, ranking diario, tienda (estado sin-billetera) y liga semanal.

**Limitación del método:** Chrome de escritorio no reduce el viewport por debajo de ~500px, así que no se pudo emular un viewport CSS de 360px con media queries reales. Se acotó el ancho del contenido/sheets a 360px y se midió el desborde por DOM. Es válido para estos componentes porque no usan breakpoints responsive (rejillas de columnas fijas). **La verificación definitiva sigue siendo un dispositivo real o DevTools device mode**, que es lo que hará MiniPay.

---

## Hueco 5 — Agente de soporte en Telegram (PENDIENTE)

**Qué pide el checklist (§6, recomendado):** el SLA de listing obliga a arreglar incidencias **críticas en 24 h** o MiniPay desactiva el listado temporalmente. Con una base de usuarios creciente, la triage manual no escala, así que recomiendan **frontar el soporte de Telegram con un agente de IA** que:

- **Intake:** recibe el mensaje, abre un ticket y responde con acuse + ID de ticket.
- **Clasifica** por **tipo** (bug · UX · fallo de pago · cuenta/KYC · petición de feature) y **criticidad** (P0 fondos en riesgo · P1 bloqueante · P2 degradado · P3 duda), para que P0/P1 salten de inmediato y se cumpla el SLA de 24 h.
- **Redacta un borrador de resolución** a partir de logs, tickets previos, estado on-chain de la tx y el FAQ — para que un humano solo **revise, apruebe y envíe** (o corrija).
- **Sigue el estado** (abierto · esperando-usuario · esperando-dev · resuelto) y persigue tickets estancados.

**Por qué queda fuera de este repo:** es infraestructura de soporte (bot de Telegram + backend de tickets + integración con logs/on-chain), no código de Frontle. Es una decisión de producto y un proyecto propio.

**Nota:** el canal de soporte in-app **ya existe y cumple el requisito obligatorio** (correo `appfrontle@gmail.com`, alcanzable desde el menú de Bordy y `/stats`). El agente de Telegram es la parte *recomendada* para sostener el SLA a escala, no un bloqueante duro del listing.

---

## Checklist completo Stage 2 — estado

| Requisito | Estado |
|-----------|--------|
| Zero-click connect (sin botón "Conectar" en MiniPay) | ✅ |
| Sin `personal_sign` / `eth_signTypedData` | ✅ |
| Sin `0x…` como identidad primaria | ✅ (alias / truncado secundario) |
| Solo USDT/USDC/USDm — nunca CELO en UI | ✅ |
| Adaptar a stablecoin preferida, o explicar single-token | ✅ (explainer USDT-only) |
| Copy sin jerga (network fee/deposit/withdraw/stablecoin) | ✅ |
| Probado a 360×640 | ✅ código · ⬜ dispositivo real |
| Imágenes SVG o WebP | ✅ (168 webp, 8 svg, 1 png de 0.5 KB) |
| PageSpeed capturado | ⬜ **acción del usuario** |
| Manifiesto de URLs/orígenes | ✅ preparado (ver abajo) — adjuntar al form |
| Contratos verificados en Celoscan | ✅ (los 3) |
| Hashes de tx de ejemplo por método | ⬜ **recopilar para el form** |
| Redirige al deeplink de recarga con saldo bajo | ✅ |
| Enlace de soporte in-app | ✅ (correo, desde Bordy y /stats) |
| Compromiso de SLA 24 h | ⬜ **compromiso del equipo** |
| Nombre + logo distintos de MiniPay | ✅ |
| ToS + Privacidad in-app | ✅ (4 idiomas) |
| Página de stats (DAU/MAU/retención/volumen/fees/…) | ✅ completada |
| Agente de soporte IA en Telegram (recomendado) | ⬜ hueco 5 |

---

## Acciones que NO son código (para el equipo)

1. **Capturar PageSpeed** de `https://www.frontle.earth/` (pestaña Mobile) en `https://pagespeed.web.dev` — apuntar a 90+. Adjuntar la captura al formulario.
2. **Redirigir `frontle.vercel.app` → `www.frontle.earth`** en Vercel (o quitar ese dominio del proyecto). El canonical le dice a Google cuál preferir, pero mientras el viejo siga sirviendo 200 sigue siendo alcanzable.
3. **Reenviar el sitemap** (`https://www.frontle.earth/sitemap.xml`) en Google Search Console tras el próximo deploy.
4. **Recopilar hashes de tx de ejemplo** por método de jugador (`buyHint`, `payAttempt`, `claim`, `buyCoins`) para el formulario.
5. **Preparar 3+ capturas** de la app (PNG/JPG, < 500 KB c/u) para el intake.
6. **Decidir sobre el agente de soporte de Telegram** (hueco 5).

---

## Manifiesto de orígenes (para el formulario)

| Origen | Para qué | Nota |
|--------|----------|------|
| `*.supabase.co` | Ranking, XP, monedas, faucet | Backend propio |
| `forno.celo.org` | RPC de Celo | Oficial |
| `celo.blockscout.com` | Métricas on-chain | Solo /stats |
| `coins.llama.fi` | Precio del token nativo (→ fees en USD) | Solo /stats |
| `flagcdn.com` | Banderas de países | Tercero (juego) |
| `cdn.jsdelivr.net` | TopoJSON del mapa mundial | Tercero (juego) |
| `open.er-api.com` | Tasa USD→COP | Tercero |
| `get.geojs.io` | País por IP (bandera del ranking) | Tercero; declarado en Privacidad |
| `auth.privy.io` | Login por correo | Solo fuera de MiniPay |

Nota: `payments.ts` deja la RPC de **Celo Sepolia** en el bundle; no se llama en producción (`CHAIN_ID === 42220`), pero aparecerá si escanean cadenas.
