# Contracts — Frontle

Capa 3 de la arquitectura. Smart contracts en **Celo**.

Aún no inicializado con Foundry (se hará en la fase de blockchain del hackathon — Bootcamp #2/#3). Cuando se agregue:

```bash
cd contracts
forge init --no-git .
forge install OpenZeppelin/openzeppelin-contracts
```

## Diseño previsto

Inspirado en el contrato `FreakingPot` del tutor (csacanam/freaking-grammar). Modelo:

- **Free play diario** — la primera jugada de cada día UTC es gratis por wallet
- **Jugadas pagas** — `play()` cobra una entry fee en stablecoin
- **Reparto** — % al pot del día, % fee de protocolo (el tutor usa 80/20)
- **Pistas** — `buyHint(hintType)` cobra una tarifa menor
- **Pot diario** — opcional: winner-takes-all como el tutor, o simplemente acumular ingresos

## Tokens (Celo Mainnet)

| Token | Dirección | Decimales |
|---|---|---|
| USDm (cUSD) | `0x765DE816845861e75A25fCA122bb6898B8B1282a` | 18 |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` | 6 |
| COPm (Mento) | `0x8A567e2aE79CA692Bd748aB832081C45de4041eA` | 18 |

> Para el `feeCurrency` de USDC usar el **adapter** `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`, no la dirección del token.

## Redes

- **Sepolia (testnet):** chainId `11142220` — para la demo
- **Mainnet:** chainId `42220` — para el bono de integración (requisito: contrato verificado)
