# Frontle — Pitch, Guion de Video y Links para la Entrega

Material listo para el Demo Day (Hackathon Agentes Onchain · Celo Colombia).
Estado técnico completo: ver [`BLOCKCHAIN.md`](BLOCKCHAIN.md).

---

## 🔗 Links clave (para la demo y la entrega)

| Recurso | Link |
|---|---|
| **App en vivo** | https://frontle.vercel.app |
| **Contrato (Celo Mainnet, verificado)** | https://celo.blockscout.com/address/0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09 |
| Contrato en Celoscan (tx) | https://celoscan.io/address/0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09 |
| Repo | https://github.com/davidndeah/frontle |

- **FrontleGame (Mainnet):** `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09`
- **Token de pago:** USDT (`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e`, 6 dec)
- En Blockscout → pestaña **"Read Contract"** puedes mostrar `pot(<día>)` en vivo y que coincide con el premio de la app.

---

## 📣 Pitch (≤140 caracteres)

**Recomendado (122 car.):**
> Frontle: el Wordle de geografía en MiniPay. Conecta países por sus fronteras y compite cada día por un premio en stablecoins sobre Celo.

Alternativas:
- (120) Geografía diaria en MiniPay. Une países por fronteras y gana un premio en stablecoins. Pagos reales en Celo, sin ver "gas".
- (118) Juego de geografía diario para MiniPay: conecta países por fronteras y compite por un pot en stablecoins sobre Celo.

---

## 🎬 Guion del video demo (≤3 min)

> Objetivo: tocar los 5 criterios del jurado — utilidad real, calidad de producto, integración Celo, actividad onchain, originalidad.

### 0:00–0:20 · Gancho
**Dices:** *"¿Sabes qué países hay que cruzar para ir de Colombia a Argentina por tierra? Eso es Frontle: un juego de geografía diario, hecho para MiniPay, donde cada jugada mueve stablecoins de verdad en Celo."*
**Muestras:** el reto del día (🇨🇴→🇦🇷) y el banner **🏆 Premio de hoy**.

### 0:20–0:50 · Qué es y cómo se juega
**Dices:** *"Cada día, un reto nuevo igual para todos. Escribes países que conecten por frontera, usando la menor cantidad posible. El semáforo te dice si vas bien, de lado o lejos."*
**Muestras:** escribes 1-2 países, se colorean en el mapa, la cadena crece.

### 0:50–1:40 · Demo del pago real (el corazón) 🔑
**Dices:** *"El primer intento es gratis. Si quieres una pista o reintentar, pagas centavos en USDT — y aquí está la magia: dentro de MiniPay, sin ver 'gas' ni saber de cripto."*
**Muestras (lo más importante):**
1. Tocas una **pista** → aparece la firma en **MiniPay**.
2. Confirmas → la pista se desbloquea.
3. **El banner del premio sube en vivo** (ej. 0.04 → 0.08 USDT).

### 1:40–2:20 · La prueba onchain
**Dices:** *"Todo es verificable. El contrato está desplegado y verificado en Celo Mainnet, y cada pago queda en la blockchain."*
**Muestras:** Blockscout en `0x7Ea1…Fa09` → la transacción + el `pot` subiendo. Mencionas: *"80% va al premio del día, 20% al protocolo. El ganador se lo lleva."*
**Plus localización:** señalas el chip **🇨🇴 Saldo en COP** (integración COPm).

### 2:20–2:45 · Por qué encaja (mercado)
**Dices:** *"Frontle es un juego de sesión corta, en stablecoins, para los 16 millones de usuarios de MiniPay en mercados emergentes. Entretenido, usable sin saber de blockchain, con un modelo de ingresos claro: pistas y reintentos."*
**Muestras:** la app en móvil, fluida.

### 2:45–3:00 · Cierre
**Dices:** *"Frontle. Conecta el mundo por sus fronteras, sobre Celo. Pruébalo en frontle.vercel.app."*
**Muestras:** logo + URL + "Hackathon Agentes Onchain · Celo Colombia".

### Tips de grabación
- Graba la demo de pago **en el teléfono real con MiniPay** (es lo que más impresiona).
- Ten el **pot bajo** antes de grabar para que se vea SUBIR al pagar.
- **≤3 min es límite, no meta** — 2:00–2:30 es ideal.
- Ten **Blockscout abierto** en otra pestaña con la tx lista.

---

## ✅ Checklist de entrega (Demo Day, viernes 1 PM Colombia)

**Técnico — HECHO:**
- [x] Contrato en Celo **Mainnet** desplegado + verificado (Blockscout)
- [x] Pagos reales USDT desde **MiniPay** (probado end-to-end)
- [x] Premio del día en vivo en la UI
- [x] Saldo en **COPm** (localización / bono)
- [x] App pública: frontle.vercel.app · Repo público

**Entrega — PENDIENTE (tareas no de código):**
- [ ] Registrarse en **Proof of Ship** (talent.app) y guardar el link
- [ ] **Video demo** ≤3 min (este guion)
- [ ] **Pitch** ≤140 (arriba)
- [ ] **5–10 transacciones reales** (amigos jugando y pagando) → cubre el 15% on-chain
- [ ] Confirmar criterio del **bono COPm** con organizadores
- [ ] **Entregar en /equipos** antes del viernes 1 PM

⚪ Stretch (no prioritario): premio de agentes IA (ERC-8004 + Self Agent ID) — Frontle es un juego, no aplica sin rework.
