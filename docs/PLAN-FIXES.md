# PLAN — Correcciones (lote de feedback de David)

> Diagnóstico hecho con Opus; ejecución para Fable. Rama `feat/regiones-audio-practica`.
> Regla común por tarea: `npx tsc --noEmit` en 0 · `npm run i18n-lint` en verde ·
> verificar en el server (viewport 390) · **commit pequeño por ítem** · NO mergear a main.
> Prioriza por bloques: P0 (juego roto) → P1 (acceso) → P2 (UX) → P3 (i18n) → P4 (banderas) → P5 (infra).

---

## P0 — Correctness del juego (lo más grave)

### BUG-1 · Conectas origen y destino (todo verde y óptimo) pero el juego NO termina
**Síntoma real (corregido por David):** logró una ruta conexa origen→destino, **todos los países elegidos en verde y óptimos**, pero la victoria **no disparó**; solo terminó al rehacer la ruta "con los países de al lado" a los que había elegido.
**Diagnóstico (causa más probable): faltan aristas de frontera reales en el grafo de adyacencia.** La victoria (`connectsThroughKnown`, `game.ts:327`) exige un camino de fronteras que **exista en los datos**. Si dos países que en la realidad SÍ limitan no tienen la arista en nuestro grafo, la ruta del jugador "se ve conectada" pero el BFS no la recorre → no hay victoria; la ruta paralela (cuyas aristas sí existen) sí gana. Los países pueden salir verdes igual porque `countryQuality` mide sobre el **mismo grafo incompleto**.
- **Mundo** (`app/lib/countries.ts`): grafo de vecinos hecho a mano → propenso a fronteras faltantes.
- **Regiones** (`gen-region.mjs`): adyacencia derivada por geometría con umbral `SHARE = 2` puntos → **puede descartar fronteras muy cortas** (misma clase de bug).
**Fix:**
1. **Harness de reproducción:** un pequeño script/test que, dado `challenge` + la cadena del jugador, imprima los componentes conexos de `known` y qué arista falta para unir origen y destino. Sirve para confirmar el caso exacto (David puede recrearlo o pasar el reto).
2. **Auditar y completar la adyacencia:**
   - **Mundo:** derivar la adyacencia de países desde un GeoJSON mundial (Natural Earth countries) con la MISMA técnica de fronteras compartidas de `gen-region.mjs`; **diff** contra `COUNTRIES`; revisar candidatos (filtrar falsos positivos marítimos) y **añadir las fronteras terrestres reales que falten**.
   - **Regiones:** bajar/ajustar el umbral `SHARE` (o añadir un segundo criterio de "casi se tocan") en `gen-region.mjs` para no perder fronteras cortas; **regenerar** los 6 países y revisar que ninguna subdivisión quede peor conectada.
3. **Pista adaptativa (relacionado):** `nextHintCountry`/`nextRegionHint` hoy siguen una `shortestPath(start,end)` FIJA; si el jugador ya avanzó por otra ruta válida, la pista lo manda por la suya. Debe calcular la ruta más corta **desde el frontier conectado actual** del jugador hasta `end`.
4. Tests con un reto de **múltiples rutas óptimas**: al conectar por CUALQUIER ruta, `solved=true` en ese mismo intento.
**Verificación:** recrear el reto que falló (o uno equivalente con una frontera corta) y confirmar victoria al conectar. `game.ts` y `regionGame.ts` son espejos: arreglar y testear en `game.ts`, luego portar.
**Secundario (cosmético):** que salgan "3 verdes para óptima 2" es esperable cuando hay varias rutas óptimas (cada país está en una); no es el bug principal. Si molesta, se puede hacer el verde relativo al progreso, pero primero resolver la adyacencia.

---

## P1 — Acceso al juego

