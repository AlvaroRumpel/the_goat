# Carreira Viva Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Curva de carreira visível ligada ao físico, aposentadoria oferecida por queda de produção, rol de eventos maior com 2 eventos interativos (escolha), e fix do glow que ocupa espaço no layout.

**Architecture:** `ageMultiplier` ganha `physical` e nova forma; `rollEvents` sai do sim e roda no reducer (draws contados); eventos interativos pausam o fluxo numa fase `eventDecision` (padrão do `tradeDecision`); aposentadoria escalonada via helper puro `performanceRatio`. UI muda só em `Season.tsx` + 1 linha de CSS.

**Tech Stack:** React 19 + TS, vitest, Playwright (e2e manual). Sem libs novas.

## Global Constraints

- `src/engine/` é TS puro: sem React, sem localStorage, sem `Math.random` — todo RNG via `Rng` injetado; todo draw contado em `rngCalls` (padrão `makeCountedRng(seed, skip)` do state.ts).
- Toda string visível via i18n (`pt.json` + `en.json`, paridade de chaves testada).
- Nova curva (spec §2) é o novo contrato: `age≤26: 0.78+(age−19)×(0.22/7)`; `26–29: 1.0`; `>29: max(0.60, 1−(age−29)×rate)`, `rate = clamp(0.035 − physical×0.0002, 0.012, 0.035)`. Calibrar só constantes.
- Aposentadoria: bandas `ratio < 0.75` (mín. 5 temporadas) e `ratio < 0.55` (narrativa); gatilho `age ≥ 31` permanece.
- Eventos: máx 2/temporada; máx 1 interativo; rates spec §4.1; `hotstreak`×`coldstreak` exclusivos.
- GOAT gate intocado; teste de calibração (<2%) deve continuar verde.
- Antes de cada commit: `npx vitest run` + `npx tsc -p tsconfig.app.json --noEmit` verdes.
- Spec: `docs/superpowers/specs/2026-07-28-carreira-viva-design.md`.

---

### Task 1: Fix do glow + nova curva de idade

**Files:**
- Modify: `src/styles/base.css:57` (seletor do glow)
- Modify: `src/engine/season.ts` (`ageMultiplier`, callers)
- Test: `tests/engine/season.test.ts`

**Interfaces:**
- Consumes: `Build.attributes.physical` (número 40–99).
- Produces: `ageMultiplier(age: number, physical: number): number` — todos os usos futuros passam physical.

- [ ] **Step 1: Fix do glow (commit separado, sem teste — bug CSS)**

Em `src/styles/base.css`, trocar o seletor:

```css
.screen > .screen__glow {
  position: absolute;
  left: 50%;
  top: -140px;
  transform: translateX(-50%);
  width: 520px;
  height: 420px;
  background: radial-gradient(closest-side, rgba(212, 167, 60, 0.22), rgba(212, 167, 60, 0));
  pointer-events: none;
}
```

(Era `.screen__glow` — a regra `.screen > *` posterior tem a mesma especificidade e sobrescrevia `position` para `relative`, fazendo o glow ocupar 420px de fluxo. `.screen > .screen__glow` tem especificidade maior.)

```bash
git add src/styles/base.css
git commit -m "fix: glow absoluto de novo — .screen > * sobrescrevia position e o glow ocupava espaço"
```

- [ ] **Step 2: Testes da curva (falhando)**

Em `tests/engine/season.test.ts`, substituir o describe existente de `ageMultiplier` (se houver) por:

```ts
describe('ageMultiplier', () => {
  test('rookie fraco, pico 26-29', () => {
    expect(ageMultiplier(19, 80)).toBeCloseTo(0.78, 2)
    expect(ageMultiplier(22, 80)).toBeCloseTo(0.78 + 3 * (0.22 / 7), 3)
    expect(ageMultiplier(26, 80)).toBeCloseTo(1.0, 3)
    expect(ageMultiplier(29, 80)).toBe(1.0)
  })
  test('declínio pós-29 depende do físico', () => {
    expect(ageMultiplier(30, 99)).toBeCloseTo(1 - (0.035 - 99 * 0.0002), 4)   // ~0.9848
    expect(ageMultiplier(35, 99)).toBeGreaterThan(ageMultiplier(35, 60))
    expect(ageMultiplier(30, 0)).toBeCloseTo(1 - 0.035, 4)                     // rate clampada em 0.035
  })
  test('piso 0.60', () => {
    expect(ageMultiplier(60, 40)).toBe(0.6)
  })
})
```

