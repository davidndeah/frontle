# 🤝 Handoff — Skills de Claude Code + estado del frontend (para el agente de Claude de Santiago)

> **Cómo usar este archivo:** pégalo (o su ruta) como contexto en tu sesión de Claude Code,
> dentro del repo `frontle`. No es una tarea para ti a menos que David te lo pida — es para que
> tengas visibilidad de qué skills está usando el frontend y en qué quedó, por si tu trabajo de
> backend/contrato cruza con estas piezas (ej. datos que alimentan la win card o el ranking).

---

## 🎯 Qué es esto

David (con Opus) auditó y está iterando el **frontend visual** de Frontle con un set de skills
de Claude Code (paquetes de expertise instalables). Este doc lista **qué instalar** si tu agente
va a tocar UI/diseño, y **en qué quedó** el trabajo — para no duplicar ni pisar nada.

---

## 🧩 Skills a instalar (si vas a tocar frontend/diseño)

Todas se instalan **en tu propia terminal** (no dentro de una sesión de Claude Desktop — si lo
corres ahí queda en el contenedor virtual de la app, no en tu sistema real):

```bash
# Buscador de skills (para descubrir más si hace falta)
npx skills add https://github.com/vercel-labs/skills --skill find-skills -g -a claude-code

# Diseño / UI
npx skills add pbakaus/impeccable -g -y                    # auditoría 100+ reglas + construir/refinar UI
npx skills add anthropics/skills --skill frontend-design -g -y   # dirección estética, evita "look de IA"
npx skills add nextlevelbuilder/ui-ux-pro-max-skill -g -y  # base de datos: paletas, estilos, motion presets

# Animación
npx skills add emilkowalski/skills --skill review-animations -g -y  # crítica de motion (no la escribe, la pule)

# Seguridad (útil dado que hay dinero real en contratos/pagos)
npx skills add trailofbits/skills -g -y   # Semgrep: análisis estático

# Frenos de seguridad al codear (opcional pero recomendada)
npx skills add obra/superpowers -g -y
```

**Flujo de trabajo con estas skills** (así se usaron en esta ronda):
`frontend-design` (decide dirección) → codear → `review-animations` (pule el motion) →
`impeccable` (audita: contraste, a11y, targets táctiles) → PR.

---

## ✅ Lo que YA está hecho y mergeado a `main`

**Auditoría de la home con `impeccable`** — 3 PRs, los 4 hallazgos cerrados:

| PR | Qué resolvió |
|---|---|
| [#41](https://github.com/davidndeah/frontle/pull/41) | Header consolidado: mute+idioma sueltos (32px, bajo el mínimo táctil) → un solo ⚙️ que abre sheet con idioma+música+efectos. `prefers-reduced-motion` respetado en Bordy/halo/pop-in. |
| [#42](https://github.com/davidndeah/frontle/pull/42) | Limpieza de CSS muerto (`.prism-glow`/`.prism-core`, 0 usos reales — no era un problema de performance real, era código huérfano). |
| [#43](https://github.com/davidndeah/frontle/pull/43) | Contraste WCAG: `neutral-500` (~3.8:1, falla AA) → `neutral-400` (~7:1) en footer y monto de premio no-ganador. |

---

## 🔨 Lo que FALTA — pendiente de decisión de David (no tocar sin su ok)

### 1. Plan de tabs + gamificación (para Fable, no para ti)
**`docs/PLAN-TABS-GAMIFICACION.md`** — creado, **sin commitear todavía**. Cubre:
- **Tabs con vida:** pop del tab activo al tocar, transición fluida entre tabs, badges/dots
  (punto en "Jugar" si el reto no está resuelto, 🔥racha en Perfil).
- **Gamificación:** estrellas por precisión (⭐⭐⭐) en la win card, racha con celebración de
  hito (día 3/7), grid de logros en Perfil, upgrade de la celebración de victoria (confeti prisma).
- Cada tarea tiene ID (`TAB-1`, `GAM-1`, etc.), qué skill usar, y criterio de aceptación.
- **Marcado con 🔶 lo que es tuyo:** persistencia real de racha/puntos (Supabase) — el frontend
  solo deja el hook visual con datos locales/mock hasta que exista el backend real.

### 2. Exploración de paleta (EXP-1) — 3 direcciones, David debe elegir
**`docs/design/palette-variants.html`** — creado, **sin commitear**. Generado con `ui-ux-pro-max`:

| Dirección | Vibe | bg | acento |
|---|---|---|---|
| A · Arcade Neón | más saturado, más energía | `#16003a` | `#ffe74a` + magenta `#ff3db4` |
| B · Violeta Premium | sobrio, refinado | `#0d0820` | champagne `#d9b45a` |
| C · Acento Coral | cálido, sin oro | `#14092e` | coral `#ff6a3d` |

Ábrelo en un navegador para comparar los 4 (incluida la actual "Violeta Prisma") lado a lado.
**No apliques ninguna a `globals.css` hasta que David elija** — es exploración, no producción.

### 3. Bordy en SVG animable (EXP-2) — aún no ejecutado
Prototipar un Bordy vectorial con expresiones (idle/acierto/fallo/racha/pensando), partiendo de
`docs/design/bordy-3d*.html`. Las skills pueden generar **código SVG/CSS**, no arte raster nuevo
(un `.webp` nuevo requiere otra herramienta, fuera de este flujo).

---

## 📚 Fuentes de verdad

- `docs/design/DESIGN-SYSTEM.md` — tokens, arquitectura de navegación, reglas de copy.
- `docs/PLAN-TABS-GAMIFICACION.md` — el plan completo de tabs/gamificación (para Fable).
- `docs/benchmark/{MECANICAS,FRONTEND}.md` — de dónde salen las ideas de gamificación (benchmark top 10 Proof of Ship).
- Gate real de CI: `npx tsc --noEmit` (no `npm run lint`, que ya falla en `main` por errores preexistentes).