### FIX-2 · Jugar sin correo ni wallet — cualquiera con el link juega  🔴 (objetivo claro, implementar)
**Objetivo (David, sin ambigüedad):** **cualquier persona con el link puede jugar** el reto (mundo, regiones, práctica) **sin correo ni wallet**. La identidad (correo/wallet) **solo** es obligatoria para: **entrar al ranking** y **recibir premios** (y para comprar pistas/reintentos de pago). No es una decisión a confirmar — hay que implementarlo así.
**Dónde:** `app/page.tsx` ~línea 889 bloquea el juego cuando no hay `myId` (mezcla "jugar" con "estar registrado").
**Fix:**
- Quitar el gate de identidad del **flujo de juego**: sin `myId` se puede iniciar y jugar el reto normalmente (incluida la 1ª jugada gratis).
- Pedir identidad **solo** en el borde de: (a) al querer aparecer en el **ranking** (tras ganar → CTA "Conéctate para entrar al ranking y premios"), (b) comprar pistas/reintentos **de pago**, (c) reclamar premios.
- No romper el flujo on-chain existente (pagos/reclamos siguen requiriendo wallet, como ya es).
**Contexto:** ver si el gate lo introdujo alguien a propósito (`git blame` en esa zona) solo para no repetir la causa; pero el resultado deseado es guest play. (Santiago puede confirmarlo, no bloquea la implementación.)
**Verificación:** en incógnito sin wallet ni correo → jugar y ganar un reto completo; el CTA de ranking/premios aparece solo al final.

### CHECK-3 · Login por correo no funciona (wallet sí)  ·  **PENDIENTE — David revisará Privy luego**
**Síntoma:** el correo (Privy) no loguea; wallet sí.
**Estado:** en pausa hasta que David pueda revisar el dashboard de Privy. Cuando lo haga, chequear: (a) app caída / límites / dominio no autorizado, (b) `NEXT_PUBLIC_PRIVY_APP_ID` + allowed origins incluyen preview y producción, (c) errores de Privy en consola al intentar el login por correo. Es config/servicio, no código de juego. **No lo tome Fable por ahora.**

---

## P2 — UX

### UX-4 · Tarjetas de modo con desplegable (colapsadas por defecto)
**Síntoma:** el preview del mapa de Regiones ocupa mucho y se ve disruptivo; Reto diario y Regiones se comportan distinto.
**Fix (unificar el patrón, `app/page.tsx` paso `jugarStep === "modes"`):**
- **Reto diario:** click en la tarjeta → despliega el selector de **modo/dificultad** (hoy navega a otro paso; convertirlo en desplegable inline que se expande bajo la tarjeta).
- **Regiones:** click en la tarjeta → despliega el selector de país + preview del mapa (lo que hoy está siempre visible). Colapsado por defecto.
- Estado: un `expanded: "daily" | "regions" | null` para que solo una esté abierta a la vez.
**Verificación:** al entrar a Jugar, ambas tarjetas colapsadas; abrir una cierra la otra.

### UX-5 · Modo práctica: elegir dificultad + 3 pistas del reto diario
**Síntoma:** el modo práctica gusta pero falta elegir dificultad y tiene una sola pista.
**Fix (`app/components/PracticeGame.tsx`):**
- Añadir selector de dificultad (easy/medium/hard) reusando `randomChallenge(level)` (ya acepta nivel) y el `LevelSelect` del reto diario si aplica.
- Reemplazar la pista única por el **sistema de 3 pistas del reto diario** (ver UX-6): inicial del siguiente país · silueta del siguiente · siluetas de todos. Gratis en práctica.

### UX-6 · Pistas de Regiones = 3 botones como el reto diario
**Síntoma:** en Regiones hay una sola pista; David quiere los 3 botones para elegir cuál.
**Fix:** portar a `RegionGame.tsx` (y práctica, UX-5) el patrón de 3 pistas del mundial (en `page.tsx`: `hintInitial`, `hintSilhouetteNext`, `hintSilhouetteAll`). En Regiones/práctica son **gratis** (sin pago). Reusar `nextRegionHint`/`nextHintCountry` (ya adaptativo tras BUG-1) para la silueta del siguiente; "todas las siluetas" muestra `showAllOutlines`.
**Verificación:** 3 botones de pista, cada uno hace lo suyo, sin cobrar.

