# Frontle — Hoja de ruta (julio 2026 →)

> Síntesis de 3 fuentes: **reglas de Proof of Ship Season 2** (Notion oficial), **feedback del equipo de listings de MiniPay**, y el **benchmark de los 10 proyectos del top 10** (`docs/benchmark/`).
> Estado: 6 de julio 2026 · Frontle #10 en PoS junio · contrato v2 (niveles) en Mainnet.

---

## 1. Las reglas del juego (Proof of Ship S2 — oficial)

### Cómo se puntúa (métricas EXACTAS, verificadas por Talent)
1. **Actividad on-chain en Celo Mainnet**: fees generados · **número de transacciones** · **usuarios únicos activos**
2. **Actividad de GitHub**: **días únicos con contribuciones** · total de contribuciones · **dependencias/uso de código específico de MiniPay**
3. **Descargas de paquetes NPM** publicados por el repo

### Calendario de julio (¡estamos dentro!)
- **Submissions/tracking: 1–27 de julio 23:59 GMT** ← todo lo que cuente debe pasar ANTES del 27
- Review 28–31 · Leaderboard + payout: 31 de julio
- **Season 2 TERMINA el 31 de julio** · tope acumulado por proyecto: 2.000 USDT

### Premios
- Pool mensual **$5.000 USDT** (Celo Public Goods) · Top 10 comparte 50% proporcional al score · Top 3: mentoría prioritaria · Ganador del mes: incentivos de usuarios + badges · Top 11–50: el otro 50%
- Reclamo vía MiniApp de Talent en MiniPay, **antes del payout del mes siguiente** (si no, se pierde)

