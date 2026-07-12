# Checklist de revisión antes de mergear a producción

> Rama: `feat/regiones-audio-practica` (21 commits sobre `main`).
> Preview (estando logueado en Vercel del equipo `ndeah`):
> **https://frontle-git-feat-regiones-audio-practica-ndeah.vercel.app**
>
> Recórrelo en el móvil (o DevTools a 390px). Marca cada casilla; si algo falla,
> anótalo y lo arreglamos antes del merge. Al final: si todo ✓ → mergear.

## 1. Modo Regiones (lo nuevo grande — lo que MiniPay pidió)
- [ ] En "Jugar" aparece la tarjeta **Regiones** con un **desplegable de país**.
- [ ] El desplegable lista 6: Colombia, Estados Unidos, Argentina, Nigeria, Brasil, Ghana — cada uno con su **bandera real** (no "CO"/"US").
- [ ] Al cambiar de país en el desplegable, el **mapa de abajo cambia** y se ve con la **forma correcta y sin distorsión** (proyección Mercator).
- [ ] Botón "▶ Jugar <país>" entra al juego de esa región.
- [ ] Dentro del juego: reto origen→destino con banderas de subdivisión, mapa, cronómetro, input con autocompletar.
- [ ] Pista gratis funciona; al ganar salen **estrellas** (3/2/1) y opción de compartir.
- [ ] Probar al menos 2 países distintos (p.ej. Colombia y Argentina) de principio a fin.

## 2. Modo práctica (pestaña Aprender)
- [ ] En "Aprender" hay un botón **🎓 Modo práctica**.
- [ ] Al entrar: juego mundial con los **contornos de todos los países visibles**.
- [ ] La **pista es gratis** (no pide pago) y ayuda (silueta → inicial → nombre).
- [ ] Al ganar: botón **"Otra ronda"** genera un reto nuevo (infinito, sin premios).

## 3. Aprender rediseñado
- [ ] Ya **no** aparece el emoji de robot 🤖 explicando el juego.
- [ ] Aparece **Bordy** (la mascota) presentando, con botón "Ver tutorial completo".
- [ ] El botón lanza el tutorial interactivo de Bordy.

## 4. Audio
- [ ] Al primer toque en la pantalla empieza una **música de fondo** suave.
- [ ] En el header hay un control con **dos botones**: música (🎵) y efectos (🔊), cada uno mutea por separado.
- [ ] En **Perfil** hay un panel de Audio con los mismos dos interruptores.
- [ ] El mute persiste al recargar.

## 5. Idioma
- [ ] Por defecto la app carga en **inglés** (era el bug del revisor de MiniPay).
- [ ] En el header hay un selector de idioma (🌐 ES/EN/FR/PT) y otro con etiqueta en Perfil.
- [ ] Cambiar idioma actualiza toda la UI y persiste al recargar.

## 6. Header y layout
- [ ] El header **no se desborda**: se ven FRONTLE, pot, audio, idioma y wallet sin cortarse (probar 360 y 390px).

## 7. Regresión del modo mundial (que NO se rompió nada)
- [ ] Jugar el reto diario mundial completo (input, semáforo, victoria).
- [ ] Comprar una pista real (si tienes saldo) o ver que el flujo de pago no está roto.
- [ ] Ranking carga y muestra posiciones.
- [ ] Cronómetro corre y la victoria guarda la marca.
- [ ] `/terms`, `/privacy`, `/stats` cargan.

## 8. Dentro de MiniPay (si puedes, en device físico)
- [ ] La wallet se conecta sola (sin botón de conectar).
- [ ] No aparece CELO ni jerga de "gas" al usuario.
- [ ] Si el saldo no alcanza, lleva a la pantalla de recarga (add_cash).

---
**Resultado:** si todo ✓ → dar luz verde al merge (F1). Si algo falla → lista los ítems y los corregimos en la rama antes de mergear.
