# Arcade: companheiros reais + ritmo enxuto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prancheta usa os 4 melhores jogadores do time do jogador (nome, camisa, skill, velocidade) e o modo arcade joga menos momentos por partida e menos partidas-chave.

**Architecture:** `common.ts` ganha `teammates()` (dados da liga → `Mate`); `playbook.ts` lê skill/velocidade/passe por atacante em vez de constantes; UI só troca número/etiqueta. No ritmo, um flag `arcade` desce de `state.career.mode` até `momentCount` e `selectKeyGames`, sem mudar nenhuma contagem de calls de rng.

**Tech Stack:** TypeScript puro no engine (sem React/Math.random), React 19 + SVG na UI, vitest (`--project unit`).

**Spec:** `docs/superpowers/specs/2026-09-03-arcade-companheiros-e-ritmo-design.md`

## Global Constraints

- `src/engine/` sem React, sem localStorage, sem `Math.random` — aleatoriedade só via `Rng` injetado.
- Nenhuma mudança na contagem de calls de rng por caminho: `momentCount` 1 call, `selectKeyGames` 3 calls, `buildCalendar` 4 calls, `gameRngCalls(n) = 4n + 4`.
- `momentWeight(n) = 3/n` intocado. `SKILL_W` intocado. Save `thegoat:v7` sem bump.
- Toda string visível passa por i18n (`pt.json` + `en.json`, paridade testada). Este plano não adiciona strings novas.
- Antes de cada commit: `npx vitest run --project unit` verde + `npx tsc -p tsconfig.app.json --noEmit` limpo. Calibração NÃO se re-roda (só modo arcade muda; ver spec §2).
- Vitest às vezes devolve "no tests" na primeira execução (flake conhecido): rode de novo.
- Commits terminam com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: `teammates()` — companheiros reais a partir da liga

**Files:**
- Modify: `src/engine/minigames/common.ts:6-16`
- Test: `tests/engine/minigames/common.test.ts`

**Interfaces:**
- Consumes: `LeagueState.players` (`id, name, pos, ovr, tags, teamId`), `toOpp()` já existente.
- Produces:
  ```ts
  export type ShotType = 'layup' | 'mid' | 'three' | 'dunk'
  export interface Mate extends OppPlayer { number: number; skill: Record<ShotType, number>; pass: number }
  export function teammates(league: LeagueState, teamId: string, yourNumber: number | null): Mate[]   // sempre 4
  ```

- [ ] **Step 1: Write the failing test**

Adicione ao fim de `tests/engine/minigames/common.test.ts` (import `teammates` e `type Mate` junto dos outros de `common`):

```ts
describe('companheiros reais', () => {
  test('teammates: 4 do time, ordenados por ovr desc, camisas estáveis em [10, 55] e diferentes da sua', () => {
    const a = teammates(league, 'lal', 23), b = teammates(league, 'lal', 23)
    expect(a).toHaveLength(4)
    expect(a.every(p => league.players.find(l => l.id === p.id)?.teamId === 'lal')).toBe(true)
    for (let i = 1; i < 4; i++) expect(a[i - 1].ovr).toBeGreaterThanOrEqual(a[i].ovr)
    for (const p of a) { expect(p.number).toBeGreaterThanOrEqual(10); expect(p.number).toBeLessThanOrEqual(56); expect(p.number).not.toBe(23) }
    expect(a.map(p => p.number)).toEqual(b.map(p => p.number))
    expect(a[0].id).toBe(opponentFive(league, 'lal')[0].id)   // os mesmos 4 melhores que o adversário usaria
  })
  test('skill pela régua do jogador: ovr 60 = 0.5 base; shooter três > não-shooter; playmaker pass < 1; dunk só grande/forte', () => {
    const mk = (id: string, ovr: number, tags: Mate['tags'], pos: Mate['pos'] = 'SF') =>
      teammates({ year: 1, players: [{ id, name: 'A B', pos, age: 27, ovr, tags, teamId: 'x', rookie: false, prevPpg: null }] }, 'x', null)[0]
    const plain = mk('lg-a', 60, [])
    expect(plain.skill.mid).toBeCloseTo(0.5, 5); expect(plain.skill.three).toBeCloseTo(0.45, 5); expect(plain.skill.layup).toBeCloseTo(0.5, 5)
    expect(plain.skill.dunk).toBeCloseTo(0.35, 5); expect(plain.pass).toBe(1)
    const sh = mk('lg-b', 60, ['shooter']); expect(sh.skill.three).toBeCloseTo(0.575, 5); expect(sh.skill.mid).toBeCloseTo(0.525, 5)
    const pm = mk('lg-c', 60, ['playmaker']); expect(pm.pass).toBe(0.8)
    const big = mk('lg-d', 60, ['rebounder'], 'C'); expect(big.skill.layup).toBeCloseTo(0.55, 5); expect(big.skill.dunk).toBeCloseTo(0.55, 5)
    expect(mk('lg-e', 99, []).skill.three).toBeCloseTo(0.9, 5)   // clamp01 depois do ×0.9 sobre base 1
    expect(mk('lg-f', 40, []).skill.mid).toBe(0.25)              // piso 0.25
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/minigames/common.test.ts --project unit`
Expected: FAIL — `teammates is not a function` (ou erro de import).

