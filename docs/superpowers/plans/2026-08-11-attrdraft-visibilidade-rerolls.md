# AttrDraft: atributos visíveis + 2 sorteios extras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Durante o draft de atributos, mostrar em cada linha o valor da lenda E o valor que fica seu, manter visível o atributo já conquistado, e dar 2 sorteios extras de carta em vez de 1.

**Architecture:** Uma função nova no engine (`draftAttrs`) calcula o estado parcial da build a partir dos picks — valores já seus (pós-malus) e penalidades pendentes em slots ainda vazios. `resolveBuild` passa a consumir essa função, então a regra de malus vive num lugar só. A UI lê `draftAttrs` para renderizar as duas colunas. O reroll vira contador.

**Tech Stack:** TypeScript, React 19, Vite, vitest. Sem dependência nova.

## Global Constraints

- `src/engine/` é TS puro: sem React, sem localStorage, sem `Math.random` — aleatoriedade só via `Rng` injetado.
- Toda string visível ao usuário passa por i18n: adicionar a chave em `src/data/i18n/pt.json` E `src/data/i18n/en.json` (paridade é testada).
- Fórmulas de `season.ts` e pesos de `verdict.ts` não são tocados neste plano.
- Antes de cada commit: `npm test` e `npx tsc -p tsconfig.app.json --noEmit`.
- Não rodar `npm run test:calibration` neste plano: a suíte injeta build pronta e não passa pelo draft.
- Commits em português, formato Conventional Commits.

---

### Task 1: `draftAttrs` no engine

**Files:**
- Modify: `src/engine/draft.ts:34-49` (`resolveBuild`)
- Test: `tests/engine/draft.test.ts`

**Interfaces:**
- Consumes: `weakestSlot(player, excluding)`, `malusAmount(value)`, `playerById(id)`, `SLOT_ORDER` — já existem em `src/engine/draft.ts` e `src/data/players.ts`.
- Produces: `draftAttrs(picks: DraftPick[]): { owned: Partial<Record<SlotId, number>>; pending: Record<SlotId, number> }`. `owned` traz só os slots já roubados, com todos os maluses já descontados e piso 40. `pending` traz, para cada slot ainda **não** roubado, a soma dos maluses já direcionados a ele (0 quando não há); slots já roubados vêm com `pending` 0 porque a penalidade já foi absorvida em `owned`.

- [ ] **Step 1: Write the failing test**

Adicionar ao fim de `tests/engine/draft.test.ts`:

```ts
describe('draftAttrs', () => {
  test('slot roubado entra em owned com o valor do doador', () => {
    const picks: DraftPick[] = [{ playerId: 'curry', slot: 'three' }]
    const { owned } = draftAttrs(picks)
    expect(owned.three).toBe(playerById('curry').attrs.three)
  })

  test('malus de um pick cai como pending no slot ainda vazio', () => {
    const picks: DraftPick[] = [{ playerId: 'curry', slot: 'three' }]
    const curry = playerById('curry')
    const target = weakestSlot(curry, 'three')
    const { owned, pending } = draftAttrs(picks)
    expect(owned[target]).toBeUndefined()
    expect(pending[target]).toBe(malusAmount(curry.attrs.three))
  })

  test('malus direcionado a slot já roubado é descontado em owned, não em pending', () => {
    const curry = playerById('curry')
    const target = weakestSlot(curry, 'three')
    const donor = PLAYERS.find(p => p.id !== 'curry' && weakestSlot(p, target) !== target)!
    const picks: DraftPick[] = [
      { playerId: donor.id, slot: target },
      { playerId: 'curry', slot: 'three' },
    ]
    const { owned, pending } = draftAttrs(picks)
    expect(owned[target]).toBe(Math.max(40, donor.attrs[target] - malusAmount(curry.attrs.three)))
    expect(pending[target]).toBe(0)
  })

  test('owned nunca fica abaixo de 40', () => {
    const picks: DraftPick[] = []
    const weak = PLAYERS.find(p => p.attrs.three === 40)!
    picks.push({ playerId: weak.id, slot: 'three' })
    for (const p of PLAYERS) {
      if (picks.length >= 8) break
      if (p.id === weak.id) continue
      const free = SLOT_ORDER.filter(s => !picks.some(pk => pk.slot === s))
      const slot = free.find(s => weakestSlot(p, s) === 'three')
      if (slot) picks.push({ playerId: p.id, slot })
    }
    const { owned } = draftAttrs(picks)
    expect(owned.three).toBeGreaterThanOrEqual(40)
  })

  test('com 8 picks, owned bate com a fórmula sequencial antiga', () => {
    // referência: o loop original de resolveBuild (clamp a cada subtração)
    const reference = (picks: DraftPick[]) => {
      const attrs = {} as Record<SlotId, number>
      for (const pk of picks) attrs[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
      for (const pk of picks) {
        const player = playerById(pk.playerId)
        const target = weakestSlot(player, pk.slot)
        attrs[target] = Math.max(40, attrs[target] - malusAmount(player.attrs[pk.slot]))
      }
      return attrs
    }
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed)
      const drawn: string[] = []
      const picks: DraftPick[] = []
      for (const slot of SLOT_ORDER) {
        const pl = drawPlayer(rng, drawn)
        drawn.push(pl.id)
        picks.push({ playerId: pl.id, slot })
      }
      expect(draftAttrs(picks).owned).toEqual(reference(picks))
    }
  })
})
```

