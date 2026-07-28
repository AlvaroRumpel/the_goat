# Draft Fenomeno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o draft de 8 confrontos fixos por sorteio de 1 jogador/rodada de um pool de ~200 jogadores da história da NBA, com roubo de atributo livre, malus híbrido leve e reroll 1x.

**Architecture:** Dataset estático curado (`src/data/players.ts`), novas funções puras no engine (`drawPlayer`, `weakestSlot`, `malusAmount`, `resolveBuild`), switchover do reducer/UI numa task atômica (save v2), e2e atualizado por último. Season/verdict/offers intocados — `Build.attributes/overall/archetype` mantêm shape.

**Tech Stack:** React 19 + TS, vitest (engine/state/data), Playwright (e2e manual), sem libs novas.

## Global Constraints

- `src/engine/` é TS puro: sem React, sem localStorage, sem `Math.random` — todo RNG via `Rng` injetado.
- Toda string visível passa por i18n (`src/data/i18n/pt.json` + `en.json`, paridade de chaves testada).
- Sem fotos/logos reais de NBA — nomes ok.
- Antes de cada commit: `npm test` E `npx tsc -p tsconfig.app.json --noEmit` verdes.
- Fórmula do malus é contrato: `clamp(round((valor − 71) / 6), 1, 5)` — calibrar só constantes, nunca a forma.
- Piso de atributo pós-malus: 40.
- GOAT gate intocado (verdict.ts não muda).
- Spec: `docs/superpowers/specs/2026-07-28-draft-fenomeno-design.md`. Mockup aprovado: canvas "The GOAT - Draft Fenomeno" no claude-design.
- Nota de refinamento vs spec §3: não existe action `DRAFT_ROLL` — o primeiro sorteio acontece no `NEW_GAME` e os seguintes dentro do próprio `DRAFT_STEAL`. Menos actions, mesmo comportamento.

---

### Task 1: Dataset de jogadores

**Files:**
- Modify: `src/engine/types.ts` (adicionar `Player`; nada removido)
- Create: `src/data/players.ts`
- Test: `tests/data/players.test.ts`

**Interfaces:**
- Consumes: `SlotId`, `SLOT_ORDER` de `src/engine/types.ts`.
- Produces: `interface Player { id: string; name: string; era: Era; attrs: Record<SlotId, number> }`, `type Era = '50s'|'60s'|'70s'|'80s'|'90s'|'2000s'|'2010s'|'2020s'`, `export const PLAYERS: Player[]`, `export function playerById(id: string): Player` (lança `Error` se id desconhecido).

- [ ] **Step 1: Escrever teste de sanidade (falhando)**

`tests/data/players.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { PLAYERS, playerById } from '../../src/data/players'
import { SLOT_ORDER } from '../../src/engine/types'

describe('PLAYERS dataset', () => {
  test('pool grande o suficiente', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(150)
  })
  test('ids únicos', () => {
    expect(new Set(PLAYERS.map(p => p.id)).size).toBe(PLAYERS.length)
  })
  test('todos os 8 atributos presentes, na faixa 40..99', () => {
    for (const p of PLAYERS) {
      for (const s of SLOT_ORDER) {
        expect(p.attrs[s], `${p.id}.${s}`).toBeGreaterThanOrEqual(40)
        expect(p.attrs[s], `${p.id}.${s}`).toBeLessThanOrEqual(99)
      }
    }
  })
  test('cada atributo tem >= 8 jogadores fortes (>=90) — draft viável em qualquer seed', () => {
    for (const s of SLOT_ORDER) {
      const strong = PLAYERS.filter(p => p.attrs[s] >= 90).length
      expect(strong, s).toBeGreaterThanOrEqual(8)
    }
  })
  test('ícones presentes', () => {
    for (const id of ['jordan', 'lebron', 'curry', 'magic', 'kareem', 'wilt', 'shaq', 'duncan'])
      expect(playerById(id).name).toBeTruthy()
  })
  test('playerById lança em id desconhecido', () => {
    expect(() => playerById('nope')).toThrow()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/data/players.test.ts`
Expected: FAIL — `Cannot find module '../../src/data/players'`

