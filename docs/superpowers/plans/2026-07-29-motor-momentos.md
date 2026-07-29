# Motor de Momentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jogos assistidos com decisões atributo+dado: 3-4 jogos-chave na regular, playoffs com jogo pivotal por série, finais best-of-7 real, momentos icônicos no score.

**Architecture:** Novo `src/engine/moments.ts` (momento/jogo assistido com contagem FIXA de rng calls — skip ≡ assistido no stream) e `src/engine/playoffs.ts` (bracket por rodadas com série do jogador pausável). `state.ts` ganha fases `keyGame`/`playoffGame` com estado pendente retomável (save v4). Awards passam a rodar ANTES dos playoffs (não dependem de bracket). Harness ganha políticas `auto`/`bold`.

**Tech Stack:** React 19 + TS + vitest. Sem libs novas.

## Global Constraints

- `src/engine/` puro: sem React, sem localStorage, sem `Math.random` — só `Rng` injetado, calls contadas no fluxo do reducer.
- **CONTRATO SKIP≡ASSISTIDO:** cada jogo assistido consome EXATAMENTE 10 rng calls (1 baseMargin + 3 makeMoments + 3×2 resolveMoment), assistindo ou pulando, qualquer opção escolhida. `resolveMoment` consome exatamente 2 calls SEMPRE (sucesso + lesão, o roll de lesão é consumido mesmo sem injuryRisk). Teste trava isso.
- NUNCA `rng.*` em comparator de sort.
- Fórmulas-contrato intocadas: `computeWinPct`/`computeTitleProb` (deltas de jogos-chave aplicados FORA, no state), `simRegularSeason` stats, GOAT gate do `verdict.ts`.
- Travas do harness com política `auto` DEVEM seguir verdes: 83 ringsMedian ≤ 2 e legendRate < 0.15; 95 legendRate > 0.2 e mvpRate > 0.5; 79 peakPpg 12-19 e royRate < 0.8; 99 peakPpg 26-34 e goatRate < 0.02. Baseline de referência: `docs/superpowers/plans/2026-07-28-calibracao-baseline-liga.md` (números finais pós-A).
- Toda string de UI via i18n pt+en (paridade testada). Sem fotos/logos.
- Save v4 `thegoat:v4`; v1/v2/v3 removidos no load.
- Antes de cada commit: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`. Vitest pode dar "no tests" espúrio na 1ª run — re-rodar.

---

### Task 1: Tipos + save v4

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/season.ts` (finishSeason preenche campos novos)
- Modify: `src/state.ts` (STORAGE_KEY, loadState)
- Test: `tests/engine/moment-types.test.ts`

**Interfaces:**
- Produces (todas as tasks dependem):

```ts
export type MomentRisk = 'safe' | 'bold' | 'reckless'

export interface MomentOption {
  id: string                 // 'safePass' | 'boldThree' | 'attackRim' | 'playHurt' | ...
  attr: SlotId
  attr2?: SlotId             // mix opcional (ex.: three + clutch)
  risk: MomentRisk
  injuryRisk?: number        // só em opções que ANUNCIAM risco (spec §1)
}

export interface Moment {
  id: string                 // 'q2tactic' | 'q4pressure' | 'clutch'
  situationKey: string       // chave i18n: 'moment.q2tactic.desc' etc.
  params: Record<string, string | number>   // { opp: 'BOS', diff: 4 }
  options: MomentOption[]    // 2-3
}

export type WatchedGameKind = 'rivalry' | 'seedRace' | 'special' | 'playoff' | 'finals'

export interface WatchedGameContext {
  kind: WatchedGameKind
  opponentTeamId: string
  round?: PlayoffRun         // contexto de playoffs
  seriesUs?: number          // placar da série antes deste jogo
  seriesThem?: number
  gameNumber?: number        // 1-7 nas finais
  elimination?: boolean      // derrota elimina (ou vitória fecha) — para icônicos/choke
}

export interface MomentOutcome {
  momentId: string
  optionId: string
  success: boolean
  injury: boolean
  delta: number              // contribuição ao margin
}

export type IconicMomentId =
  | 'finalsBuzzer' | 'seriesWinner' | 'closeout45' | 'fluGame'
  | 'comeback' | 'bigNight' | 'rivalWinner' | 'sweep'

export interface WatchedGameResult {
  won: boolean
  margin: number             // >0 = vitória
  playerPts: number
  outcomes: MomentOutcome[]
  injured: boolean           // lesão ocorreu neste jogo
  choke: boolean             // falhou clutch em jogo de eliminação
  iconics: IconicMomentId[]  // detectados neste jogo (sweep é detectado na série, fora daqui)
}

export interface PendingGame {
  context: WatchedGameContext
  moments: Moment[]          // 3, gerados no início do jogo
  momentIndex: number        // próximo momento a resolver (0-3)
  outcomes: MomentOutcome[]
  baseMargin: number         // rolado no início
}

export interface KeyGame { kind: WatchedGameKind; opponentTeamId: string }
```

Além disso: `SeasonResult` ganha `iconicMoments: IconicMomentId[]` e `chokes: number`; `Career` NÃO muda (agregação é no verdict). `finishSeason` (season.ts) ganha params `iconicMoments: IconicMomentId[]` e `chokes: number` e os repassa ao retorno. `state.ts`: `STORAGE_KEY = 'thegoat:v4'`; `loadState` remove `'thegoat:v3'` também (v1/v2 já removidos).

- [ ] **Step 1: Teste que falha**

```ts
// tests/engine/moment-types.test.ts
import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { finishSeason, simRegularSeason } from '../../src/engine/season'
import { teamById } from '../../src/data/teams'
import { SLOT_ORDER, type Build, type SlotId } from '../../src/engine/types'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})

test('finishSeason carrega iconicMoments e chokes', () => {
  const rng = createRng(1)
  const regular = simRegularSeason({
    build: build(90), age: 27, team: teamById('okc'), profile: 'contender',
    focus: 'scoring', rng, canTrade: false, events: [], choices: [],
  })
  const s = finishSeason({
    regular, finalTeamId: 'okc', build: build(90), rng, winPct: 0.7,
    seed: 1, playoffRun: 'champion', wonTitle: true, extraAwards: [],
    iconicMoments: ['finalsBuzzer', 'sweep'], chokes: 1,
  })
  expect(s.iconicMoments).toEqual(['finalsBuzzer', 'sweep'])
  expect(s.chokes).toBe(1)
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/engine/moment-types.test.ts`

- [ ] **Step 3: Implementar** — tipos acima em `types.ts`; `finishSeason` ganha os 2 params e os inclui no retorno; `state.ts`: bump da key + `localStorage.removeItem('thegoat:v3')` no load. Call sites existentes de `finishSeason` (state.ts, calibration.test.ts, verdict.test.ts, season.test.ts) passam `iconicMoments: [], chokes: 0`.

- [ ] **Step 4: Rodar suite inteira** — `npm test` + `npx tsc -p tsconfig.app.json --noEmit` verdes.

- [ ] **Step 5: Commit** — `git commit -m "feat: tipos do motor de momentos + save v4"`

---

### Task 2: Motor de momentos (`src/engine/moments.ts`)

**Files:**
- Create: `src/engine/moments.ts`
- Test: `tests/engine/moments.test.ts`

**Interfaces:**
- Consumes: `ageMultiplier`, `effectiveOverall` de season.ts; tipos da Task 1.
- Produces:

```ts
export const GAME_RNG_CALLS = 10   // contrato: 1 baseMargin + 3 makeMoments + 3×2 resolveMoment

export function makeMoments(context: WatchedGameContext, rng: Rng): Moment[]
// exatamente 3 momentos (q2tactic, q4pressure, clutch), exatamente 3 rng calls
// (1 por momento: variação da situação/params). Opções fixas por momento (catálogo).

export function resolveMoment(build: Build, age: number, option: MomentOption, rng: Rng):
  { success: boolean; injury: boolean; delta: number }
// exatamente 2 rng calls SEMPRE (roll de sucesso + roll de lesão, consumido mesmo sem injuryRisk)

export function defaultOption(m: Moment): MomentOption   // a opção 'safe' (ou a 1ª)

export function startWatchedGame(input: {
  context: WatchedGameContext; ourStrength: number; oppStrength: number; rng: Rng
}): PendingGame
// exatamente 4 rng calls: 1 baseMargin + makeMoments(3)

export function applyMoment(pending: PendingGame, option: MomentOption, build: Build, age: number, rng: Rng): PendingGame
// 2 calls; incrementa momentIndex, acumula outcome

export function autoResolveGame(pending: PendingGame, build: Build, age: number, rng: Rng): PendingGame
// resolve os momentos RESTANTES com defaultOption — mesmas calls que o caminho assistido

export function finishWatchedGame(pending: PendingGame, build: Build, age: number): WatchedGameResult
// 0 calls — puro: margin = baseMargin + Σ deltas; playerPts/iconics/choke derivados
```

- [ ] **Step 1: Testes que falham**

```ts
// tests/engine/moments.test.ts
import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import {
  GAME_RNG_CALLS, applyMoment, autoResolveGame, defaultOption, finishWatchedGame,
  makeMoments, resolveMoment, startWatchedGame,
} from '../../src/engine/moments'
import { SLOT_ORDER, type Build, type SlotId, type WatchedGameContext } from '../../src/engine/types'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const ctx: WatchedGameContext = { kind: 'rivalry', opponentTeamId: 'bos' }

function countedRng(seed: number) {
  const inner = createRng(seed)
  let n = 0
  const rng = {
    next: () => { n++; return inner.next() },
    int: (a: number, b: number) => a + Math.floor((n++, inner.next()) * (b - a + 1)),
    pick: <T,>(arr: T[]) => arr[Math.floor((n++, inner.next()) * arr.length)],
    chance: (p: number) => (n++, inner.next()) < p,
  }
  return { rng, calls: () => n }
}

describe('contrato de rng calls', () => {
  test('jogo completo assistido = exatamente GAME_RNG_CALLS', () => {
    const { rng, calls } = countedRng(1)
    let g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, rng })
    expect(calls()).toBe(4)
    for (let i = 0; i < 3; i++) g = applyMoment(g, g.moments[g.momentIndex].options[0], build(90), 27, rng)
    expect(calls()).toBe(GAME_RNG_CALLS)
    expect(g.momentIndex).toBe(3)
  })
  test('skip consome as MESMAS calls que assistido', () => {
    const a = countedRng(7)
    let ga = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, rng: a.rng })
    ga = autoResolveGame(ga, build(90), 27, a.rng)
    const b = countedRng(7)
    let gb = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, rng: b.rng })
    for (let i = 0; i < 3; i++) gb = applyMoment(gb, gb.moments[gb.momentIndex].options[1] ?? gb.moments[gb.momentIndex].options[0], build(90), 27, b.rng)
    expect(a.calls()).toBe(GAME_RNG_CALLS)
    expect(b.calls()).toBe(GAME_RNG_CALLS)   // opção diferente, mesmo nº de calls
  })
  test('resolveMoment = exatamente 2 calls, com ou sem injuryRisk', () => {
    const a = countedRng(3)
    resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, a.rng)
    expect(a.calls()).toBe(2)
    const b = countedRng(3)
    resolveMoment(build(80), 27, { id: 'y', attr: 'physical', risk: 'reckless', injuryRisk: 0.1 }, b.rng)
    expect(b.calls()).toBe(2)
  })
})

describe('resolução', () => {
  test('atributo alto = mais sucesso (estatístico)', () => {
    let hi = 0, lo = 0
    for (let i = 0; i < 300; i++) {
      const { rng: r1 } = countedRng(1000 + i)
      if (resolveMoment(build(95), 27, { id: 'x', attr: 'three', risk: 'bold' }, r1).success) hi++
      const { rng: r2 } = countedRng(1000 + i)
      if (resolveMoment(build(65), 27, { id: 'x', attr: 'three', risk: 'bold' }, r2).success) lo++
    }
    expect(hi).toBeGreaterThan(lo + 50)
  })
  test('safe > bold > reckless em prob; reckless > bold > safe em delta', () => {
    let s = 0, b = 0, r = 0
    for (let i = 0; i < 300; i++) {
      const mk = () => countedRng(2000 + i).rng
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, mk()).success) s++
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'bold' }, mk()).success) b++
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'reckless' }, mk()).success) r++
    }
    expect(s).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(r)
    const dS = resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, countedRng(1).rng)
    const dR = resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'reckless' }, countedRng(1).rng)
    expect(Math.abs(dR.delta)).toBeGreaterThanOrEqual(Math.abs(dS.delta))
  })
  test('lesão só com injuryRisk e rara', () => {
    let inj = 0
    for (let i = 0; i < 500; i++) {
      const { rng } = countedRng(3000 + i)
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'physical', risk: 'reckless', injuryRisk: 0.08 }, rng).injury) inj++
    }
    expect(inj / 500).toBeGreaterThan(0.02)
    expect(inj / 500).toBeLessThan(0.15)
    const { rng } = countedRng(1)
    expect(resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, rng).injury).toBe(false)
  })
})

describe('jogo', () => {
  test('makeMoments: 3 momentos, ids na ordem, 2-3 opções cada', () => {
    const { rng, calls } = countedRng(5)
    const ms = makeMoments(ctx, rng)
    expect(calls()).toBe(3)
    expect(ms.map(m => m.id)).toEqual(['q2tactic', 'q4pressure', 'clutch'])
    for (const m of ms) {
      expect(m.options.length).toBeGreaterThanOrEqual(2)
      expect(m.options.some(o => o.risk === 'safe')).toBe(true)
    }
  })
  test('finishWatchedGame determinístico e coerente', () => {
    const { rng } = countedRng(9)
    let g = startWatchedGame({ context: ctx, ourStrength: 80, oppStrength: 70, rng })
    g = autoResolveGame(g, build(90), 27, rng)
    const r1 = finishWatchedGame(g, build(90), 27)
    const r2 = finishWatchedGame(g, build(90), 27)
    expect(r1).toEqual(r2)
    expect(r1.won).toBe(r1.margin > 0)
    expect(r1.playerPts).toBeGreaterThanOrEqual(6)
    expect(r1.playerPts).toBeLessThanOrEqual(65)
  })
  test('força importa: time muito superior vence mais (estatístico)', () => {
    let wins = 0
    for (let i = 0; i < 200; i++) {
      const { rng } = countedRng(4000 + i)
      let g = startWatchedGame({ context: ctx, ourStrength: 85, oppStrength: 55, rng })
      g = autoResolveGame(g, build(85), 27, rng)
      if (finishWatchedGame(g, build(85), 27).won) wins++
    }
    expect(wins / 200).toBeGreaterThan(0.7)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar**

```ts
// src/engine/moments.ts
import { ageMultiplier } from './season'
import type {
  Build, IconicMomentId, Moment, MomentOption, MomentOutcome, MomentRisk,
  PendingGame, Rng, WatchedGameContext, WatchedGameResult,
} from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const GAME_RNG_CALLS = 10