Ajustar o import no topo do arquivo para incluir `draftAttrs` e `PLAYERS`:

```ts
import { computeArchetype, draftAttrs, drawPlayer, malusAmount, resolveBuild, weakestSlot } from '../../src/engine/draft'
import { PLAYERS, playerById } from '../../src/data/players'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit tests/engine/draft.test.ts`
Expected: FAIL — `draftAttrs is not a function` / erro de import.

- [ ] **Step 3: Write minimal implementation**

Em `src/engine/draft.ts`, trocar `resolveBuild` (linhas 34-49) por:

```ts
// Estado parcial da build durante o draft. `owned` = slots já roubados com os maluses
// descontados (piso 40); `pending` = malus já direcionado a um slot ainda vazio, que
// será cobrado quando (e se) aquele slot for roubado.
export function draftAttrs(picks: DraftPick[]): {
  owned: Partial<Record<SlotId, number>>
  pending: Record<SlotId, number>
} {
  const base: Partial<Record<SlotId, number>> = {}
  const pending = Object.fromEntries(SLOT_ORDER.map(s => [s, 0])) as Record<SlotId, number>
  for (const pk of picks) base[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
  for (const pk of picks) {
    const player = playerById(pk.playerId)
    pending[weakestSlot(player, pk.slot)] += malusAmount(player.attrs[pk.slot])
  }
  const owned: Partial<Record<SlotId, number>> = {}
  for (const slot of SLOT_ORDER) {
    const v = base[slot]
    if (v === undefined) continue
    owned[slot] = Math.max(40, v - pending[slot])
    pending[slot] = 0
  }
  return { owned, pending }
}

export function resolveBuild(picks: DraftPick[]): Build {
  const attrs = draftAttrs(picks).owned as Record<SlotId, number>
  return {
    attributes: attrs,
    picks,
    archetype: computeArchetype(attrs),
    overall: computeOverall(attrs),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project unit tests/engine/draft.test.ts tests/state.test.ts`
Expected: PASS. O teste de equivalência garante que a build final não mudou.

- [ ] **Step 5: Typecheck e suíte completa**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm test`
Expected: sem erros; 250+ testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/engine/draft.ts tests/engine/draft.test.ts
git commit -m "feat(draft): draftAttrs expoe estado parcial da build"
```

---

### Task 2: Reroll vira contador de 2

**Files:**
- Modify: `src/state.ts:90` (campo do `GameState`), `src/state.ts:189` (`initialState`), `src/state.ts:658-667` (`DRAFT_REROLL`), bloco de defaults do `loadState` (perto de `src/state.ts:892`)
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`
- Test: `tests/state.test.ts:68`, `tests/state.test.ts:91-99`, `tests/state.test.ts:441-447`

**Interfaces:**
- Consumes: `draftAttrs` da Task 1 não é usada aqui.
- Produces: campo `rerollsLeft: number` no `GameState` (substitui `rerollUsed: boolean`); chaves i18n `draft.reroll` (com `{n}`) e `draft.rerollOne`. A Task 3 consome ambos.

- [ ] **Step 1: Write the failing test**

Em `tests/state.test.ts`, substituir o teste da linha 68 (dentro de `BEGIN_CAREER sorteia o primeiro jogador`):

```ts
    expect(s.rerollsLeft).toBe(2)
```

Substituir o teste inteiro de `DRAFT_REROLL` (linhas 91-99) por:

```ts
  test('DRAFT_REROLL troca o jogador duas vezes; terceira é no-op', () => {
    let s = beginCareer({ seed: 4 })
    const first = s.currentPlayerId
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    const second = s.currentPlayerId
    expect(second).not.toBe(first)
    expect(s.rerollsLeft).toBe(1)
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s.currentPlayerId).not.toBe(second)
    expect(s.rerollsLeft).toBe(0)
    const after = s
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s).toBe(after)
  })
