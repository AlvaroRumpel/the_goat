# The GOAT

[![CI](https://github.com/AlvaroRumpel/the_goat/actions/workflows/ci.yml/badge.svg)](https://github.com/AlvaroRumpel/the_goat/actions/workflows/ci.yml)

NBA career game that runs in the browser. You steal attributes from legends during the draft, each pick with a price, then play up to two decades of seasons in a 30-team league with awards, trades and playoffs. Retire and get a verdict on your legacy.

Free, no sign-up, saves in the browser. Portuguese and English. Play at [thegoatgame.app](https://thegoatgame.app).

Inspired by text career simulators, in particular the Brazilian football classic The Fenomeno.

## Modes

- Career: the full game. Eight attributes stolen from legends with visible values and prices, one re-roll.
- Arcade: every key moment is a minigame (play call, slingshot shot with rim physics, 1v1 defense). Execution moves the odds by up to 25 points; attributes decide the rest.
- GOAT: blind draft. Legend numbers and prices are hidden, no re-roll.

## How it is built

React 19, TypeScript and Vite. No backend. Deploys to Cloudflare Pages.

`src/engine/` is pure TypeScript: no React, no localStorage, no `Math.random`. All randomness comes from an injected seeded `Rng`, so a save can be replayed deterministically. Season formulas and verdict weights are treated as a contract: calibration changes constants, never the shape. The GOAT gate (legacy score of 1950 or more plus an iconic career) is a design decision, not a tuning knob.

Every user-visible string goes through i18n. The `pt.json` and `en.json` files are checked for key parity in tests.

No real NBA photos or logos. Names only.

## Tests

```bash
npm test                  # unit: engine, state, data (~30s)
npm run test:calibration  # distribution locks on season and verdict outcomes (~15min)
npm run test:all          # both
node tests/e2e-playthrough.mjs   # full playthrough with Playwright
```

41 test files with vitest. Run `npm test` and `npx tsc -p tsconfig.app.json --noEmit` before committing. If you touched a constant in `season.ts` or `verdict.ts`, or anything that consumes the RNG, run the calibration project too.

## Develop and deploy

```bash
npm install
npm run dev
npm run build && npx wrangler pages deploy dist --project-name=the-goat --branch=master
```

`HANDOFF.md` has the current state, architecture, locked decisions and backlog. `docs/DESIGN.md` has the visual design.