// Catálogo fixo de opções por momento (constantes calibráveis).
const MOMENT_OPTIONS: Record<string, MomentOption[]> = {
  q2tactic: [
    { id: 'feedHot', attr: 'passing', risk: 'safe' },
    { id: 'takeOver', attr: 'finishing', attr2: 'handles', risk: 'bold' },
  ],
  q4pressure: [
    { id: 'lockDefense', attr: 'defense', risk: 'safe' },
    { id: 'pushPace', attr: 'physical', attr2: 'finishing', risk: 'bold' },
    { id: 'playHurt', attr: 'physical', risk: 'reckless', injuryRisk: 0.08 },
  ],
  clutch: [
    { id: 'safePass', attr: 'passing', attr2: 'clutch', risk: 'safe' },
    { id: 'clutchThree', attr: 'three', attr2: 'clutch', risk: 'bold' },
    { id: 'attackRim', attr: 'finishing', attr2: 'clutch', risk: 'reckless' },
  ],
}

// prob base por risco + impacto por risco (constantes calibráveis)
const RISK = {
  safe: { base: 0.42, attrW: 0.005, hit: 4, miss: -2 },
  bold: { base: 0.28, attrW: 0.005, hit: 7, miss: -4 },
  reckless: { base: 0.16, attrW: 0.005, hit: 10, miss: -6 },
} as const satisfies Record<MomentRisk, { base: number; attrW: number; hit: number; miss: number }>

export function makeMoments(context: WatchedGameContext, rng: Rng): Moment[] {
  // 1 call por momento: variação leve do texto (index da variante 0-2)
  return (['q2tactic', 'q4pressure', 'clutch'] as const).map(id => ({
    id,
    situationKey: `moment.${id}.v${rng.int(0, 2)}`,
    params: { opp: context.opponentTeamId.toUpperCase() },
    options: MOMENT_OPTIONS[id],
  }))
}

export function defaultOption(m: Moment): MomentOption {
  return m.options.find(o => o.risk === 'safe') ?? m.options[0]
}

export function resolveMoment(
  build: Build, age: number, option: MomentOption, rng: Rng,
): { success: boolean; injury: boolean; delta: number } {
  const m = ageMultiplier(age, build.attributes.physical)
  const a1 = build.attributes[option.attr] * m
  const attr = option.attr2 ? 0.6 * a1 + 0.4 * build.attributes[option.attr2] * m : a1
  const cfg = RISK[option.risk]
  const p = clamp(cfg.base + (attr - 60) * cfg.attrW, 0.05, 0.95)
  const success = rng.chance(p)                          // call 1
  const injuryRoll = rng.next()                          // call 2 — SEMPRE consumido (contrato)
  const injury = option.injuryRisk !== undefined && injuryRoll < option.injuryRisk
  return { success, injury, delta: success ? cfg.hit : cfg.miss }
}

export function startWatchedGame(input: {
  context: WatchedGameContext; ourStrength: number; oppStrength: number; rng: Rng
}): PendingGame {
  const { context, ourStrength, oppStrength, rng } = input
  // 1 call: ruído do jogo; margem base = diferença de força + ruído
  const baseMargin = (ourStrength - oppStrength) * 0.45 + (rng.next() * 16 - 8)
  return { context, moments: makeMoments(context, rng), momentIndex: 0, outcomes: [], baseMargin }
}

export function applyMoment(
  pending: PendingGame, option: MomentOption, build: Build, age: number, rng: Rng,
): PendingGame {
  const moment = pending.moments[pending.momentIndex]
  const r = resolveMoment(build, age, option, rng)
  const outcome: MomentOutcome = {
    momentId: moment.id, optionId: option.id, success: r.success, injury: r.injury, delta: r.delta,
  }
  return { ...pending, momentIndex: pending.momentIndex + 1, outcomes: [...pending.outcomes, outcome] }
}

export function autoResolveGame(pending: PendingGame, build: Build, age: number, rng: Rng): PendingGame {
  let g = pending
  while (g.momentIndex < 3) g = applyMoment(g, defaultOption(g.moments[g.momentIndex]), build, age, rng)
  return g
}

export function finishWatchedGame(pending: PendingGame, build: Build, age: number): WatchedGameResult {
  const { context, outcomes, baseMargin } = pending
  const margin = Math.round(baseMargin + outcomes.reduce((n, o) => n + o.delta, 0))
  const won = margin > 0
  const m = ageMultiplier(age, build.attributes.physical)
  const expPts = clamp((build.overall * m - 50) * 0.6, 6, 34)
  const playerPts = Math.round(clamp(
    expPts + outcomes.filter(o => o.success).length * 7 - outcomes.filter(o => !o.success).length * 2
      + baseMargin / 8,
    6, 65,
  ))
  const injured = outcomes.some(o => o.injury)
  const clutchOutcome = outcomes[2]
  const choke = context.elimination === true && clutchOutcome !== undefined && !clutchOutcome.success && !won

  const iconics: IconicMomentId[] = []
  const clutchWinner = clutchOutcome?.success === true && won && margin <= 4
  if (clutchWinner && context.kind === 'finals') iconics.push('finalsBuzzer')
  else if (clutchWinner && context.kind === 'playoff' && context.elimination) iconics.push('seriesWinner')
  else if (clutchWinner && context.kind === 'rivalry') iconics.push('rivalWinner')
  if (won && context.elimination && playerPts >= 45 && (context.kind === 'playoff' || context.kind === 'finals')) iconics.push('closeout45')
  if (won && outcomes.some(o => o.optionId === 'playHurt') && !injured) iconics.push('fluGame')
  if (won && baseMargin <= -15) iconics.push('comeback')
  if (playerPts >= 55 && (context.kind === 'rivalry' || context.kind === 'seedRace' || context.kind === 'special')) iconics.push('bigNight')

  return { won, margin, playerPts, outcomes, injured, choke, iconics }
}
```

- [ ] **Step 4: Rodar testes** — estatísticos guiam constantes RISK/baseMargin. Ajustar constantes, nunca contagem de calls.

- [ ] **Step 5: Commit** — `git commit -m "feat: motor de momentos com contrato de rng fixo"`

---

### Task 3: Verdict — icônicos com cap

**Files:**
- Modify: `src/engine/verdict.ts`
- Test: `tests/engine/verdict.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `SeasonResult.iconicMoments`/`chokes` (Task 1).
- Produces: `ICONIC_VALUES: Record<IconicMomentId, number>` exportado; score soma `min(100, Σ)`; `Verdict` ganha `iconicPoints: number` e `chokes: number` (para UI).

- [ ] **Step 1: Teste que falha**