```

No teste do modo GOAT (linha 441), trocar a asserção final:

```ts
    expect(s.rerollsLeft).toBe(2)
```

E adicionar, logo depois do teste `save v6 é descartado no load; v7 sobrevive`:

```ts
  it('save antigo com rerollUsed migra para rerollsLeft', () => {
    const base = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(base).not.toBeNull()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, rerollUsed: true, rerollsLeft: undefined }))
    expect(loadState()!.rerollsLeft).toBe(1)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, rerollUsed: false, rerollsLeft: undefined }))
    expect(loadState()!.rerollsLeft).toBe(2)
  })
```

Se `STORAGE_KEY` ou `loadState` não estiverem importados no arquivo de teste, adicioná-los ao import de `../../src/state`. Se o teste `save v6...` não deixar um save válido em `localStorage`, gerar um antes: `saveState(beginCareer({ seed: 9 }))` e reler com `JSON.parse(localStorage.getItem(STORAGE_KEY)!)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project unit tests/state.test.ts`
Expected: FAIL — `rerollsLeft` é `undefined`.

- [ ] **Step 3: Write minimal implementation**

`src/state.ts` linha 90, trocar o campo:

```ts
  rerollsLeft: number        // sorteios extras de carta restantes no draft
```

`src/state.ts` linha 189, em `initialState`:

```ts
    rerollsLeft: 2,
```

`src/state.ts` linhas 658-667, o case:

```ts
    case 'DRAFT_REROLL': {
      if (state.career.mode === 'goat') return state
      if (state.rerollsLeft <= 0 || state.phase !== 'attrDraft') return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = drawPlayer(rng, state.drawnIds)
      return {
        ...state, rerollsLeft: state.rerollsLeft - 1,
        currentPlayerId: next.id, drawnIds: [...state.drawnIds, next.id], rngCalls: calls(),
      }
    }
```

No bloco de defaults do `loadState` (junto das outras linhas `parsed.x = parsed.x ?? ...`, perto da linha 892):

```ts
    parsed.rerollsLeft = parsed.rerollsLeft ?? (parsed.rerollUsed ? 1 : 2)
```

- [ ] **Step 4: i18n nos dois idiomas**

`src/data/i18n/pt.json`, substituir a chave `draft.reroll` e adicionar a singular ao lado:

```json
  "draft.reroll": "Sortear outro jogador · {n} restantes",
  "draft.rerollOne": "Sortear outro jogador · 1 restante",
```

`src/data/i18n/en.json`:

```json
  "draft.reroll": "Draw another player · {n} left",
  "draft.rerollOne": "Draw another player · 1 left",
```

Adicionar também, junto de `draft.ownedRound` nos dois arquivos (usada na Task 3):

pt.json:
```json
  "draft.ownedFrom": "ERA {from}",
```
en.json:
```json
  "draft.ownedFrom": "WAS {from}",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --project unit tests/state.test.ts tests/i18n.test.ts`
Expected: PASS. `src/ui/screens/AttrDraft.tsx` ainda referencia `state.rerollUsed` — o typecheck vai acusar; isso é resolvido na Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/state.ts src/data/i18n/pt.json src/data/i18n/en.json tests/state.test.ts
git commit -m "feat(draft): 2 sorteios extras por carreira"
```

---

### Task 3: UI com duas colunas e atributo conquistado visível

**Files:**
- Modify: `src/ui/screens/AttrDraft.tsx:1-182`
- Test: verificação manual no app + `npx tsc` + suíte existente

**Interfaces:**
- Consumes: `draftAttrs(picks)` da Task 1; `state.rerollsLeft` e as chaves `draft.reroll`, `draft.rerollOne`, `draft.ownedFrom` da Task 2.
- Produces: nada consumido por tarefas posteriores.

- [ ] **Step 1: Trocar o import e calcular o estado parcial**

Em `src/ui/screens/AttrDraft.tsx`, linha 6, trocar o import:

```tsx
import { draftAttrs, malusAmount, weakestSlot } from '../../engine/draft'
```

Logo depois de `const taken = new Map(...)` (linha 20), adicionar:

```tsx
  const { owned: myAttrs, pending: pendingMalus } = draftAttrs(state.picks)
```

- [ ] **Step 2: Corrigir o OVR projetado**

Substituir o bloco `projectedOvr` (linhas 39-44) por:

```tsx
  const projectedOvr = sel
    ? (() => {
        const after = draftAttrs([...state.picks, { playerId: player.id, slot: sel }]).owned
        const vals = Object.values(after) as number[]
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      })()
    : 0
```

- [ ] **Step 3: Linha já roubada mostra o valor conquistado**