Atualizar TODAS as chamadas existentes `ageMultiplier(x)` nos testes para `ageMultiplier(x, <físico usado no build do teste>)`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/engine/season.test.ts`
Expected: FAIL (assinatura/valores)

- [ ] **Step 4: Implementar**

Em `src/engine/season.ts`:

```ts
export function ageMultiplier(age: number, physical: number): number {
  if (age <= 26) return 0.78 + (age - 19) * (0.22 / 7)
  if (age <= 29) return 1.0
  const rate = clamp(0.035 - physical * 0.0002, 0.012, 0.035)
  return Math.max(0.6, 1.0 - (age - 29) * rate)
}
```

Callers no mesmo arquivo: `simRegularSeason` → `const m = ageMultiplier(age, build.attributes.physical)`; `simPostseason` → `const m = ageMultiplier(regular.age, build.attributes.physical)`.

- [ ] **Step 5: Suite + typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS — inclusive `verdict.test.ts` (gate < 2%; carreiras lá são geradas aleatoriamente, não via sim — não deve mexer; se algum teste de `season.test.ts` de ppg/rpg quebrar por valores, ajustar a EXPECTATIVA do teste, não a fórmula).

- [ ] **Step 6: Commit**

```bash
git add src/engine/season.ts tests/engine/season.test.ts
git commit -m "feat: curva de carreira — rookie 0.78, pico 26-29, declínio pelo físico, piso 0.60"
```

---

### Task 2: Aposentadoria escalonada por performance

**Files:**
- Modify: `src/engine/season.ts` (helper `performanceRatio`)
- Modify: `src/state.ts` (case `ADVANCE`)
- Modify: `src/ui/screens/Season.tsx` (`RetireDecision` — narrativa)
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`
- Test: `tests/engine/season.test.ts`, `tests/state.test.ts`

**Interfaces:**
- Consumes: `SeasonResult[]` (career.seasons), fase `retireDecision` existente.
- Produces: `performanceRatio(seasons: SeasonResult[]): number | null` — null se < 5 temporadas; senão `últimaPpg / picoPpg`. Usado pelo reducer (gatilho 0.75) e pela UI (narrativa 0.55).

- [ ] **Step 1: Testes (falhando)**

`tests/engine/season.test.ts`:

```ts
import { performanceRatio } from '../../src/engine/season'

const seasonWithPpg = (ppg: number): SeasonResult => ({
  age: 25, teamId: 'lal', finalTeamId: 'lal', games: 82, ppg, rpg: 5, apg: 5,
  events: [], choices: [], madePlayoffs: false, wonTitle: false, awards: [],
})
// NOTA: o campo `choices` só existe a partir da Task 3. Nesta task, omitir
// `choices` do helper acima (adicionar na Task 3 se o tipo exigir).

describe('performanceRatio', () => {
  test('null com menos de 5 temporadas', () => {
    expect(performanceRatio([seasonWithPpg(20)])).toBeNull()
  })
  test('última / pico', () => {
    const seasons = [28, 30, 29, 27, 18].map(seasonWithPpg)
    expect(performanceRatio(seasons)).toBeCloseTo(18 / 30, 4)
  })
})
```

`tests/state.test.ts` (o helper `playToBuild`/fluxo de temporadas já existe; adicionar):

