# PLAN — Flag Rush (seguridad primero)

> **Qué es:** un modo rotativo de 10 banderas con 4 opciones y 10 s cada una, una partida por
> ventana de 8 horas (00, 08 y 16 UTC). Reemplaza a "Adivina la bandera". XP con tope (los 2
> mejores intentos del día, hasta 12 XP), sin ranking ni premio propio.
>
> **Orden:** primero se cerraron las vulnerabilidades que Flag Rush heredaría del modo Bandera y
> de la función `game`, después se construyó el modo encima. Todo en `dev`; nada a producción.
>
> **Estado (2026-11-18):** construido en tres PRs hacia `dev`, en verde y sin mergear:
> #86 (servidor), #87 (pantalla y ficha en Modos) y #88 (escena de entrada en 3D). Falta
> revisar, mergear y desplegar: ver la sección 6. El plan original es del 2026-11-11; lo que
> cambió desde entonces está marcado como **(actualizado)**.

---

## 1. Auditoría: lo que Flag Rush heredaría

Verificado leyendo el código, no supuesto. Ordenado por gravedad para Flag Rush.

| # | Vulnerabilidad | Dónde | Gravedad | Qué permite hoy |
|---|---|---|---|---|
| V1 | **El XP de Bandera, Contorno y Regiones no exige probar el acierto.** `xp_finish` solo revalida la respuesta en Práctica | `supabase/functions/game/index.ts`, acción `xp_finish` | Alta | Un script abre la ronda, espera 1,5 s y la cierra: XP sin jugar, hasta el tope diario (más 3 rondas pagadas) |
| V2 | **El país lo elige el cliente**, no el servidor | `CountryQuizGame.tsx` → `randomQuizCountry` | Alta | La respuesta vive en el navegador antes de jugar. El servidor no puede validar algo que no eligió |
| V3 | **La imagen filtra la respuesta:** la bandera se pide como `flagcdn.com/{código}.svg` | `CountryQuizGame.tsx`, `BigFlag` | Alta para un modo con ranking | Inspeccionar la página da el código del país. Un ranking de banderas sería trivial de ganar |
| V4 | **Jugar y sumar XP no verifica el teléfono en el servidor.** El chequeo vive solo en la app (`page.tsx`, `phoneBlocked = inMiniPay && phoneOk === false`) | Función `game` (no lo mira); `page.tsx` | Media | Una granja de wallets sin teléfono ensucia rankings y podio. **No cobra:** `close-day` y `close-week` sí exigen teléfono o wallet de correo antes de pagar |
| V5 | **Wallets de correo (Privy) pasan el control de pago sin teléfono** | `close-day` / `close-week`, `isPrivyEmailWallet` | Media | Crear correos es gratis: es la puerta para cobrar con varias wallets |
| V6 | **El servidor confía en el `player` que manda el cliente** para abrir partidas y rondas. El `secret` del dispositivo solo se exige al gastar monedas | Acciones `start` y `xp_start` | Media | Abrir partidas a nombre de otra wallet: gastarle el nivel gratis del día a un rival, o cargarle XP a cualquiera |
| V7 | **Mismas respuestas para todos** en un reto de banderas | Diseño de Flag Rush | Media | "Francia, Japón, Kenia…" se comparte en un mensaje. Es justo el ataque que ya vimos (3 wallets copiando cadenas, semana del 2 al 8-nov) |
| V8 | **Bots de reconocimiento de imagen** | Diseño de Flag Rush | Baja-media | Los ~250 dibujos de banderas son públicos. Esconder el link no impide que un bot reconozca el dibujo. Solo se puede encarecer y detectar |

Lo que ya está bien y se reutiliza:
- **Pagos y premios:** el servidor verifica cada transacción y el teléfono antes de pagar.
- **Copias en el diario:** se detectan (`detect_answer_copying`, migración 0030 de `main`).
- **Sanciones:** las cuentas sancionadas no salen en los rankings (0031).
- **Topes y tiempos:** hay tope diario de XP por modo y tiempo mínimo por ronda en el servidor.

---

## 2. Fase 0 — Cerrar lo heredado (antes de Flag Rush)

No dependen de ninguna decisión de producto.

**(actualizado)** S1, S2 y S3 se resolvieron dentro de Flag Rush mismo (no en el modo Bandera
viejo, que deja de tener ficha): el servidor elige las banderas, la imagen viaja como dato sin
el código y `rush_start` exige el `secret`. **S4 sigue pendiente:** el teléfono se comprueba al
pagar en los cierres, no al jugar.

| Tarea | Cierra | Qué cambia | Esfuerzo |
|---|---|---|---|
| **S1. El servidor elige y valida la bandera** | V1, V2 | `xp_start` (fuentes `quiz_flag`) elige el país y lo guarda en la ronda. `xp_finish` exige la respuesta y la compara. El cliente nunca conoce la respuesta antes de contestar | 1 día |
| **S2. Bandera sin código en el link** | V3 | Acción nueva que devuelve el SVG de la ronda en curso, sin código ni nombre. El cliente lo pinta como imagen local. Se varía el tamaño del lienzo en cada entrega para que el archivo no sea idéntico entre partidas | Medio día |
| **S3. `secret` del dispositivo en las acciones competitivas** | V6 | `start`, `xp_start` y las de Flag Rush exigen el mismo `secret` que ya piden los gastos (`lib/secret.ts`, primera escritura gana) | Medio día |
| **S4. Teléfono verificado en el servidor al competir** | V4 | Mismo chequeo que `close-day` (`FederatedAttestations` + wallet de correo), cacheado con vencimiento, al abrir partidas y rondas con XP. Sin verificación se juega igual, pero sin XP ni ranking | 1 día |