Substituir o bloco `if (owned) { ... }` (linhas 89-112) por:

```tsx
            if (owned) {
              const round = state.picks.indexOf(owned) + 1
              const mine = myAttrs[slot]!
              const origin = playerById(owned.playerId).attrs[slot]
              return (
                <div key={slot}>
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 0', opacity: 0.6,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
                        {t(lang, 'slot.' + slot)}
                      </div>
                      <div className="mono-label" style={{ marginTop: 4 }}>
                        {t(lang, 'draft.ownedRound', { n: round })}
                        {mine < origin ? ' · ' + t(lang, 'draft.ownedFrom', { from: origin }) : ''}
                      </div>
                    </div>
                    <div className="headline" style={{ fontSize: 22 }}>{mine}</div>
                  </div>
                  {!isLast && <hr className="rule--soft" />}
                </div>
              )
            }
```

Nota: a variável `owned` aqui é o `DraftPick` vindo de `taken.get(slot)` — nome preservado de propósito para manter o diff curto. Os valores do engine estão em `myAttrs`.

- [ ] **Step 4: Linha não roubada mostra o valor que fica seu**

Substituir a sublinha `draft.yours` (linhas 143-150) por:

```tsx
                    {!goat && (
                      <div
                        className="mono"
                        style={{ fontSize: 11, marginTop: 2, color: isSel ? 'var(--on-ink-dim)' : 'var(--dim)' }}
                      >
                        {t(lang, 'draft.yours', {
                          legend: player.attrs[slot],
                          yours: Math.max(40, player.attrs[slot] - pendingMalus[slot]),
                        })}
                      </div>
                    )}
```

- [ ] **Step 5: Botão de sorteio com contador**

Substituir o bloco do botão (linhas 171-178) por:

```tsx
        {!goat && (
          <button
            type="button" className="btn btn--outline" disabled={state.rerollsLeft <= 0}
            onClick={reroll}
          >
            {state.rerollsLeft <= 0
              ? t(lang, 'draft.rerollUsed')
              : state.rerollsLeft === 1
                ? t(lang, 'draft.rerollOne')
                : t(lang, 'draft.reroll', { n: state.rerollsLeft })}
          </button>
        )}
```

- [ ] **Step 6: Typecheck e suíte**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm test`
Expected: sem erros de tipo (a referência pendente a `rerollUsed` some); todos os testes passando.

- [ ] **Step 7: Verificação visual**

Run: `npm run dev`, abrir o app, começar uma carreira no modo normal e conferir na tela de draft:
- toda linha não roubada mostra `lenda X · seu Y`, com `Y < X` quando aquele slot já levou malus
- linha já roubada mostra o número conquistado (não mais `—` riscado) e, quando levou malus, `ERA {origem}`
- o botão mostra `2 restantes`, depois `1 restante`, depois desabilita
- modo GOAT: valores da lenda seguem `??`, mas os slots já roubados mostram o número

- [ ] **Step 8: Commit**

```bash
git add src/ui/screens/AttrDraft.tsx
git commit -m "feat(draft): mostra atributo atual e valor pos-roubo em cada linha"
```

---

### Task 4: Fechamento

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Rodar a suíte inteira uma última vez**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Expected: tudo verde.

- [ ] **Step 2: Atualizar o HANDOFF**

Registrar em `HANDOFF.md`, na seção de estado atual: draft de atributos passou a mostrar o valor atual do jogador e o valor pós-roubo em cada linha; sorteio extra virou 2 por carreira; `draftAttrs` é a fonte única da regra de malus (`resolveBuild` consome).

- [ ] **Step 3: Commit**

```bash
git add HANDOFF.md
git commit -m "docs: HANDOFF — visibilidade de atributos no draft + 2 sorteios"
```

---

## Self-Review

**Cobertura do spec:**
- Spec §1 (`draftAttrs`, `resolveBuild` consumindo) → Task 1
- Spec §2 (duas colunas, linha roubada sem risco, GOAT, `projectedOvr`) → Task 3 steps 2-4
- Spec §3 (contador de 2, no-op em 0, GOAT, migração de save, i18n) → Task 2
- Spec §4 (testes de `draftAttrs`, reducer, `loadState`, paridade i18n) → Task 1 step 1, Task 2 step 1

**Placeholders:** nenhum — todo step traz o código ou o comando exato.

**Consistência de tipos:** `draftAttrs` devolve `{ owned, pending }` na Task 1 e é consumida com esse mesmo shape na Task 3. `rerollsLeft: number` é definido na Task 2 e lido na Task 3. As chaves `draft.rerollOne` e `draft.ownedFrom` são criadas na Task 2 e usadas na Task 3.