- [ ] **Step 3: Adicionar tipos em `src/engine/types.ts`**

Logo após a interface `Legend` (que permanece por enquanto):

```ts
export type Era = '50s' | '60s' | '70s' | '80s' | '90s' | '2000s' | '2010s' | '2020s'

export interface Player {
  id: string
  name: string
  era: Era
  attrs: Record<SlotId, number>   // 40..99
}

export interface DraftPick { playerId: string; slot: SlotId }
```

- [ ] **Step 4: Criar `src/data/players.ts` com ~200 jogadores curados**

Formato (attrs na ordem `three, finishing, passing, handles, defense, rebounding, physical, clutch` via helper para o arquivo ficar legível):

```ts
import type { Era, Player, SlotId } from '../engine/types'

// notas estilo 2K, curadoria própria (pico de carreira). Sem stats/fotos reais.
function p(id: string, name: string, era: Era, v: number[]): Player {
  const [three, finishing, passing, handles, defense, rebounding, physical, clutch] = v
  return { id, name, era, attrs: { three, finishing, passing, handles, defense, rebounding, physical, clutch } }
}

export const PLAYERS: Player[] = [
  // ícones (ids estáveis — testes dependem deles)
  p('jordan',  'Michael Jordan',      '90s',   [83, 95, 82, 92, 93, 68, 90, 99]),
  p('lebron',  'LeBron James',        '2010s', [78, 97, 94, 88, 87, 82, 99, 92]),
  p('curry',   'Stephen Curry',       '2010s', [99, 82, 88, 94, 70, 55, 68, 95]),
  p('magic',   'Magic Johnson',       '80s',   [70, 84, 99, 90, 72, 78, 85, 93]),
  p('kareem',  'Kareem Abdul-Jabbar', '70s',   [45, 98, 78, 65, 88, 90, 90, 92]),
  p('wilt',    'Wilt Chamberlain',    '60s',   [40, 96, 70, 55, 90, 99, 99, 80]),
  p('shaq',    'Shaquille O\'Neal',   '2000s', [40, 99, 68, 55, 82, 92, 99, 85]),
  p('duncan',  'Tim Duncan',          '2000s', [52, 92, 78, 60, 94, 92, 86, 90]),
  // ... ~192 entradas restantes, ver regras abaixo
]

const byId = new Map(PLAYERS.map(pl => [pl.id, pl]))

export function playerById(id: string): Player {
  const found = byId.get(id)
  if (!found) throw new Error(`unknown player: ${id}`)
  return found
}
```

Regras de curadoria (o teste do Step 1 valida as invariantes):
- ~200 entradas, distribuição por era: 2020s ~25, 2010s ~35, 2000s ~35, 90s ~35, 80s ~30, 70s ~15, 60s ~15, 50s ~10.
- Incluir os 24 nomes do `legends.ts` atual (mesmos ids: `curry, bird, ray, shaq, kareem, duncan, magic, nash, oscar, kyrie, iverson, penny, russell, hakeem, kawhi, rodman, wilt, moses, lebron, giannis, karl, jordan, kobe, durant`).
- Faixa 40–99 em tudo; superestrelas têm 1–3 notas 95+; role players históricos ficam na faixa 70–88 no forte.
- Toda entrada tem fraqueza clara (atributo mais baixo) coerente com o jogador real — é o alvo do malus.
- Notas plausíveis de conhecimento geral de basquete; NÃO derivar de dataset externo.

- [ ] **Step 5: Rodar testes e typecheck**

Run: `npx vitest run tests/data/players.test.ts && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS / sem erros

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/data/players.ts tests/data/players.test.ts
git commit -m "feat: pool de ~200 jogadores da história da NBA (dataset curado)"
```

---

### Task 2: Engine do draft novo

**Files:**
- Modify: `src/engine/draft.ts` (adicionar funções; `drawMatchups`/`resolveDraft` antigos permanecem até a Task 3)
- Test: `tests/engine/draft.test.ts` (adicionar describes; os antigos saem na Task 3)