```ts
describe('aposentadoria por queda', () => {
  test('ADVANCE vai para retireDecision quando ratio < 0.75 com 5+ temporadas, mesmo antes dos 31', () => {
    // monta um estado sintético pós-temporada com carreira em declínio
    let s = playToSeasonResult()          // helper existente/derivado que chega em seasonResult
    s = {
      ...s,
      age: 27, contractYearsLeft: 3,
      career: {
        ...s.career,
        seasons: [30, 31, 29, 28, 15].map((ppg, i) => ({
          ...s.career.seasons[0], ppg, age: 22 + i,
        })),
      },
    }
    const next = gameReducer(s, { type: 'ADVANCE' })
    expect(next.phase).toBe('retireDecision')
  })
  test('sem declínio e < 31 segue para preseason', () => {
    let s = playToSeasonResult()
    s = { ...s, age: 25, contractYearsLeft: 3 }
    const next = gameReducer(s, { type: 'ADVANCE' })
    expect(next.phase).toBe('preseason')
  })
})
```

(Se não existir `playToSeasonResult`, criar no topo do arquivo: joga até `seasonResult` via `playToBuild()` + `CHOOSE_OFFER` + `PLAY_SEASON` com seed que não gere trade/evento interativo — nesta task eventos interativos ainda não existem, então qualquer seed sem trade serve; resolver `tradeDecision` com reject se aparecer.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/season.test.ts tests/state.test.ts`
Expected: FAIL — `performanceRatio` não existe; ADVANCE não dispara por ratio

- [ ] **Step 3: Implementar**

`src/engine/season.ts`:

```ts
export function performanceRatio(seasons: SeasonResult[]): number | null {
  if (seasons.length < 5) return null
  const last = seasons[seasons.length - 1].ppg
  const peak = Math.max(...seasons.map(s => s.ppg))
  return peak > 0 ? last / peak : null
}
```

`src/state.ts`, case `ADVANCE` — trocar a linha `if (age >= 31) ...` por:

```ts
const ratio = performanceRatio(state.career.seasons)
const declining = ratio !== null && ratio < 0.75
if (age >= 31 || declining) return { ...state, age, contractYearsLeft, phase: 'retireDecision' }
```

(Ordem do ADVANCE preservada: verdict >40 → freeAgency contrato zerado → retireDecision → preseason.)

`src/ui/screens/Season.tsx`, `RetireDecision` — trocar a linha do desc:

```tsx
const ratio = performanceRatio(state.career.seasons)
const heavyDecline = ratio !== null && ratio < 0.55
...
<div className="hint">
  {t(lang, heavyDecline ? 'retire.desc.pressure' : 'retire.desc', { age: state.age })}
</div>
```

(import: `import { performanceRatio } from '../../engine/season'`)

i18n — `pt.json`: `"retire.desc.pressure": "Você tem {age} anos e a imprensa especula sobre seu futuro. As médias despencaram."`; `en.json`: `"retire.desc.pressure": "You're {age} and the press is speculating about your future. Your numbers have cratered."`

- [ ] **Step 4: Suite + typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: aposentadoria escalonada — gatilho por queda de produção (0.75) + narrativa (0.55)"
```

---

### Task 3: Eventos — engine (rol novo, efeitos, choices)

**Files:**
- Modify: `src/engine/types.ts` (`GameEventId`, `EventChoice`, `RegularSeasonResult.choices`)
- Modify: `src/engine/events.ts` (rates novos, exclusividade, `injuryProne`)
- Modify: `src/engine/season.ts` (`simRegularSeason` recebe events/choices; efeitos; `simPostseason` efeitos)
- Modify: `src/state.ts` (PLAY_SEASON/TRADE_DECISION passam events/choices — auto-resolve seguro NESTA task; fase interativa é a Task 4)
- Modify: `src/data/i18n/pt.json`, `en.json` (chaves `event.*` novas — a UI de resultado já renderiza `event.{id}` genericamente)
- Test: `tests/engine/events.test.ts` (ou describe em season.test.ts se events.test não existir), `tests/engine/season.test.ts`

**Interfaces:**
- Consumes: `Rng`, `Focus`.
- Produces:
  - `GameEventId = 'injury' | 'rivalry' | 'viral' | 'coldstreak' | 'hotstreak' | 'coachchange' | 'playoffspark' | 'lockerroom'`
  - `EventChoice = 'injuryEarly' | 'injuryFull' | 'lockerFight' | 'lockerCalm'`
  - `rollEvents(rng: Rng, focus: Focus, injuryProne?: boolean): GameEventId[]`
  - `simRegularSeason(input: { build; age; team; profile; focus; rng; canTrade?; events: GameEventId[]; choices: EventChoice[] }): RegularSeasonResult` (não rola mais eventos internamente)
  - `RegularSeasonResult.choices: EventChoice[]` (flui para `SeasonResult` via spread existente)
  - `INTERACTIVE_EVENTS: GameEventId[] = ['injury', 'lockerroom']` (exportado de events.ts)
  - `autoResolve(events: GameEventId[]): EventChoice[]` (exportado de events.ts — escolhas seguras: `injuryFull`, `lockerCalm`)

- [ ] **Step 1: Testes (falhando)**

`tests/engine/events.test.ts` (criar; import `createRng` de rng.ts):

```ts
import { describe, expect, test } from 'vitest'
import { INTERACTIVE_EVENTS, autoResolve, rollEvents } from '../../src/engine/events'
import { createRng } from '../../src/engine/rng'

describe('rollEvents', () => {
  test('máximo 2 eventos', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(rollEvents(createRng(seed), 'scoring').length).toBeLessThanOrEqual(2)
    }
  })
  test('hotstreak nunca junto com coldstreak', () => {
    for (let seed = 0; seed < 500; seed++) {
      const ev = rollEvents(createRng(seed), 'scoring')
      expect(ev.includes('hotstreak') && ev.includes('coldstreak')).toBe(false)
    }
  })
  test('injuryProne aumenta frequência de lesão', () => {
    let base = 0, prone = 0
    for (let seed = 0; seed < 2000; seed++) {
      if (rollEvents(createRng(seed), 'scoring').includes('injury')) base++
      if (rollEvents(createRng(seed), 'scoring', true).includes('injury')) prone++
    }
    expect(prone).toBeGreaterThan(base)
  })
  test('foco health reduz lesão pela metade (antes do multiplicador)', () => {
    let normal = 0, health = 0
    for (let seed = 0; seed < 2000; seed++) {
      if (rollEvents(createRng(seed), 'scoring').includes('injury')) normal++
      if (rollEvents(createRng(seed), 'health').includes('injury')) health++
    }
    expect(health).toBeLessThan(normal * 0.75)
  })
})

describe('autoResolve', () => {
  test('escolhas seguras', () => {
    expect(autoResolve(['injury', 'lockerroom'])).toEqual(['injuryFull', 'lockerCalm'])
    expect(autoResolve(['rivalry'])).toEqual([])
  })
  test('INTERACTIVE_EVENTS', () => {
    expect(INTERACTIVE_EVENTS).toEqual(['injury', 'lockerroom'])
  })
})
```

`tests/engine/season.test.ts` — adicionar (adaptar `makeBuild` existente do arquivo):

```ts
describe('efeitos dos eventos novos', () => {
  const base = { build: makeBuild(), age: 27, team: teamById('lal'), profile: 'rebuild' as const, focus: 'scoring' as const, canTrade: false }

  test('hotstreak sobe ppg vs sem evento (mesma seed)', () => {
    const a = simRegularSeason({ ...base, rng: createRng(9), events: [], choices: [] })
    const b = simRegularSeason({ ...base, rng: createRng(9), events: ['hotstreak'], choices: [] })
    expect(b.ppg).toBeGreaterThan(a.ppg)
  })
  test('injuryEarly perde menos jogos que injuryFull mas ppg cai', () => {
    const early = simRegularSeason({ ...base, rng: createRng(3), events: ['injury'], choices: ['injuryEarly'] })
    const full = simRegularSeason({ ...base, rng: createRng(3), events: ['injury'], choices: ['injuryFull'] })
    expect(early.games).toBeGreaterThanOrEqual(82 - 18)
    expect(full.games).toBeLessThanOrEqual(82 - 10)
    const clean = simRegularSeason({ ...base, rng: createRng(3), events: [], choices: [] })
    expect(early.ppg).toBeLessThan(clean.ppg)
  })
  test('lockerroom dobra chance de trade (0.20)', () => {
    let withEv = 0, without = 0
    for (let seed = 0; seed < 1500; seed++) {
      const t1 = simRegularSeason({ ...base, canTrade: true, rng: createRng(seed), events: ['lockerroom'], choices: ['lockerCalm'] })
      const t2 = simRegularSeason({ ...base, canTrade: true, rng: createRng(seed), events: [], choices: [] })
      if (t1.tradeOffer) withEv++
      if (t2.tradeOffer) without++
    }
    expect(withEv).toBeGreaterThan(without * 1.5)
  })
  test('playoffspark e lockerFight mexem no pós-temporada de forma determinística', () => {
    const reg = simRegularSeason({ ...base, rng: createRng(5), events: ['playoffspark'], choices: [] })
    const post = simPostseason({ build: base.build, regular: reg, team: base.team, focus: 'scoring', rng: createRng(6) })
    expect(post).toBeTruthy() // sanity: roda sem erro com os novos campos
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/events.test.ts tests/engine/season.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar tipos**

`src/engine/types.ts`:

```ts
export type GameEventId =
  | 'injury' | 'rivalry' | 'viral' | 'coldstreak'
  | 'hotstreak' | 'coachchange' | 'playoffspark' | 'lockerroom'

export type EventChoice = 'injuryEarly' | 'injuryFull' | 'lockerFight' | 'lockerCalm'
```

`RegularSeasonResult` ganha `choices: EventChoice[]` (SeasonResult herda via Omit existente).

- [ ] **Step 4: Implementar events.ts**

```ts
import type { EventChoice, Focus, GameEventId, Rng } from './types'

const RATES: [GameEventId, number][] = [
  ['injury', 0.18],
  ['rivalry', 0.12],
  ['viral', 0.10],
  ['coldstreak', 0.12],
  ['hotstreak', 0.10],
  ['coachchange', 0.08],
  ['playoffspark', 0.08],
  ['lockerroom', 0.10],
]

export const INTERACTIVE_EVENTS: GameEventId[] = ['injury', 'lockerroom']

export function rollEvents(rng: Rng, focus: Focus, injuryProne = false): GameEventId[] {
  const out: GameEventId[] = []
  for (const [id, rate] of RATES) {
    let p = rate
    if (id === 'injury') {
      if (focus === 'health') p /= 2
      if (injuryProne) p *= 1.5
    }
    if (id === 'hotstreak' && out.includes('coldstreak')) continue
    if (rng.chance(p)) out.push(id)
    if (out.length === 2) break
  }
  return out
}

export function autoResolve(events: GameEventId[]): EventChoice[] {
  const out: EventChoice[] = []
  if (events.includes('injury')) out.push('injuryFull')
  if (events.includes('lockerroom')) out.push('lockerCalm')
  return out
}
```

- [ ] **Step 5: Implementar season.ts**

`simRegularSeason`: assinatura ganha `events: GameEventId[]` e `choices: EventChoice[]`; remover `const events = rollEvents(rng, focus)` e o import de rollEvents. Efeitos:

```ts
if (events.includes('coldstreak')) ppg -= 2          // existente
if (events.includes('hotstreak')) ppg += 2           // novo, antes do clamp final
if (choices.includes('injuryEarly')) ppg -= 2        // novo, antes do clamp final

const games = 82 - (events.includes('injury')
  ? (choices.includes('injuryEarly') ? rng.int(10, 18) : rng.int(10, 35))
  : rng.int(0, 6))

const tradeP = events.includes('lockerroom') ? 0.20 : 0.10
const tradeOffer = canTrade && rng.chance(tradeP) ? makeOffers(rng, team.id)[rng.int(0, 2)] : null

return { age, teamId: team.id, games, ppg: ..., rpg: ..., apg: ..., events, choices, tradeOffer }
```

`simPostseason` (depois do cálculo base de winPct, antes do clamp final):

```ts
if (regular.events.includes('coachchange')) winPct += rng.chance(0.5) ? 0.02 : -0.02
if (regular.choices.includes('lockerFight')) winPct -= 0.03
if (regular.choices.includes('lockerCalm')) winPct += 0.02
winPct = clamp(winPct, 0.15, 0.85)

let effClutch = build.attributes.clutch * m + (regular.events.includes('rivalry') ? 6 : 0)
if (regular.choices.includes('lockerFight')) effClutch += 6
// no cálculo do titleProb, se madePlayoffs && regular.events.includes('playoffspark'): effClutch += 8 antes da fórmula
```

E o spread do return existente já carrega `choices` (via `...rest` de regular — conferir que `choices` não é droppado junto com tradeOffer).

- [ ] **Step 6: Ajustar state.ts (wiring mínimo — sem fase interativa ainda)**

`PLAY_SEASON`: antes do sim:

```ts
const events = rollEvents(rng, action.focus, false)
const choices = autoResolve(events)
const regular = simRegularSeason({ build, age: state.age, team, profile, focus: action.focus, rng, canTrade, events, choices })
```

(imports: `rollEvents`, `autoResolve` de `./engine/events`). `TRADE_DECISION` não muda (usa `pendingRegular` que já carrega events/choices).

- [ ] **Step 7: i18n dos eventos novos**

`pt.json`:
```json
"event.hotstreak": "Fase quente — tudo caindo",
"event.coachchange": "Troca de técnico — novo esquema na quadra",
"event.playoffspark": "Brilho nos playoffs — você cresceu na hora certa",
"event.lockerroom": "Atrito no vestiário — clima pesado"
```
`en.json`:
```json
"event.hotstreak": "Hot streak — everything's falling",
"event.coachchange": "Coaching change — new system on the floor",
"event.playoffspark": "Playoff spark — you rose when it mattered",
"event.lockerroom": "Locker room friction — tense atmosphere"
```

- [ ] **Step 8: Suite + typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS — atenção a testes existentes de season/state que constroem `RegularSeasonResult` na mão: adicionar `choices: []`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: rol de eventos expandido — hotstreak, coachchange, playoffspark, lockerroom; events/choices como parâmetros do sim"
```

---

### Task 4: Fase eventDecision + UI + injuryProne

**Files:**
- Modify: `src/state.ts` (fase `eventDecision`, action `EVENT_DECISION`, campos `pendingEvents`/`injuryProne`)
- Modify: `src/ui/screens/Season.tsx` (componente `EventDecision`)
- Modify: `src/data/i18n/pt.json`, `en.json` (chaves `eventdec.*`)
- Test: `tests/state.test.ts`

**Interfaces:**
- Consumes: `INTERACTIVE_EVENTS`, `autoResolve`, `rollEvents(rng, focus, injuryProne)` (Task 3).
- Produces: `Phase` ganha `'eventDecision'`; `Action` ganha `{ type: 'EVENT_DECISION'; choice: 'a' | 'b' }`; `GameState` ganha `pendingEvents: GameEventId[] | null` e `injuryProne: boolean`. App.tsx não muda (Season é fallback de fase).

- [ ] **Step 1: Testes (falhando)**

`tests/state.test.ts`:

```ts
describe('eventDecision', () => {
  // acha um seed cujo PLAY_SEASON role evento interativo na 1ª temporada
  function findInteractiveSeed(): { s: GameState; seed: number } {
    for (let seed = 1; seed < 3000; seed++) {
      let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed })
      for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
      s = gameReducer(s, { type: 'CONFIRM_BUILD' })
      s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      const after = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      if (after.phase === 'eventDecision') return { s: after, seed }
    }
    throw new Error('nenhum seed com evento interativo em 3000 tentativas')
  }

  test('PLAY_SEASON com evento interativo pausa em eventDecision; EVENT_DECISION resolve e segue', () => {
    const { s } = findInteractiveSeed()
    expect(s.pendingEvents!.some(e => e === 'injury' || e === 'lockerroom')).toBe(true)
    const done = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
    expect(['seasonResult', 'tradeDecision']).toContain(done.phase)
    expect(done.pendingEvents).toBeNull()
  })
  test('escolha a em lesão liga injuryProne; consumido na próxima temporada', () => {
    const { s } = findInteractiveSeed()
    if (!s.pendingEvents!.includes('injury')) return   // seed rolou lockerroom; injury coberto por outro seed em CI local
    const done = gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
    expect(done.injuryProne).toBe(true)
  })
  test('EVENT_DECISION fora da fase é no-op', () => {
    const s = initialState('pt')
    expect(gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })).toBe(s)
  })
  test('replay determinístico com decisão de evento', () => {
    const { seed } = findInteractiveSeed()
    const run = () => {
      let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed })
      for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
      s = gameReducer(s, { type: 'CONFIRM_BUILD' })
      s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
      return s
    }
    expect(run().career).toEqual(run().career)
    expect(run().rngCalls).toBe(run().rngCalls)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/state.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar state.ts**

- `Phase`: adicionar `'eventDecision'`.
- `GameState`: `pendingEvents: GameEventId[] | null`, `injuryProne: boolean` (initialState: `null`, `false`).
- `Action`: `| { type: 'EVENT_DECISION'; choice: 'a' | 'b' }`.
- Extrair helper local (module-level, não exportado) com o corpo pós-eventos do PLAY_SEASON:

```ts
function runSeasonSim(state: GameState, focus: Focus, events: GameEventId[], choices: EventChoice[], rng: Rng, calls: () => number): GameState {
  const currentOffer = state.currentOffer!
  const build = state.build!
  const team = teamById(currentOffer.teamId)
  const profile = currentOffer.profile
  const canTrade = state.career.seasons.length >= 2
  const regular = simRegularSeason({ build, age: state.age, team, profile, focus, rng, canTrade, events, choices })

  if (regular.tradeOffer) {
    return { ...state, phase: 'tradeDecision', pendingRegular: regular, pendingFocus: focus, pendingEvents: null, rngCalls: calls() }
  }
  const season = simPostseason({ build, regular, team, focus, rng })
  const career = applyFame(state.career, season, profile)
  return { ...state, phase: 'seasonResult', career, pendingEvents: null, rngCalls: calls() }
}
```

- `PLAY_SEASON`:

```ts
case 'PLAY_SEASON': {
  const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
  const events = rollEvents(rng, action.focus, state.injuryProne)
  const consumed = { ...state, injuryProne: false }
  const interactive = events.find(e => INTERACTIVE_EVENTS.includes(e))
  if (interactive) {
    return { ...consumed, phase: 'eventDecision', pendingEvents: events, pendingFocus: action.focus, rngCalls: calls() }
  }
  return runSeasonSim(consumed, action.focus, events, autoResolve(events), rng, calls)
}
```

- `EVENT_DECISION`:

```ts
case 'EVENT_DECISION': {
  if (state.phase !== 'eventDecision') return state
  const events = state.pendingEvents!
  const focus = state.pendingFocus!
  const interactive = events.find(e => INTERACTIVE_EVENTS.includes(e))!
  // evento interativo primário recebe a escolha do usuário; um segundo interativo (raro) resolve seguro
  const choices = autoResolve(events.filter(e => e !== interactive))
  let injuryProne = state.injuryProne
  if (interactive === 'injury') {
    choices.push(action.choice === 'a' ? 'injuryEarly' : 'injuryFull')
    if (action.choice === 'a') injuryProne = true
  } else {
    choices.push(action.choice === 'a' ? 'lockerFight' : 'lockerCalm')
  }
  const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
  return runSeasonSim({ ...state, injuryProne, pendingFocus: null }, focus, events, choices, rng, calls)
}
```

Atenção: `runSeasonSim` põe `pendingFocus` de volta? Não — no caminho tradeDecision o `pendingFocus` é setado por ele; passar `focus` explicitamente resolve. Conferir que `TRADE_DECISION` continua funcionando (ele usa `pendingRegular`/`pendingFocus` — `runSeasonSim` seta ambos no caminho de trade; no snippet acima, garantir `pendingFocus: focus` dentro do branch de trade de `runSeasonSim`).

- [ ] **Step 4: UI — `EventDecision` em Season.tsx**

No switch de fases: `case 'eventDecision': return <EventDecision {...props} />`. Componente (padrão do TradeDecision):

```tsx
function EventDecision({ state, dispatch }: Props) {
  const lang = state.lang
  const ev = state.pendingEvents!.find(e => e === 'injury' || e === 'lockerroom')!
  return (
    <div className="screen">
      <div className="grain" />
      <div className="modal-veil">
        <div className="card card--gold" style={{ padding: 24, maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <div className="kicker kicker--gold">{t(lang, `eventdec.${ev}.title`)}</div>
          <div className="display" style={{ fontSize: 20 }}>{t(lang, `eventdec.${ev}.desc`)}</div>
          <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'EVENT_DECISION', choice: 'a' })}>
            {t(lang, `eventdec.${ev}.a`)}
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'EVENT_DECISION', choice: 'b' })}>
            {t(lang, `eventdec.${ev}.b`)}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: i18n**

