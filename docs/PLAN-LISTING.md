# PLAN — Listing en MiniPay (80/20)

> Objetivo: quedar **listados en MiniPay** (ya en proceso). Este doc concentra
> el 80/20: pocas tareas de alto impacto, con pasos directos para no gastar
> tokens redescubriendo. Divide el trabajo entre **Santiago (backend/contrato)**
> y **Fable (frontend, lo ejecuta David)**.

## Decisiones fijadas (contexto para no re-litigar)

- **Compliance/gambling NO es blocker**: el equipo de listing nunca lo mencionó. No se toca el modelo del pot por este motivo.
- **Timing**: preparar todo ahora; el listing se finaliza/aplica en agosto tras el payout de Proof of Ship S2 (31 jul). Excepción: ver P0 (llevar regiones a producción conviene antes, porque el equipo revisa la app en vivo).
- **Fuente de requisitos**: docs.minipay.xyz + `docs/benchmark/`.
- **Estado**: 21 commits (regiones ×6, práctica, audio, Bordy, estrellas) están en `feat/regiones-audio-practica`, **no en `main`/producción**.

---

## Prioridad (el 80/20 para listing)

| Pri | Tarea | Impacto en listing | Dueño |
|-----|-------|--------------------|-------|
| **P0** | Llevar la rama a **producción** (las 6 regiones = lo que MiniPay pidió) | El reviewer juzga la app en vivo; hoy no ve nada de esto | Fable (F1) |
| **P1** | **Catálogo MiniApp**: manifest, icono, screenshots, categoría + QA en device | Es el trámite concreto de listar | Fable (F2) + David (device) |
| **P2** | **Copy audit** plain-language (network fee, deposit, sin jerga) | MiniPay es estricto con el wording | Fable (F3) |
| **P3** | **Score card compartible** (loop de crecimiento Wordle) | No es requisito, pero es el gap nº1 del benchmark y sube el PMF que MiniPay valora | Fable (F4) |
| **P4** | Ranking regional + robustez de dinero + npm | Retención/robustez/PoS | Santiago (S1–S4) |

---

# PARTE A — Tareas para SANTIAGO (backend / contrato)

> Pásale esta sección tal cual. Cada tarea es autocontenida.

### S1 — Ranking regional (columna `mode`)
**Por qué:** el modo Regiones hoy es local-only (sin ranking). Para que compita como el mundial, cada país necesita su tabla de posiciones.
**Pasos:**
1. Migración nueva `supabase/migrations/0007_scores_add_mode.sql`: `ALTER TABLE scores ADD COLUMN mode text NOT NULL DEFAULT 'world';` (índice en `(mode, day, level)`).
2. `submitScore` (frontend `app/lib/ranking.ts`) ya manda `ScoreEntry`; añadir campo opcional `mode?: string` y pasarlo al insert.
3. `getRanking(day, level, mode='world')`: añadir `&mode=eq.${mode}` al query REST.
4. Regiones no tienen "nivel"; usar `level='easy'` fijo y `mode=<regionId>` (co/us/ar/ng/br/gh).
**Verificación:** un score de Argentina aparece solo en el ranking `mode=ar`, no en el mundial.
**Nota:** el wiring de `RegionGame.tsx` para llamar `submitScore` con `mode` lo hace Fable (ver F más abajo si se prioriza); Santiago solo deja la columna + queries listas.

### S2 — Cron de respaldo del cierre diario
**Por qué:** patrón del benchmark (Zorrito/Chessify): si el `close-day` de Supabase falla un día, los pots quedan sin liquidar. Redundancia gratis.
**Pasos:**
1. GitHub Action (`.github/workflows/close-day-backstop.yml`) con `schedule: cron` ~30 min después del cierre UTC.
2. Llama al mismo endpoint/función `close-day` (idempotente) y verifica que el día quedó `rolled`.
3. Si no, reintenta y notifica (issue/Telegram).
**Verificación:** desactivar temporalmente el pg_cron un día y confirmar que el backstop cierra igual.