```ts
test('icônicos pontuam com cap 100', () => {
  const base: SeasonResult = {
    age: 27, teamId: 'okc', finalTeamId: 'okc', games: 80, ppg: 25, rpg: 6, apg: 5,
    events: [], choices: [], madePlayoffs: true, wonTitle: false, seed: 1, playoffRun: 'finals',
    awards: [], iconicMoments: [], chokes: 0,
  }
  const one = computeVerdict({ seasons: [{ ...base, iconicMoments: ['finalsBuzzer'] }], fame: 0 })
  const none = computeVerdict({ seasons: [base], fame: 0 })
  expect(one.score - none.score).toBe(25)
  expect(one.iconicPoints).toBe(25)
  // cap: 6 buzzer-beaters = 150 brutos → 100
  const six = computeVerdict({
    seasons: Array.from({ length: 6 }, () => ({ ...base, iconicMoments: ['finalsBuzzer' as const] })), fame: 0,
  })
  const zero = computeVerdict({
    seasons: Array.from({ length: 6 }, () => base), fame: 0,
  })
  expect(six.score - zero.score).toBe(100)
  expect(six.chokes).toBe(0)
})
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar**

```ts
export const ICONIC_VALUES: Record<IconicMomentId, number> = {
  finalsBuzzer: 25, seriesWinner: 20, closeout45: 18, fluGame: 18,
  comeback: 15, bigNight: 12, rivalWinner: 12, sweep: 10,
}
```
No `computeVerdict`: acumular `iconicPoints = Math.min(100, Σ ICONIC_VALUES[id])` e `chokes = Σ s.chokes` no loop; `score += iconicPoints`; retorno ganha os 2 campos. Saves antigos não existem (v4) — `s.iconicMoments ?? []`/`s.chokes ?? 0` defensivo é aceitável no loop. GOAT gate e thresholds de tier INTOCADOS.

- [ ] **Step 4: Rodar suite inteira** — travas de calibração seguem verdes (política atual do harness não gera icônicos → zero impacto até a Task 8).

- [ ] **Step 5: Commit** — `git commit -m "feat: momentos icônicos pontuam no veredito (cap 100)"`

---

### Task 4: Seleção de jogos-chave

**Files:**
- Modify: `src/engine/moments.ts`
- Test: `tests/engine/keygames.test.ts`

**Interfaces:**
- Consumes: `rosterStrength` (league.ts), `TEAMS`/`teamById`, tipos.
- Produces:

```ts
export function selectKeyGames(input: {
  league: LeagueState
  playerTeamId: string
  prevStandings: TeamStanding[] | null   // seasonOutcome do ano anterior (null no ano 1)
  prevChampionTeamId: string | null      // leagueHistory último ano (null no ano 1)
  hasRivalryEvent: boolean
  rng: Rng
}): KeyGame[]   // 3 (ou 4 com rivalry event); rng calls FIXAS: exatamente 3 (1 por slot rotativo/desempate)
```

Regras (determinísticas, sem rng em sort):
- **rivalry:** time de MAIOR `rosterStrength` da MESMA conferência do jogador (≠ jogador). Desempate por ordem de TEAMS. 0 calls.
- **seedRace:** com prevStandings: time da mesma conf com wins mais próximos do time do jogador (≠ jogador, ≠ rivalry; desempate por ordem). Sem prevStandings (ano 1): time da mesma conf com `rosterStrength` mais próximo. 0 calls.
- **special:** `rng.int(0,2)` → 0: Christmas (time bigMarket de maior strength ≠ já escolhidos); 1: revenge (prevChampionTeamId se existir e ≠ jogador, senão cai no Christmas); 2: showcase (time de MAIOR strength da OUTRA conferência). 1 call.
- +2 calls fixas de "tempero" consumidas sempre (`rng.next()` ×2) para folga de variação futura — total exato 3 calls (trava no teste).
- **rivalry event ativo:** adiciona 4º jogo `{ kind: 'rivalry' }` contra o MESMO rivalry (revanche) — 0 calls extras.

- [ ] **Step 1: Teste que falha**

```ts
// tests/engine/keygames.test.ts
import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { selectKeyGames } from '../../src/engine/moments'
import { initLeague } from '../../src/data/league'
import { TEAMS } from '../../src/data/teams'

const league = initLeague()
function counted(seed: number) {
  const inner = createRng(seed); let n = 0
  return {
    rng: { next: () => (n++, inner.next()), int: (a: number, b: number) => a + Math.floor((n++, inner.next()) * (b - a + 1)), pick: <T,>(arr: T[]) => arr[Math.floor((n++, inner.next()) * arr.length)], chance: (p: number) => (n++, inner.next()) < p },
    calls: () => n,
  }
}

