# Benchmark Top 10 Proof of Ship — Recomendaciones de MECÁNICAS y FUNCIONALIDADES para Frontle

> Análisis de 8 proyectos del top 10 de junio (Proof of Ship) — la cohorte de Frontle (#10).
> Archivo hermano: [`FRONTEND.md`](FRONTEND.md) (estética/UI/UX).

---

## Qué hace cada uno (capa de juego + on-chain)

### Tycoon — Monopoly on-chain
- Modos: vs IA · PvP con **código de sala (6 chars)** + waiting room · **Agent vs Agent** (8 agentes autónomos).
- Entry stake USDC → ganador **reclama on-chain**. Backend Express+Redis gigante: quests, referrals, daily claim, trades, subastas, shop, bounty months, pagos NGN y **admin dashboard completo** (economía, moderación, auditoría, analytics).

### Playchessify — Ajedrez con token gratis
- **CHESS gratis con faucet diario (1.000/día)** → wager loop **sin gambling** (token sin valor monetario).
- Contrato escrowea; juego se valida off-chain; **oráculo liquida** + **Vercel Cron de respaldo** + `reclaimExpired`. ⭐
- **Gas sponsorship en cascada**: MiniPay→drip USDm; social→paymaster 4337; EOA→drip CELO; fallback self-pay. **Elo on-chain**.

### Action Order — Cartas 1v1 MiniPay
- La checklist de gamificación más completa: achievements, challenges, **daily-reward, streak, season-pass**, tournament, referral, trade, black-market, NFT mint, matches live, online presence, username, history.
- Modos: Ranked (Season Pass) · Wager PvP (fee 10%) · **VS House (IA)** · Torneos/Bounty. Estado en Redis → **reanudar tras desconexión**.

### GameArena — Skill games + agente IA
- **MARKOV: agente ERC-8004 registrado** (token #6386) con persona documentada y **commit-reveal provably fair** → ganan el premio AI.
- **Identidad humana verificada** (GoodDollar SDK) para puntuar → leaderboard anti-sybil. Ladders semanales + all-time, misiones diarias, badges por tier, streaks, equipos, habitat economy. **Dune público** + Telegram activo.

### Gambit — Arcade (5 juegos clásicos) ⭐ el más alineado con Frontle
- Free vs bots o **staked 1v1** (USDm/USDC/G$) vía `ArcadeEscrow`; torneos con **split on-chain 50/30/20**; **`WeeklyCup`: copa semanal on-chain GoodID-gated (1 entrada por humano), mismo tablero seed para todos, top-3 reparte premio del vault**.
- `ArcadeEscrow`: relayer liquida; **`reclaimStalled` permissionless** (si no se liquida a tiempo, CUALQUIERA devuelve los stakes — fondos nunca congelados); `cancelMatch`/`abortMatch`.
- Daily reward (XP + 1 G$), Privy, push, admin, Dune. **Su roadmap declara**: "Daily Challenge with a shareable result card… **The Wordle loop**", referidos con dinero real capped por humano verificado, **streak multipliers**, challenge links, forfeit/resign con gracia.

### Chesscito — Puzzles educativos
- 78 ejercicios + laberintos; **estrellas por precisión vs óptimo (3/2/1)**; **Peones** (moneda in-game); **badges y scores on-chain** como prueba de progreso; partida completa guardable como **NFT**; **AI Coach (LLM)** que analiza tus partidas.

### Zorrito — Ahorro no-loss (Aave)
- Depositas USDT → yield de Aave se parte en: recompensas a todos + **premio semanal a un ahorrador activo**. Principal nunca en riesgo.
- **`save()` diario on-chain (solo gas)** que mantiene tu elegibilidad y suma **streak (máx 7)** + **welcome bonus al día 5**. Sorteo con **commit-reveal** (keeper) y Fenwick tree.
- **Keeper = GitHub Actions cron** (gratis). `emergencyReturn` por lotes para migraciones. Endpoints curiosos: **/api/mcp**, self-status/self-verify (agente Self). AUDIT.md publicado.

### Chessxu — Ajedrez multichain
- Stacks + Celo; **paymaster propio (gasless V2)**; **SDK TypeScript publicado en npm** con CI + codecov; **Farcaster miniapp** como canal principal; docs de integración MiniPay/Farcaster/gasless.

### AbaPay — Pagos de servicios (no juego)
- Patrones útiles: **verificación previa** (valida el medidor/IUC ANTES de cobrar cripto), admin dashboard ejecutivo, **notificaciones Telegram al admin** por cada venta, Supabase como ledger, fallback SMS.

---

## Patrones comunes de mecánicas en la cohorte

1. **Recompensa diaria por VOLVER** (además del contenido diario): daily reward (Gambit XP+G$; Action Order; Tycoon daily claim; faucet de Chessify; `save()` de Zorrito). El contenido diario retiene; la **recompensa diaria** convierte.
2. **Streaks por todas partes** — hasta **on-chain** (Zorrito: streak máx 7 con bonus al día 5). Gambit: streak multipliers en el claim.
3. **Modo gratis/práctica SIEMPRE disponible** (bots/House/faucet) → nunca falta rival ni te bloquea el dinero.
4. **Ciclo semanal por encima del diario**: `WeeklyCup` (contrato dedicado, mismo seed para todos, top-3 split), ladders semanales (GameArena), premio semanal (Zorrito). El patrón exacto para un "Frontle Weekly".
5. **Fondos nunca atrapados**: `reclaimStalled` **permissionless** (Gambit) / `reclaimExpired` + cron backstop (Chessify) / `emergencyReturn` (Zorrito). Estándar de la cohorte que nos falta.
6. **Anti-sybil con humanos verificados** para premios: GoodID/GoodDollar (GameArena, Gambit — 1 entrada por humano, referidos capped).
7. **Split de premios top-3 (50/30/20)** en vez de winner-takes-all (Gambit torneos y WeeklyCup) — más ganadores, menos parecido a apuesta, más retención.
8. **Referidos con recompensa real y cap por humano** (Gambit, Tycoon, Action Order, Zorrito con referralCode en el deposit).
9. **Keeper barato**: GitHub Actions cron (Zorrito) o Vercel Cron (Chessify) como respaldo del nuestro (Supabase pg_cron). Redundancia gratis.
10. **Admin panel + analytics públicos** (Dune) — operación y transparencia (y requisito soft del listing).

---

## Recomendaciones priorizadas para Frontle

### 🔴 Retención (gap #1)
1. **Streak de días** con badge y (fase 2) multiplicador de puntos — el patrón universal de la cohorte; Zorrito hasta lo pone on-chain.
2. **Recompensa diaria por resolver** (puntos "Frontle" off-chain aunque no ganes el pot) + **welcome bonus** al completar los primeros 5 días (patrón Zorrito).
3. **Logros** ("ruta óptima 3 días seguidos", "conecta 2 continentes", "sin pistas") + **estrellas por precisión** (Chesscito) acumulables en el perfil.

### 🟠 Robustez del dinero (para Santiago)
4. **`reclaimStalled` permissionless o política de pots huérfanos** (patrón Gambit/Chessify): si un día no se cierra en X horas, los pagos de ese día se pueden reclamar/reciclar. + **Cron de respaldo** (GitHub Actions, gratis como Zorrito) vigilando el `close-day` de Supabase.
5. **Considerar split top-3 (50/30/20)** para el pot diario o al menos el semanal (Gambit): mitiga el riesgo "apuesta" de MiniPay, produce 3 ganadores felices/día y es un cambio pequeño de contrato (v2).
6. **/stats pública + Dune dashboard** (GameArena, Gambit, Zorrito lo tienen).

### 🟡 Nuevos modos ("New modes coming soon…")
7. **Frontle Weekly Cup** (calco del contrato `WeeklyCup` de Gambit): mismo reto especial semanal para todos, 1 entrada por humano (GoodID/Self), top-3 split del vault. Encaja perfecto con nuestro determinismo por seed.
8. **Modo práctica infinito** (nuestro `randomChallenge()` ya existe) — gratis, vs el reloj, sin pot.
9. **Duelo por código de sala** (Tycoon/Gambit challenge links): retar a un amigo al mismo reto, wager opcional; el modo viral de WhatsApp.
10. **Bordy como rival/coach IA → agente ERC-8004** (blueprint MARKOV de GameArena + AI Coach de Chesscito): corto plazo, "¿le ganas al tiempo de Bordy hoy?" (off-chain); largo plazo, registro ERC-8004 + Self Agent ID → premio AI de Proof of Ship ($250×4).

### 🟢 Crecimiento
11. **Referidos capped por humano** con bonus real pequeño (pista gratis o 0.05 USDT del treasury).
12. **Telegram/push del reto diario** ("Hoy: 🇧🇳→🇩🇪 · pot $X") — bot simple + service worker.
13. **Token FRONT gratis con faucet** (patrón Chessify) para duelos sin dinero real — wager loop sin riesgo regulatorio.
14. **Verificación GoodID/Self para el ranking** cuando crezca (anti-sybil en premios).

### Nota de cumplimiento (vigente)
La cohorte maneja el riesgo "apuesta" de 3 formas: token sin valor (Chessify), split top-3 + free-first (Gambit), o premio del yield sin tocar principal (Zorrito). Nuestro winner-takes-all diario tiene esas 3 válvulas de escape documentadas si el listing de MiniPay lo exige.

---

*Actualizado 2026-07-04 con los 8 proyectos (9 repos). Cohorte completa del top 10 salvo 1 proyecto restante.*
