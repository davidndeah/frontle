# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Frontle** — a daily geography game (inspired by Travle): given a *start* and *end* country, the player lists the intermediate countries that form a chain of shared land borders. Fewer countries = better score. Built for **MiniPay** (Opera's wallet) on **Celo** for an onchain-agents hackathon. Demo Day: 2026-06-19.

## Monorepo layout

Three layers, deliberately separated even though only one is live:

- `frontend/` — **the only active code.** Next.js app; runs the whole game client-side today.
- `backend/` — README-only placeholder. Server logic (daily-challenge seeding, leaderboard, anti-cheat) is planned but unbuilt. Likely lands as Next.js API routes (`frontend/app/api/...`) before a dedicated server.
- `contracts/` — README-only placeholder. Foundry Celo contracts for paid attempts/hints, not yet `forge init`'d.

All commands below run inside `frontend/`.

## ⚠️ Next.js version

`frontend/AGENTS.md` carries a hard rule: this is **Next.js 16.2.9** with breaking changes vs. older versions you may know. **Before writing Next.js code, read the relevant guide in `frontend/node_modules/next/dist/docs/`** and heed deprecation notices — do not assume App Router conventions from training data.

## Commands (from `frontend/`)

```bash
npm install
npm run dev      # next dev — http://localhost:3000
npm run build    # next build
npm run lint     # eslint
```

There is no test suite. Testing inside MiniPay requires a **physical device + ngrok** (emulators don't work).

## Frontend architecture

App Router under `frontend/app/`. Game logic is pure and lives in `app/lib/`:

- **`lib/countries.ts`** — the border graph. Each country lists land-border `neighbors`; the graph is symmetrized at build time (if A→B exists, B→A is added). Island nations with no land border are excluded (no chains possible). ISO alpha-2 codes are *derived from the flag emoji* (`flagToCode`), not hand-typed.
- **`lib/game.ts`** — core engine: `shortestPath` (BFS over the graph), `dailyChallenge`/`dateSeed` (deterministic per UTC date — everyone gets the same challenge), input handling (`normalize`, `resolveCountry`, alias table, `suggest`), and scoring (`distance`, `countryQuality`, `tryGuess`).
- **`lib/i18n.ts`** — 4 locales (`es`, `en`, `fr`, `pt`) for Celo/MiniPay markets. Country names are translated via the native `Intl.DisplayNames` keyed off the derived ISO code — **never hand-translate country names.** `t(locale)` returns the UI string dictionary.
- **`app/components/WorldMap.tsx`** — map rendering with `d3-geo` + `topojson-client`.
- **`app/page.tsx`** — the game UI and all React state (challenge, chain, input, suggestions, locale).

Stack: TypeScript · Tailwind CSS v4 · `viem` + `@celo/abis` for the (planned) onchain layer. Wallet model is MiniPay's injected `window.ethereum` — no wallet-connection libraries. Deploys to Vercel from GitHub.

## Conventions

- Code comments and game-facing copy are in **Spanish**; keep that style when editing existing files.
- Adding a country means editing `lib/countries.ts` only — names localize and the graph symmetrizes automatically; just supply the correct flag emoji.

## Celo / contracts reference

When the blockchain layer is built, `contracts/README.md` holds the token addresses (USDm/cUSD, USDC, COPm), the USDC `feeCurrency` adapter, and chain IDs (Sepolia `11142220`, Mainnet `42220`). Read it before touching payments.
