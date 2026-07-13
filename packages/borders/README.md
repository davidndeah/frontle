# @frontle/borders

The pure geography engine behind [Frontle](https://frontle.vercel.app) — a daily
"connect two countries through their land borders" game built for MiniPay on Celo.

Zero dependencies. Works in the browser, Node, and edge runtimes.

- **Country land-border graph** (symmetric, verified) for 150+ countries.
- **`shortestPath` / `distance`** via BFS.
- **Deterministic daily challenge** — same date → same puzzle for everyone.
- **Guess evaluation** (Travle-style: a guess is valid if it borders *any* known
  country) with a green/yellow/red quality signal, and victory when start and end
  connect through known countries.

## Install

```bash
npm i @frontle/borders
```

## Usage

```ts
import {
  dailyChallenge, tryGuess, resolveCountry, connectsThroughKnown,
} from "@frontle/borders";

// Today's puzzle (deterministic by UTC date):
const challenge = dailyChallenge();
// → { start: "Portugal", end: "Germany", optimal: 2, path: [...], level: "medium" }

// A running game state:
let state = { challenge, chain: [], solved: false };

// The player types a country (any language name → canonical via resolveCountry):
const guess = resolveCountry("españa"); // → "Spain"
const result = tryGuess(state, "españa", guess);
// → { ok: true, solved: false, quality: "green", country: "Spain", ... }
```

## API

| Export | What it does |
|--------|--------------|
| `shortestPath(a, b)` | Shortest border path, or `null` if unconnected |
| `distance(a, b)` | Hops between two countries (`Infinity` if none) |
| `dailyChallenge(seed?, level?)` | Deterministic challenge for a day/level |
| `dailyChallenges(seed?)` | One challenge per difficulty |
| `randomChallenge(level?)` | A random challenge (for practice) |
| `tryGuess(state, raw, canonical)` | Validate + evaluate a guess |
| `countryQuality(c, start, end)` | `"green" \| "yellow" \| "red"` |
| `connectsThroughKnown(start, end, known)` | Victory check |
| `nextHintCountry(state)` | Next country on an optimal path |
| `resolveCountry(input)` | Canonical name from fuzzy/aliased input |
| `suggest(input, limit?)` | Autocomplete suggestions |
| `COUNTRIES`, `COUNTRY_NAMES`, `getCountry`, `areNeighbors` | The graph |

## License

MIT © Frontle