**Interfaces:**
- Consumes: `PLAYERS`, `playerById` (Task 1); `Rng`, `SLOT_ORDER`, `DraftPick`, `Player` de types.
- Produces:
  - `drawPlayer(rng: Rng, drawnIds: string[]): Player` — sorteia do pool excluindo `drawnIds`.
  - `weakestSlot(player: Player, excluding: SlotId): SlotId` — menor attr fora do roubado; empate → primeiro em `SLOT_ORDER`.
  - `malusAmount(value: number): number` — `clamp(round((value − 71) / 6), 1, 5)`.
  - `resolveBuild(picks: DraftPick[]): Build` — bases, depois maluses, piso 40.
  - `Build.picks` passa a ser `DraftPick[]` (mudança em `types.ts`).

- [ ] **Step 1: Escrever testes (falhando)**

Adicionar em `tests/engine/draft.test.ts`:

```ts
import { drawPlayer, malusAmount, resolveBuild, weakestSlot } from '../../src/engine/draft'
import { PLAYERS, playerById } from '../../src/data/players'
import type { DraftPick } from '../../src/engine/types'

describe('drawPlayer', () => {
  test('não repete jogador já sorteado', () => {
    const rng = createRng(7)
    const drawn: string[] = []
    for (let i = 0; i < 30; i++) {
      const pl = drawPlayer(rng, drawn)
      expect(drawn).not.toContain(pl.id)
      drawn.push(pl.id)
    }
  })
  test('determinístico por seed', () => {
    expect(drawPlayer(createRng(3), []).id).toBe(drawPlayer(createRng(3), []).id)
  })
})

describe('malusAmount', () => {
  test('escala leve, clamp 1..5', () => {
    expect(malusAmount(99)).toBe(5)
    expect(malusAmount(95)).toBe(4)
    expect(malusAmount(83)).toBe(2)
    expect(malusAmount(77)).toBe(1)
    expect(malusAmount(50)).toBe(1)   // piso 1
  })
})

describe('weakestSlot', () => {
  test('menor atributo excluindo o roubado', () => {
    const curry = playerById('curry')   // rebounding 55 é o mais fraco
    expect(weakestSlot(curry, 'three')).toBe('rebounding')
    // roubando o próprio ponto fraco, cai no segundo mais fraco
    expect(weakestSlot(curry, 'rebounding')).not.toBe('rebounding')
  })
})

describe('resolveBuild', () => {
  test('bases + maluses na fraqueza, piso 40', () => {
    // 8 picks: um slot de cada, jogadores distintos quaisquer
    const rng = createRng(11)
    const drawn: string[] = []
    const picks: DraftPick[] = SLOT_ORDER.map(slot => {
      const pl = drawPlayer(rng, drawn)
      drawn.push(pl.id)
      return { playerId: pl.id, slot }
    })
    const build = resolveBuild(picks)
    // recomputa na mão
    const expected = {} as Record<string, number>
    for (const pk of picks) expected[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
    for (const pk of picks) {
      const pl = playerById(pk.playerId)
      const target = weakestSlot(pl, pk.slot)
      expected[target] = Math.max(40, expected[target] - malusAmount(pl.attrs[pk.slot]))
    }
    for (const s of SLOT_ORDER) expect(build.attributes[s]).toBe(expected[s])
    expect(build.picks).toEqual(picks)
    expect(build.overall).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/engine/draft.test.ts`
Expected: FAIL — `drawPlayer is not a function` (ou import error)

- [ ] **Step 3: Implementar em `src/engine/draft.ts`**

Mudar `types.ts`: `Build.picks: DraftPick[]` (era `string[]`). Depois em `draft.ts`:

```ts
import { PLAYERS, playerById } from '../data/players'
import type { DraftPick, Player } from './types'

export function drawPlayer(rng: Rng, drawnIds: string[]): Player {
  const pool = PLAYERS.filter(pl => !drawnIds.includes(pl.id))
  return rng.pick(pool)
}

export function weakestSlot(player: Player, excluding: SlotId): SlotId {
  const slots = SLOT_ORDER.filter(s => s !== excluding)
  return slots.reduce((worst, s) => player.attrs[s] < player.attrs[worst] ? s : worst, slots[0])
}

export function malusAmount(value: number): number {
  return Math.min(5, Math.max(1, Math.round((value - 71) / 6)))
}

export function resolveBuild(picks: DraftPick[]): Build {
  const attrs = {} as Record<SlotId, number>
  for (const pk of picks) attrs[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
  for (const pk of picks) {
    const player = playerById(pk.playerId)
    const target = weakestSlot(player, pk.slot)
    attrs[target] = Math.max(40, attrs[target] - malusAmount(player.attrs[pk.slot]))
  }
  return {
    attributes: attrs,
    picks,
    archetype: computeArchetype(attrs),
    overall: computeOverall(attrs),
  }
}
```

O `resolveDraft` antigo quebra o typecheck com o novo `Build.picks` — ajustar a linha do return dele para `picks: picks.map(pl => ({ playerId: pl.id, slot: pl.slot }))` (morre na Task 3; só manter compilando).

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (suite inteira — `state.test.ts` ainda usa o fluxo antigo, que continua funcionando)

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/draft.ts tests/engine/draft.test.ts
git commit -m "feat: engine do draft fenomeno — drawPlayer, weakestSlot, malusAmount, resolveBuild"
```

---

### Task 3: Switchover — state, UI, i18n, remoção do legado

**Files:**
- Modify: `src/state.ts`
- Modify: `src/ui/screens/AttrDraft.tsx` (rewrite da parte de draft; `DraftDone` fica)
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`
- Modify: `src/styles/base.css` (classes `.attr-cell*`, `.preview-bar`)
- Modify: `tests/state.test.ts`
- Delete: `src/data/legends.ts`, `src/ui/components/LegendCard.tsx`, `tests/data/legends.test.ts`
- Modify: `src/engine/draft.ts` (remover `drawMatchups` + `resolveDraft` antigos), `src/engine/types.ts` (remover `Legend`, `Matchup`), `tests/engine/draft.test.ts` (remover describes antigos `drawMatchups`/`resolveDraft`)

**Interfaces:**
- Consumes: `drawPlayer`, `resolveBuild`, `weakestSlot`, `malusAmount` (Task 2); `playerById` (Task 1).
- Produces: `GameState` sem `matchups`/`picks: Legend[]`, com `currentPlayerId: string | null`, `drawnIds: string[]`, `rerollUsed: boolean`, `picks: DraftPick[]`. Actions `DRAFT_STEAL { slot }` e `DRAFT_REROLL` (substituem `PICK_LEGEND`). `STORAGE_KEY = 'thegoat:v2'`.

- [ ] **Step 1: Atualizar testes de state (falhando)**

Em `tests/state.test.ts`, trocar `playToBuild` e os testes de draft:

```ts
import { SLOT_ORDER } from '../src/engine/types'

function playToBuild() {
  let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 123 })
  for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  return gameReducer(s, { type: 'CONFIRM_BUILD' })
}

describe('draft fenomeno', () => {
  test('NEW_GAME sorteia o primeiro jogador', () => {
    const s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 1 })
    expect(s.phase).toBe('attrDraft')
    expect(s.currentPlayerId).toBeTruthy()
    expect(s.drawnIds).toEqual([s.currentPlayerId])
    expect(s.rerollUsed).toBe(false)
  })
  test('DRAFT_STEAL preenche slot e sorteia o próximo; 8º vai para draftDone', () => {
    let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 2 })
    const first = s.currentPlayerId
    s = gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })
    expect(s.picks).toEqual([{ playerId: first, slot: 'three' }])
    expect(s.currentPlayerId).not.toBe(first)
    for (const slot of SLOT_ORDER.slice(1)) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
    expect(s.phase).toBe('draftDone')
    expect(s.build).not.toBeNull()
  })
  test('DRAFT_STEAL em slot já preenchido é no-op', () => {
    let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 3 })
    s = gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })
    const before = s
    s = gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })
    expect(s).toBe(before)
  })
  test('DRAFT_REROLL troca o jogador uma vez; segunda é no-op', () => {
    let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 4 })
    const first = s.currentPlayerId
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s.currentPlayerId).not.toBe(first)
    expect(s.rerollUsed).toBe(true)
    const after = s
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s).toBe(after)
  })
  test('replay determinístico: mesmo seed + mesmas actions = mesmo estado', () => {
    const run = () => {
      let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 42 })
      s = gameReducer(s, { type: 'DRAFT_REROLL' })
      for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
      return s
    }
    expect(run().build).toEqual(run().build)
    expect(run().drawnIds).toEqual(run().drawnIds)
  })
})
```