### UX-7 · Aprender: quitar burbujas de Bordy + botón "Jugar" con la estética del tab
**Síntoma:** las burbujas de texto de Bordy sobran (arriba ya está Bordy + botón de tutorial); el botón "Jugar" no combina con los demás del tab.
**Fix (`app/page.tsx`, bloque `tab === "aprender"`):** eliminar el `map` de `learnBubbles` (las burbujas). Dejar: héroe de Bordy + "Ver tutorial completo" + "Modo práctica" + "Jugar". Unificar el estilo del botón "Jugar" con las otras tarjetas/botones del tab (mismo `panel`/`btn` que "Modo práctica").

### UX-8 · Botón de soporte no hace nada · quitar botón X y moverlo a redes
**Síntoma:** el botón de soporte no responde; David quiere quitar el X de donde está y ponerlo junto a redes sociales.
**Dónde:** Perfil, fila de enlaces legales (`app/page.tsx`), usa `SUPPORT_MAILTO` y `SUPPORT_X_URL` (`app/lib/support.ts`).
**Fix:** (a) arreglar el enlace de soporte (que abra `mailto:` real; verificar `SUPPORT_MAILTO`); (b) quitar el botón "𝕏" de la fila legal y agruparlo en una sección de **redes sociales** (footer o Perfil) junto a otros enlaces sociales.

---

## P3 — i18n (regresiones nuevas)

### I18N-9 · "Conecta el mundo" y "racha" hardcodeados en español
**Dónde:** `app/page.tsx:723` (`Conecta el mundo`) y `:730` (`racha`). No los cazó `i18n-lint` porque no llevan acentos.
**Fix:** mover a `i18n.ts` (p.ej. `home.title`, `home.streak`) en los 4 idiomas y usar `tr.*`. **Además**, endurecer `i18n-lint.mjs`: marcar también texto JSX de ≥2 palabras separadas por espacio **sin** caracteres de código (`;={}()<>` etc.) aunque no tenga acentos, para cazar inglés/español hardcodeado. Ajustar la allowlist hasta que la corrida quede limpia.

### I18N-10 · Autofill muestra "Egypt" en español
**Causa:** en `PracticeGame.tsx:226` la sugerencia renderiza `{s}` (nombre canónico en inglés). `suggestLocalized` devuelve nombres canónicos, no localizados.
**Fix:** renderizar `countryName(s, locale)` en vez de `{s}` (y en `CFlag`/valor ya está por nombre canónico, ok). **Auditar** el mismo patrón en el mundial (`page.tsx` lista de sugerencias) y en `RegionGame` (ahí los nombres ya son locales, revisar).
**Verificación:** con la app en español, escribir "eg" en práctica → sugiere "Egipto".

### I18N-11 · Idioma por región (geo), no por navegador
**Síntoma:** David quiere que el idioma se elija según la **región del usuario**, no el default del navegador.
**Fix (`app/lib/i18n.ts` `detectLocale`):** añadir un paso de geo antes del navegador: usar el país ya disponible (`getIpCountry()` en `ranking.ts`, que la app ya llama) → mapear país→idioma (CO/AR/…→es, BR→pt, países francófonos→fr, resto→en). Orden: **preferencia manual guardada → geo país → navegador → en**. Como el geo es async, aplicar: arrancar con navegador/en y, cuando llegue el país, si el usuario no eligió idioma manual, actualizar el locale.
**Verificación:** simular país BR → app en portugués sin tocar el navegador.

