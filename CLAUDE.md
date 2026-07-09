# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Frontle** — a daily geography game (inspired by Travle): given a *start* and *end* country, the player lists the intermediate countries that form a chain of shared land borders. Fewer countries = better score.

Built for **MiniPay** (Opera's wallet) on **Celo**. It is live on Celo Mainnet with real users and real money. It competes in **Proof of Ship** (Celo's monthly builder program) and is preparing a **MiniPay discovery listing** — the two goals that drive most decisions here.

## Monorepo layout

- `frontend/` — the Next.js app. The game runs client-side; it also talks straight to the contract and to Supabase.
- `contracts/` — **a real Foundry project**, not a placeholder. `src/FrontleGame.sol` is deployed and verified on Celo Mainnet (v1 and v2). `script/Deploy.s.sol` deploys it.
- `supabase/` — **this is the backend.** `functions/close-day` (rolls the day, picks winners) and `functions/welcome-bonus` (the faucet), plus `migrations/` for the schema.
- `backend/` — an empty placeholder from an early plan. Nothing lives here; don't add to it.

Most commands run inside `frontend/`.

## ⚠️ Next.js version

`frontend/AGENTS.md` carries a hard rule: this is **Next.js 16.2.9** with breaking changes vs. older versions you may know. **Before writing Next.js code, read the relevant guide in `frontend/node_modules/next/dist/docs/`** and heed deprecation notices — do not assume App Router conventions from training data.

## Commands

```bash
# frontend/
npm install
npm run dev                        # http://localhost:3000
npm run build
npm run lint                       # NOTE: already fails on main (react-hooks rules)
npx tsc --noEmit -p tsconfig.json  # this is the real gate; keep it at 0

# contracts/  (needs contracts/.env — gitignored)
forge build
forge verify-contract <addr> src/FrontleGame.sol:FrontleGame --chain-id 42220 \
  --verifier etherscan --verifier-url "https://api.etherscan.io/v2/api?chainid=42220"
```

There is no test suite. `npm run lint` reports pre-existing errors — don't read a clean lint as a gate, and don't be alarmed by them; use the typecheck and the build.

