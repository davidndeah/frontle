# QA — tanda del 19 de julio 2026

Guía para revisar los 3 PRs de esta tanda. Pensada para hacerse **en el móvil o
con el navegador a 375 px**, que es donde vive la app.

> Orden sugerido de merge: **#69 → #70 → #71**. Son independientes entre sí
> (ramas separadas desde `main`), pero #71 es el que más superficie toca.

Para empezar de cero en cualquier momento, en la consola del navegador:

```js
localStorage.clear(); location.reload();
```

---

## PR #69 — Botón de cerrar sesión

**Lo que cambió:** existe una forma de salir de una sesión de correo. Antes no.

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 | Entrar con un correo, tocar el chip de identidad del header | Aparece "Cerrar sesión" bajo "Conectado como" |
| 2 | Cerrar sesión | Vuelve a "👤 Entrar"; el alias y los premios desaparecen |
| 3 | **Recargar la página** | Sigue deslogueado (esto es lo que fallaba: Privy resucitaba la sesión) |
| 4 | Volver a entrar **con el MISMO correo** | Recupera identidad y ranking |

⚠️ **El paso 4 es el importante.** Hay un caché interno que daba la dirección
por registrada y dejaba al usuario sin identidad al reentrar. Si tras volver a
entrar el ranking no te reconoce, es ese bug.

**Debe seguir igual:**
- Dentro de **MiniPay** NO debe aparecer "Cerrar sesión" (la wallet la inyecta
  el navegador; mostrar ese botón viola las reglas de MiniPay).
- Con una wallet de extensión, tampoco.

---

## PR #70 — Niveles sin saltos de nicho

**Lo que cambió:** el nivel fácil ya no se arma sobre fronteras que casi nadie
conoce, y los 3 niveles se distinguen por longitud.

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 | Jugar **fácil** varios días seguidos | Origen y destino siempre en la misma región, sin cruzar océanos |
| 2 | Mirar la longitud de cada nivel | fácil ≤3 intermedios · medio ≤5 · difícil ≤7 |
| 3 | Jugar **difícil** y pasar por Francia → Brasil | **Debe seguir funcionando** — las fronteras raras siguen siendo válidas al jugar |

**Lo que NO debe pasar (crítico):**
Los retos de días **anteriores al 20 de julio** no pueden haber cambiado. Si
cambiaran, el ranking y el pot on-chain de esos días dejarían de corresponder
al reto que la gente resolvió. Ya está verificado automáticamente (240 retos
comparados contra el motor anterior, cero cambios) y hay un test que lo fija,
pero si ves un ranking histórico raro, empieza por aquí.

Para correr los tests del motor:

```bash
cd packages/borders && npm run build && npm test   # 10/10
```

---

## PR #71 — Bordy, tienda y tutorial

El más grande. Lo divido por temas.

### A. Tutorial unificado ⚠️ *empieza por aquí*

Es lo único que **no pude verificar de punta a punta** con automatización: el
efecto de máquina de escribir vacía el texto de los botones y pelea con los
clicks sintéticos. La lógica y los textos están verificados; el recorrido
completo no.

Con `localStorage.clear()`, entrar a jugar el reto diario:

| # | Qué debe pasar |
|---|---|
| 1 | Sale el modal de Bordy con **5 pasos** (saludo → verde → amarillo → rojo → victoria) |
| 2 | El paso 5 ya **no** habla del cronómetro, y anuncia que faltan dos cosas |
| 3 | Al terminar, salen **2 coachmarks**: panel de pistas y cronómetro |
| 4 | El coachmark del cronómetro empieza con "Y este es el desempate" |
| 5 | **Ya no aparece** un coachmark sobre el input (era la redundancia) |
| 6 | Al terminar, el cronómetro arranca en 00:00 y empieza la partida |
| 7 | Recargar y volver a jugar → **no sale nada** del tutorial |

También probar el botón "Saltar tutorial" y el checkbox "No volver a mostrar".

**Migración:** si ya habías visto el tutorial viejo, no debería volver a
aparecerte. Probar sin limpiar localStorage.

### B. Bordy reactivo

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 | Acertar un país **verde** | Bordy salta y su LED se pone verde |
| 2 | Acertar uno **amarillo** | Sacudida corta, LED ámbar |
| 3 | Escribir un país inválido o **rojo** | Se sacude y queda ladeado, LED rojo |
| 4 | **Ganar** | Salto grande con chispas doradas |
| 5 | Acertar **dos verdes seguidos** | Salta **las dos veces** (no solo la primera) |

⚠️ **Lo que más quiero que juzgues:** antes Bordy se **escondía** durante la
partida para no tapar el input. Ahora se queda (es cuando tiene algo que decir)
pero se encoge a la mitad y baja la opacidad. **Si estorba al escribir, dilo y
lo vuelvo a esconder** — o lo muevo de sitio.

Probar también con el sistema en "reducir movimiento": no debe haber saltos ni
chispas, pero **el LED debe seguir cambiando de color** (ahí está la
información).

### C. Menú de Bordy

| # | Qué hacer | Qué debe pasar |
|---|---|---|
| 1 | Tocar a Bordy | Abre el menú (antes iba directo al tutorial) |
| 2 | Probar los 4 destinos | Tutorial, perfil, ajustes y soporte |
| 3 | Tocar fuera del panel | Cierra |
| 4 | **Arrastrar desde dentro del panel y soltar fuera** | **NO** debe cerrarse |

> **Actualización (20 jul):** el menú tenía un 5º destino, "Tienda", con una
> tienda de monedas placeholder (saldo en localStorage). La quité del PR el
> mismo día: al revisar el repo encontré que Santiago abrió la rama `v2` horas
> después con la implementación REAL del mercado de monedas (ledger verificado
> on-chain, XP, rachas, contrato `FrontleWeekly`) — y de paso corrigió la spec
> para que las monedas ya **no** apliquen al reto diario, que era justo lo que
> mi placeholder mostraba. Ver commit `7cbc8f6`. Cuando `v2` se integre, el
> menú gana su entrada de tienda de forma natural. Nada que revisar aquí sobre
> tienda; si la ves en la app, es la de `v2`, no la de este PR.

### D. Accesibilidad de los sheets (nuevo)

En cualquier sheet (wallet, ajustes, menú, tienda):

| # | Qué debe pasar |
|---|---|
| 1 | **Escape** lo cierra |
| 2 | El fondo **no** hace scroll mientras está abierto |
| 3 | Al cerrar, el foco vuelve al botón que lo abrió |

### E. Sin cambios visuales (regresión)

El refactor de colores no debería verse. Comprobar que siguen igual:

- Los colores del mapa (origen cyan, destino rosa, verde/amarillo/rojo)
- La **imagen que se comparte** al ganar — mismos colores que el mapa
- El tablero de ejemplo del tutorial
- La leyenda bajo el mapa

---

## Si algo se rompe

Los 3 PRs son independientes: se puede revertir uno sin tocar los otros. Dentro
del #71, cada commit es un tema, así que también se puede revertir suelto:

```bash
git revert 64e4d2b   # colores
git revert 18831ca   # tutorial
git revert 6ebea36   # menú + tienda
git revert 18380dc   # animaciones de Bordy
git revert 5278be5   # sheet reutilizable
```

Ojo: revertir `5278be5` (el sheet) obliga a revertir también lo que lo usa.
