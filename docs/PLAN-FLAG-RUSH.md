# PLAN — Flag Rush (seguridad primero)

> **Qué es:** un desafío diario de 10 banderas seguidas, con ranking y XP. Ataca dos frentes:
> darle a todos algo más que hacer gratis cada día, y llevar al reto diario al 25 % que entra
> por Bandera y nunca lo juega (vuelve al día siguiente apenas el 5,3 %).
>
> **Orden:** primero se cierran las vulnerabilidades que Flag Rush heredaría del modo Bandera y
> de la función `game`, después se construye el modo encima. Todo en `dev`; nada a producción.
>
> **Estado:** plan para revisión (2026-11-11). Auditoría hecha contra `origin/main` (5d95bde).

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

| Tarea | Cierra | Qué cambia | Esfuerzo |
|---|---|---|---|
| **S1. El servidor elige y valida la bandera** | V1, V2 | `xp_start` (fuentes `quiz_flag`) elige el país y lo guarda en la ronda. `xp_finish` exige la respuesta y la compara. El cliente nunca conoce la respuesta antes de contestar | 1 día |
| **S2. Bandera sin código en el link** | V3 | Acción nueva que devuelve el SVG de la ronda en curso, sin código ni nombre. El cliente lo pinta como imagen local. Se varía el tamaño del lienzo en cada entrega para que el archivo no sea idéntico entre partidas | Medio día |
| **S3. `secret` del dispositivo en las acciones competitivas** | V6 | `start`, `xp_start` y las de Flag Rush exigen el mismo `secret` que ya piden los gastos (`lib/secret.ts`, primera escritura gana) | Medio día |
| **S4. Teléfono verificado en el servidor al competir** | V4 | Mismo chequeo que `close-day` (`FederatedAttestations` + wallet de correo), cacheado con vencimiento, al abrir partidas y rondas con XP. Sin verificación se juega igual, pero sin XP ni ranking | 1 día |

Contorno (`quiz_outline`) tiene el mismo problema (la silueta se busca por nombre en el atlas del navegador). Queda para después de Flag Rush, porque obliga a mandar la geometría desde el servidor.

---

## 3. Fase 1 — Flag Rush, servidor primero

Acciones nuevas en la función `game`, sobre las piezas de la Fase 0:

- `rush_start {player, secret}`: verifica teléfono (S4), sanciones y que no haya jugado hoy. Crea la partida con 10 países elegidos en el servidor y devuelve la primera bandera (S2).
- `rush_answer {sessionId, secret, answer}`: compara con el país de esa posición, guarda la hora del servidor, revela el país correcto y devuelve la siguiente bandera. No se puede saltar ni repetir.
- Al terminar: puntaje = aciertos y, a igualdad, menos tiempo (como el diario). XP con tope diario. Ranking propio.

Defensas propias del modo:
- **Una partida por wallet y día**, sin reinicio: abandonar cuenta como terminada.
- **Tiempo medido por el servidor** entre bandera y bandera.
- **Detección de velocidad no humana:** si la mediana por bandera queda por debajo de un umbral (a calibrar con datos reales), la cuenta va a revisión automática, no a sanción.
- **Copias:** según D1 (abajo), o se evita el problema con sets distintos, o se reutiliza la lógica de `detect_answer_copying`.
- **Sin premio en USDT al inicio:** solo XP. Un premio en plata atrae justo a las granjas y cae en la pregunta de cumplimiento pendiente con MiniPay.

Migraciones: `main` ya usa 0030 y 0031, y el PR #83 se renumera a 0032. **Flag Rush usa 0033 en adelante.**

## 4. Fase 2 — Interfaz

Reutiliza `CountryQuizGame` para el input y el autocompletado. Pantalla final con el puntaje y una invitación al reto diario (el puente para quien solo juega Bandera). Score card para compartir.

---

## 5. Decisiones pendientes

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Mismas 10 banderas para todos? | A) Mismas para todos: comparable y compartible, pero copiable (V7). B) Set distinto por jugador, con la misma mezcla de dificultad (3 fáciles, 4 medias, 3 difíciles): no se puede copiar, pero "mi Flag Rush de hoy" ya no es el mismo que el tuyo | **B**, por lo ya visto con las 3 wallets. Si el valor social pesa más, A con detección de copias |
| D2 | ¿Las wallets de correo compiten por premios? | A) Igual que hoy. B) Solo con teléfono. C) Con correo, pero sin podio de la liga hasta tener cierta antigüedad | Decidir con lo que diga MiniPay sobre identidad (V5) |
| D3 | ¿Premio en USDT? | No al inicio / sí | **No al inicio:** solo XP |
| D4 | Sincronizar `dev` con `main` | `dev` va 3 commits atrás (antitrampa) | **Sí, antes de tocar la función `game`**, para no programar sobre la versión vieja |
