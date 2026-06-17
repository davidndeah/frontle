# 🌍 Frontle

> **Connect countries through borders.**

Juego de geografía diario inspirado en [Travle](https://travle.earth). Te damos un país de **origen** y uno de **destino**; tienes que llegar de uno al otro listando los países intermedios que comparten frontera. Menos países = mejor puntaje.

Construido para **[MiniPay](https://www.opera.com/products/minipay)** (16M+ usuarios) sobre **[Celo](https://celo.org)** como parte del **Hackathon de Agentes Onchain de Celo Colombia**.

---

## 🎮 Cómo se juega

1. Recibes el reto del día: **Origen → Destino** (ej: 🇨🇴 Colombia → 🇦🇷 Argentina)
2. Vas escribiendo países que formen una cadena por fronteras compartidas
3. Llegas al destino usando la menor cantidad de países posible
4. **1 intento gratis al día.** Intentos extra y pistas se pagan en stablecoins.

---

## 💰 Monetización (stablecoins en Celo)

| Acción | Precio |
|---|---|
| Primer intento del día | **Gratis** |
| Intento extra | 0.10 USDm |
| Pista (región / inicial / silueta) | 0.05 USDm |

Pagos en **USDm / USDC** vía MiniPay con fee abstraction (el usuario nunca ve "gas" ni CELO).
Integración con **COPm** (peso colombiano) para mostrar saldos en moneda local.

---

## 🏗️ Arquitectura (capas separadas)

```
frontle/
├── frontend/     # Capa 1 · Next.js — la UI del juego (MiniPay WebView)
├── backend/      # Capa 2 · Lógica de servidor / API (se irá agregando)
└── contracts/    # Capa 3 · Smart contracts en Celo (Foundry)
```

- **frontend** — Next.js + TypeScript + Tailwind + viem. Auto-connect dentro de MiniPay.
- **backend** — Por definir según necesidades (validación de rutas, leaderboard, anti-trampa). Ver [backend/README.md](backend/README.md).
- **contracts** — Pagos de intentos/pistas y pot diario en Celo. Modelo inspirado en el contrato del tutor (winner-takes-all + free play diario).

---

## 🚀 Desarrollo

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Para probar dentro de MiniPay se necesita un dispositivo físico + ngrok (los emuladores no funcionan).

---

## 📦 Stack

- **Frontend:** Next.js · TypeScript · Tailwind CSS · viem
- **Blockchain:** Celo (L2 de Ethereum) · stablecoins USDm/USDC/COPm
- **Wallet:** MiniPay (`window.ethereum`, sin librerías de conexión)
- **Deploy:** Vercel (auto-deploy desde GitHub)

---

## 📋 Estado del hackathon

- [x] Idea aterrizada
- [x] Repo público en GitHub + SSH configurado
- [ ] Frontend con pantallas navegables en Vercel
- [ ] Smart contract desplegado en Celo Sepolia
- [ ] Integración de pagos en MiniPay
- [ ] Demo Day — 19 de junio 2026

---

🤖 Desarrollado con [Claude Code](https://claude.com/claude-code)