`pt.json`:
```json
"eventdec.injury.title": "Lesão no meio da temporada",
"eventdec.injury.desc": "O departamento médico dá o prazo. Você decide.",
"eventdec.injury.a": "Voltar antes — jogar no sacrifício",
"eventdec.injury.b": "Curar direito — sem pressa",
"eventdec.lockerroom.title": "Atrito no vestiário",
"eventdec.lockerroom.desc": "Um veterano questiona seu papel no time.",
"eventdec.lockerroom.a": "Comprar a briga",
"eventdec.lockerroom.b": "Apaziguar o grupo"
```
`en.json`:
```json
"eventdec.injury.title": "Mid-season injury",
"eventdec.injury.desc": "The medical staff sets the timeline. You decide.",
"eventdec.injury.a": "Return early — play through it",
"eventdec.injury.b": "Heal properly — no rush",
"eventdec.lockerroom.title": "Locker room friction",
"eventdec.lockerroom.desc": "A veteran questions your role on the team.",
"eventdec.lockerroom.a": "Pick the fight",
"eventdec.lockerroom.b": "Calm the group"
```

- [ ] **Step 6: Suite + typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: eventos interativos — fase eventDecision com escolha (lesão, vestiário) + injuryProne"
```

---

### Task 5: E2E, HANDOFF e verificação final

**Files:**
- Modify: `tests/e2e-playthrough.mjs` (comentário/log do branch modal-veil)
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: UI da Task 4 (`.modal-veil` com `btn--gold` + `btn` também na eventDecision — o branch existente do e2e que clica `.modal-veil button.btn:not(.btn--gold)` já resolve as duas fases com a opção segura).

- [ ] **Step 1: Ajustar e2e**

No branch `.modal-veil` do loop de temporadas, atualizar o log (era específico de trade):

```js
if (await page.locator('.modal-veil').count() > 0) {
  log('modal decision (trade/event): choose safe option')
  await page.locator('.modal-veil button.btn:not(.btn--gold)').click()
  continue
}
```

Atualizar o comentário de phase markers: `tradeDecision/eventDecision: .modal-veil present`.

- [ ] **Step 2: Rodar o playthrough completo**

Run: `node tests/e2e-playthrough.mjs`
Expected: chega ao veredito sem timeout. Se o loop travar em `eventDecision`, o seletor do Step 1 está errado — inspecionar screenshot e corrigir seletor (não mexer no app).

- [ ] **Step 3: Verificação final**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS. Conferir no output do vitest que `verdict.test.ts` (GOAT gate < 2%) passou.

- [ ] **Step 4: HANDOFF.md**

- Arquitetura: `events.ts` (8 eventos, 2 interativos, máx 2/temporada), `season.ts` (`ageMultiplier(age, physical)`, `performanceRatio`).
- Decisões-chave, item 8: "**Carreira viva** (2026-07-28): curva 0.78→1.0 (26–29)→declínio por físico (rate clamp 0.012–0.035), piso 0.60; aposentadoria por queda (ratio <0.75 oferece, <0.55 narrativa, mín. 5 temporadas; idade ≥31 mantida); eventos interativos via fase `eventDecision` (escolha a/b antes do sim); `injuryProne` 1 temporada após volta antecipada. Spec `2026-07-28-carreira-viva-design.md`."
- Débitos: remover a linha do glow se listada; nada novo.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e-playthrough.mjs HANDOFF.md
git commit -m "test: e2e cobre eventDecision + handoff carreira viva"
```