Os demais testes que chamavam `playToBuild` continuam iguais.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/state.test.ts`
Expected: FAIL — `DRAFT_STEAL` não existe no reducer

- [ ] **Step 3: Reescrever draft no `src/state.ts`**

- Imports: trocar `drawMatchups, resolveDraft` por `drawPlayer, resolveBuild`; trocar `Legend, Matchup` por `DraftPick` e importar `SlotId`; importar `playerById` não é necessário aqui.
- `STORAGE_KEY = 'thegoat:v2'`.
- `GameState`: remover `matchups: Matchup[]`; `picks: DraftPick[]`; adicionar `currentPlayerId: string | null`, `drawnIds: string[]`, `rerollUsed: boolean`. `initialState`: `currentPlayerId: null, drawnIds: [], rerollUsed: false, picks: []` (sem `matchups`).
- `Action`: remover `PICK_LEGEND`; adicionar `{ type: 'DRAFT_STEAL'; slot: SlotId }` e `{ type: 'DRAFT_REROLL' }`.
- Cases:

```ts
case 'NEW_GAME': {
  const { rng, calls } = makeCountedRng(action.seed, 0)
  const first = drawPlayer(rng, [])
  return {
    ...initialState(state.lang),
    seed: action.seed,
    rngCalls: calls(),
    currentPlayerId: first.id,
    drawnIds: [first.id],
    phase: 'attrDraft',
  }
}

case 'DRAFT_STEAL': {
  if (state.picks.some(pk => pk.slot === action.slot)) return state
  const picks = [...state.picks, { playerId: state.currentPlayerId!, slot: action.slot }]
  if (picks.length >= 8) {
    // DraftDone lê state.build assim que a fase vira, então computa aqui.
    return { ...state, picks, draftRound: 8, build: resolveBuild(picks), phase: 'draftDone' }
  }
  const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
  const next = drawPlayer(rng, state.drawnIds)
  return {
    ...state, picks, draftRound: picks.length,
    currentPlayerId: next.id, drawnIds: [...state.drawnIds, next.id], rngCalls: calls(),
  }
}

case 'DRAFT_REROLL': {
  if (state.rerollUsed || state.phase !== 'attrDraft') return state
  const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
  const next = drawPlayer(rng, state.drawnIds)
  return {
    ...state, rerollUsed: true,
    currentPlayerId: next.id, drawnIds: [...state.drawnIds, next.id], rngCalls: calls(),
  }
}
```

- `CONFIRM_BUILD`: trocar `resolveDraft(state.picks)` por `resolveBuild(state.picks)`.

- [ ] **Step 4: Reescrever tela de draft em `AttrDraft.tsx`**

`DraftDone` não muda. A parte de draft vira (seguindo o mockup aprovado):

```tsx
import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { SLOT_ORDER, type SlotId } from '../../engine/types'
import { playerById } from '../../data/players'
import { malusAmount, weakestSlot } from '../../engine/draft'

