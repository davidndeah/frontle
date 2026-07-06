# Benchmark Top 10 Proof of Ship — Recomendaciones de FRONTEND para Frontle

> Análisis de 8 proyectos del top 10 de junio (Proof of Ship) — la cohorte de Frontle (#10).
> Archivo hermano: [`MECANICAS.md`](MECANICAS.md) (gamificación, contratos y features).

---

## Resumen de la cohorte

| Proyecto | Qué es | Nota de frontend | Live |
|---|---|---|---|
| **Tycoon** (SaboStudios + aji70) | Monopoly on-chain, PvP + IA + agentes | Tableros **3D** con versión mobile dedicada, shop, animaciones | base-monopoly.vercel.app |
| **Playchessify** | Ajedrez con wagers en token gratis | UI "premium **cyber-industrial**", piezas 3D, música, temas | celo.playchessify.xyz |
| **Action Order** (CELO-cards) | Cartas tácticas 1v1 en MiniPay | **Personajes** con retrato + idle + taunts, overlays cinemáticos | actionorder.xyz |
| **GameArena** (Gamerstew) | Skill games + IA rival + ladders G$ | Identidad "arena", badges, Telegram como capa social | gamearenahq.xyz |
| **Gambit** | Arcade de 5 juegos clásicos, free o staked | "Dark **arcade design system**", bottom-nav, música por juego, push | gambit-rose.vercel.app |
| **Chesscito** | Puzzles pre-ajedrez educativos | Mascota lobo, **estrellas por precisión**, AI Coach | chesscito.com |
| **Zorrito** | Ahorro no-loss sobre Aave | **Mascota zorro customizable**, vanilla JS ultraligero, /stats | zorritov2.vercel.app |
| **Chessxu** | Ajedrez multichain (Farcaster miniapp) | React+Vite, gasless UX, SDK npm propio | farcaster.xyz/miniapps/…/chessxu |

---

## Patrones comunes de frontend en la cohorte

1. **Mascota/personaje como identidad Y como interfaz.** Chessify: coaches con retratos; Action Order: 5 fighters con idle+taunts; GameArena: MARKOV (IA con nombre); Chesscito: lobo; **Zorrito: zorro customizable** (¡con "fox-customizer" como feature!); **Gambit: "coach" con mano que apunta** para el onboarding de cada juego. → *Bordy debe vivir DENTRO de la app.*
2. **Onboarding guiado explícito.** El más elaborado: Gambit — "on-board coach (pointing hand) for first-time play **in every game**", y su fase 2 lo extiende a wallet/depósitos/retiros, **reabrible desde un botón de ayuda** (no once-and-gone). Tycoon: `/how-to-play`. Chesscito: es 100% un tutorial jugable.
3. **Lenguaje llano, cero jerga.** Gambit planea un "plain language pass over every word in the app… No jargon a first-timer has to google" + hero copy trabajado ("Think you'd win? Put money on it."). Coincide con las reglas de copy de MiniPay.
4. **Estrellas / calidad de la solución visible.** Chesscito da **3/2/1 estrellas según movimientos extra sobre el óptimo** — exactamente la matemática del semáforo de Frontle, convertida en recompensa coleccionable.
5. **Resultado compartible tipo Wordle.** Gambit (roadmap): "finishing produces a **spoiler-free score card** that posts to WhatsApp/X in one tap. The Wordle loop." → *Frontle ya comparte texto; falta la CARD visual.*
6. **Leaderboard y perfil como páginas núcleo** (todos). Username/alias en vez de 0x (requisito MiniPay).
7. **Cinemática en momentos clave**: VS screens (Action Order), modal de victoria + claim (Tycoon), celebración con premio.
8. **Sonido**: música por juego (Gambit, generada por script), music/ + taunts (Chessify, Action Order). El "anti-generic pass" de Gambit dedica una fase entera a "motion, feel and sound".
9. **Push notifications** (Gambit `push-sw.js`): reengancha cuando abre un stake o llega el reto.
10. **Rutas legales + stats públicas**: /terms /privacy /cookies (Tycoon, Zorrito) y **/stats** (Zorrito, GameArena vía Dune) — ambos requisitos del listing MiniPay.
11. **Farcaster como canal extra**: manifest `.well-known/farcaster.json` (Tycoon, AbaPay) o miniapp completa (Chessxu).
12. **Guest/social primero, wallet después**: Privy (Gambit, Chessify), guest auth (Tycoon), gasless por paymaster (Chessxu). La cohorte entera valida lo que Santiago ya montó.

---

## Recomendaciones priorizadas para Frontle

### 🔴 Alto impacto / bajo esfuerzo
1. **Bordy in-app**: guía del primer uso (3 burbujas como el video, reabrible con un botón "?") + voz de los mensajes del semáforo. Patrón validado por 6 de 8 proyectos.
2. **Score card compartible** (el gap #1): al resolver, generar una tarjeta visual spoiler-free (bandera→bandera, nº países, tiempo, colores del semáforo estilo cuadritos de Wordle) que se comparte a WhatsApp/X en un tap. Gambit lo declara SU loop de crecimiento — nosotros ya tenemos el juego diario, solo falta la card.
3. **Estrellas por precisión** (patrón Chesscito): ⭐⭐⭐ ruta óptima · ⭐⭐ +1 país · ⭐ +2. Se calcula con datos que ya tenemos; se muestra en win card, ranking y perfil.
4. **Página "How to play"** + sección de reglas simple.
5. **Sonido mínimo** (4 SFX + mute) y **micro-animaciones** al conectar país (la ruta “dibujándose” en el mapa).
6. **/terms, /privacy y /stats** públicos (listing MiniPay; Zorrito y Tycoon los tienen hasta en vanilla JS).

### 🟡 Medio esfuerzo
7. **Perfil con username/alias** + historial + estrellas acumuladas + racha.
8. **Leaderboard página completa**: Hoy / Semana / Histórico.
9. **VS screen** al iniciar el reto (1.5s, banderas grandes) — anticipación estilo Action Order.
10. **Push notifications** (service worker): "el reto de hoy ya está aquí" + "te superaron en el ranking".
11. **Plain-language pass** de todo el copy (auditar contra las reglas MiniPay: network fee, deposit, digital dollars).
12. **Manifest de Farcaster** (`.well-known/farcaster.json`) — Tycoon y AbaPay lo incluyen; distribución gratis.

### 🟢 Más adelante
13. **Customización de Bordy** (patrón fox-customizer de Zorrito): accesorios desbloqueables/comprables — cosmético que monetiza sin tocar el juego.
14. **Temas de mapa** desbloqueables (análogo a piece sets de Chessify).
15. **Modo oscuro/claro y "arcade design system"** documentado (Gambit) para consistencia al crecer.

---

*Actualizado 2026-07-04 con los 8 proyectos analizados (9 repos). AbaPay (utility payments, no juego) aporta poco a frontend de juego; sus patrones van en MECANICAS.md.*