describe('selectKeyGames', () => {
  test('3 jogos sem rivalry event, 4 com; exatamente 3 rng calls', () => {
    const a = counted(1)
    const g3 = selectKeyGames({ league, playerTeamId: 'uta', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng: a.rng })
    expect(g3).toHaveLength(3)
    expect(a.calls()).toBe(3)
    const b = counted(1)
    const g4 = selectKeyGames({ league, playerTeamId: 'uta', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: true, rng: b.rng })
    expect(g4).toHaveLength(4)
    expect(b.calls()).toBe(3)
  })
  test('nunca joga contra si; oponentes distintos nos 3 primeiros', () => {
    for (let s = 0; s < 20; s++) {
      const { rng } = counted(100 + s)
      const games = selectKeyGames({ league, playerTeamId: 'okc', prevStandings: null, prevChampionTeamId: 'okc', hasRivalryEvent: false, rng })
      expect(games.every(g => g.opponentTeamId !== 'okc')).toBe(true)
      expect(new Set(games.slice(0, 3).map(g => g.opponentTeamId)).size).toBe(3)
    }
  })
  test('rivalry é da mesma conferência', () => {
    const { rng } = counted(5)
    const games = selectKeyGames({ league, playerTeamId: 'uta', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng })
    const conf = new Map(TEAMS.map(t => [t.id, t.conf]))
    expect(conf.get(games[0].opponentTeamId)).toBe('west')
  })
  test('determinístico por seed', () => {
    const a = selectKeyGames({ league, playerTeamId: 'lal', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng: counted(9).rng })
    const b = selectKeyGames({ league, playerTeamId: 'lal', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng: counted(9).rng })
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar** conforme regras acima (helper `strongestOf(teamIds, exclude)` com sort por strength pré-computada + ordem de TEAMS como desempate; `rng.next()` ×2 de folga no final; showcase/christmas caem para o próximo time mais forte se o escolhido já estiver na lista).

- [ ] **Step 4: Rodar testes + suite** — verdes.

- [ ] **Step 5: Commit** — `git commit -m "feat: seleção de jogos-chave da regular"`

---

### Task 5: Matemática de playoffs (`src/engine/playoffs.ts`)

**Files:**
- Create: `src/engine/playoffs.ts`
- Test: `tests/engine/playoffs-math.test.ts`

**Interfaces:**
- Consumes: `rosterStrength` (league.ts); tipos.
- Produces:

```ts
export const SERIES_SHIFT = 0.20   // deslocamento por resultado do jogo pivotal (calibrável)
export const PLAYER_OUT_MARGIN = -7 // penalidade de baseMargin com jogador lesionado (calibrável)

export function bo7WinProb(pGame: number): number
// P(vencer best-of-7) fechada: Σ_{k=0..3} C(3+k, k) × p^4 × (1−p)^k

export function pGameForSeries(pSeries: number): number
// inverso numérico de bo7WinProb (bisseção 60 iterações; puro, sem rng)

export interface BracketState {
  round: number              // 0=r1, 1=semi, 2=conf, 3=finals
  aliveEast: string[]        // ordenados por seed
  aliveWest: string[]
}
export function seedBracket(standings: TeamStanding[]): BracketState

export function npcRound(bs: BracketState, league: LeagueState, playerTeamId: string | null, rng: Rng): {
  next: BracketState; playerOpponent: string | null
}
// Resolve TODOS os pares NPC do round atual em ordem fixa (east na ordem de pares (1v8)(4v5)(3v6)(2v7), depois west),
// PULANDO o par do jogador. Retorna o oponente do jogador no round (null se player null).
// O par do jogador NÃO é resolvido — o chamador decide (jogo assistido + roll).
// round 3 (finals): aliveEast/aliveWest têm 1 cada; playerOpponent = o do outro lado.

export function advancePlayer(bs: BracketState, playerTeamId: string, rng: Rng): BracketState
// move o jogador para o próximo round (remove o oponente); puro exceto ordem

export function resolveRest(bs: BracketState, league: LeagueState, rng: Rng): string
// jogador já eliminado/ausente: resolve o resto do bracket NPC-only e retorna championTeamId
```

Prob NPC vs NPC por série: MESMA fórmula do simBracket atual (`clamp(0.5 + (sA − sB) × 0.03, 0.10, 0.90)`) — extrair helper compartilhado `npcSeriesProb(sA, sB)` e fazer `simBracket` (league.ts) usá-lo também (sem duplicação divergente). `simBracket` continua existindo para o caminho "jogador fora dos playoffs".

- [ ] **Step 1: Testes que falham**

```ts
// tests/engine/playoffs-math.test.ts
import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { bo7WinProb, npcRound, pGameForSeries, resolveRest, seedBracket } from '../../src/engine/playoffs'
import { simStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

const league = initLeague()

describe('bo7', () => {
  test('valores conhecidos', () => {
    expect(bo7WinProb(0.5)).toBeCloseTo(0.5, 10)
    expect(bo7WinProb(0.7)).toBeGreaterThan(0.87)
    expect(bo7WinProb(0)).toBe(0)
    expect(bo7WinProb(1)).toBe(1)
  })
  test('pGameForSeries inverte bo7WinProb', () => {
    for (const p of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      expect(bo7WinProb(pGameForSeries(p))).toBeCloseTo(p, 6)
    }
  })
})

describe('bracket por rodadas', () => {
  const rng = createRng(11)
  const standings = simStandings({ league, playerTeamId: 'den', playerWins: 55, rng })
  test('seedBracket: 8 por conferência', () => {
    const bs = seedBracket(standings)
    expect(bs.aliveEast).toHaveLength(8)
    expect(bs.aliveWest).toHaveLength(8)
    expect(bs.round).toBe(0)
  })
  test('npcRound preserva o jogador e reduz o resto pela metade', () => {
    const bs = seedBracket(standings)
    const denSeeded = bs.aliveWest.includes('den')
    if (!denSeeded) return   // seed 55 wins quase sempre classifica; guard para o raro
    const { next, playerOpponent } = npcRound(bs, league, 'den', createRng(12))
    expect(playerOpponent).not.toBeNull()
    expect(next.aliveWest).toContain('den')
    expect(next.aliveWest).toContain(playerOpponent!)
    expect(next.aliveEast).toHaveLength(4)   // east toda resolvida (4 vencedores)
    expect(next.aliveWest).toHaveLength(5)   // 3 vencedores NPC + jogador + oponente (par pendente)
    expect(next.round).toBe(bs.round)        // round só avança via advancePlayer/derrota
  })
  test('resolveRest devolve campeão entre os vivos', () => {
    const bs = seedBracket(standings)
    const champ = resolveRest(bs, league, createRng(13))
    expect([...bs.aliveEast, ...bs.aliveWest]).toContain(champ)
  })
})
```

Invariante do `npcRound` (documentar em comentário no código): pares NPC do round viram vencedores; o par do jogador fica intacto em `next` — lado do jogador termina com 3 vencedores + jogador + oponente = 5; `round` não avança aqui.

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar**

- `bo7WinProb`: forma fechada `p⁴ × Σ_{k=0..3} C(3+k,k) × (1−p)^k` com C(3,0)=1, C(4,1)=4, C(5,2)=10, C(6,3)=20.
- `pGameForSeries`: bisseção em [0.01, 0.99], 60 iterações.
- `seedBracket`: ordena seeds 1-8 por conferência a partir de standings.
- `npcRound`: pares por posição no array vivo `[0v7, 3v4, 2v5, 1v6]` (round 0; rounds seguintes `[0v1]`, `[0v1,2v3]` conforme tamanho), east primeiro, west depois, ordem fixa; par com o jogador é pulado e ambos permanecem em `next`; usa `npcSeriesProb(rosterStrength A, B)`; `playerOpponent` = o par pulado.
- `advancePlayer`: remove o oponente do array vivo do jogador.
- `resolveRest`: rounds sucessivos NPC-only até campeão (reusa npcRound com playerTeamId null + final cross-conference).
- Refactor `simBracket` (league.ts) para usar `npcSeriesProb` compartilhado — comportamento byte-idêntico (mesma fórmula, mesma ordem de calls; suite existente é a trava).

- [ ] **Step 4: Rodar testes + suite inteira** — verdes (incluindo travas de calibração — simBracket não muda de comportamento).

- [ ] **Step 5: Commit** — `git commit -m "feat: matemática de playoffs por rodadas (bo7, bracket pausável)"`

---

### Task 6: State — fase keyGame

**Files:**
- Modify: `src/state.ts`
- Test: `tests/state-keygame.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4.
- Produces (Tasks 7, 9 dependem):

```ts
// Phase += 'keyGame'
// GameState +=
pendingKeyGames: KeyGame[] | null      // fila restante (o jogo corrente já saiu da fila)
pendingGame: PendingGame | null
keyGameResults: WatchedGameResult[]    // da temporada corrente; zerado no início de cada PLAY_SEASON
// Action +=
| { type: 'DECIDE_MOMENT'; optionId: string }
| { type: 'SKIP_GAME' }
```

Fluxo: `PLAY_SEASON` → rollEvents → (eventDecision pausa, como hoje) → **startKeyGames**: `selectKeyGames` (usa `state.seasonOutcome?.standings` como prevStandings, `state.leagueHistory.at(-1)?.championTeamId`, `events.includes('rivalry')`) → inicia o 1º jogo (`startWatchedGame` com `rosterStrength` dos dois lados) → fase `keyGame`. `DECIDE_MOMENT` resolve 1 momento; `SKIP_GAME` auto-resolve o jogo corrente. Jogo completo (momentIndex 3) → `finishWatchedGame` acumula em `keyGameResults` → próximo da fila ou → `runSeasonSim` com os efeitos.

Efeitos em `runSeasonSim` (FORA das fórmulas-contrato):
```ts
const kg = state.keyGameResults
const winPctDelta = kg.reduce((n, r) => n + (r.won ? 0.01 : -0.01), 0)
const ppgDelta = clamp(kg.reduce((n, r) => n + r.outcomes.filter(o => o.success).length - r.outcomes.filter(o => !o.success).length, 0) * 0.1, -0.5, 0.5)
// winPct = clamp(winPct + winPctDelta, 0.15, 0.85) após computeWinPct
// regular.ppg = clamp(round((ppg + ppgDelta)*10)/10, 4, 38) após simRegularSeason
// lesão em jogo-chave: regular.games -= 10 por jogo com injured (mín 40); ppgDelta -1 adicional
```
Contexto de foco/eventos precisa atravessar a pausa: reusar `pendingFocus`/`pendingEvents` + novo `pendingChoices: EventChoice[] | null` (as choices resolvidas do eventDecision — hoje elas são consumidas na hora; com keyGame no meio, guardar).

Ordem de rng por dispatch (comentar no código): PLAY_SEASON: rollEvents → selectKeyGames(3) → startWatchedGame(4) → pausa. DECIDE_MOMENT/SKIP: applyMoment(2×N) → [próximo jogo: startWatchedGame(4)] → pausa ou runSeasonSim (fluxo A inalterado dali em diante).

- [ ] **Step 1: Testes que falham**

```ts
// tests/state-keygame.test.ts
import { describe, expect, test } from 'vitest'
import { gameReducer, initialState } from '../src/state'
import type { GameState } from '../src/state'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

function playToKeyGame(seed: number): GameState {
  let s = gameReducer(initialState(), { type: 'NEW_GAME', seed })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  return s
}

function finishSeasonFrom(s: GameState): GameState {
  let guard = 0
  while ((s.phase === 'keyGame' || s.phase === 'playoffGame') && guard++ < 60) {
    s = gameReducer(s, { type: 'SKIP_GAME' })
    if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
  }
  if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
  return s
}

describe('fase keyGame', () => {
  test('PLAY_SEASON entra em keyGame com jogo pendente', () => {
    const s = playToKeyGame(31)
    expect(s.phase).toBe('keyGame')
    expect(s.pendingGame).not.toBeNull()
    expect(s.pendingGame!.moments).toHaveLength(3)
    expect(s.pendingKeyGames!.length).toBeGreaterThanOrEqual(2)
  })
  test('DECIDE_MOMENT ×3 fecha o jogo e abre o próximo', () => {
    let s = playToKeyGame(32)
    const fila = s.pendingKeyGames!.length
    for (let i = 0; i < 3; i++) {
      const opt = s.pendingGame!.moments[s.pendingGame!.momentIndex].options[0]
      s = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: opt.id })
    }
    expect(s.keyGameResults).toHaveLength(1)
    expect(s.pendingKeyGames!.length).toBe(fila - 1)
  })
  test('SKIP_GAME até o fim chega em seasonResult (via playoffs se houver)', () => {
    let s = playToKeyGame(33)
    s = finishSeasonFrom(s)
    expect(s.phase).toBe('seasonResult')
    expect(s.keyGameResults.length).toBeGreaterThanOrEqual(3)
  })
  test('replay determinístico: decidir e pular são reprodutíveis', () => {
    const runA = finishSeasonFrom(playToKeyGame(34))
    const runB = finishSeasonFrom(playToKeyGame(34))
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB))
  })
  test('DECIDE_MOMENT com optionId inválido é no-op', () => {
    const s = playToKeyGame(35)
    const before = JSON.stringify(s)
    const after = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: 'nope' })
    expect(JSON.stringify(after)).toBe(before)
  })
})
```

Nota: `finishSeasonFrom` tolera fase `playoffGame` (Task 7); antes da Task 7, `runSeasonSim` segue direto pro fluxo antigo (bracket de uma vez) e o teste 3 passa sem playoffs pausáveis.

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar** conforme fluxo acima. `SKIP_GAME` na fila: auto-resolve APENAS o jogo corrente (próximo jogo abre pausado de novo — quem quer pular tudo aperta 3-4 vezes; a UI da Task 9 pode chamar SKIP_GAME em sequência). Guardar `pendingChoices` no eventDecision. Injuries de keyGame: aplicar em runSeasonSim como especificado.

- [ ] **Step 4: Rodar suite inteira** — testes existentes de state (`playToSeason` etc.) precisam atravessar keyGame: atualizar helpers com o loop de SKIP_GAME (preservando intenção). Travas de calibração intocadas (harness não usa o reducer).

- [ ] **Step 5: Commit** — `git commit -m "feat: fase keyGame no reducer"`

---

### Task 7: State — playoffs pausáveis + finais best-of-7

**Files:**
- Modify: `src/state.ts`
- Test: `tests/state-playoffs.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 5, 6.
- Produces:

