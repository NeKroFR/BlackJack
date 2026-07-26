# Blackjack Trainer

A free, offline-first web app for training card counting and basic strategy. The advice isn't a
memorized chart. It's the actual EV, computed from the current shoe by a composition-aware engine.
Everything runs client-side: no accounts, no backend, installable as a PWA and usable offline.

## Features

- **Exact EV engine**: composition-dependent stand/hit/double/split/surrender/insurance math.
  Reproduces the canonical Wizard-of-Odds 6-deck S17 DAS basic-strategy chart and a ~0.33% house
  edge for the default rules.
- **Five training modes**
  - **Count drill**: single-card flash, deal-down-the-shoe, grouped flashes, and multi-player
    table pacing with "call the true count" checks.
  - **Strategy trainer**: random hands vs. the upcard from the live shoe. Instant verdict with the EV
    explanation. Focus filters (pairs / soft / stiffs / surrender) and spaced repetition.
  - **Deviations trainer**: Illustrious 18 / Fab 4 index flashcards and an insurance drill.
  - **Live game**: full felt table, other seats, place bets, keep your own count, insurance
    offers, penetration/cut-card, and post-hand feedback.
  - **Betting sim**: configure a spread, run a seeded Monte-Carlo, and see bankroll percentiles,
    risk-of-ruin, N0, and EV/hour.
- **Reference**: interactive, rule-aware colour-coded basic-strategy and index charts.
- **Multiple counting systems**: Hi-Lo, KO, Wong Halves, Omega II, Zen.
- **Progression**: guided curriculum, stats with trends, and a reviewable mistake log.
- **Polish**: synthesized Web Audio cues (no asset files), tasteful CSS/WAAPI motion that respects
  `prefers-reduced-motion`, light + dark themes, and a colour-blind-safe palette.
- **Private**: all state lives in `localStorage`. Export/import as JSON.

## Tech

React 19 + TypeScript (strict) · Vite 6 · Tailwind CSS v4 · Zustand v5 · React Router v7 ·
Vitest · vite-plugin-pwa. The heavy EV solver and Monte-Carlo run in a Web Worker so the UI stays
at 60fps.

## Develop

```bash
npm install
npm run dev        # start the dev server
npm test           # run the full test suite
npm run typecheck  # tsc --noEmit
npm run build      # type-check + production build to dist/
npm run preview    # preview the production build locally
```

### App icons

The maskable PWA icons in `public/` are generated deterministically from the spade emblem. No
binary art is hand-maintained. Regenerate them with:

```bash
node scripts/gen-icons.mjs   # renders public/pwa-192.png and public/pwa-512.png via headless chromium
```

## Deploy (free, GitHub Pages)

The app uses **hash-based routing** and a **relative base** (`base: './'` in `vite.config.ts`), so
it works on a GitHub Pages project site with zero server rewrite config.

1. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds `dist/` and publishes it.
2. In the repository, go to **Settings → Pages → Build and deployment** and set **Source** to
   **GitHub Actions** (one-time).
3. Each push to `main` redeploys automatically. The live URL appears in the workflow's *deploy*
   job summary.

The committed PNG icons mean CI needs no browser download. The build is just `npm ci && npm run build`.