### Reglas clave
- Mainnet + contratos verificados ✅ (tenemos v1 y v2)
- Open source en GitHub ✅
- **MiniPay hook ya NO es obligatorio, pero cuenta como BOOSTER del score**
- ⚠️ **Apps YA listadas en MiniPay NO son elegibles para premios de PoS** — el programa es para validar PMF *antes* del listing
- **Demo video de 4 min** en el perfil del proyecto (formato: 1' idea+tech · 2' walkthrough · 1' retos y visión)
- Self checkmark: nice-to-have (no obligatorio)
- Qué buscan: **juegos** ✅, utility apps, AI agents con casos MiniPay, B2C onboarding. Qué NO: demos, farming, engagement bots

---

## 2. El feedback de MiniPay (listings)

> *"Very interesting game. We currently have only one game in the geography puzzle category. This can be a welcome second. They can later even add routes between **states, provinces and counties** in specific countries as additional levels. Love it."*

**Lecturas:**
1. Hay **hueco en la categoría geografía** de MiniPay y nos quieren ahí → el listing es un objetivo REAL a corto plazo.
2. Idea regalada de producto: **modo sub-nacional** (departamentos de Colombia, estados de USA/Brasil/India…) como niveles adicionales.
3. ⚠️ **Tensión estratégica**: listing en MiniPay = fin de elegibilidad en PoS → hay que **secuenciar**: exprimir PoS S2 (termina 31 jul) → luego listing.

---

## 3. La estrategia (secuencia)

```
JULIO (1–27): maximizar el score del último mes de la Season 2
   └─ transacciones + usuarios únicos + commits diarios + boosters
31 JULIO: payout final S2 → reclamar en MiniPay
AGOSTO: pivote a LISTING de MiniPay (guidelines + pulir onboarding)
   └─ en paralelo: retención (streaks/score card) y nuevos modos
SEPT+: modo sub-nacional (el feedback), duelos, Weekly Cup, Bordy ERC-8004
```

---

## 4. Plan de acción

### 🔴 AHORA — antes del 27 de julio (cuenta para el score)

| # | Acción | Métrica que mueve |
|---|---|---|
| 1 | **Merge + deploy del rediseño y niveles** (Santiago une `feat/ui-violeta-prisma`; secret `GAME_ADDRESS`=v2 en Supabase; publicar Vercel) | Todo: las tx nuevas caen en el v2 |
| 2 | **Launch oficial en X** (video + copy listos) respondiendo al tweet del top 10 | Usuarios únicos, tx |
| 3 | **3 retos/día = 3× oportunidades de pago** — comunicarlo (cada nivel con su pot share) | Transacciones, fees |
| 4 | **Commits pequeños y DIARIOS** hasta el 27 (días únicos con contribuciones es métrica directa — mejor 15 commits en 15 días que 15 en 1) | GitHub activity |
| 5 | **Verificar el "MiniPay hook" como booster**: confirmar con Santiago que usamos las dependencias/patrones detectables de MiniPay (feeCurrency CIP-64 ya está; revisar `@minipay` SDK/hooks oficiales) | Booster del score |
| 6 | **Actualizar el demo video del perfil de Talent** al formato 4 min (1' idea · 2' walkthrough con la UI nueva · 1' retos/visión) — tenemos el material del launch video | Requisito del perfil |
| 7 | **Publicar paquete NPM**: extraer el motor de fronteras (grafo de países + BFS + reto determinista) como `@frontle/borders` open source | Métrica NPM (nadie más la estará usando 😏) |
| 8 | **Sembrar pots con `fundPot`** y anunciar "torneo diario" (compliance + incentivo de tx) | Tx, usuarios |
| 9 | Agregar **contrato v2 como data source** en talent.app (mantener v1 por historial) | Tracking correcto |

### 🟠 AGOSTO — track de LISTING en MiniPay
1. **Checklist de guidelines de MiniPay**: páginas `/terms`, `/privacy`, `/stats` (aún faltan) · copy "network fee"/nada de "gas" ✅ · identidad sin 0x ✅ (falta username) · viewport/safe-areas
2. **Onboarding pulido**: el tutorial de Bordy ya está — validar con usuarios reales de MiniPay (dispositivo físico)
3. **Revisar el modelo winner-takes-pot** con el equipo de listing (el reparto por niveles v2 + premio base sembrado ayuda a enmarcarlo como torneo)
4. **Aplicar al listing** citando el feedback recibido ("second game in geography category")

### 🟡 RETENCIÓN (agosto, en paralelo — del benchmark top 10)
1. **Score card compartible** estilo Wordle (imagen bandera→bandera + cuadritos semáforo) — el loop viral que Gambit persigue
2. **Racha visible + recompensa diaria** por resolver (la racha ya se muestra; falta premiarla)
3. **⭐ Estrellas por precisión** (3/2/1 vs óptima — patrón Chesscito) en win card y perfil
4. **Push notifications** ("nuevo reto en 1h" / "te superaron en el ranking")

### 🟢 NUEVOS MODOS (sept+ — la card "coming soon" ya existe)
1. **🗺️ Modo sub-nacional** (el feedback de MiniPay): empezar por **departamentos de Colombia** ("putting Colombia on the map", literal), luego estados de USA/Brasil/India. Reusar todo el motor (grafo de adyacencias + GeoJSON admin-1 de Natural Earth)
2. **Modo práctica** infinito (el `randomChallenge(level)` ya existe)
3. **Duelo por código de sala** (reto compartido, gana el más rápido — patrón Tycoon/Gambit)
4. **Frontle Weekly Cup** (contrato tipo `WeeklyCup` de Gambit: mismo reto semanal, top-3 split)
5. **Bordy como agente ERC-8004** (blueprint MARKOV de GameArena → premio AI de PoS S3)

---

## 5. Riesgos y notas
- **No listar en MiniPay antes del 31 de julio** (perderíamos el payout final de S2).
- El **reclamo de premios** de julio debe hacerse a tiempo (si no, se reasigna).
- Cadencia semanal de PoS: el leaderboard se actualiza cada semana — publicar progreso en el grupo de Telegram de PoS y en X (Week 2 = "Ship" pide construir en público).
- Season 3: estar atentos al anuncio (el ritmo mensual continúa; el premio AI agents requiere ERC-8004 + Self Agent ID → Bordy).

*Actualizado 2026-07-06. Fuentes: Notion oficial PoS · feedback listings MiniPay · docs/benchmark/*