```ts
// Phase += 'playoffGame'
// GameState +=
pendingPlayoffs: PendingPlayoffs | null
// state.ts (exportar para testes/UI):
export interface PendingPlayoffs {
  bracket: BracketState
  opponentTeamId: string
  seriesUs: number; seriesThem: number     // finals; 0-0 nos rounds de prob
  pGame: number                            // finals
  seriesProb: number                       // rounds 0-2 (base, sem shift)
  titleProb: number
  winPct: number
  seed: number
  playerOut: boolean
  chokes: number
  iconics: IconicMomentId[]
  regular: RegularSeasonResult
  finalOffer: Offer
  awards: { races: AwardRace[]; winners: Record<RaceAward, string | null>; playerAwards: Award[] }
  standings: TeamStanding[]
  lines: NpcLine[]
}
// Action +=
| { type: 'ADVANCE_GAME' }   // finals: da tela de série para o próximo jogo
| { type: 'SKIP_SERIES' }    // finals: auto-resolve os jogos restantes da série
```

**Reestruturação do `concludeSeason`:**
1. winPct final (+ deltas de keyGame), seed, clutchAdj, titleProb — como hoje.
2. **`simAwards` movido para ANTES dos playoffs** (não depende de bracket; winPct de regular).
3. Se `seed === null`: `simBracket` de uma vez com playerTeamId null (como hoje) → finishSeason (`playoffRun: 'missed'`) → seasonResult. Fluxo idêntico ao atual.
4. Se seed: `seedBracket` → `enterRound` (helper): `npcRound` resolve NPCs, oponente do jogador definido; rounds 0-2: `seriesProb = clamp(baseP × (1 − (oppStrength − 70) × 0.004), 0.05, 0.95)` com `baseP = titleProb^(1/4)` (MESMA fórmula do simBracket atual); finals: `pGame = pGameForSeries(seriesProb)`; `startWatchedGame` (context playoff/finals com `elimination` marcado quando aplicável: rounds 0-2 sempre true — jogo pivotal narrado como decisivo; finals: true quando `seriesThem === 3` ou fechando `seriesUs === 3`) → fase `playoffGame`.
5. `DECIDE_MOMENT`/`SKIP_GAME` em playoffGame: resolvem o jogo corrente (reusa handlers da Task 6 — mesmo código, o branch de conclusão difere por fase):
   - **Rounds 0-2:** jogo fecha → `shifted = clamp(seriesProb + (won ? +SERIES_SHIFT : −SERIES_SHIFT), 0.05, 0.95)` → `rng.chance(shifted)`: venceu → `advancePlayer` + próximo `enterRound` (ou finals); perdeu → eliminado: `resolveRest` → `finishPostseason`.
   - **Finals:** jogo fecha → seriesUs/Them atualizado (won ? us+1 : them+1); lesão no jogo (qualquer round de playoffs) → `playerOut = true` E `injuryProne = true` para a próxima temporada (spec §3 — reusa o campo existente; rollEvents já o consome) — jogos seguintes: `startWatchedGame` com `ourStrength + PLAYER_OUT_MARGIN` e auto-resolve imediato (sem decisões, jogador fora); 4 vitórias us → campeão (+ `sweep` icônico se 4-0); 4 them → derrota nas finais; senão → fase playoffGame com `pendingGame: null` (tela de série) aguardando `ADVANCE_GAME` (abre próximo jogo) ou `SKIP_SERIES` (loop auto até fechar).
