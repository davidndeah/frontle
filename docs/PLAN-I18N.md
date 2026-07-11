# PLAN — Internacionalización total (cero hardcodeado) + traducción rápida

> Auditoría completa del repo (hecha con Opus) + tareas Fable para dejar **ningún
> texto de UI hardcodeado**, un **guard anti-regresión**, y una **receta para
> traducir a idiomas nuevos rápido**. Ids de tarea continúan los de PLAN-LISTING.

---

## Dato clave que abarata todo

`STRINGS` es `Record<Locale, Dict>`. **TypeScript ya obliga** a que cada idioma
tenga TODAS las claves del `Dict`: si a un idioma nuevo le falta una, **es error
de compilación** (`tsc`). Es decir: **añadir un idioma no puede quedar incompleto
sin que `tsc` lo cante.** El riesgo real no es "falta una clave" (lo caza tsc),
sino: (a) texto que nunca pasó por `i18n` (hardcodeado), y (b) una clave dejada
en el idioma equivocado. La Parte 3 (guard) ataca (a) y (b).

---

## PARTE 1 — Inventario de la auditoría

### 🔴 Hardcodeado en español (romper para usuarios no-ES) — HAY QUE ARREGLAR

| # | Archivo | Qué | Fix |
|---|---------|-----|-----|
| A | `app/components/RegionGame.tsx` | **Toda la pantalla** (~18 líneas): mensajes de intento (`ya está en el mapa`, `no limita con ningún…`), `Reto del día`, `Ruta óptima…`, `El cronómetro arranca al pulsar Jugar`, `Pista (gratis)`, `Escribe un {noun}…`, `¡Ruta perfecta!`, `¡Lo lograste!`, `Conectaste con…`, `Tiempo:`, `¡Copiado!`, `Compartir resultado`, `Elegir otro modo`, `Modo … gratis · vuelve mañana` | Recibir `locale`, usar `tr.*`. **Reusar** las claves que ya usa `PracticeGame` (`tr.feedback`, `tr.winPerfect/winNormal/winText`, `tr.placeholder`, `tr.share`, `tr.copied`) + añadir 5 claves `region.*` nuevas |
| B | `app/page.tsx` selector de modos (líneas ~752–801) | `Reto diario`, `3 niveles · premio real del pot`, `Regiones`, `conecta departamentos y estados · gratis`, `nuevo`, `▶ Jugar {title}`, `más países muy pronto…`, `Más modos`, `práctica, duelos y más…`, `aria-label="País"` | Mover a `i18n` (`modes.*`), usar `tr.*` |
| C | `app/page.tsx` prompt de nombre (~1466) | `¡Elige tu nombre!`, `Así apareces en el ranking (en vez de tu wallet).` | `i18n` (`name.*`) |
| D | `app/page.tsx` aria-labels de audio (~685) | `Silenciar música`/`Activar música`/`Silenciar efectos`/`Activar efectos` | `i18n` (`a11y.*`) |
| E | `app/lib/regions/*.ts` **`entityNoun`** | **Mezcla de idiomas**: Colombia `departamentos`, USA `states`, Argentina `provincias`, Brasil `estados`, Ghana `regiones`, **Nigeria `estados`** (¡bug! un nigeriano en inglés ve "estados") | Cambiar a `nounKey` tipado + mapa i18n `subdivisionNoun` (ver Parte 2 · F6c) |
| F | `app/layout.tsx` | `<html lang="es">` **fijo** | Debe reflejar el idioma real (o al menos `"en"`, el default global) |

### 🟠 Páginas legales — decisión de David

| Archivo | Estado | Nota |
|---------|--------|------|
| `app/terms/page.tsx` | **Solo español**, texto estático | MiniPay exige ToS/Privacy; sus mercados son mayormente inglés. Mínimo: versión inglés. Ideal: localizar |
| `app/privacy/page.tsx` | **Solo español** (0 uso de `locale`) | idem |

### 🟢 Ya localizado (sin acción)
`PracticeGame.tsx` ✅ · `StatsView.tsx` ✅ (49 usos de `tr`) · `BordyTutorial.tsx` ✅ · `Coachmarks.tsx` ✅ · `PrivyLogin.tsx` ✅ · `PrivyGate.tsx` ✅ · `RegionMap/RegionMapPreview/WorldMap` ✅ (reciben `loadingLabel` como prop).

### ⚪ Polish opcional
- Títulos de región mezclados (`"Brasil"`, `"United States"`). Se pueden localizar con `countryName(iso, locale)` → "Brazil/Brasil/Brésil". Bajo impacto; dejar para después.

---

## PARTE 2 — Tareas Fable para llegar a CERO hardcodeado

> Todas parten de `feat/regiones-audio-practica`. Cada una: `tsc --noEmit` en 0 + verificación en el server + commit pequeño. Pásalas de a una.

### F6a — Localizar `RegionGame.tsx`
1. Cambiar la firma a `RegionGame({ regionId, locale, onExit })`; en `page.tsx` pasar `locale={locale}`.
2. `const tr = t(locale)` dentro del componente.
3. Reemplazar cada string hardcodeado por `tr.*`:
   - Mensajes de intento → `tr.feedback(res.reason, {…})` (igual que `PracticeGame.tsx`).
   - Victoria → `tr.winPerfect`/`tr.winNormal`/`tr.winText` + `tr.share`/`tr.copied`.
   - Nuevas claves `region.challengeOfDay`, `region.timerStarts`, `region.freeHint`, `region.chooseOtherMode`, `region.modeFooter(title)` y `region.placeholder(noun)`.
4. **Verificación:** jugar Nigeria con la app en inglés → todo el marco en inglés.

