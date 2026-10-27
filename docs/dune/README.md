# Frontle en Dune — dashboard público de analítica on-chain

Cubren los tres contratos de Frontle en Celo Mainnet y responden lo que `/stats`
**no** puede: series temporales, altas vs. recurrentes y retención por cohorte.

## 🟢 Ya está montado

**Dashboard:** <https://dune.com/frontle9949/frontle-anal-tica-on-chain-celo>

| # | Query | ID |
|---|---|---|
| Q1 | Wallets activas por día | [8268440](https://dune.com/queries/8268440) |
| Q2 | Wallets nuevas vs. recurrentes | [8268446](https://dune.com/queries/8268446) |
| Q3 | Retención por cohorte semanal | [8268448](https://dune.com/queries/8268448) |
| Q4 | Mezcla de acciones por día | [8268449](https://dune.com/queries/8268449) |
| Q5 | Flujo del pot en USDT | [8268454](https://dune.com/queries/8268454) |
| Q6 | Tasa de reclamo por nivel | [8268462](https://dune.com/queries/8268462) |

Verificado contra datos reales el 2026-08-08: los 8 `topic0` de abajo devuelven
filas, y `celo.logs` tiene los tres contratos desde el bloque de despliegue. El
SQL de este documento es el que está publicado — si editas una query en Dune,
actualiza también aquí.

⚠️ **`celo.logs` está particionado por `block_date`.** Toda query nueva debe
filtrar por esa columna o cuesta créditos de más. Las 6 ya lo hacen.

## Contratos

| Rol | Dirección | Desde |
|---|---|---|
| FrontleGame v1 (ganador único) | `0x7Ea1EEB96Caf0b07E47354c349b8FdFC75B2Fa09` | 2026-06-17 |
| FrontleGame v2 (niveles) | `0xaDcA9A707F394509C8aA906B89B93cb222f2BeBE` | 2026-07-05 |
| FrontleWeekly (liga) | `0x766A12333AA5249CDEf2259Cc9D3aD0c746c8132` | 2026-07-20 |

## topic0 de cada evento

Calculados con `cast keccak` sobre la firma canónica. El v1 y el v2 comparten
los tres primeros: **un solo filtro cubre ambos contratos**.

| Evento | Firma | topic0 | Contratos |
|---|---|---|---|
| AttemptPaid | `AttemptPaid(address,uint256,uint256)` | `0xc7d6a3c0e0c7b1d53dba234d6939ccd07e84a7ae27dcaf5df9fda1ca3bc6c126` | v1 + v2 |
| HintPaid | `HintPaid(address,uint256,uint8,uint256)` | `0xfe8c8a0590601b4b7aab2bb582f822622ce700ad7f90baac9a9b8b31b7b96f53` | v1 + v2 |
| PotFunded | `PotFunded(uint256,address,uint256)` | `0xa630e8498f159e2cbe3385b2724384bb37cec46b5b4eb61cc6eb7bde9504b985` | v1 + v2 |
| Claimed (v2) | `Claimed(uint256,uint8,address,uint256)` | `0x4ef771089e4b5ef47e7c1aef7d8253a52d84d64338be1765c1b6e8ed34cb14c1` | v2 |
| Claimed (v1) | `Claimed(uint256,address,uint256)` | `0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026` | v1 |
| DayRolled (v2) | `DayRolled(uint256,address,address,address,uint256)` | `0xfc068a16c2d502efabe6173a9256e4a335af217a85f91f59fd57a35539d39b1a` | v2 |
| DayRolled (v1) | `DayRolled(uint256,address,uint256)` | `0xa9953c4665f907098109ba233d01760f37b4cde3683e1d5d27044a7d2166b658` | v1 |
| CoinsPurchased | `CoinsPurchased(address,uint256,uint256)` | `0xe42c627940ae035b15bcb45ba29d47ff8b9716b27a4b993b5513d8c0516dc1ed` | weekly |

### Dónde vive cada dato

```
AttemptPaid    topic1=player  topic2=day            data: [amount]
HintPaid       topic1=player  topic2=day            data: [hintType][amount]
PotFunded      topic1=day     topic2=from           data: [amount]
Claimed v2     topic1=day     topic2=level  topic3=winner   data: [amount]
Claimed v1     topic1=day     topic2=winner         data: [amount]
DayRolled v2   topic1=day                           data: [hard][med][easy][pot]
DayRolled v1   topic1=day     topic2=winner         data: [pot]
CoinsPurchased topic1=player  topic2=week           data: [amount]
```

`bytearray_substring` es 1-indexado: la palabra N empieza en `32*(N-1)+1`, y una
dirección son los últimos 20 bytes de su palabra (`+12`).

## Quién cuenta como jugador

Mismo criterio que `frontend/app/lib/onchain.ts`: **reintentos, pistas, premios
cobrados y compra de monedas**. `PotFunded` queda fuera aunque sea permissionless
— en la práctica somos nosotros sembrando el pot, y contarlo inflaría las
wallets únicas con nuestras propias direcciones.

---

## Cómo montarlo

1. **Sube los contratos a decodificar** (opcional pero recomendado):
   dune.com → *Submit contract for decoding* → dirección + ABI + chain `celo`.
   - ABI del v2 y del weekly: `cd contracts && forge inspect FrontleGame abi`
   - ABI del v1: la fuente vive en el historial →
     `git show 29a1721^:contracts/src/FrontleGame.sol`
   - Usa el mismo namespace (`frontle`) para los tres.
   - Tarda ~1 día. **Las queries de abajo NO lo necesitan**: van contra
     `celo.logs` crudo y funcionan desde el minuto uno.

2. **Crea cada query**: New → Query → motor *Dune SQL* → pega → Run → Save.

3. **Visualiza**: en cada query, *New visualization* → tipo de gráfica (abajo
   sugiero cuál) → Add.

4. **Dashboard**: New → Dashboard → arrastra las visualizaciones → *Make public*.
   Esa URL es la que va al submission de Proof of Ship, al README y a `/stats`.

> **Truco:** en vez de repetir el CTE `eventos` en cada query, guarda la Q1 y
> desde las demás haz `SELECT * FROM query_XXXXXXX` (el id de la Q1). Dune
> permite queries sobre queries y así el criterio de "quién es jugador" vive en
> un solo sitio. Abajo van independientes para que nada se rompa si borras una.

> Si `celo.logs` no resuelve, el esquema puede llamarse distinto en tu cuenta:
> revisa el explorador de tablas de Dune. Es un cambio de una palabra.

---

## Q1 — Wallets únicas y acciones por día

Tu DAU on-chain. **Visualización:** barras (wallets) + línea (acciones).

```sql
-- Frontle · actividad diaria de jugadores
WITH eventos AS (
    -- Reintentos (v1 + v2 comparten firma)
    SELECT block_time, tx_hash, bytearray_substring(topic1, 13, 20) AS player, 'reintento' AS accion
    FROM celo.logs
    WHERE contract_address IN (
            0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09,
            0xadca9a707f394509c8aa906b89b93cb222f2bebe)
      AND topic0 = 0xc7d6a3c0e0c7b1d53dba234d6939ccd07e84a7ae27dcaf5df9fda1ca3bc6c126
      AND block_time >= TIMESTAMP '2026-06-17'

    UNION ALL
    -- Pistas (v1 + v2)
    SELECT block_time, tx_hash, bytearray_substring(topic1, 13, 20), 'pista'
    FROM celo.logs
    WHERE contract_address IN (
            0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09,
            0xadca9a707f394509c8aa906b89b93cb222f2bebe)
      AND topic0 = 0xfe8c8a0590601b4b7aab2bb582f822622ce700ad7f90baac9a9b8b31b7b96f53
      AND block_time >= TIMESTAMP '2026-06-17'

    UNION ALL
    -- Premio cobrado, v2: el ganador va en topic3
    SELECT block_time, tx_hash, bytearray_substring(topic3, 13, 20), 'premio'
    FROM celo.logs
    WHERE contract_address = 0xadca9a707f394509c8aa906b89b93cb222f2bebe
      AND topic0 = 0x4ef771089e4b5ef47e7c1aef7d8253a52d84d64338be1765c1b6e8ed34cb14c1

    UNION ALL
    -- Premio cobrado, v1: sin niveles, el ganador va en topic2
    SELECT block_time, tx_hash, bytearray_substring(topic2, 13, 20), 'premio'
    FROM celo.logs
    WHERE contract_address = 0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09
      AND topic0 = 0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026

    UNION ALL
    -- Monedas de la liga semanal
    SELECT block_time, tx_hash, bytearray_substring(topic1, 13, 20), 'monedas'
    FROM celo.logs
    WHERE contract_address = 0x766a12333aa5249cdef2259cc9d3ad0c746c8132
      AND topic0 = 0xe42c627940ae035b15bcb45ba29d47ff8b9716b27a4b993b5513d8c0516dc1ed
)
SELECT
    date_trunc('day', block_time)   AS dia,
    count(DISTINCT player)          AS wallets,
    count(*)                        AS acciones,
    count(DISTINCT tx_hash)         AS transacciones
FROM eventos
GROUP BY 1
ORDER BY 1
```

## Q2 — Wallets nuevas vs. recurrentes

La que separa "tuve un pico" de "estoy creciendo". **Visualización:** barras
apiladas.

```sql
-- Frontle · altas vs. retorno
WITH eventos AS (
    /* ↓ pega aquí el mismo bloque `eventos` de la Q1 ↓
       (o reemplaza todo el CTE por: SELECT * FROM query_XXXXXXX) */
),
activas AS (
    SELECT DISTINCT date_trunc('day', block_time) AS dia, player
    FROM eventos
),
primera AS (
    SELECT player, min(dia) AS dia_alta
    FROM activas
    GROUP BY 1
)
SELECT
    a.dia,
    count_if(p.dia_alta = a.dia) AS nuevas,
    count_if(p.dia_alta < a.dia) AS recurrentes
FROM activas a
JOIN primera p ON p.player = a.player
GROUP BY 1
ORDER BY 1
```

## Q3 — Retención por cohorte semanal

Ninguna otra fuente tuya puede calcular esto. **Visualización:** pivot table
(`cohorte` en filas, `semana_n` en columnas, `pct` como valor) o heatmap.

```sql
-- Frontle · retención por cohorte semanal
WITH eventos AS (
    /* ↓ mismo bloque `eventos` de la Q1 ↓ */
),
semanas AS (
    SELECT DISTINCT player, date_trunc('week', block_time) AS semana
    FROM eventos
),
cohorte AS (
    SELECT player, min(semana) AS semana_alta
    FROM semanas
    GROUP BY 1
),
tam AS (
    SELECT semana_alta, count(*) AS n
    FROM cohorte
    GROUP BY 1
)
SELECT
    c.semana_alta                                        AS cohorte,
    t.n                                                  AS tam_cohorte,
    date_diff('week', c.semana_alta, s.semana)           AS semana_n,
    count(DISTINCT s.player)                             AS wallets,
    round(100.0 * count(DISTINCT s.player) / t.n, 1)     AS pct
FROM semanas s
JOIN cohorte c ON c.player = s.player
JOIN tam     t ON t.semana_alta = c.semana_alta
GROUP BY 1, 2, 3
ORDER BY 1, 3
```

## Q4 — Transacciones por tipo

Cuenta la historia del producto, no solo el volumen. **Visualización:** área
apilada.

```sql
-- Frontle · mezcla de acciones por día
WITH eventos AS (
    /* ↓ mismo bloque `eventos` de la Q1 ↓ */
)
SELECT
    date_trunc('day', block_time) AS dia,
    accion,
    count(*)                      AS n
FROM eventos
GROUP BY 1, 2
ORDER BY 1, 2
```

## Q5 — Economía del pot (USDT)

Cuánto se sembró, cuánto se repartió y cuánto se cobró de verdad.
**Visualización:** barras agrupadas por `concepto`.

```sql
-- Frontle · flujo del pot en USDT (6 decimales)
WITH mov AS (
    -- Sembrado (fundPot, v1 + v2). data = [amount]
    SELECT date_trunc('day', block_time) AS dia, 'sembrado' AS concepto,
           CAST(bytearray_to_uint256(bytearray_substring(data, 1, 32)) AS double) / 1e6 AS usdt
    FROM celo.logs
    WHERE contract_address IN (
            0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09,
            0xadca9a707f394509c8aa906b89b93cb222f2bebe)
      AND topic0 = 0xa630e8498f159e2cbe3385b2724384bb37cec46b5b4eb61cc6eb7bde9504b985

    UNION ALL
    -- Repartido v2: data = [hard][med][easy][pot] → el pot es la 4ª palabra
    SELECT date_trunc('day', block_time), 'repartido',
           CAST(bytearray_to_uint256(bytearray_substring(data, 97, 32)) AS double) / 1e6
    FROM celo.logs
    WHERE contract_address = 0xadca9a707f394509c8aa906b89b93cb222f2bebe
      AND topic0 = 0xfc068a16c2d502efabe6173a9256e4a335af217a85f91f59fd57a35539d39b1a

    UNION ALL
    -- Repartido v1: data = [pot]
    SELECT date_trunc('day', block_time), 'repartido',
           CAST(bytearray_to_uint256(bytearray_substring(data, 1, 32)) AS double) / 1e6
    FROM celo.logs
    WHERE contract_address = 0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09
      AND topic0 = 0xa9953c4665f907098109ba233d01760f37b4cde3683e1d5d27044a7d2166b658

    UNION ALL
    -- Cobrado (Claimed de ambos contratos). data = [amount] en las dos versiones
    SELECT date_trunc('day', block_time), 'cobrado',
           CAST(bytearray_to_uint256(bytearray_substring(data, 1, 32)) AS double) / 1e6
    FROM celo.logs
    WHERE contract_address IN (
            0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09,
            0xadca9a707f394509c8aa906b89b93cb222f2bebe)
      AND topic0 IN (
            0x4ef771089e4b5ef47e7c1aef7d8253a52d84d64338be1765c1b6e8ed34cb14c1,
            0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026)
)
SELECT dia, concepto, round(sum(usdt), 4) AS usdt
FROM mov
GROUP BY 1, 2
ORDER BY 1, 2
```

## Q6 — Tasa de reclamo por nivel

Si sale baja, acabas de encontrar un bug de producto gratis: gente que ganó y
nunca cobró. **Visualización:** tabla o barras.

```sql
-- Frontle · ¿los ganadores cobran?
WITH ganadores AS (
    -- v2, difícil: 1ª palabra del data
    SELECT bytearray_to_uint256(topic1) AS dia, 'dificil' AS nivel,
           bytearray_substring(data, 13, 20) AS ganador
    FROM celo.logs
    WHERE contract_address = 0xadca9a707f394509c8aa906b89b93cb222f2bebe
      AND topic0 = 0xfc068a16c2d502efabe6173a9256e4a335af217a85f91f59fd57a35539d39b1a

    UNION ALL
    -- v2, medio: 2ª palabra
    SELECT bytearray_to_uint256(topic1), 'medio', bytearray_substring(data, 45, 20)
    FROM celo.logs
    WHERE contract_address = 0xadca9a707f394509c8aa906b89b93cb222f2bebe
      AND topic0 = 0xfc068a16c2d502efabe6173a9256e4a335af217a85f91f59fd57a35539d39b1a

    UNION ALL
    -- v2, fácil: 3ª palabra
    SELECT bytearray_to_uint256(topic1), 'facil', bytearray_substring(data, 77, 20)
    FROM celo.logs
    WHERE contract_address = 0xadca9a707f394509c8aa906b89b93cb222f2bebe
      AND topic0 = 0xfc068a16c2d502efabe6173a9256e4a335af217a85f91f59fd57a35539d39b1a

    UNION ALL
    -- v1: ganador único, sin niveles
    SELECT bytearray_to_uint256(topic1), 'v1', bytearray_substring(topic2, 13, 20)
    FROM celo.logs
    WHERE contract_address = 0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09
      AND topic0 = 0xa9953c4665f907098109ba233d01760f37b4cde3683e1d5d27044a7d2166b658
),
cobros AS (
    SELECT bytearray_to_uint256(topic1) AS dia,
           CASE bytearray_to_uint256(topic2)
                WHEN 0 THEN 'facil' WHEN 1 THEN 'medio' ELSE 'dificil' END AS nivel,
           bytearray_substring(topic3, 13, 20) AS ganador
    FROM celo.logs
    WHERE contract_address = 0xadca9a707f394509c8aa906b89b93cb222f2bebe
      AND topic0 = 0x4ef771089e4b5ef47e7c1aef7d8253a52d84d64338be1765c1b6e8ed34cb14c1

    UNION ALL
    SELECT bytearray_to_uint256(topic1), 'v1', bytearray_substring(topic2, 13, 20)
    FROM celo.logs
    WHERE contract_address = 0x7ea1eeb96caf0b07e47354c349b8fdfc75b2fa09
      AND topic0 = 0x4ec90e965519d92681267467f775ada5bd214aa92c0dc93d90a5e880ce9ed026
)
SELECT
    coalesce(g.nivel, 'TOTAL')                                        AS nivel,
    count(*)                                                          AS premios_asignados,
    count_if(c.ganador IS NOT NULL)                                   AS cobrados,
    round(100.0 * count_if(c.ganador IS NOT NULL) / count(*), 1)      AS pct_cobro
FROM ganadores g
LEFT JOIN cobros c
       ON c.dia = g.dia AND c.nivel = g.nivel AND c.ganador = g.ganador
-- address(0) = ese nivel no tuvo ganador ese día; no es un premio sin cobrar
WHERE g.ganador != 0x0000000000000000000000000000000000000000
GROUP BY ROLLUP (g.nivel)
ORDER BY 1
```

---

## Después del dashboard

- Pega la URL pública en el submission de Proof of Ship, en el README y en
  `/stats` (ojo con el vocabulario prohibido de MiniPay en el texto del enlace:
  nada de "crypto"/"gas").
- Registra el v2 y el weekly como data sources en talent.app; deja el v1 para
  no perder el historial.
- Pendiente aparte: `onchain.ts` corta en `MAX_PAGES = 6` (300 tx por
  contrato). Cuando se supere, `uniqueUsers`, `volume` y `txMonth` pasan a ser
  pisos y no totales. Con estas queries publicadas, la API de Dune tras una
  ruta cacheada del lado servidor lo resuelve de raíz.