6. `finishPostseason` (helper): championTeamId (jogador campeão OU `resolveRest`), playerRun do round alcançado (`round 0..2` perdido → 'r1'/'semi'/'conf'; finals perdidas → 'finals'; título → 'champion'), acumula iconics/chokes dos jogos de playoffs + keyGameResults da temporada, `finishSeason({ ..., iconicMoments, chokes })`, monta `seasonOutcome`, fase `seasonResult`, limpa pendings.
7. Ordem de rng POR DISPATCH comentada no código (contagem por jogo é fixa — GAME_RNG_CALLS — então replay fecha).

Icônicos de playoffs: os flags vêm de `finishWatchedGame`; `sweep` adicionado em finishPostseason quando finais 4-0. Choke: `choke` flag dos jogos (elimination + clutch falho + derrota).

- [ ] **Step 1: Testes que falham**

```ts
// tests/state-playoffs.test.ts
import { describe, expect, test } from 'vitest'
import { gameReducer, initialState } from '../src/state'
import type { GameState } from '../src/state'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

function newCareer(seed: number): GameState {
  let s = gameReducer(initialState(), { type: 'NEW_GAME', seed })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  return gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
}

function playSeasonAuto(s: GameState): GameState {
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 80) {
    if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'playoffGame') {
      s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
    }
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else break
  }
  return s
}

describe('playoffs pausáveis', () => {
  test('temporada completa em auto chega em seasonResult com outcome coerente', () => {
    let found = false
    for (let seed = 60; seed < 75; seed++) {
      let s = newCareer(seed)
      for (let y = 0; y < 8 && !found; y++) {
        s = playSeasonAuto(s)
        expect(s.phase).toBe('seasonResult')
        const season = s.career.seasons[s.career.seasons.length - 1]
        expect(season.madePlayoffs).toBe(season.seed !== null)
        expect(s.seasonOutcome!.championTeamId).toBeTruthy()
        if (season.playoffRun === 'finals' || season.playoffRun === 'champion') found = true
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
        if (s.phase === 'verdict') break
      }
      if (found) break
    }
    expect(found).toBe(true)   // em 15 seeds × 8 anos alguém chega às finais
  }, 30000)
  test('finais: série fecha entre 4 e 7 jogos', () => {
    // dirigir até finais com seeds variados; quando chegar, contar jogos
    for (let seed = 100; seed < 140; seed++) {
      let s = newCareer(seed)
      for (let y = 0; y < 6; y++) {
        s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
        if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
        let games = 0, guard = 0
        while (s.phase !== 'seasonResult' && guard++ < 100) {
          if (s.phase === 'playoffGame' && s.pendingPlayoffs?.bracket.round === 3 && s.pendingGame) games++
          if (s.phase === 'keyGame' || (s.phase === 'playoffGame' && s.pendingGame)) s = gameReducer(s, { type: 'SKIP_GAME' })
          else if (s.phase === 'playoffGame') s = gameReducer(s, { type: 'ADVANCE_GAME' })
          else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
          else break
        }
        const season = s.career.seasons[s.career.seasons.length - 1]
        if (games > 0) {
          expect(games).toBeGreaterThanOrEqual(4)
          expect(games).toBeLessThanOrEqual(7)
          expect(['finals', 'champion']).toContain(season.playoffRun)
          return
        }
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
        if (s.phase === 'verdict') break
      }
    }
    throw new Error('nenhuma final em 40 seeds × 6 anos — calibração ou fluxo quebrado')
  }, 60000)
  test('replay determinístico com playoffs', () => {
    const run = (n: number) => {
      let s = newCareer(200 + n * 0)
      for (let y = 0; y < 3; y++) {
        s = playSeasonAuto(s)
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
      }
      return JSON.stringify(s)
    }
    expect(run(1)).toBe(run(2))
  }, 30000)
})
```

- [ ] **Step 2: Rodar e ver falhar**

- [ ] **Step 3: Implementar** conforme reestruturação acima. Cuidado: `TRADE_DECISION` agora conclui em `concludeSeason` reestruturado (pode cair em playoffGame — os campos de currentOffer/contractYears aplicados ANTES de entrar nos playoffs). `ADVANCE` (offseason) permanece intocado.

- [ ] **Step 4: Rodar suite inteira** — helpers de testes existentes atualizados para o novo fluxo (loop auto). Typecheck limpo.

- [ ] **Step 5: Commit** — `git commit -m "feat: playoffs pausáveis + finais best-of-7 no reducer"`

---

### Task 8: Harness auto/bold + calibração

**Files:**
- Modify: `tests/engine/calibration.test.ts`

**Interfaces:**
- Consumes: engine completo (Tasks 2-5). O harness NÃO usa o reducer — replica o fluxo com as funções do engine (como hoje), agora incluindo keyGames + playoffs pausáveis com política de decisão.

Política no harness:
```ts
type Policy = 'auto' | 'bold'
// auto: defaultOption (safe) em tudo — equivale a SKIP_GAME sempre
// bold: options.find(o => o.risk === 'bold') ?? default em TODO momento
```
simCareer ganha param `policy` (default 'auto'). Fluxo por temporada: rollEvents → selectKeyGames → jogos (política) → deltas → simRegularSeason/computeWinPct+delta → simStandings/simNpcLines → simAwards → seedBracket/rounds com jogos (política) → finishSeason com iconics/chokes.

- [ ] **Step 1: Reescrever harness** com o fluxo acima (espelhar a ordem do reducer; comentário no topo referenciando state.ts).

- [ ] **Step 2: Locks existentes (política auto) — TODOS mantidos verbatim:**
83 ringsMedian ≤ 2, legendRate < 0.15 · 95 legendRate > 0.2, mvpRate > 0.5 · 79 peakPpg 12-19, royRate < 0.8 · 99 peakPpg 26-34, goatRate < 0.02.

- [ ] **Step 3: Locks novos:**

```ts
test('bold dá edge real mas não quebra o jogo (95 overall)', () => {
  const auto = distribution(95, 'auto')
  const bold = distribution(95, 'bold')
  if (process.env.CALIBRATE) console.log('95 auto vs bold:', JSON.stringify({ auto, bold }, null, 2))
  // edge: anéis médios sobem 10-60% relativo com bold
  expect(bold.ringsAvg).toBeGreaterThan(auto.ringsAvg * 1.05)
  expect(bold.ringsAvg).toBeLessThan(auto.ringsAvg * 1.8)
  expect(bold.goatRate).toBeLessThan(0.04)   // trava de sanidade do dono
}, 120000)
test('icônicos: auto gera poucos, bold gera mais; cap respeitado', () => {
  const auto = distribution(90, 'auto')
  const bold = distribution(90, 'bold')
  expect(bold.iconicAvg).toBeGreaterThan(auto.iconicAvg)
  expect(auto.iconicPointsAvg).toBeLessThanOrEqual(100)
}, 120000)
```
`distribution` ganha `ringsAvg`, `iconicAvg` (média de momentos icônicos/carreira), `iconicPointsAvg`.

