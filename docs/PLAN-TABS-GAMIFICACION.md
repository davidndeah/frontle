# PLAN — Tabs con vida + Gamificación de mecánicas

> Rediseño del bottom-nav para que se sienta un **juego** (no una app utilitaria) y
> gamificación de las mecánicas de juego. Diseñado con Opus para **ejecución de Fable**.
> Continúa el estilo de los `PLAN-*` del repo. Aterrizado en `docs/benchmark/MECANICAS.md`
> y `FRONTEND.md` (la investigación del top 10 de Proof of Ship) y en el
> `docs/design/DESIGN-SYSTEM.md` (estética "Violeta Prisma").

> ## ✅ ESTADO: Partes A y B completadas (2026-07-16)
> Ejecutado por Santiago/Fable en 10 PRs, todo mergeado a `main`:
> `TAB-1` [#45](https://github.com/davidndeah/frontle/pull/45) ·
> `TAB-2` [#49](https://github.com/davidndeah/frontle/pull/49) ·
> `TAB-3` [#47](https://github.com/davidndeah/frontle/pull/47) ·
> `TAB-4` [#56](https://github.com/davidndeah/frontle/pull/56) ·
> `GAM-1` [#46](https://github.com/davidndeah/frontle/pull/46) ·
> `GAM-2` [#48](https://github.com/davidndeah/frontle/pull/48) ·
> `GAM-3` [#51](https://github.com/davidndeah/frontle/pull/51) ·
> `GAM-4` [#50](https://github.com/davidndeah/frontle/pull/50) ·
> `GAM-5` [#55](https://github.com/davidndeah/frontle/pull/55) + [#57](https://github.com/davidndeah/frontle/pull/57)
> (incluyó la persistencia Supabase que estaba marcada 🔶 bloqueada — Santiago la destrabó).
> Auditado con `impeccable` post-merge (2026-07-16): sin hallazgos bloqueantes — a11y, performance,
> theming y anti-patrones limpios. Único detalle cosmético (no bloqueante): el keyframe de
> `streak-bump` tiene overshoot de escala, técnicamente roza la regla "no bounce" del skill, pero
> es un patrón de feedback de logro legítimo (mismo criterio que Chesscito en el benchmark). No tocar.
>
> **Solo queda la Parte C** (exploración de paleta + Bordy), ahora en su propio plan dedicado
> para Fable: [[PLAN-PALETA-BORDY]] (`docs/PLAN-PALETA-BORDY.md`).
>
> **Siguiente tanda sugerida** (de `docs/benchmark/FRONTEND.md`, tiers 🟡/🟢, sin ejecutar):
> - VS screen al iniciar el reto (banderas grandes, 1.5s) — anticipación estilo Action Order
> - Personalización de Bordy (patrón fox-customizer de Zorrito) — depende de que exista Bordy SVG (EXP-2) primero
> - Pasada de "lenguaje llano" sobre todo el copy (auditar contra las reglas MiniPay)
> - Manifest de Farcaster (`.well-known/farcaster.json`) — archivo simple, distribución gratis
> - Temas de mapa desbloqueables (análogo a piece sets de Chessify)
> - Duelo por código de sala — el modo viral de WhatsApp, pero necesita backend (🔶 Santiago)

---

## 0. Reglas de oro (leer antes de tocar nada)

1. **Design system manda** (`docs/design/DESIGN-SYSTEM.md`): color solo funcional; el
   **gradiente prisma** (`.prism-text` / `prism`) se reserva para **marca y celebración**
   — la gamificación (subir de racha, estrellas, logros) ES el momento de celebración
   donde el prisma está permitido. Fuera de eso, blanco/gris sobre violeta.
2. **`prefers-reduced-motion` no es opcional.** Toda animación nueva necesita su
   alternativa (crossfade o instantáneo) en el bloque `@media (prefers-reduced-motion: reduce)`
   de `globals.css` — ya existe el patrón ahí (Bordy, halo, pop-in, claim-*). Añadir cada
   clase nueva a ese bloque en el mismo commit.
3. **Móvil primero, 360×640** (mínimo MiniPay). Targets táctiles ≥ 44px.
4. **Commits pequeños, 1 tarea = 1 PR** (métrica Proof of Ship: días con commits).
   Gate de CI real = `npx tsc --noEmit` limpio (el `npm run lint` ya falla en main por
   errores preexistentes; no bloquea).
5. **Scope = frontend.** Lo que necesite persistencia real (puntos, racha on-chain, pot)
   es de Santiago (backend/contrato) y está marcado 🔶 abajo — Fable hace la capa visual
   con datos locales/existentes y deja el hook listo.

---

## 1. Cómo usar las skills (instaladas a nivel usuario)

| Skill | Para qué en este plan | Cómo invocarla |
|-------|----------------------|----------------|
| **frontend-design** | Dirección estética de cada pieza (que no se vea genérico/IA). Úsala al *decidir* el look de un tab/celebración antes de codear. | Se activa sola al diseñar UI, o `usa la skill frontend-design para…` |
| **ui-ux-pro-max** | Biblioteca de consulta: patrones de badges, indicadores, iconos, presets de motion (GSAP). Úsala para *elegir* el patrón concreto (ej. estilo de badge de logro). | `busca en ui-ux-pro-max un patrón de…` |
| **review-animations** (Emil Kowalski) | **Después** de codear cada animación, pásala por sus 10 estándares (propósito, frecuencia, performance). No escribe la animación: la *critica*. | `revisa esta animación con review-animations` |
| **impeccable** | Auditoría final de cada PR (contraste, a11y, targets). Ya la usamos para la home. | `audita [archivo] con impeccable` |

**Flujo por tarea:** frontend-design (decidir) → codear → review-animations (pulir motion) →
impeccable (auditar) → PR.

---

## PARTE A — Tabs con vida (bottom-nav)

Estado actual (`app/page.tsx`, componente de la `<nav className="app-nav">`, ~línea 1445):
nav plana, emoji + label, inactivo en `grayscale opacity-60`, activo en blanco con un
subrayado amarillo de 8px. **Cero animación al cambiar de tab.** Se siente utilitario.

### TAB-1 · Estado activo con "pop" (spring) al seleccionar
- **Qué:** al tocar un tab, su ícono hace un rebote sutil (scale 1 → 1.18 → 1, ease-out, ~250ms)
  y sube ligeramente; el subrayado amarillo actual se convierte en un "glow" bajo el ícono
  activo (no un simple line).
- **Archivos:** `app/page.tsx` (nav), `app/globals.css` (keyframe `tab-pop` + su reduced-motion).
- **Skill:** frontend-design (look del estado activo) → review-animations (que el pop no rebote feo).
- **Aceptación:** el ícono activo tiene volumen; al cambiar de tab se siente táctil; con
  reduced-motion no hay pop (solo cambia el color/glow). `tsc` limpio.

### TAB-2 · Transición de contenido entre tabs (crossfade + slide corto)
- **Qué:** al cambiar de tab, el contenido entra con un fade + desplazamiento vertical de ~8px
  (el `pop-in` que ya existe sirve de base). Que no "salte" de golpe.
- **Archivos:** `app/page.tsx` (contenedor `.app-content`), `app/globals.css`.
- **Skill:** review-animations (timing y stagger).
- **Aceptación:** cambiar de tab se siente fluido, no un corte seco; reduced-motion = corte
  instantáneo. Sin layout shift.

### TAB-3 · Indicadores/badges en los tabs (el gancho de juego)
- **Qué:** señales que inviten a volver, estilo juego:
  - **Jugar:** punto pulsante (dot) cuando el reto de hoy **no está resuelto**; desaparece al resolver.
  - **Perfil:** mini-contador de **racha** (🔥 N) sobre el ícono si la racha ≥ 2.
  - (Opcional) **Ranking:** dot si el jugador cayó de posición desde la última visita (fase 2).
- **Archivos:** `app/page.tsx` (nav + estado que ya existe: `daysPlayed`, reto resuelto, racha).
- **Skill:** ui-ux-pro-max (patrón de badge/notification dot) → frontend-design (que encaje con el DS).
- **Aceptación:** el dot de "Jugar" refleja el estado real del reto de hoy; la racha usa el dato
  existente (no inventar). Legible a 360px, no tapa el label. 🔶 *La racha persistente real
  depende de Santiago; usar el valor local/existente por ahora.*

### TAB-4 · (Opcional, más grande) Iconos cohesivos en vez de emoji genéricos
- **Qué:** 🌍🏆👤❓ son emojis del sistema (se ven distinto por dispositivo). Evaluar un set de
  iconos propio y consistente (SVG) con el lenguaje visual de Frontle. **Solo si TAB-1..3 ya
  están y hay tiempo** — es el más costoso y menos urgente.
- **Skill:** ui-ux-pro-max (entradas de iconos) → frontend-design (coherencia de set).
- **Aceptación:** set consistente en Android/iOS; mismo peso visual; no rompe el layout de 4 tabs.

---

## PARTE B — Gamificación de mecánicas

Priorizado desde `MECANICAS.md` §"Retención (gap #1)". Solo lo **ejecutable en frontend**;
lo backend va marcado 🔶.

### GAM-1 · Estrellas por precisión en la win card (⭐⭐⭐)
- **Qué:** al resolver, mostrar 1–3 estrellas según la matemática del semáforo que YA existe
  (⭐⭐⭐ ruta óptima · ⭐⭐ +1 país · ⭐ +2). Reveal animado: las estrellas caen/aparecen una
  a una con un pequeño delay (stagger), la tercera con destello prisma si es perfecta.
- **Por qué:** patrón Chesscito (`MECANICAS.md`), y el DESIGN-SYSTEM ya contempla "estrellas por precisión".
- **Archivos:** win card en `app/page.tsx` (y/o `ScoreCard.tsx`), `app/globals.css`.
- **Skill:** frontend-design (composición de la card) → review-animations (el stagger de estrellas).
- **Aceptación:** las estrellas salen del dato real de la ruta; el momento se siente
  gratificante sin ser largo (<1.2s); reduced-motion = estrellas fijas sin reveal. Ya usable
  en el modo diario y práctica.

### GAM-2 · Racha con celebración de hito
- **Qué:** la barra de racha (🔥) ya existe en el home. Añadir: (a) el número anima al subir
  (count-up), (b) **celebración de hito** al llegar a 3 y 7 días (destello prisma + Bordy
  felicitando en una burbuja corta). Nunca celebrar cada día — solo hitos.
- **Por qué:** streaks es el patrón #2 universal de la cohorte (`MECANICAS.md`).
- **Archivos:** strip de racha en `app/page.tsx`, `app/globals.css`, copy i18n (4 idiomas) en `app/lib/i18n.ts`.
- **Skill:** frontend-design → review-animations.
- **Aceptación:** el hito se dispara solo en 3/7; copy en es/en/pt/fr; reduced-motion respetado.
  🔶 *Persistencia real de la racha = Santiago; usar el valor existente.*

### GAM-3 · Logros en Perfil (grid de badges)
- **Qué:** una sección de **logros** en el tab Perfil: grid de badges desbloqueables —
  "Ruta óptima", "Sin pistas", "Conecta 2 continentes", "Racha de 7". Bloqueados en gris,
  desbloqueados a color; al desbloquear uno, micro-celebración.
- **Por qué:** `MECANICAS.md` §Retención #3 (logros + estrellas acumulables).
- **Archivos:** vista Perfil en `app/page.tsx` (o componente nuevo `Achievements.tsx`),
  `app/lib/` (lógica de qué está desbloqueado, desde datos locales existentes), i18n.
- **Skill:** ui-ux-pro-max (patrón de grid de logros) → frontend-design → review-animations.
- **Aceptación:** al menos 4 logros computables con datos que ya existen localmente; estado
  bloqueado/desbloqueado claro; a11y (no solo color). 🔶 *Sincronización cross-device = Santiago.*

### GAM-4 · Upgrade de la celebración de victoria
- **Qué:** el momento de ganar debe sentirse como un juego. Base: ya existe `claim-spark`
  (chispas). Extender a la victoria: partículas/confeti del gradiente prisma + el título
  "¡Ruta perfecta!" con `prism-text`, solo cuando es óptima. Reutilizar, no reinventar.
- **Por qué:** "cinemática en momentos clave" (`FRONTEND.md` patrón #7); es el uso legítimo del prisma.
- **Archivos:** win card en `app/page.tsx`, `app/globals.css` (extender keyframes existentes).
- **Skill:** frontend-design → review-animations (que el confeti no sea excesivo/genérico).
- **Aceptación:** solo dispara en ruta óptima; <1.5s; performante en móvil; reduced-motion =
  sin partículas, solo el título. No usa librería nueva si un keyframe CSS basta.

### GAM-5 · 🔶 (Bloqueado en backend — solo dejar el hook) Recompensa diaria por resolver
- **Qué:** puntos "Frontle" off-chain por resolver el reto aunque no ganes el pot
  (`MECANICAS.md` §Retención #2). **Requiere Santiago** (persistencia/Supabase). Fable solo
  deja el **componente visual** del "+N puntos" y el punto de integración, con dato mock,
  documentado para cuando el backend exista. No mergear como feature activa.

---

## PARTE C — Exploración (exprimir las skills)

> Estas tareas son **exploratorias**: generan **opciones para que David elija**, no van
> directo a producción. Son el mejor terreno para ver de qué son capaces las skills.
> Salida esperada: páginas/variantes comparables (patrón `docs/design/bordy-variants.html`),
> **nunca aplicar a `main` hasta que David escoja**.

> [!nota] Qué pueden y qué NO pueden las skills
> - **Paleta:** las skills son excelentes aquí (ui-ux-pro-max: 192 paletas, light/dark).
> - **Bordy en código (SVG/CSS):** SÍ pueden — construir y animar un Bordy vectorial.
> - **Bordy como arte raster nuevo (.webp):** NO pueden — generan código, no dibujan imágenes.
>   Eso requiere una herramienta de generación de imágenes (otro flujo, fuera de estas skills).

### EXP-1 · Iteración de paleta (2–3 direcciones)
- **Qué:** partiendo de la paleta actual ("Violeta Prisma": `#160833 / #6c2bd9 / #b79ced / #fcff52`),
  generar **2–3 direcciones alternativas o refinadas** que mantengan la identidad pero exploren:
  ej. una más saturada/arcade, una más sobria/premium, una con acento distinto al oro.
  Cada una como set de tokens (bg, surface, ink, acento, semáforo) en OKLCH.
- **Entregable:** una página de comparación (`docs/design/palette-variants.html`) con las 3
  direcciones aplicadas al mismo mock del home, lado a lado. NO tocar `globals.css` de prod.
- **Skill:** ui-ux-pro-max (elegir/combinar paletas) → frontend-design (que cada dirección
  tenga criterio, no sea aleatoria) → impeccable (verificar contraste AA de cada una).
- **Aceptación:** 3 direcciones distinguibles, cada una con contraste AA válido, presentadas
  para que David elija; la elegida se aplica en un PR aparte después.

### EXP-2 · Bordy en código (SVG/CSS animable)
- **Qué:** prototipar un **Bordy vectorial** (SVG) con **estados de expresión** que reaccionen
  al juego: idle, acierto (feliz), fallo (😵), racha (celebrando), pensando (pista). Aprovechar
  los mockups existentes `docs/design/bordy-3d*.html` como punto de partida.
- **Entregable:** `docs/design/bordy-svg-explore.html` con el Bordy vectorial y sus estados
  conmutables (botones para ver cada expresión). Comparar contra el `bordy-m2.webp` actual.
- **Skill:** frontend-design (personalidad del personaje) → review-animations (que las
  transiciones de expresión se sientan vivas, squash&stretch como el `bordy-talk` actual).
- **Aceptación:** ≥4 expresiones; animación entre estados fluida y con reduced-motion;
  David decide si reemplaza al raster o convive. 🔶 *Si David quiere arte raster nuevo en vez
  de SVG, es otro flujo (herramienta de imágenes) — no estas skills.*

### EXP-3 · Showcase de capacidades (aprendizaje)
- **Qué:** ejercicio para VER las skills divergir: tomar UN elemento (ej. la win card o un tab)
  y pedir a frontend-design **3 direcciones estéticas muy distintas** del mismo componente,
  usando el modo de iteración visual de impeccable (`live`) si el server está corriendo.
- **Entregable:** capturas/variantes comparadas + una nota corta de qué aportó cada skill.
- **Skill:** impeccable (`live` / variantes) + frontend-design.
- **Aceptación:** queda claro para David qué tan lejos pueden llevar un mismo componente;
  insumo para decidir cuánto empujar el rediseño.

---

## Orden sugerido de ejecución (de menor a mayor riesgo)

1. **TAB-1** (pop del tab activo) — pequeño, alto impacto sensorial.
2. **GAM-1** (estrellas por precisión) — dato ya existe, gran valor percibido.
3. **TAB-3** (badges/dots en tabs) — el gancho de "volver".
4. **GAM-2** (racha + hito) — retención.
5. **TAB-2** (transición de contenido) — pulido.
6. **GAM-4** (celebración de victoria) — el "wow".
7. **GAM-3** (logros en Perfil) — el más grande de gamificación.
8. **TAB-4** (iconos propios) y **GAM-5** (recompensa diaria) — opcionales / bloqueados.

Cada uno: branch propia desde `main` → tarea → `tsc` limpio → verificación visual → PR → merge.

> **La Parte C (exploración) va idealmente PRIMERO** para el que dependa de dirección visual:
> EXP-1 (paleta) y EXP-2 (Bordy) definen el rumbo antes de que GAM-4/celebraciones o TAB-1
> se codeen en firme. Son exploratorias (no PRs a `main`), así que pueden correr en paralelo
> sin bloquear las tareas A/B que no dependen de la paleta nueva.

---

*v1 — Opus, para ejecución de Fable. Fuente de verdad de mecánicas: `docs/benchmark/MECANICAS.md`.
Fuente de verdad de estética: `docs/design/DESIGN-SYSTEM.md`.*