### I18N-12 · Desplegable de idioma del header ilegible (blanco sobre blanco)
**Causa:** el `<select>` compacto usa `bg-white/5`; el popup de opciones queda con fondo claro y texto blanco.
**Fix (`LanguageSelect` en `page.tsx`):** dar al `<select>` y a los `<option>` colores explícitos legibles: fondo oscuro (`bg-[#1c0b3e]`) y texto claro; en `<option>` setear `style={{ background:'#1c0b3e', color:'#fff' }}` (los `option` no toman clases cross-browser). Verificar en móvil (el picker nativo usa el color del value).

---

## P4 — Banderas

### FLAGS-13 · Auditar y arreglar banderas de las regiones (Nigeria/Ghana se ven mal)
**Diagnóstico (cobertura actual):** co 32/32 · us 48/48 · br 26/27 · ar 22/23 · **ng 14/37** · **gh 4/16**. Nigeria y Ghana tienen la mayoría de subdivisiones **sin bandera en Wikidata** → caen al marcador de 2 letras → se ve inconsistente/roto.
**Fix (elige por región):**
1. **Mejorar el marcador de respaldo** (`EntityFlag` en `RegionGame`/`RegionMapPreview`): que se vea intencional y consistente (badge con el código o iniciales, mismo tamaño/estilo que una bandera).
2. Para regiones con **baja cobertura** (ng, gh): considerar **todo-marcador** (no mezclar banderas sueltas con marcadores) para que no parezca a medio cargar, **o** buscar banderas alternativas (muchos estados de Nigeria/regiones de Ghana no tienen bandera oficial — puede que simplemente no existan).
3. Script de auditoría `check-flags.mjs`: por región, listar entidades sin PNG y PNGs sospechosos (<600 bytes → verificar que no estén rotos; los tricolores simples pesan poco legítimamente).
**Verificación:** ng y gh se ven coherentes (o todas banderas, o todos marcadores limpios).

---

## P5 — Rutas / móvil / infra

### CHECK-14 · En móvil no cargan Términos / Privacidad / Estadísticas
**Hipótesis principal:** es la **protección del preview de Vercel** — en móvil esas rutas piden acceso a Vercel y "no cargan". Se resolvería al **mergear a main** (INFRA-16) o desactivar la protección. **Verificar primero** si es eso antes de tocar código.
**Si no es Vercel:** reproducir en viewport 390 sobre el server local (`/terms`, `/privacy`, `/stats`) y revisar consola/network. Nota: `/terms` y `/privacy` pasaron a componente cliente (F6e) — confirmar que hidratan bien en móvil; `/stats` hace fetches (contrato/Supabase/Blockscout) — ver si alguno falla en móvil.

### INFRA-16 · Mergear a main para poder probar en MiniPay  ·  **David**
No se puede probar la rama en MiniPay (pide acceso a Vercel). Requiere el merge de PR #9 tras la revisión (`docs/REVIEW-MERGE.md`). **Se deja para después** por decisión de David, pero es el desbloqueador de las pruebas reales en MiniPay y de CHECK-14.

---

## Resumen de dueños
- **Fable:** BUG-1, FIX-2 (implementar guest play), UX-4..8, I18N-9..12, FLAGS-13 (marcador limpio), CHECK-14 (repro).
- **David (pendiente):** CHECK-3 (Privy — en pausa), INFRA-16 (merge), decisión FLAGS-13 (¿buscar banderas alternativas para ng/gh?).
- **Santiago:** solo si FLAGS/adyacencia mundial requiere apoyo; opcional confirmar origen del gate de FIX-2.

## Orden sugerido para Fable
1. **BUG-1** (juego roto — repro + auditar adyacencia).
2. **FIX-2** (jugar sin registro — clave para adopción/listing).
3. **I18N-9..12** (rápidas, quitan bugs de idioma visibles).
4. **UX-4..8** (modos con desplegable, práctica con dificultad + 3 pistas, Aprender, soporte).
5. **FLAGS-13** (marcador limpio) · **CHECK-14** (repro móvil).

> CHECK-3 (Privy) queda fuera del alcance de Fable hasta que David lo revise.
