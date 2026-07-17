# PLAN — Paleta (EXP-1) + Bordy en SVG (EXP-2)

> Continuación de la Parte C de [[PLAN-TABS-GAMIFICACION]] (exploración, no producción).
> Diseñado con Opus para **ejecución de Fable**. Aterrizado en `docs/design/DESIGN-SYSTEM.md`
> y en lo ya explorado en `docs/design/palette-variants.html` y `docs/design/bordy-3d*.html`.

---

## ⚠️ Modelo a usar: **Opus**, no Sonnet ni Haiku

Este plan es **trabajo de juicio estético**, no ejecución mecánica de una spec. La tanda de
gamificación (`PLAN-TABS-GAMIFICACION.md`, Partes A/B) tenía criterios de aceptación objetivos
("estrellas según la matemática que ya existe", "reduced-motion en cada animación nueva") — ideal
para un modelo más barato/rápido, y salió muy bien así.

**Esto es distinto:** elegir una identidad de marca (paleta) y diseñar la personalidad visual de
un personaje (Bordy) son decisiones **subjetivas, difíciles de revertir baratas** (quedan en
capturas del listing de MiniPay, en la memoria de marca de los usuarios) y que se benefician de
más profundidad de razonamiento — la propia skill `frontend-design` pide explícitamente un ciclo
de **brainstorm → explorar → planear → criticarse → construir → criticarse de nuevo** antes de
escribir código. Un modelo más capaz autocritica mejor y evita el "look genérico de IA" con más
consistencia. Por eso: **Opus para ambas tareas de este plan.**

(`ui-ux-pro-max` es solo una base de datos de consulta — el valor está en la síntesis y el
criterio que se le aplica encima, que es justo donde el modelo importa.)

---

## EXP-1 · Refinar y cerrar la decisión de paleta

### Contexto
`docs/design/palette-variants.html` ya tiene 3 direcciones (A-Arcade Neón, B-Violeta Premium,
C-Acento Coral) comparadas contra la actual "Violeta Prisma". **David aún no eligió.** Desde que
se construyó ese mockup, se shippeó gamificación nueva (logros, confeti, chip de puntos, hitos de
racha) que el mockup original **no contempla** — hay que corregir eso antes de que David decida
con información completa.

### Tarea
1. Leer `docs/design/palette-variants.html` (los 4 "teléfonos" existentes) y `docs/design/DESIGN-SYSTEM.md`.
2. **Actualizar el mockup** (mismo archivo, no crear uno nuevo) agregando a cada una de las 4
   columnas (actual + A/B/C) una vista del **perfil con logros** (grid de `Achievements.tsx`,
   candado en no-desbloqueados) y de la **win card con confeti** (solo en la columna que muestre
   ruta óptima) — los dos componentes nuevos más visibles de la gamificación.
3. Usar `frontend-design` para el ciclo de crítica: ¿alguna dirección se rompe con los colores
   semánticos nuevos (dorado de logro `#fcff52`, verde del semáforo, prisma del confeti)? Si el
   acento de una dirección choca con esos colores funcionales, decirlo explícitamente en el mockup
   (no ocultarlo — es información que David necesita para decidir).
4. Usar `ui-ux-pro-max` (`--domain color`) si hace falta una 4ª dirección adicional, pero **no
   agregar más de 1** — ya hay 3, más satura la decisión sin agregar valor.
5. Correr `impeccable audit` sobre el HTML actualizado (contraste AA de cada dirección con los
   componentes nuevos incluidos).

### Entregable
`docs/design/palette-variants.html` actualizado, **sin tocar `globals.css` de producción**.
Reporte corto (en el PR) de cuál dirección recomienda Fable y por qué, pero **la decisión final
es de David** — no aplicar ninguna a producción en este PR.

### Aceptación
- Las 4 columnas incluyen ahora logros + confeti.
- Contraste AA verificado en las 4 (no solo la actual).
- PR de **solo el HTML de exploración**, no toca código de la app.

---

## EXP-2 · Bordy en SVG animable

### Contexto
Bordy hoy es un raster (`frontend/public/bordy-m2.webp`), usado en 4 lugares del código
(incluyendo el nuevo `milestone-toast` de GAM-2, que no existía cuando se escribió el plan
original). Ya existen exploraciones en `docs/design/bordy-3d*.html` y `bordy-variants.html`.

### Tarea
1. Leer los 4 mockups existentes de Bordy (`docs/design/bordy-*.html`) — no arrancar de cero.
2. Diseñar Bordy como **SVG vectorial** con estados de expresión, ahora con un caso de uso extra
   respecto al plan original:
   - **idle** (el `bordy-float` de siempre)
   - **acierto** (feliz — semáforo verde)
   - **fallo** (😵 — desvío grande/rojo)
   - **racha/hito** (celebrando — este es el que aparece en el `milestone-toast` nuevo de GAM-2,
     revisar `app/globals.css` `.milestone-toast` y su uso en `page.tsx` para el contexto exacto)
   - **pensando** (al comprar una pista)
3. Usar `frontend-design` para la personalidad del personaje (que no sea un mascota-IA genérica:
   ver el criterio de "signature element" de la skill) y `review-animations` para que las
   transiciones entre expresiones se sientan vivas — el `bordy-talk` actual (squash & stretch) es
   la vara a igualar o superar.
4. Construir en `docs/design/bordy-svg-explore.html`: el SVG con botones para conmutar entre las
   5 expresiones, comparado lado a lado con el `bordy-m2.webp` actual.

### Entregable
`docs/design/bordy-svg-explore.html`. **No reemplazar `bordy-m2.webp` en el código de producción**
— es exploración para que David decida si conviven o si el SVG reemplaza al raster.

### Aceptación
- 5 expresiones (no menos), cada una justificada por un caso de uso real del código (no inventado).
- Transición entre estados fluida, con alternativa `reduced-motion`.
- Si David quiere arte raster nuevo en vez de SVG, eso es **otro flujo** (herramienta de
  generación de imágenes) — este plan no lo cubre, decirlo así si se pregunta.

---

## Orden y entrega

1. EXP-1 primero (más rápido, desbloquea la decisión de paleta que ya lleva tiempo pendiente).
2. EXP-2 después.
3. Cada uno en su propio PR — **exploración, no se mergea a producción sin que David elija**.
4. Al terminar ambos, avisar a David con las rutas de los 2 archivos para que decida (igual que
   se hizo la primera vez con `palette-variants.html`).

---

*v1 — Opus, para ejecución de Fable. Continúa [[PLAN-TABS-GAMIFICACION]].*