Testing inside MiniPay requires a **physical device + ngrok** (emulators don't work). `isMiniPay()` is always `false` in a normal browser, so anything gated on it is untestable locally.

## Frontend architecture

App Router under `frontend/app/`. Game logic is pure and lives in `app/lib/`:

- **`lib/countries.ts`** — the border graph. Each country lists land-border `neighbors`; the graph is symmetrized at build time (if A→B exists, B→A is added). Island nations with no land border are excluded (no chains possible). ISO alpha-2 codes are *derived from the flag emoji* (`flagToCode`), not hand-typed.
- **`lib/game.ts`** — core engine: `shortestPath` (BFS over the graph), `dailyChallenge`/`dateSeed` (deterministic per UTC date — everyone gets the same challenge), input handling (`normalize`, `resolveCountry`, alias table, `suggest`), and scoring (`distance`, `countryQuality`, `tryGuess`).
- **`lib/i18n.ts`** — 4 locales (`es`, `en`, `fr`, `pt`) for Celo/MiniPay markets. Country names come from the native `Intl.DisplayNames` keyed off the ISO code — **never hand-translate country names.** `countryName()` takes a canonical name, `regionName()` takes an ISO code. `t(locale)` returns the UI string dictionary.
- **`lib/payments.ts`** — everything on-chain: `requestPayment` (hints/retries), prize claims, balances, and `getPublicStats` / `CONTRACT_INFO` for the stats page. Holds both contract addresses.
- **`lib/ranking.ts`** — Supabase REST (anon key, client-side). Daily ranking plus the aggregate views behind `/stats`.
- **`lib/minipay.ts`** — `isMiniPay()` and the Add Cash deeplink. Read the rules below before touching UI that uses it.
- **`lib/privy.ts` + `components/PrivyGate.tsx`** — email login for players with no wallet. See the bundle note below.
- **`lib/onchain.ts`** — tx counts / unique wallets / failure rate, read from the public Blockscout API.
- **`app/components/WorldMap.tsx`** — map rendering with `d3-geo` + `topojson-client`.
- **`app/page.tsx`** — the game UI and nearly all React state.
- **`app/stats/`** — the public stats page. Required for the MiniPay listing.
- **`app/lib/regions/` + `lib/regionGame.ts`** — the in-progress "Regions" mode (subdivisions instead of countries). Data, engine and maps exist; the UI does not. Nothing imports `regionGame.ts` yet, so it ships as dead code. Work on it happens on the `feat/regiones` branch — see `docs/HANDOFF-REGIONS.md`.

Stack: TypeScript · Tailwind CSS v4 · `viem` for the chain · `@privy-io/react-auth` for email login. Deploys to Vercel from GitHub. (`@celo/abis` is a dependency but nothing imports it.)

## MiniPay rules that constrain the code

These are enforced at listing review. Breaking them is not a style issue.

- **Never show the CELO token** anywhere a user can see it — no balances, no selectors, no copy. Fees are paid in the stablecoin via CIP-64 fee abstraction. `payments.ts` still *reads* the CELO balance for the embedded wallet's pre-flight check; that's fine, just never render it.
- **Banned words in user-facing strings**: "gas" (say *network fee*), "onramp"/"buy crypto" (say *deposit*), "offramp"/"sell crypto" (say *withdraw*), "crypto" (say *stablecoin*). Code identifiers and RPC method names keep their real names.
- **Zero-click connect**: no "Connect wallet" button when `isMiniPay()`. Never show a raw `0x…` address as the primary identity — use the alias, or the truncated form as a secondary hint.
- **Low balance sends the user to the Add Cash deeplink**, not to a dead-end error.
- **Initial JS must stay under 2 MB per route.** This is why `PrivyGate` is loaded with `next/dynamic({ssr:false})` and only mounts *after* `isMiniPay()` resolves — the SDK is ~1.27 MB and is useless inside MiniPay. Mounting it on the first render would download the chunk anyway. If you add a heavy dependency, measure `/` before and after.
- **Images must be SVG or WebP.**

The `celopedia-skill` (`.agents/skills/celopedia-skill/`) is the source of truth here; `references/minipay-requirements.md` has the full checklist.

## Gotchas that have bitten before

- **Two different "day" numbers.** `scores.day` in Supabase is `YYYYMMDD` (e.g. `20260709`). The contract's `currentDay()` counts days since the Unix epoch (e.g. `20643`). They are not interchangeable; converting is on you.
- **Two contracts, both live.** v2 (levels, prize per level) takes all payments; v1 (single winner) is history but still holds its own numbers. `/stats` sums both. v1 has no `prize()` — its winner took `pot(day)` whole.
- **`balanceOf(contract)` is not the prize pool.** It includes `protocolAccrued()`, the platform's cut. Subtract it before calling anything "player funds".
- **`toLocaleString(locale, {style:"percent"})` returns `"45 %"` in Spanish**, with a non-breaking space. It is not a valid CSS width.

## Conventions

- Code comments and game-facing copy are in **Spanish**; keep that style when editing existing files.
- Adding a country means editing `lib/countries.ts` only — names localize and the graph symmetrizes automatically; just supply the correct flag emoji.
- Commit messages are in Spanish, `type(scope): summary`. Small, frequent commits: days-with-commits is a scored Proof of Ship metric.

## Where the real numbers live

`NIVELES.md` has the deployed addresses (v1, v2, USDT, the feeCurrency adapter, the operator), the Supabase project ref, and the Talent App project id. `contracts/README.md` has the token/chain reference. `docs/ROADMAP.md` has the Proof of Ship and listing strategy — but treat its program dates and eligibility claims as unverified; they conflict with `celopedia-skill/references/proof-of-ship.md`.