- [ ] **Step 3: Write minimal implementation**

Em `src/engine/minigames/common.ts`, logo após `bestDefender` (linha 20):

```ts
// ---- seu time (prancheta): os 4 melhores por ovr, com camisa determinística e skill pela sua régua ----
export type ShotType = 'layup' | 'mid' | 'three' | 'dunk'
export interface Mate extends OppPlayer { number: number; skill: Record<ShotType, number>; pass: number }
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
// hash do id → 10..55, estável por jogador; nunca a sua camisa
function jerseyOf(id: string, yourNumber: number | null): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 46
  const n = 10 + h
  return n === yourNumber ? n + 1 : n
}
function toMate(p: LeaguePlayer, yourNumber: number | null): Mate {
  const base = clamp((p.ovr - 30) / 60, 0.25, 1)
  const shooter = p.tags.includes('shooter'), rebounder = p.tags.includes('rebounder')
  const layup = clamp01(base * (rebounder ? 1.1 : 1))
  const skill: Record<ShotType, number> = {
    layup,
    mid: clamp01(base * (shooter ? 1.05 : 1)),
    three: clamp01(base * (shooter ? 1.15 : 0.9)),
    dunk: p.pos === 'PF' || p.pos === 'C' || p.ovr >= 75 ? layup : clamp01(layup * 0.7),
  }
  return { ...toOpp(p), number: jerseyOf(p.id, yourNumber), skill, pass: p.tags.includes('playmaker') ? 0.8 : 1 }
}
export function teammates(league: LeagueState, teamId: string, yourNumber: number | null): Mate[] {
  return league.players.filter(p => p.teamId === teamId).sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id)).slice(0, 4).map(p => toMate(p, yourNumber))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/minigames/common.test.ts --project unit`
Expected: PASS (todos, incluindo os antigos).

- [ ] **Step 5: Commit**

```bash
git add src/engine/minigames/common.ts tests/engine/minigames/common.test.ts
git commit -m "feat(arcade): teammates() — 4 melhores do seu time com camisa, skill e passe" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: engine da prancheta lê skill/velocidade/passe do companheiro

**Files:**
- Modify: `src/engine/minigames/playbook.ts:54-57` (PlaybookInput), `:236-241` (runSpeed em `step`), `:323-335` (`pass`), `:386-391` (`skillFor`), `:401` (chamada em `shoot`)
- Test: `tests/engine/minigames/playbook.test.ts`

**Interfaces:**
- Consumes: `Mate`, `teammates` (Task 1).
- Produces: `PlaybookInput.mates: Mate[]` (obrigatório; índice `i − 1` para o atacante `i ≥ 1`; `0` = você). `ASSIST_SKILL` deixa de existir.

- [ ] **Step 1: Write the failing tests**

Em `tests/engine/minigames/playbook.test.ts`: adicione `teammates, type Mate` ao import de `common`, mude o helper `input` para aceitar override e incluir `mates`:

```ts
const mates = () => teammates(league, 'lal', 23)
const input = (over: Partial<PlaybookInput> = {}): PlaybookInput => ({ kind: 'rivalry', five: opponentFive(league, 'bos'), mods: attrMods(build(80), 27), difficulty: 1,
  skill: { layup: 1, mid: 1, three: 1, dunk: 1 }, reboundChance: 0.5, mates: mates(), ...over })