### F6b — Localizar el selector de modos de `page.tsx`
1. Añadir claves `modes.dailyTitle`, `modes.dailySub`, `modes.regionsTitle`, `modes.regionsSub`, `modes.new`, `modes.play(title)`, `modes.moreCountries`, `modes.moreModesTitle`, `modes.moreModesSub` al `Dict` + 4 idiomas.
2. Reemplazar los literales por `tr.modes.*`. `aria-label="País"` → `tr.a11y.country`.

### F6c — `entityNoun` → `nounKey` tipado + i18n  (arregla el bug de Nigeria)
1. `types.ts`: reemplazar `entityNoun: string` por `nounKey: "department" | "state" | "province" | "region"`.
2. Cada región: Colombia→`department`, USA→`state`, Argentina→`province`, Brasil→`state`, Ghana→`region`, **Nigeria→`state`**.
3. `i18n`: `subdivisionNoun: Record<NounKey, { one: string; many: string }>` en las 4 locales (singular + plural, porque el placeholder usa el singular):
   - department: es{departamento/departamentos} en{department/departments} pt{departamento/departamentos} fr{département/départements}
   - state: es{estado/estados} en{state/states} pt{estado/estados} fr{état/états}
   - province: es{provincia/provincias} en{province/provinces} pt{província/províncias} fr{province/provinces}
   - region: es{región/regiones} en{region/regions} pt{região/regiões} fr{région/régions}
4. `RegionGame` usa `tr.subdivisionNoun[def.nounKey].one/.many` (adiós al hack `.replace(/s$/,"")`).
5. **`gen-region.mjs`**: en `CONFIG` cambiar `entityNoun` por `nounKey` y emitir `nounKey` en el `.ts` (para que los próximos países salgan correctos).
6. **Verificación:** Nigeria en inglés dice "states", en español "estados", en portugués "estados", en francés "états".

### F6d — `layout.tsx` `lang` dinámico
- Como el idioma se resuelve en cliente, poner `lang="en"` (default global) fijo, **o** mejor: un pequeño componente cliente que setee `document.documentElement.lang` al detectar/cambiar locale. MVP: `lang="en"`.

### F6e — Páginas legales (gated por decisión de David)
- Opción mínima: traducir `terms`/`privacy` a **inglés** (default) y enlazar. Opción completa: localizarlas a los 4 idiomas con un bloque `legal.*`. **Requiere decisión** (esfuerzo/mantenimiento).

---

## PARTE 3 — Guard anti-regresión (para "asegurar que no habrá errores de idioma")

Crear `frontend/i18n-lint.mjs` + script `npm run i18n-lint`:
1. **Hardcoded scan (heurística):** recorrer `app/**/*.tsx`, marcar texto JSX (`>Texto<`) y props visibles (`placeholder=`, `aria-label=`, `alt=` con contenido) que contengan letras y **no** vengan de `tr`/`{`… Excluir comentarios y una allowlist (marcas: "Frontle", "OK", símbolos).
2. **Idioma cruzado (heurística):** para claves string, si `en[k] === es[k]` y tiene ≥4 letras y no está en allowlist → warning "posible sin traducir".
3. Correr en pre-commit/CI. (La **paridad de claves** ya la garantiza `tsc` por `Record<Locale, Dict>`.)

Esto convierte "no dejes nada hardcodeado" en algo **verificable automáticamente**, no confiado a revisión manual.

---

## PARTE 4 — Receta para traducir a idiomas nuevos (rápido)

**Escala del trabajo:** 1 idioma = **~180 líneas / ~90 claves** (un bloque en `i18n.ts`). Los **nombres de país salen gratis** vía `Intl.DisplayNames` (soporta sw/id/fil/hi sin trabajo).

**Método rápido (1 pasada, no string por string):**
1. Añadir el código a `LOCALES` y `LOCALE_LABELS` (nombre nativo).
2. Pedir al modelo: *"traduce el bloque `en: {…}` completo al <idioma>, preservando claves, placeholders `${…}`, arrays y emojis; devuelve el bloque `xx: {…}` listo para pegar"*. Una sola generación produce las ~90 claves.
3. Pegar el bloque; `tsc --noEmit` **confirma que no falta ninguna clave** (si falta, error).
4. `npm run i18n-lint` para cazar claves que quedaron en inglés.
5. Spot-check visual: cambiar el idioma en la app y recorrer 2–3 pantallas.
6. Commit del idioma.

**Prioridad de idiomas (del análisis de mercados MiniPay con celopedia):**

| Pri | Idioma | Código | Por qué |
|-----|--------|--------|---------|
| 1 | Suajili | `sw` | Kenia/Tanzania/Uganda = mercado top MiniPay; KESm; ~100M |
| 2 | Indonesio | `id` | Celo nombró embajador regional de Indonesia; mercado gigante |
| 3 | Filipino/Tagalog | `fil` | Filipinas mercado primario (remesas, PHPm) |
| 4 | Hindi | `hi` | India aparece en el geo-targeting del catálogo MiniPay |

> Los 4 idiomas actuales (es/en/fr/pt) ya cubren **lingüísticamente** todos los mercados
> primarios (África anglófona y Filipinas usan inglés). Añadir sw/id es **crecimiento**,
> no un bloqueo de listing. **Prioridad real: primero F6a–F6d** (dejar de mostrar
> español a los mercados que YA servimos), luego idiomas nuevos.

---

## Secuencia recomendada
```
1) F6a RegionGame  ─┐
2) F6b modos        ├─ cero hardcodeado en lo que ya enviamos (URGENTE, es el bug del reviewer)
3) F6c nounKey (NG) │
4) F6d layout lang ─┘
5) i18n-lint (guard)      ← evita que vuelva a pasar
6) F6e legales (decisión de David)
7) idiomas nuevos: sw, id (receta Parte 4)
```
