# PLAN — Correcciones (lote de feedback de David)

> Diagnóstico hecho con Opus; ejecución para Fable. Rama `feat/regiones-audio-practica`.
> Regla común por tarea: `npx tsc --noEmit` en 0 · `npm run i18n-lint` en verde ·
> verificar en el server (viewport 390) · **commit pequeño por ítem** · NO mergear a main.
> Prioriza por bloques: P0 (juego roto) → P1 (acceso) → P2 (UX) → P3 (i18n) → P4 (banderas) → P5 (infra).

---

## P0 — Correctness del juego (lo más grave)

### BUG-1 · Se marcan verdes de más y la victoria no dispara aunque "conectes"
**Síntoma:** (a) óptima = 2 pero salen 3 en verde; (b) conectas los dos objetivos, todo verde, pero el juego no termina y la pista te manda por otra ruta más larga.
**Causa raíz (los dos son el mismo bug):** `countryQuality(c, start, end)` en `app/lib/game.ts:284` marca verde si `d(start,c)+d(c,end) ≤ d(start,end)`, es decir si `c` está sobre **alguna** ruta óptima **global** desde el origen. Eso **no mira la conexión real del jugador**. Por eso:
- Con varias rutas óptimas puedes juntar más verdes que el óptimo (cada uno "bueno" por separado).
- Esos verdes **no son adyacentes entre sí** → no hay camino real de fronteras → `connectsThroughKnown` (que sí exige camino real, `game.ts:327`) devuelve false → no hay victoria, y la pista (`nextHintCountry`, ruta fija) te reencamina.
**La victoria en sí es correcta** y ya acepta **cualquier** ruta (incluidas varias óptimas) — el problema es que el semáforo engaña sobre la conectividad.
**Fix (world + regions; `game.ts` y `regionGame.ts` son espejos):**
1. Cambiar la semántica de verde a **relativa al progreso conectado**, no al origen abstracto:
   - Antes de la jugada, calcular el componente conexo de `start` dentro de `known` (BFS por known) y también el de `end`. La "brecha" = distancia mínima (por países desconocidos) entre ambos componentes.
   - Un intento válido es **verde** si **reduce esa brecha** (acerca de verdad los dos componentes / los une). **Amarillo** si es válido pero no reduce la brecha (lateral). **Rojo** si aumenta el desvío.
   - Así, cuando los verdes cierran la brecha, `connectsThroughKnown` da victoria en el mismo intento — el verde y la victoria quedan alineados.
2. **Pista adaptativa:** `nextHintCountry` debe calcular la ruta más corta **desde el frontier conectado actual del jugador** hasta `end` (por países desconocidos) y sugerir el siguiente de **esa** ruta — no una `shortestPath(start,end)` fija. Igual en `nextRegionHint`.
3. Tests: añadir casos en un reto con **múltiples rutas óptimas** y confirmar: (i) nunca hay más verdes que pasos usados en una ruta conexa; (ii) al conectar por cualquier ruta, `solved=true`; (iii) la pista apunta al siguiente país que realmente cierra la brecha.
**Verificación:** reproducir el caso de la imagen (Colombia, óptima 2) y un reto mundial donde start/end estén a distancia ≥3; jugar una ruta conexa y confirmar victoria inmediata.
**Nota:** es un cambio de mecánica delicado — hacer primero la función de calidad relativa con tests unitarios en `game.ts`, luego portar a `regionGame.ts`.

---

## P1 — Acceso al juego

### FIX-2 · Permitir jugar sin wallet/correo (registro solo para ranking y premios)
**Síntoma:** hoy no se puede jugar sin conectar wallet o correo.
**Dónde:** `app/page.tsx` ~línea 889 (`hasWallet || privyActive ? … : …`) bloquea el juego cuando no hay `myId`. El gate mezcla "jugar" con "estar registrado".
**Fix:** separar ambos conceptos. Cualquiera puede **jugar el reto** (world, regiones, práctica) sin identidad. La identidad (wallet/correo) se pide **solo** al: (a) enviar marca al ranking, (b) comprar pistas/reintentos de pago, (c) reclamar premios. Mostrar un CTA suave "Conéctate para entrar al ranking y premios" tras ganar, no antes de jugar.
**Investigar antes:** confirmar con David/Santiago si el gate fue intencional (¿Santiago?) — `git log --oneline -- app/page.tsx | head` y `git blame` sobre esa zona. No romper el flujo de pago on-chain.
**Verificación:** en incógnito sin wallet, jugar y ganar un reto; el ranking pide identidad solo al final.

### CHECK-3 · Login por correo no funciona (wallet sí)  ·  **necesita David/Santiago**
**Síntoma:** el correo (Privy) no loguea; wallet sí.
**Acción:** revisar el estado del servicio de Privy: (a) dashboard de Privy (¿app caída / límites / dominio no autorizado?), (b) que el `NEXT_PUBLIC_PRIVY_APP_ID` y los allowed origins incluyan la URL del preview y producción, (c) consola del navegador al intentar el login por correo (errores de Privy). No es código de juego; es config/servicio. Documentar hallazgo antes de tocar nada.

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
- **Fable:** BUG-1, FIX-2 (tras confirmar), UX-4..8, I18N-9..12, FLAGS-13, CHECK-14 (repro).
- **David:** CHECK-3 (Privy), INFRA-16 (merge), decisión de FLAGS-13 (todo-marcador vs buscar banderas).
- **Santiago:** confirmar si FIX-2 (gate sin-wallet) fue suyo; apoyo en CHECK-3 si es config.

## Orden sugerido
1. **BUG-1** (juego roto, lo más visible y dañino).
2. **FIX-2** (que cualquiera pueda jugar — clave para adopción/listing).
3. **I18N-9..12** (rápidas, quitan bugs de idioma visibles).
4. **UX-4..8** (pulido de modos y práctica).
5. **FLAGS-13**, **CHECK-14/3** (según decisión de David).