export function AttrDraft({ state, dispatch }: Props) {
  const [selected, setSelected] = useState<SlotId | null>(null)
  if (state.phase === 'draftDone') return <DraftDone state={state} dispatch={dispatch} />

  const lang = state.lang
  const player = playerById(state.currentPlayerId!)
  const taken = new Map(state.picks.map(pk => [pk.slot, pk]))
  const sel = selected && !taken.has(selected) ? selected : null
  const malusSlot = sel ? weakestSlot(player, sel) : null
  const malusN = sel ? malusAmount(player.attrs[sel]) : 0
  // fraqueza global (sem exclusão) — só para exibição no card do jogador
  const globalWeak = SLOT_ORDER.reduce((w, s) => (player.attrs[s] < player.attrs[w] ? s : w), SLOT_ORDER[0])

  const steal = (slot: SlotId) => {
    dispatch({ type: 'DRAFT_STEAL', slot })
    setSelected(null)
  }
  const reroll = () => {
    dispatch({ type: 'DRAFT_REROLL' })
    setSelected(null)
  }

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* header rodada + dots: manter o bloco existente (draft.round usa state.draftRound + 1) */}

        <div className="card card--gold" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 22 }}>{player.name}</div>
            <div className="hint">{t(lang, 'draft.weakness', { slot: t(lang, 'slot.' + globalWeak) })}</div>
          </div>
          <div className="chip">{t(lang, 'era.' + player.era)}</div>
        </div>

        <div className="kicker kicker--gold" style={{ textAlign: 'center' }}>{t(lang, 'draft.choose')}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SLOT_ORDER.map(slot => {
            const owned = taken.get(slot)
            if (owned) {
              const ownedVal = playerById(owned.playerId).attrs[slot]
              return (
                <div key={slot} className="attr-cell attr-cell--off">
                  <div>
                    <div className="attr-cell__name">{t(lang, 'slot.' + slot)}</div>
                    <div className="attr-cell__owned">{t(lang, 'draft.owned', { n: ownedVal })}</div>
                  </div>
                  <div className="attr-cell__val">—</div>
                </div>
              )
            }
            return (
              <button
                key={slot} type="button"
                className={sel === slot ? 'attr-cell attr-cell--sel' : 'attr-cell'}
                onClick={() => setSelected(slot)}
              >
                <div className="attr-cell__name">{t(lang, 'slot.' + slot)}</div>
                <div className="attr-cell__val">{player.attrs[slot]}</div>
              </button>
            )
          })}
        </div>

        {sel && (
          <div className="preview-bar">
            {t(lang, 'draft.preview', { name: player.name, slot: t(lang, 'slot.' + malusSlot!), n: malusN })}
          </div>
        )}

        {sel && (
          <button type="button" className="btn btn--gold" onClick={() => steal(sel)}>
            {t(lang, 'draft.stealBtn', { slot: t(lang, 'slot.' + sel), n: player.attrs[sel] })}
          </button>
        )}

        <button
          type="button" className="btn btn--ghost" disabled={state.rerollUsed}
          onClick={reroll}
        >
          {state.rerollUsed ? t(lang, 'draft.rerollUsed') : t(lang, 'draft.reroll')}
        </button>

        <div className="hint">{t(lang, 'draft.hint')}</div>
      </div>
    </div>
  )
}
```

Deletar `src/ui/components/LegendCard.tsx` (só o AttrDraft usava). Reusar/adicionar CSS em `base.css`:

```css
.attr-cell { display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.attr-cell--sel { border-color: var(--gold); box-shadow: 0 0 18px rgba(212, 167, 60, 0.18); }
.attr-cell--off { opacity: 0.55; cursor: default; }
.attr-cell__name { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dim); }
.attr-cell__val { font-family: var(--serif); font-size: 24px; line-height: 1; }
.attr-cell__owned { font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold-dim); margin-top: 4px; }
.preview-bar { background: linear-gradient(160deg, rgba(196, 85, 59, 0.14), rgba(196, 85, 59, 0.05)); border: 1px solid #4A2A1E; border-radius: 10px; padding: 12px 16px; text-align: center; font-size: 13px; line-height: 1.5; }
```

(Conferir nomes reais das custom properties em `tokens.css` — usar as existentes; se `--gold-dim`/`--dim`/`--border` tiverem outros nomes, adaptar.)

- [ ] **Step 5: i18n pt/en**

`pt.json` — remover `draft.title`, `draft.steal`, `draft.malus`, `draft.signature`; adicionar:

```json
"draft.choose": "Escolha o que roubar",
"draft.weakness": "Fraqueza: {slot}",
"draft.owned": "Seu · {n}",
"draft.preview": "Roubar herda a fraqueza de {name}: {slot} −{n}",
"draft.stealBtn": "Roubar {slot} {n}",
"draft.reroll": "Sortear outro jogador · 1 restante",
"draft.rerollUsed": "Sorteio extra já usado",
"draft.hint": "Toque num atributo para ver o preço. Quanto maior o valor, maior o custo.",
"era.50s": "Anos 50", "era.60s": "Anos 60", "era.70s": "Anos 70", "era.80s": "Anos 80",
"era.90s": "Anos 90", "era.2000s": "Anos 2000", "era.2010s": "Anos 2010", "era.2020s": "Anos 2020"
```

`en.json` — mesmas chaves:

```json
"draft.choose": "Choose what to steal",
"draft.weakness": "Weakness: {slot}",
"draft.owned": "Yours · {n}",
"draft.preview": "Stealing inherits {name}'s weakness: {slot} −{n}",
"draft.stealBtn": "Steal {slot} {n}",
"draft.reroll": "Draw another player · 1 left",
"draft.rerollUsed": "Extra draw already used",
"draft.hint": "Tap an attribute to see the price. Higher value, higher cost.",
"era.50s": "'50s", "era.60s": "'60s", "era.70s": "'70s", "era.80s": "'80s",
"era.90s": "'90s", "era.2000s": "2000s", "era.2010s": "2010s", "era.2020s": "2020s"
```

- [ ] **Step 6: Remover legado**

- Deletar `src/data/legends.ts`, `tests/data/legends.test.ts`, `src/ui/components/LegendCard.tsx`.
- `src/engine/draft.ts`: remover `drawMatchups` e o `resolveDraft` antigo (e import de `LEGENDS` antigo).
- `src/engine/types.ts`: remover `Legend` e `Matchup`.
- `tests/engine/draft.test.ts`: remover describes `drawMatchups` e `resolveDraft` e imports mortos.

- [ ] **Step 7: Rodar tudo**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS. Se o teste de paridade i18n reclamar de chave morta/faltante, corrigir os JSONs até parear.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: draft fenomeno — sorteio de jogador, roubo de atributo livre, reroll, save v2"
```

---

### Task 4: E2E, HANDOFF e verificação final

**Files:**
- Modify: `tests/e2e-playthrough.mjs` (bloco do draft, ~linhas 89–94)
- Modify: `HANDOFF.md`

**Interfaces:**
- Consumes: classes `.attr-cell`, `.attr-cell--off`, `.btn--gold` (Task 3).
- Produces: playthrough verde ponta a ponta.

- [ ] **Step 1: Atualizar bloco do draft no e2e**

Trocar o loop atual por:

```js
log('draft: 8 steals')
for (let i = 0; i < 8; i++) {
  await page.locator('button.attr-cell:not(.attr-cell--off)').first().click()
  await page.locator('button.btn--gold').click()
  await page.waitForTimeout(50)
}
await page.screenshot({ path: `${SHOTS_DIR}/02-draft.png` })
```

(O CTA "Roubar" só aparece após selecionar célula, então `.btn--gold` é único na tela nesse momento.)

- [ ] **Step 2: Rodar o playthrough completo**

Run: `npm run build` não é necessário; usar o fluxo do script: `node tests/e2e-playthrough.mjs`
Expected: playthrough completo até o veredito, sem timeout. Conferir screenshot `02-draft.png` mostra a grade de atributos.

- [ ] **Step 3: Atualizar HANDOFF.md**

Na seção Arquitetura: `draft.ts` agora é `drawPlayer/weakestSlot/malusAmount/resolveBuild`; `legends.ts` → `players.ts (~200)`. Em Decisões-chave adicionar: "7. **Draft fenomeno** (2026-07-28): 1 jogador sorteado/rodada, roubo de atributo livre, reroll 1x, malus = fraqueza do jogador roubado com `clamp(round((v−71)/6),1,5)`, piso 40. Save key `thegoat:v2` (v1 descartado)." Referenciar spec e este plano.

- [ ] **Step 4: Verificação final e commit**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS

```bash
git add tests/e2e-playthrough.mjs HANDOFF.md
git commit -m "test: e2e do draft fenomeno + handoff atualizado"
```