### S3 — (opcional, métrica PoS) publicar `@frontle/borders` en npm
**Por qué:** "descargas de paquetes npm" es métrica directa de PoS y nadie más la usará.
**Pasos:** extraer de `app/lib/game.ts` el motor puro (grafo de países + `shortestPath` BFS + `dailyChallenge` determinista) a un paquete `@frontle/borders` con su `package.json`, README y `npm publish`. Sin deps del frontend.
**Verificación:** `npm i @frontle/borders` en un proyecto vacío y `dailyChallenge()` devuelve el reto del día.

### S4 — Confirmar tracking en Talent
- v2 (`0xaDcA…f2beBE`) añadido como data source en talent.app (mantener v1 por historial).
- Confirmar que el "MiniPay hook" (feeCurrency CIP-64 ya está) cuenta como booster; revisar si hay `@minipay` SDK/hook oficial detectable que sume.

---

# PARTE B — Tareas para FABLE (frontend)

> Cómo invocar: pásale a Fable **una tarea a la vez**, citando su id (p.ej. "haz F3
> de `docs/PLAN-LISTING.md`"). Todas parten de la rama `feat/regiones-audio-practica`.
> Regla común: `npx tsc --noEmit` en 0 + verificación en el server + **commit pequeño**.

### F1 — Merge a producción + QA de regresión  🔴 P0
**Objetivo:** que `main` (producción) muestre regiones/práctica/audio/Bordy. Es el mayor impacto de listing.
**Pasos:**
1. Abrir PR de `feat/regiones-audio-practica` → `main`. Resolver conflictos (probable en `page.tsx`; conservar lo de `main` + capas nuevas, ya se hizo antes).
2. `npx tsc --noEmit` (0 errores) + `npx eslint app/page.tsx` (no introducir errores nuevos).
3. **Checklist de regresión** (levantar server, viewport móvil 390px):
   - Modo mundial: jugar, pistas, victoria, ranking, timer.
   - Modo Regiones: selector con dropdown + mapa (6 países), jugar Colombia/USA, banderas.
   - Aprender: tutorial de Bordy + Modo práctica (contornos, pista gratis, otra ronda).
   - Audio: mute música/efectos en header y Perfil.
   - Header sin desbordarse en 360/390/414px.
4. Confirmar deploy de Vercel en verde y hacer un smoke test en la URL de producción.
**Verificación:** captura de cada tab en producción. **Commit/merge** solo tras checklist ✓.
**⚠️ Decisión de David antes de mergear:** confirmar timing vs. elegibilidad PoS (ver "Decisiones fijadas").

### F2 — Catálogo MiniApp: manifest + metadata + Farcaster  🟠 P1
**Objetivo:** dejar la app lista para el catálogo de descubrimiento.
**Pasos:**
1. **Metadata Next** (`app/layout.tsx`): `metadata` con `title`, `description` (1 frase, plain language), `openGraph` (imagen 1200×630 en `/public/og.png`), `themeColor` (#1c0b3e), `manifest: "/manifest.webmanifest"`.
2. **PWA manifest** (`app/manifest.ts` o `public/manifest.webmanifest`): `name` "Frontle", `short_name`, `description`, `start_url "/"`, `display "standalone"`, `background_color`, `theme_color`, `icons` (192 y 512, ya existe favicon; generar PNGs), `categories: ["games","education"]`.
3. **Farcaster manifest** (`public/.well-known/farcaster.json`): frame/miniapp metadata (patrón Tycoon/AbaPay). Distribución extra gratis.
4. **Viewport/safe-areas**: verificar `viewport-fit=cover` + `env(safe-area-inset-*)` en el layout (MiniPay webview con notch).
**Verificación:** Lighthouse PWA sin errores de manifest; el `.well-known/farcaster.json` responde 200.
**Falta de David:** decidir la descripción de 1 frase + confirmar/aportar el icono maestro y 3–5 screenshots (o que Fable las capture del preview).

### F3 — Auditoría de copy plain-language  🟡 P2
**Objetivo:** todo el texto cumple las reglas de MiniPay (cero jerga cripto).
**Reglas (checklist):**
- "gas" / "gas fee" → **"network fee"** (comisión de red).
- "crypto" / "tokens" en UI de usuario → **"digital dollars"** / el nombre del stablecoin (USDT).
- "wallet address 0x…" → alias/username (ya está; verificar que no se escape ningún 0x en UI).
- "swap/bridge/mint" → lenguaje llano o quitar.
- "deposit"/"add cash" para recargar (ya usa el deeplink).
**Método (mecánico, ideal Fable):**
1. `grep -rniE "gas|crypto|token|wallet|0x|swap|mint" app/lib/i18n.ts` → revisar cada string de UI (no comentarios).
2. Corregir en las 4 locales (es/en/fr/pt) manteniendo el sentido.
3. Revisar también textos hardcodeados fuera de i18n (RegionGame, PracticeGame, tutorial).
**Verificación:** segundo grep sin hits en strings de UI; typecheck ok.

### F4 — Score card compartible (imagen tipo Wordle)  🟢 P3  ← la más compleja
**Objetivo:** al ganar, generar una **imagen** spoiler-free y compartirla (WhatsApp/X) en un tap. Hoy solo se comparte texto (`page.tsx:1930`, `RegionGame.tsx:309`).
**Diseño de la card (1080×1080 PNG, tema Violeta Prisma):**
- Header: "FRONTLE" + fecha del reto.
- Fila origen→destino: **banderas** (no nombres, spoiler-free) con "→".
- **Cuadritos del semáforo** (una fila de 🟩🟨🟥 según la calidad de cada país de la ruta) — el equivalente visual de los cuadritos de Wordle.
- Métricas: nº de países · ⏱️ tiempo · ⭐ estrellas (3/2/1 vs óptima).
- Footer: "frontle.vercel.app".
**Implementación (Canvas, sin libs):**
1. Nuevo `app/lib/scoreCard.ts`: `async function makeScoreCard(data): Promise<Blob>`.
   - Crear `<canvas 1080×1080>`, `getContext("2d")`, pintar fondo (gradiente #1c0b3e→#160833), textos y rects de colores del semáforo (COLORS de game.ts).
   - Banderas: cargar `https://flagcdn.com/w160/<code>.png` (o `/flags/national/<id>.png` en regiones) con `new Image()` + `await onload`, dibujar con `drawImage`.
   - `canvas.toBlob(resolve, "image/png")`.
2. Nuevo componente/botón "Compartir tarjeta" en la win card (mundo + regiones):
   - `const blob = await makeScoreCard(...)`.
   - `const file = new File([blob], "frontle.png", {type:"image/png"})`.
   - Si `navigator.canShare?.({files:[file]})` → `navigator.share({files:[file], text})`.
   - Fallback: descargar el PNG (`URL.createObjectURL`) + copiar el texto actual.
3. Reusar los datos que ya existen: chain, qualities, guesses, optimal, tiempo, stars.
**Verificación:** en el server, ganar un reto → botón genera el PNG (revisar la imagen visualmente con Playwright/screenshot del canvas) → `navigator.canShare` true en móvil.
**Flujo:** ver diagrama al final.

### F5 — (si sobra tiempo) recompensa visible por racha
La racha ya se muestra; falta premiarla (badge al día 3/7 + micro-celebración). Local (localStorage), sin backend. Bajo esfuerzo, refuerza retención.

---

## Diagrama — flujo del Score Card (F4)

```
[Victoria] ──> botón "Compartir tarjeta"
                    │
                    ▼
        makeScoreCard(data)  ── carga banderas (async) ──┐
                    │                                     │
                    ▼                                     ▼
        canvas 1080² : fondo + banderas + 🟩🟨🟥 + métricas + ⭐
                    │
                    ▼
             canvas.toBlob(png)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 navigator.canShare(files)   (no soportado)
        │                       │
        ▼                       ▼
 share({files,text})     descargar PNG + copiar texto
```

## Diagrama — secuencia general

```
AHORA ─ F1 merge a prod (regiones en vivo) ─┬─ F2 catálogo ─┬─ QA device ─> LISTO para aplicar
                                            ├─ F3 copy audit┤
                                            └─ F4 score card┘   (agosto: aplicar tras payout PoS)
Santiago en paralelo: S1 ranking regional · S2 cron respaldo · S3 npm · S4 tracking
```

---

## Qué falta de David (para desbloquear a Fable)
1. **F1**: confirmar cuándo mergear a producción (timing PoS).
2. **F2**: la descripción de 1 frase de la app + icono maestro + screenshots (o dar luz verde a que Fable las capture del preview).
3. **S1–S4**: pasar la Parte A a Santiago.