- [ ] **Step 4: Calibrar** — `CALIBRATE=1 npx vitest run tests/engine/calibration.test.ts --disableConsoleIntercept` (bash). Comparar com `docs/superpowers/plans/2026-07-28-calibracao-baseline-liga.md` (números pós-A). Knobs autorizados: constantes RISK (moments.ts), baseMargin (0.45/±8), SERIES_SHIFT, deltas de keyGame (±0.01/0.1), expPts. NUNCA: fórmulas-contrato, contagem de calls, thresholds das travas. A trava central: agregados de auto ≈ pós-A (auto ~= o antigo roll de série; desvio esperado pequeno porque bo7(pGameForSeries(p)) = p por construção — o desvio real vem dos deltas de momento no margin; calibrar RISK para média ~neutra no auto). Iterar até tudo verde. Registrar números finais e constantes no doc de baseline (nova seção "Pós-B").

- [ ] **Step 5: Commit** — `git commit -m "feat: harness com políticas auto/bold + calibração do motor de momentos"`

---

### Task 9: UI — GameScreen + tela de série + i18n

**Files:**
- Create: `src/ui/screens/Game.tsx`
- Modify: `src/ui/App.tsx` (ou onde as fases roteiam — conferir `src/ui/`) para renderizar fases `keyGame`/`playoffGame`
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`

**Interfaces:**
- Consumes: `state.pendingGame`, `state.pendingPlayoffs`, `state.pendingKeyGames`, actions `DECIDE_MOMENT`/`SKIP_GAME`/`ADVANCE_GAME`/`SKIP_SERIES`; `teamById`; classes CSS existentes (`card`, `kicker`, `chip`, `display`, `hint`, `goldtext`, `btn`, `btn--gold`).

Estrutura do `Game.tsx`:
- **Cabeçalho:** contexto — keyGame: `t('game.kind.' + kind)` + sigla do oponente; playoff: `t('game.round.' + round)` + `t('game.series', { us, them })` + nº do jogo nas finais.
- **Placar vivo:** margin parcial renderizado como placar fictício (`98 : 94` — base 100 + margin/2 arredondado; detalhe visual, sem estado extra).
- **Momento:** `t(pendingGame.moments[momentIndex].situationKey, params)` (2-3 linhas) + botões por opção: `t('option.' + option.id)` + linha menor com atributo (`t('slot.' + attr)` — chaves de slot já existem?) e risco (`t('risk.' + risk)`, cor: safe neutro, bold dourado, reckless vermelho + `t('risk.injury')` quando injuryRisk).
- **Botão "Simular jogo"** (`SKIP_GAME`) sempre visível no rodapé.
- **Pós-momento:** resultado do momento anterior aparece como banner curto (sucesso/falha — derivar do último outcome).
- **Tela de série** (playoffGame com `pendingGame === null`): placar da série grande, botões `t('series.next')` (ADVANCE_GAME) e `t('series.simAll')` (SKIP_SERIES).
- Jogo fechado dentro de keyGame: o reducer já abre o próximo jogo ou avança — a UI só re-renderiza; resultado do jogo anterior aparece no cabeçalho do próximo (último de `keyGameResults`: `t('game.lastResult', { score })`).

Chaves i18n novas (pt mostrado; en equivalente): `game.kind.rivalry/seedRace/special`, `game.round.0/1/2/3`, `game.series`, `game.number`, `game.simulate`, `game.lastResult`, `moment.q2tactic.v0..v2`, `moment.q4pressure.v0..v2`, `moment.clutch.v0..v2` (com `{opp}`), `option.feedHot/takeOver/lockDefense/pushPace/playHurt/safePass/clutchThree/attackRim`, `risk.safe/bold/reckless/injury`, `series.next/simAll`, `series.title`. Conferir se `slot.*` já existe nos JSONs (AttrDraft usa) — reusar; senão criar.

- [ ] **Step 1: Implementar** componentes + roteamento de fase + i18n pt/en.
- [ ] **Step 2: Verificar** — `npx tsc -p tsconfig.app.json --noEmit` + `npm test` (paridade i18n) + `npm run build`.
- [ ] **Step 3: Sanity manual** — `npm run dev`, jogar uma temporada decidindo e outra pulando.
- [ ] **Step 4: Commit** — `git commit -m "feat: tela de jogo assistido + série"`

---

### Task 10: UI — highlights, icônicos e veredito

**Files:**
- Modify: `src/ui/screens/Season.tsx` (aba Resultado)
- Modify: `src/ui/screens/Verdict.tsx`
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`

**Interfaces:**
- Consumes: `state.keyGameResults` (aba Resultado da temporada corrente — ainda populado na fase seasonResult), `season.iconicMoments`/`season.chokes`, `computeVerdict(...).iconicPoints/chokes`, `ICONIC_VALUES`.

- **Season aba Resultado:** bloco "Jogos-chave" — 1 linha por jogo de `keyGameResults` (W/L + placar + pts do jogador); icônicos da temporada como chips dourados (`t('iconic.' + id)`).
- **Verdict:** seção "Momentos" — lista dos icônicos da carreira (agregar de `career.seasons`) com `t('iconic.' + id)`, total `iconicPoints`; se `chokes > 0`, linha `t('verdict.chokes', { n })` (badge sóbrio, sem cor de erro).
- Chaves: `iconic.finalsBuzzer/seriesWinner/closeout45/fluGame/comeback/bigNight/rivalWinner/sweep`, `keygames.title`, `keygames.win/loss`, `verdict.moments`, `verdict.chokes`.
- Atenção decisão A (ledger): resolver nomes/ids contra dados vivos com fallback — aqui só ids de icônicos (estáticos), sem risco.

- [ ] **Step 1: Implementar** + i18n pt/en.
- [ ] **Step 2: Verificar** — tsc + `npm test` + build.
- [ ] **Step 3: Commit** — `git commit -m "feat: highlights de jogos-chave e momentos no veredito"`

---

### Task 11: E2E + HANDOFF

**Files:**
- Modify: `tests/e2e-playthrough.mjs`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Playthrough atualizado** — cobrir: temporada 1: jogar 1 jogo-chave DECIDINDO (3 cliques de opção) + pular os demais (botão simular); atravessar playoffs pulando (e ADVANCE_GAME/SKIP_SERIES se finais aparecerem); verificar bloco "Jogos-chave" no seasonResult; seguir carreira até veredito como hoje; verificar seção Momentos no veredito (pode estar vazia — asserir presença do título apenas se houver icônico). Seletores pelos textos reais do pt.json.

- [ ] **Step 2: Rodar tudo**

```bash
npm test
npx tsc -p tsconfig.app.json --noEmit
npm run build
node tests/e2e-playthrough.mjs
```

- [ ] **Step 3: HANDOFF.md** — item 11 nas Decisões-chave: motor de momentos (contrato GAME_RNG_CALLS=10 skip≡assistido, save v4, awards antes dos playoffs, híbrido crescente com SERIES_SHIFT, finais bo7 com pGameForSeries, icônicos cap 100, constantes calibradas finais e onde). Estado do topo atualizado (nº de testes). Backlog: rival de carreira (v3), elenco ofertante, All-Star assistido.

- [ ] **Step 4: Commit** — `git commit -m "feat: motor de momentos completo — jogos assistidos, playoffs jogo a jogo, icônicos"`

Deploy só quando o dono pedir.