```

E um `describe` novo no fim do arquivo:

```ts
describe('companheiros reais', () => {
  // posse já em run, bola com o companheiro 1, aberto (defensores longe)
  const withMate1 = (inp: PlaybookInput) => {
    let s = startRun(applyTemplate(createPlaybook(createRng(3), inp), 'iso'))
    s.ball = { holder: 1, flying: null }
    s.attackers[1] = { x: COURT.basket.x, y: COURT.basket.y + 7.5 }          // três aberto
    s.defenders = s.defenders.map(d => ({ ...d, x: 0, y: COURT.d - 1 }))
    return s
  }
  test('arremesso de companheiro usa a skill DELE por tipo (não a sua nem 0.6 fixo)', () => {
    const weak = { ...mates()[0], skill: { layup: 0.3, mid: 0.3, three: 0.3, dunk: 0.3 } }
    const strong = { ...weak, skill: { layup: 1, mid: 1, three: 1, dunk: 1 } }
    const q = (m: Mate) => { const inp = input({ mates: [m, ...mates().slice(1)] }); return shoot(withMate1(inp), createRng(1), inp).result!.quality }
    expect(q(strong)).toBeGreaterThan(q(weak) + 0.3)
    expect(q(strong)).toBeGreaterThan(0.9)
  })
  test('cada companheiro corre na velocidade dele: o rápido termina a rota antes do lento', () => {
    const route = [{ x: 0, y: 25 }, { x: 0, y: 5 }]
    const prog = (speed: number) => {
      const inp = input({ mates: mates().map((m, i) => i === 0 ? { ...m, speed } : m) })
      let s = startRun(setRoute(applyTemplate(createPlaybook(createRng(3), inp), 'iso'), 1, route))
      for (let i = 0; i < 20; i++) s = step(s, 0.05, createRng(1), inp)
      return s.routeProgress[1]
    }
    expect(prog(4.4)).toBeGreaterThan(prog(3.0) * 1.3)
  })
  test('passe de playmaker intercepta menos (chance × 0.8) — mesma seed, faixa apertada', () => {
    const tight = (m: Mate) => {
      const inp = input({ mates: [{ ...m, pass: m.pass }, ...mates().slice(1)] })
      let s = withMate1(inp)
      s.attackers[2] = { x: s.attackers[1].x + 3, y: s.attackers[1].y }
      s.defenders[0] = { ...s.defenders[0], x: s.attackers[1].x + 1.5, y: s.attackers[1].y }   // na linha do passe
      let picks = 0
      for (let seed = 0; seed < 200; seed++) if (pass(s, 2, createRng(seed), inp).phase === 'done') picks++
      return picks
    }
    const base = mates()[0]
    expect(tight({ ...base, pass: 0.8 })).toBeLessThan(tight({ ...base, pass: 1 }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/minigames/playbook.test.ts --project unit`
Expected: FAIL — os três novos (`mates` não é lido pelo engine: quality igual, velocidade igual, interceptações iguais). Os antigos passam (o helper só ganhou um campo a mais; se o TS reclamar de `mates` desconhecido, é o erro esperado).

- [ ] **Step 3: Write minimal implementation**

`src/engine/minigames/playbook.ts`:

```ts
// import: acrescente Mate
import { freeThrowP, type AttrMods, type Mate, type OppPlayer } from './common'

// PlaybookInput (linha 54)
export interface PlaybookInput {
  kind: WatchedGameKind; five: OppPlayer[]; mods: AttrMods; difficulty: number
  skill: Record<'layup' | 'mid' | 'three' | 'dunk', number>; reboundChance: number
  mates: Mate[]                                   // atacantes 1..4 (0 = você); skill/velocidade/passe deles
}

// step (linha ~236): velocidade por atacante — você por mods, companheiro pela dele
  s.routes.forEach((route, i) => {
    if (route.points.length < 2) return
    const runSpeed = i === 0 ? 4.2 * input.mods.speed : input.mates[i - 1].speed * 1.1
    const mult = s.mismatch && i === 0 ? 1.15 : 1
    s.routeProgress[i] = Math.min(routeLength(route.points), s.routeProgress[i] + runSpeed * mult * dt)
    s.attackers[i] = clampCourt(pointAlongRoute(route.points, s.routeProgress[i]), COURT)
  })
// (remova a linha `const runSpeed = 4.2 * input.mods.speed` que ficava antes do forEach)

// pass (linha ~332): passador playmaker
    const chance = laneRisk * 0.45 / input.mods.laneSafety * (risky ? 2 : 1) * (holder === 0 ? 1 : input.mates[holder - 1].pass)

// skillFor (linha 386): sai ASSIST_SKILL
function skillFor(optionId: string, input: PlaybookInput, holder: number): number {
  const type = optionId === 'mgLayup' ? 'layup' : optionId === 'mgDunk' ? 'dunk' : optionId === 'mgThree' ? 'three' : 'mid'
  return holder === 0 ? input.skill[type] : input.mates[holder - 1].skill[type]
}
// shoot (linha 401)
  const skill = skillFor(optionId, input, holder)
```

Atenção: em `shoot`, `optionId` continua `mgAssist` quando o portador não é você (`shotOptionFor`), e `mgAssist` cai no ramo `mid` do companheiro — é o desejado (a spec não muda o catálogo do momento). Se `resolveOptionId(..., finish)` devolver `mgLayup/mgDunk` para companheiro, o tipo correspondente é usado.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/minigames --project unit`
Expected: PASS. Se o terceiro teste (interceptação) der contagem igual nas duas variantes, a linha do passe não está cruzando o defensor: verifique que `distToSegment(defensor, from, dest) < 0.9` no cenário (ajuste `x + 1.5 → x + 1.5, y ± 0.3` até a diferença aparecer). Nunca afrouxe a asserção.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: erro em `src/ui/minigames/Playbook.tsx` (falta `mates` no input) — esperado, resolvido na Task 3. Se o único erro for esse, siga.

- [ ] **Step 6: Commit**

```bash
git add src/engine/minigames/playbook.ts tests/engine/minigames/playbook.test.ts
git commit -m "feat(arcade): prancheta — companheiro arremessa, corre e passa com os atributos dele" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: UI — `teamId` nos props, números/etiquetas reais, select no lab

**Files:**
- Modify: `src/ui/minigames/types.ts:12-24`, `src/ui/minigames/Minigame.tsx:75-90`, `src/ui/minigames/Playbook.tsx:36,62-72,361-369`, `src/lab.tsx:35,67-72,101`

**Interfaces:**
- Consumes: `teammates(league, teamId, number)` (Task 1), `PlaybookInput.mates` (Task 2).
- Produces: `MinigameProps.teamId: string`.

- [ ] **Step 1: `MinigameProps.teamId`**

`src/ui/minigames/types.ts`, dentro de `MinigameProps`, logo após `league`:

```ts
  teamId: string               // seu time (companheiros reais da prancheta)
```

- [ ] **Step 2: `Minigame.tsx` passa o time**

Em `src/ui/minigames/Minigame.tsx`, no `<Comp ... />` (linha ~79), após `league={state.league!}`:

```tsx
          teamId={state.pendingPlayoffs?.finalOffer.teamId ?? state.currentOffer!.teamId}
```

- [ ] **Step 3: `Playbook.tsx` usa os companheiros**

```tsx
// import de common (linha ~7): acrescente teammates
import { attrMods, difficulty, opponentFive, reboundChance, teammates } from '../../engine/minigames/common'
// (mantenha o que já é importado dali; só adicione `teammates`)

// linha 36: REMOVA
const MATE_NUM = [4, 11, 23, 33]               // camisas dos companheiros (você usa a sua)

// assinatura do componente (linha 62): acrescente teamId
export function PlaybookGame({ seed, context, build, age, quarter, league, teamId, number, lang, onResolve, outcome }: MinigameProps) {
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const mates = useMemo(() => teammates(league, teamId, number), [league, teamId, number])
  const input = useMemo<PlaybookInput>(() => {
    const mods = attrMods(build, age, quarter)
    const sk = (tp: 'layup' | 'mid' | 'three' | 'dunk') => skillOf(build, age, tp, mods.fatigue)
    return {
      kind: context.kind, five, mods, difficulty: difficulty(context.kind, five[0].ovr),
      skill: { layup: sk('layup'), mid: sk('mid'), three: sk('three'), dunk: sk('dunk') }, reboundChance: reboundChance(mods, five),
      mates,
    }
  }, [context.kind, five, mates, build, age, quarter])

// render dos atacantes (linha ~367-368): número e etiqueta reais
              <text x={p.x * S} y={p.y * S + 15} className="mg-pb__num">{i === st.you ? (number ?? '★') : mates[i - 1].number}</text>
              <text x={p.x * S} y={p.y * S + R_US + 40} className="mg-pb__tag">{i === st.you ? t(lang, 'mg.you') : mates[i - 1].short}</text>
```

- [ ] **Step 4: lab — select "Meu time"**

`src/lab.tsx`: estado novo ao lado de `teamId` (linha 35):

```tsx
  const [myTeamId, setMyTeamId] = useState('lal')
```

Após o `<label>Adversário ...</label>` (linha ~72):

```tsx
        <label>Meu time
          <select value={myTeamId} onChange={e => setMyTeamId(e.target.value)}>
            {TEAMS.map(tm => <option key={tm.id} value={tm.id}>{tm.city} {tm.name} · {tm.strength}</option>)}
          </select>
        </label>
```

No `<Game ... />` (linha ~101), após `league={league}`: `teamId={myTeamId}`.

- [ ] **Step 5: Typecheck + suíte**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run --project unit`
Expected: tsc limpo; suíte verde (i18n intocado — `mg.you` já existe).

- [ ] **Step 6: Verificação visual no lab**

Run (dev server já costuma estar em 5199; senão `npx vite --port 5199`): abra `http://localhost:5199/lab.html`, minigame JOGADA, "Meu time" = Lakers. Esperado: 4 ímãs vermelhos com números diferentes de `4/11/23/33` e sobrenome abaixo de cada um; trocar "Meu time" troca nomes/números.

- [ ] **Step 7: Commit**

```bash
git add src/ui/minigames/types.ts src/ui/minigames/Minigame.tsx src/ui/minigames/Playbook.tsx src/lab.tsx
git commit -m "feat(arcade): prancheta mostra seus companheiros reais (camisa + sobrenome); lab escolhe o time" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: menos momentos por jogo no arcade (`moments.ts`)

**Files:**
- Modify: `src/engine/moments.ts:148-156` (baseCount/momentCount), `:168-170` (makeMoments), `:296-305` (startWatchedGame)
- Test: `tests/engine/moments.test.ts`

**Interfaces:**
- Produces: `momentCount(context, rng, arcade = false)`, `makeMoments(context, rng, arcade = false)`, `startWatchedGame({ ..., arcade?: boolean })`.

- [ ] **Step 1: Write the failing test**

Adicione a `tests/engine/moments.test.ts` (import `momentCount` de `moments`):

```ts
describe('ritmo do arcade', () => {
  const kinds = ['rivalry', 'playoff', 'finals'] as const
  test('momentCount arcade: base 2/3/3 ± 1, clamp [2, 4], 1 call; normal segue 3/4/5 ± 1, clamp [2, 5]', () => {
    for (const kind of kinds) {
      const lo = { rivalry: 2, playoff: 2, finals: 2 }[kind], hi = { rivalry: 3, playoff: 4, finals: 4 }[kind]
      const seen = new Set<number>()
      for (let seed = 0; seed < 60; seed++) {
        const { rng, calls } = countedRng(seed)
        const n = momentCount({ kind, opponentTeamId: 'bos' }, rng, true)
        expect(calls()).toBe(1)
        expect(n).toBeGreaterThanOrEqual(lo); expect(n).toBeLessThanOrEqual(hi)
        seen.add(n)
      }
      expect(seen.size).toBeGreaterThanOrEqual(2)
    }
    let big = 0
    for (let seed = 0; seed < 60; seed++) big = Math.max(big, momentCount({ kind: 'finals', opponentTeamId: 'bos' }, createRng(seed)))
    expect(big).toBe(5)                                                     // normal intocado
  })
  test('startWatchedGame({ arcade }) sorteia ≤ 4 momentos e mantém gameRngCalls(n)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { rng, calls } = countedRng(seed)
      const b = build(85)
      let g = startWatchedGame({ context: { kind: 'finals', opponentTeamId: 'bos' }, ourStrength: 75, oppStrength: 78, build: b, age: 27, rng, arcade: true })
      const n = g.moments.length
      expect(n).toBeLessThanOrEqual(4)
      while (g.momentIndex < n) g = applyMoment(g, g.moments[g.momentIndex].options[0], b, 27, rng)
      expect(calls()).toBe(gameRngCalls(n))
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/moments.test.ts --project unit`
Expected: FAIL — `momentCount` ignora o 3º argumento (finais devolvem 5 no arcade).

- [ ] **Step 3: Write minimal implementation**

`src/engine/moments.ts`:

```ts
// linhas 148-156
// modo arcade (cada momento é um minigame): base 2/3/3 e teto 4 — spec 2026-09-03 companheiros-e-ritmo §2
function baseCount(kind: WatchedGameKind, arcade: boolean): number {
  if (kind === 'finals') return arcade ? 3 : 5
  if (kind === 'playoff') return arcade ? 3 : 4
  return arcade ? 2 : 3
}

export function momentCount(context: WatchedGameContext, rng: Rng, arcade = false): number {
  return clamp(baseCount(context.kind, arcade) + rng.int(-1, 1), 2, arcade ? 4 : 5)   // 1 call, sempre
}

// linha 168
export function makeMoments(context: WatchedGameContext, rng: Rng, arcade = false): Moment[] {
  const n = momentCount(context, rng, arcade)            // 1 call

// startWatchedGame (linha 296): campo novo + repasse
  marginBias?: number      // penalidade fixa de margem (ex.: PLAYER_OUT_MARGIN)
  arcade?: boolean         // modo arcade: menos momentos (contagem de calls igual)
}): PendingGame {
  const { context, ourStrength, oppStrength, build, age, rng, targetWinP, marginBias = 0, arcade = false } = input
  ...
  const moments = makeMoments(context, rng, arcade)      // 1 + n calls
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/moments.test.ts --project unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/moments.ts tests/engine/moments.test.ts
git commit -m "feat(arcade): momentos por jogo enxutos no arcade (base 2/3/3, teto 4; 1 call como sempre)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 2 partidas-chave no arcade + fiação no reducer

**Files:**
- Modify: `src/engine/moments.ts:436-491` (selectKeyGames), `src/state.ts:279-286` (chamada), `:589-597` (startWatchedKeyGame), `:466-475` (openPlayoffGame)
- Test: `tests/engine/moments.test.ts`, `tests/state-arcade.test.ts`

**Interfaces:**
- Consumes: `startWatchedGame({ arcade })` (Task 4).
- Produces: `selectKeyGames({ ..., arcade?: boolean })` — arcade devolve `[rivalry, special]`.

- [ ] **Step 1: Write the failing tests**

`tests/engine/moments.test.ts` (import `selectKeyGames` e `initLeague` de `../../src/data/league`):

```ts
describe('partidas-chave no arcade', () => {
  const league = initLeague()
  const base = { league, playerTeamId: 'lal', prevStandings: null, prevChampionTeamId: null }
  test('arcade: 2 jogos (rivalidade + especial), sem corrida de seed e sem extra de evento; 3 calls como no normal', () => {
    const a = countedRng(5)
    const games = selectKeyGames({ ...base, hasRivalryEvent: true, rng: a.rng, arcade: true })
    expect(games.map(g => g.kind)).toEqual(['rivalry', 'special'])
    expect(a.calls()).toBe(3)
    const n = countedRng(5)
    const normal = selectKeyGames({ ...base, hasRivalryEvent: true, rng: n.rng })
    expect(normal.map(g => g.kind)).toEqual(['rivalry', 'seedRace', 'special', 'rivalry'])
    expect(n.calls()).toBe(3)
    expect(games[1].opponentTeamId).toBe(normal[2].opponentTeamId)   // mesmo sorteio do especial
  })
})
```

`tests/state-arcade.test.ts`, novo `describe` no fim (o helper `playToKeyGame` já existe no arquivo; `beginCareer` vem de `./helpers/career`):

```ts
describe('modo arcade — ritmo enxuto', () => {
  test('temporada arcade tem 2 slots de key game (rivalry + special) e ≤ 3 momentos na regular; normal tem ≥ 3 slots', () => {
    const a = playToKeyGame(41, 'arcade')
    expect(a.calendar!.slots.map(s => s.keyGame.kind).sort()).toEqual(['rivalry', 'special'])
    expect(a.pendingGame!.moments.length).toBeLessThanOrEqual(3)
    const n = playToKeyGame(41, 'normal')
    expect(n.calendar!.slots.length).toBeGreaterThanOrEqual(3)
  })
  test('replay: recarregar o save arcade reproduz o mesmo estado (rngCalls bate)', () => {
    const s = playToKeyGame(41, 'arcade')
    const again = playToKeyGame(41, 'arcade')
    expect(again.rngCalls).toBe(s.rngCalls)
    expect(again.pendingGame!.moments).toEqual(s.pendingGame!.moments)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/moments.test.ts tests/state-arcade.test.ts --project unit`
Expected: FAIL — arcade devolve 4 jogos / 3 slots.

- [ ] **Step 3: Write minimal implementation**

`src/engine/moments.ts`, `selectKeyGames`:

```ts
export function selectKeyGames(input: {
  league: LeagueState
  playerTeamId: string
  prevStandings: TeamStanding[] | null
  prevChampionTeamId: string | null
  hasRivalryEvent: boolean
  rng: Rng
  arcade?: boolean          // modo arcade: só rivalidade + especial (spec 2026-09-03 §2); calls iguais
}): KeyGame[] {
  const { league, playerTeamId, prevStandings, prevChampionTeamId, hasRivalryEvent, rng, arcade = false } = input
  ... (tudo igual até montar `games`) ...
  if (arcade) return [games[0], games[2]]                 // depois das 3 calls, antes do extra
  if (hasRivalryEvent) games.push({ kind: 'rivalry', opponentTeamId: rivalryId })
  return games
}
```

`src/state.ts`:

```ts
// linha ~279 (startSeasonCalendar)
  const games = selectKeyGames({
    league: state.league!,
    playerTeamId: team.id,
    prevStandings: state.seasonOutcome?.standings ?? null,
    prevChampionTeamId: state.leagueHistory.at(-1)?.championTeamId ?? null,
    hasRivalryEvent: events.includes('rivalry'),
    rng,
    arcade: state.career.mode === 'arcade',
  })

// startWatchedKeyGame (linha ~589): acrescente no objeto
    build: state.build!, age: state.age, rng,
    arcade: state.career.mode === 'arcade',

// openPlayoffGame (linha ~467): acrescente no objeto
    marginBias: pp.playerOut ? PLAYER_OUT_MARGIN : 0,
    arcade: state.career.mode === 'arcade',
    rng,
```

- [ ] **Step 4: Run the whole unit suite + typecheck**

Run: `npx vitest run --project unit && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS / limpo. Se `tests/state-keygame.test.ts` ou `state-calendar.test.ts` quebrarem, eles rodam em modo normal — investigue antes de tocar neles (não devem mudar).

- [ ] **Step 5: e2e**

Run: `grep -n "slots\|keyGame\|3 jogos\|moments" tests/e2e-playthrough.mjs | head`
Se o e2e conta jogos-chave ou momentos e roda em modo arcade, ajuste a contagem para 2 slots / ≤ 3 momentos; se roda em modo normal, nada a fazer. Registre no commit qual foi o caso.

- [ ] **Step 6: Commit**

```bash
git add src/engine/moments.ts src/state.ts tests/engine/moments.test.ts tests/state-arcade.test.ts tests/e2e-playthrough.mjs
git commit -m "feat(arcade): 2 partidas-chave por temporada e menos momentos nos playoffs (calls de rng iguais)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: HANDOFF

**Files:**
- Modify: `HANDOFF.md:3` (Estado), `:32` (arquitetura de `minigames/`), `:83+` (decisões — nova 29), `:54` e `:63` não mudam (decisões 11/16 seguem verdadeiras para o modo normal)

- [ ] **Step 1: Estado**

Prefixe a linha 3 (`**Data:** ... **Estado:**`) com:

```
**Data:** 2026-09-03 · **Estado:** ciclo **arcade companheiros + ritmo** COMPLETO (decisão 29) — prancheta com os 4 melhores do SEU time (`teammates()`: camisa por hash do id, skill por ovr+tags, velocidade e passe próprios; `ASSIST_SKILL` saiu) e modo arcade enxuto (momentos base 2/3/3 ±1 teto 4; 2 partidas-chave: rivalidade + especial; playoffs iguais, finais com 3 momentos/jogo). Calls de rng idênticas por caminho; calibração intocada por construção (peso 3/n, efeitos centrados, calibração roda em modo normal). Spec `docs/superpowers/specs/2026-09-03-arcade-companheiros-e-ritmo-design.md` · plano `docs/superpowers/plans/2026-09-03-arcade-companheiros-e-ritmo.md` (6 tasks). **NÃO deployado**. Anterior: 
```

- [ ] **Step 2: Arquitetura (linha 32)**

Após `common.ts (adversário real via opponentFive/bestDefender, ...` acrescente `, teammates(league, teamId, number): 4 melhores do seu time → Mate {number, skill, pass, speed}` e em `playbook.ts` acrescente `; decisão 29: skill/velocidade/passe por atacante via input.mates`.

- [ ] **Step 3: Decisão 29**

Após a decisão 28 (antes de `## Comandos`):

```
29. **Companheiros reais + ritmo enxuto do arcade** (2026-09-03, spec/plano acima): `teammates(league, teamId, yourNumber)` = 4 melhores por ovr (mesma ordenação de `opponentFive`), `number = 10 + hash31(id) mod 46` (+1 se igual à sua), `skill.base = clamp((ovr − 30)/60, 0.25, 1)`, três ×1.15 shooter / ×0.9 senão, meia ×1.05 shooter, bandeja ×1.1 rebounder, enterrada = bandeja se PF/C ou ovr ≥ 75 senão ×0.7, `pass = 0.8` playmaker; `MinigameProps.teamId` (regular `currentOffer`, playoffs `pendingPlayoffs.finalOffer`); `PlaybookInput.mates`; `skillFor(optionId, input, holder)`; `runSpeed` = você `4.2 × mods.speed`, companheiro `speed × 1.1`; interceptação × `mates[holder−1].pass` quando ele passa. UI: número + sobrenome no ímã; lab tem "Meu time". Ritmo: `baseCount(kind, arcade)` 2/3/3, `momentCount` clamp [2, 4] no arcade (1 call), `selectKeyGames({arcade})` = `[rivalry, special]` depois das 3 calls, flag desce de `career.mode` em `startSeasonCalendar`/`startWatchedKeyGame`/`openPlayoffGame`. Sem bump de save (calendário já sorteado fica; próximos jogos usam os números novos). Testes: common +2, playbook +3, moments +3, state-arcade +2.
```

- [ ] **Step 4: Commit**

```bash
git add HANDOFF.md
git commit -m "docs: HANDOFF — decisão 29 (companheiros reais + ritmo enxuto do arcade)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