Contorno (`quiz_outline`) tiene el mismo problema (la silueta se busca por nombre en el atlas del navegador). Queda para después de Flag Rush, porque obliga a mandar la geometría desde el servidor.

---

## 3. Fase 1 — Flag Rush, servidor primero

**(actualizado)** Lo construido (PR #86) difiere del borrador de abajo en cuatro puntos,
decididos por David el 16 y 17-nov: ventanas de 8 h en vez de una partida diaria; opción
múltiple de 4 en vez de escribir el país; sin ranking (solo XP con tope); y salir con una
bandera en pantalla la cuenta como fallo (`RESUME_GRACE_MS` de 1,5 s solo para reintentos de
red). La pausa del veredicto (0,6 s) no le resta tiempo al jugador. 26 pruebas.

Borrador original (2026-11-11):

- `rush_start {player, secret}`: verifica teléfono (S4), sanciones y que no haya jugado hoy. Crea la partida con 10 países elegidos en el servidor y devuelve la primera bandera (S2).
- `rush_answer {sessionId, secret, answer}`: compara con el país de esa posición, guarda la hora del servidor, revela el país correcto y devuelve la siguiente bandera. No se puede saltar ni repetir.
- Al terminar: puntaje = aciertos y, a igualdad, menos tiempo (como el diario). XP con tope diario. Ranking propio.

Defensas propias del modo:
- **Una partida por wallet y día**, sin reinicio: abandonar cuenta como terminada.
- **Tiempo medido por el servidor** entre bandera y bandera.
- **Detección de velocidad no humana:** si la mediana por bandera queda por debajo de un umbral (a calibrar con datos reales), la cuenta va a revisión automática, no a sanción.
- **Copias:** según D1 (abajo), o se evita el problema con sets distintos, o se reutiliza la lógica de `detect_answer_copying`.
- **Sin premio en USDT al inicio:** solo XP. Un premio en plata atrae justo a las granjas y cae en la pregunta de cumplimiento pendiente con MiniPay.

Migraciones: **(actualizado)** Flag Rush usa **0034** (la 0033 es de Duelos, PR #85).

## 4. Fase 2 — Interfaz

**(actualizado)** Construida en los PR #87 y #88: intro con las 3 ventanas del día y el XP,
partida con reloj, resultado y práctica sin XP, en es, en, pt y fr. Ocupa la ficha de
"Adivina la bandera" en Modos. La entrada es una escena 3D con Bordy (el modelo original de
`public/bordy-hero.html`) y el globo: three.js va en su propio trozo, fuera de la carga
inicial. Se prueba con un simulador (`/?rushmock=1` o `/lab/flag-rush`) porque solo existe el
proyecto de producción.

---

## 5. Decisiones pendientes

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Mismas 10 banderas para todos? **Decidido: B** (set distinto por jugador) | A) Mismas para todos: comparable y compartible, pero copiable (V7). B) Set distinto por jugador, con la misma mezcla de dificultad (3 fáciles, 4 medias, 3 difíciles): no se puede copiar, pero "mi Flag Rush de hoy" ya no es el mismo que el tuyo | **B**, por lo ya visto con las 3 wallets. Si el valor social pesa más, A con detección de copias |
| D2 | ¿Las wallets de correo compiten por premios? | A) Igual que hoy. B) Solo con teléfono. C) Con correo, pero sin podio de la liga hasta tener cierta antigüedad | Decidir con lo que diga MiniPay sobre identidad (V5) |
| D3 | ¿Premio en USDT? **Decidido: no** | No al inicio / sí | **No al inicio:** solo XP |
| D4 | Sincronizar `dev` con `main` **Hecho** (Santiago, 17-nov) | `dev` iba atrás de `main` | **Sí, antes de tocar la función `game`**, para no programar sobre la versión vieja |

---

## 6. Despliegue (actualizado 2026-11-18)

Solo existe el proyecto de producción de Supabase. Las acciones `rush_*` no las usa nadie hasta
que salga la interfaz, así que el servidor puede ir primero sin riesgo para los jugadores.

| Paso | Qué | Cómo se comprueba |
|---|---|---|
| 1 | Revisar y mergear **#86** (servidor) hacia `dev` | `cd supabase/functions/game && deno test rush-core_test.ts rush_test.ts`: 26 pasan |
| 2 | Aplicar la migración **0034** en producción | Existen `rush_sessions` y la vista `rush_funnel`; `xp_shape` incluye `flag_rush` |
| 3 | Desplegar la función: `supabase functions deploy game` | Lleva `rush.ts`, `rush-core.ts` y `_shared/flags-data.json` |
| 4 | Probar el servidor sin interfaz | `rush_status` con una wallet de prueba responde `ok` y `state: "none"` |
| 5 | Revisar y mergear **#87** y **#88** hacia `dev` | `npm run build` pasa. En `dev` local, sin `?rushmock=1`, jugar una partida real con una wallet de prueba |
| 6 | Pasar `dev` a `main` (sale en Vercel) | La ficha de Modos muestra los 3 puntos de las ventanas; la escena corre al tocar Jugar |

Cuidados:
- **Orden de migraciones con Duelos.** 0033 (Duelos) y 0034 rehacen `xp_shape` completo. 0034
  ya incluye la línea de `duel`. Si 0033 se aplica **después** de 0034, borra la línea de
  `flag_rush`: hay que volver a correr el bloque de `xp_shape` de 0034.
- **El quiz de bandera viejo** sigue en el código sin ficha, y su XP `quiz_flag` sigue
  habilitado en el servidor. Quitarlo cuando Flag Rush esté estable.
- **Después del lanzamiento:** mirar `rush_funnel` (empezados contra terminados por ventana) y
  las partidas con `suspect = true` (8+ aciertos con mediana bajo 0,6 s).
