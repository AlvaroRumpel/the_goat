# Arcade — ajustes pós-teste (passe planejado, rebote, formações, arremesso estilingue, muralha fluida + WASD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the owner's six corrections to the three arcade minigames: planned pass + rebound to anyone + 7 start formations (prancheta), slingshot shot with static-obstacle defender (arremesso), fluid movement + WASD (muralha).

**Architecture:** Engine-first (pure TS in `src/engine/minigames/*`, local `Rng`), then the React/SVG renderer in `src/ui/minigames/*`. Each minigame is one task pair (engine → UI). i18n PT/EN parity is tested.

**Tech Stack:** TypeScript, React 19, SVG, vitest. No new deps.

**Spec:** `docs/superpowers/specs/2026-09-03-arcade-ajustes-design.md`

## Global Constraints

- `src/engine/` pure: no React, no localStorage, no `Math.random` — randomness only via the injected `Rng` (`next/int/pick/chance`).
- The minigame rng is LOCAL (`createRng(seed)` in the component); extra local calls do not touch the save's RNG contract → calibration does not need to run.
- Every user-visible string goes through `t(lang, key)` with the key in BOTH `src/data/i18n/pt.json` and `en.json` (parity test in `tests/i18n.test.ts`).
- Animation OBEYS `outcome.success` (engine decides; the UI narrates).
- Before committing: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`.
- Commits: conventional, PT subject as the repo does, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Prancheta engine — formações sorteadas, rebote pra qualquer um, passe planejado

**Files:**
- Modify: `src/engine/minigames/playbook.ts`
- Test: `tests/engine/minigames/playbook.test.ts`

**Interfaces:**
- Produces: `type PassWhen = 'early' | 'mid' | 'late'`; `PlaybookState.plannedPass: { to: number; when: PassWhen; at: number | null } | null`; `PlaybookState.reboundBy: number | null`; `planPass(s, to: number | null, when?: PassWhen): PlaybookState`; `FORMATIONS` with 7 ids (`fiveOut | horns | pnr | iso | box | stack | sideOut`).

- [ ] **Step 1: Failing tests** — append to `tests/engine/minigames/playbook.test.ts` (import `planPass` too):

```ts
const no = { next: () => 0, int: () => 0, pick: <T,>(a: T[]) => a[0], chance: () => false }

describe('formação inicial', () => {
  test('sorteada entre ≥ 5 formações, determinística por seed', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 60; seed++) seen.add(JSON.stringify(createPlaybook(createRng(seed), input()).attackers))
    expect(seen.size).toBeGreaterThanOrEqual(5)
    expect(createPlaybook(createRng(9), input()).attackers).toEqual(createPlaybook(createRng(9), input()).attackers)
  })
})

describe('rebote pra qualquer um', () => {
  test('quem pega é sorteado entre os 5 (peso por proximidade do aro); reboundBy = holder', () => {
    const who = new Set<number>()
    for (let seed = 0; seed < 60; seed++) {
      let tight = live(seed, 'iso'); tight = { ...tight, defenders: tight.defenders.map(d => ({ ...d, x: tight.attackers[0].x + 0.4, y: tight.attackers[0].y })) }
      const r = shoot(tight, createRng(seed), { ...input(), reboundChance: 1 })
      expect(r.phase).toBe('run'); expect(r.reboundBy).toBe(r.ball.holder); who.add(r.ball.holder)
    }
    expect(who.size).toBeGreaterThanOrEqual(2)
  })
})

describe('passe planejado', () => {
  const base = () => ({ ...applyTemplate(createPlaybook(createRng(1), input()), 'iso'), scheme: 'man' as const })
  test('planPass grava/limpa; alvo = portador ou null limpa; modelo limpa', () => {
    const s = base()
    expect(planPass(s, 2, 'late').plannedPass).toEqual({ to: 2, when: 'late', at: null })
    expect(planPass(s, 0, 'early').plannedPass).toBeNull()
    expect(planPass(planPass(s, 2, 'late'), null).plannedPass).toBeNull()
    expect(applyTemplate(planPass(s, 2, 'late'), 'horns').plannedPass).toBeNull()
  })
  test('CEDO passa no 1º tick; TARDE só quando as rotas acabam; NORMAL no meio; isSettled false enquanto pendente', () => {
    const early = startRun(planPass(base(), 2, 'early'))
    expect(isSettled(early)).toBe(false)
    const e1 = step(early, 0.05, no, input())
    expect(e1.ball.flying?.to).toBe(2); expect(e1.plannedPass).toBeNull()

    let late = step(startRun(planPass(base(), 2, 'late')), 0.05, no, input())
    const lateAt = late.plannedPass!.at!
    expect(lateAt).toBeGreaterThan(0.1); expect(late.ball.flying).toBeNull()
    while (late.phase === 'run' && late.plannedPass) late = step(late, 0.05, no, input())
    expect(late.ball.flying?.to).toBe(2)
    late.routes.forEach((r, i) => { if (r.points.length >= 2) expect(late.routeProgress[i]).toBeGreaterThanOrEqual(routeLen(r.points) - 0.25) })

    const mid = step(startRun(planPass(base(), 2, 'mid')), 0.05, no, input())
    expect(mid.plannedPass!.at!).toBeGreaterThan(0.05); expect(mid.plannedPass!.at!).toBeLessThan(lateAt)
  })
  test('alvo virou portador antes do instante = plano só some', () => {
    let s = startRun(planPass(base(), 2, 'late'))
    s = { ...s, ball: { holder: 2, flying: null } }
    while (s.phase === 'run' && s.plannedPass) s = step(s, 0.05, no, input())
    expect(s.ball.holder).toBe(2); expect(s.ball.flying).toBeNull()
  })
})
```
Add helper at top: `const routeLen = (pts: { x: number; y: number }[]) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0)`.

- [ ] **Step 2: Run** `npx vitest run tests/engine/minigames/playbook.test.ts` → FAIL (planPass undefined, reboundBy undefined, formations = 1).

- [ ] **Step 3: Implement** in `src/engine/minigames/playbook.ts`:

```ts
export type FormationId = 'fiveOut' | 'horns' | 'pnr' | 'iso' | 'box' | 'stack' | 'sideOut'
export type PassWhen = 'early' | 'mid' | 'late'
// FORMATIONS: add
  box: [{ x: 7.62, y: 10 }, { x: 5.2, y: 3.0 }, { x: 10.0, y: 3.0 }, { x: 5.2, y: 6.2 }, { x: 10.0, y: 6.2 }],
  stack: [{ x: 3.0, y: 9.0 }, { x: 5.6, y: 3.0 }, { x: 5.6, y: 4.6 }, { x: 5.6, y: 6.2 }, { x: 13.5, y: 8.0 }],
  sideOut: [{ x: 1.0, y: 7.0 }, { x: 4.0, y: 3.0 }, { x: 7.62, y: 5.5 }, { x: 11.5, y: 3.0 }, { x: 13.5, y: 9.0 }],
const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[]
// state: plannedPass, reboundBy (init null); clone copies plannedPass as a new object
// createPlaybook: const formation = rng.pick(FORMATION_IDS)  (BEFORE weightedScheme → 2 calls total)
// applyTemplate: next.plannedPass = null
export function planPass(s: PlaybookState, to: number | null, when: PassWhen = 'mid'): PlaybookState {
  if (s.phase !== 'draw' && s.phase !== 'run') return s
  const next = clone(s)
  next.plannedPass = to === null || to === s.ball.holder || to < 0 || to >= s.attackers.length ? null : { to, when, at: null }
  return next
}
// step (run), right after the ball-in-flight block:
  if (s.plannedPass) {
    const pp = s.plannedPass
    if (pp.at === null) {
      const dur = Math.max(0, ...s.routes.map((r, i) => r.points.length < 2 ? 0 : (routeLength(r.points) - s.routeProgress[i]) / runSpeed))
      pp.at = s.t + (pp.when === 'early' ? 0 : pp.when === 'mid' ? dur / 2 : dur)
    }
    if (s.t >= pp.at && !s.ball.flying) {
      s.plannedPass = null
      if (pp.to !== s.ball.holder) { const passed = pass(s, pp.to, rng, input); if (passed.phase !== 'run') return passed; s = passed }
    }
  }
// shoot, rebound-hit branch, before `next.clock = 5`:
      const w = next.attackers.map(p => 1 / (0.6 + distToBasket(p)))
      let roll = rng.next() * w.reduce((a, b) => a + b, 0), who = w.length - 1
      for (let i = 0; i < w.length; i++) { roll -= w[i]; if (roll <= 0) { who = i; break } }
      next.ball = { holder: who, flying: null }; next.reboundBy = who
// isSettled: if (s.plannedPass) return false
```
`s` in `step` must become `let s` (it is reassigned by the pass). `pass` is a hoisted function declaration — fine.

- [ ] **Step 4: Run** the file → PASS (also the pre-existing tests; `scheme sorteado` still sees ≥ 4 schemes).
- [ ] **Step 5: Commit** `feat(arcade): prancheta — formação sorteada (7), rebote pra qualquer atacante, passe planejado cedo/normal/tarde`.

---

### Task 2: Prancheta UI — PASSAR, seta do plano, animação do rebote

**Files:**
- Modify: `src/ui/minigames/Playbook.tsx`, `src/styles/mg-playbook.css`, `src/data/i18n/pt.json`, `src/data/i18n/en.json`

**Interfaces:** consumes Task 1 (`planPass`, `plannedPass`, `reboundBy`).

- [ ] **Step 1: i18n keys** (pt / en):
```
mg.pb.act.plan        "PASSAR"            / "PASS"
mg.pb.act.planCancel  "CANCELAR PASSE"    / "CANCEL PASS"
mg.pb.passHint        "Toque no companheiro que vai receber o passe" / "Tap the teammate who gets the pass"
mg.pb.passWhen        "Quando passar?"    / "When to pass?"
mg.pb.pass.early      "CEDO"   / "EARLY"
mg.pb.pass.mid        "NORMAL" / "NORMAL"
mg.pb.pass.late       "TARDE"  / "LATE"
```
Rules line added to `mg.rules.playbook` (after DESENHAR line): PT `PASSAR (antes de RODAR): escolha o companheiro e o momento — CEDO (ao rodar), NORMAL (metade da jogada), TARDE (fim da jogada).` EN `PASS (before RUN): pick the teammate and the moment — EARLY (as it runs), NORMAL (halfway), LATE (end of the play).`
`mg.pb.drawHint` PT → `Arraste os ímãs vermelhos pra desenhar a jogada · toque num ímã = bloqueio no fim · PASSAR agenda um passe` (EN analog).

- [ ] **Step 2: Component** (`Playbook.tsx`):
  - `const [passPick, setPassPick] = useState<'pick' | number | null>(null)`; `const [rb, setRb] = useState<'rim' | 'bounce' | null>(null)`.
  - `commit`: on `next.rebounds !== prev.rebounds` also `setRb('rim')`. Effect: `useEffect(() => { if (!rb) return; const id = setTimeout(() => setRb(rb === 'rim' ? 'bounce' : null), rb === 'rim' ? SHOT_MS : 300); return () => clearTimeout(id) }, [rb])`.
  - `onBoardUp`, in the drawing/paused branches, BEFORE the screen-toggle: `if (passPick === 'pick' && idx > 0 && !dragged) { setPassPick(idx); return }`.
  - Buttons (drawing || paused row): `st.plannedPass ? <btn onClick={() => { snapshot(); act(s => planPass(s, null)); }}>{planCancel}</btn> : <btn aria-pressed={passPick==='pick'} onClick={() => setPassPick(p => p ? null : 'pick')}>{plan}</btn>`; when `typeof passPick === 'number'` render chips row `['early','mid','late'].map(w => <btn onClick={() => { snapshot(); act(s => planPass(s, passPick, w)); setPassPick(null) }}>{t('mg.pb.pass.'+w)}</btn>)`; hint text: `passPick === 'pick' ? passHint : typeof passPick === 'number' ? passWhen : (paused ? pauseHint : drawHint)`.
  - `clearRoutes` also `s = planPass(s, null)`; template click also `setPassPick(null)`.
  - Board: when `st.plannedPass` draw `<line className="mg-pb__plan" x1..y2 from attackers[holder] to attackers[to]/>` + `<text className="mg-pb__plan-tag" x=mid y=mid-20>{t('mg.pb.pass.'+when)}</text>`.
  - Ball: `else if (rb === 'rim') { ballAt = BASKET; ballCls += ' mg-pb__ball--shot' } else if (rb === 'bounce') { ballCls += ' mg-pb__ball--bounce' }` (holder pos already computed = rebounder).
- [ ] **Step 3: CSS** `.mg-pb__plan { stroke: var(--ink); stroke-width: 10; stroke-dasharray: 6 22; stroke-linecap: round; opacity: .8 } .mg-pb__plan-tag { font-family: var(--mono); font-size: 30px; letter-spacing: .14em; fill: var(--ink); text-anchor: middle }`.
- [ ] **Step 4:** `npx tsc -p tsconfig.app.json --noEmit` + `npm test` (i18n parity) → PASS. Manual check in `/lab.html` (dev server) — PASSAR → teammate → CEDO → RODAR passes immediately; rebound ball flies to rim then to a magnet.
- [ ] **Step 5: Commit** `feat(arcade): prancheta — botão PASSAR (cedo/normal/tarde), seta do plano, bola vai ao aro e volta no rebote`.

---

### Task 3: Arremesso engine — cena, estilingue, ruído de mira, simulação

**Files:**
- Rewrite: `src/engine/minigames/shot.ts`
- Modify: `src/ui/minigames/FreeThrows.tsx` (only imports/constants), `src/ui/minigames/Playbook.tsx` (`skillOf` signature unchanged for `'layup'|'mid'|'three'|'dunk'`)
- Rewrite test: `tests/engine/minigames/shot.test.ts`

**Interfaces (produces):**
```ts
export type ShotKind = 'layup' | 'mid' | 'three' | 'dunk'
export function skillOf(build: Build, age: number, kind: ShotKind, fatigue?: number): number
export function freeThrowQuality(build: Build, age: number): number
export interface ShotScene { d: number; releaseH: number; gap: number; who: OppPlayer; kind: ShotKind; optionId: string }
export function createScene(rng: Rng, five: OppPlayer[], build: Build, age: number): ShotScene   // 3 rng calls
export interface Launch { angle: number; speed: number }
export function launchFromPull(dx: number, dy: number): Launch | null   // dx,dy = cur − start, metros, y pra cima
export function aimNoise(rng: Rng, skill: number, l: Launch): Launch      // 2 rng calls
export type Fate = 'in' | 'short' | 'long' | 'blocked'
export interface Flight { vx: number; vy: number; h0: number; tEnd: number; err: number; fate: Fate; accuracy: number }
export function simulateShot(scene: ShotScene, l: Launch): Flight
export const flightPoint = (f: Flight, t: number) => ({ x: f.vx * t, y: f.h0 + f.vy * t - G * t * t / 2 })
export function shotQuality(f: Flight, skill: number): number   // accuracy × (0.6 + 0.4 skill)
export function idealSpeed(angleRad, d, releaseH): number  // kept
export function trajectory(angleRad, speed, releaseH): Trajectory // kept (FreeThrows)
export const G, RIM_H, ARC = 7.24, FINISH_D = 1.8, PULL_GAIN = 4, rad
```

- [ ] **Step 1: Test file** (replace `shot.test.ts`):
```ts
import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { initLeague } from '../../../src/data/league'
import { opponentFive } from '../../../src/engine/minigames/common'
import { aimNoise, createScene, flightPoint, freeThrowQuality, idealSpeed, launchFromPull, rad, RIM_H, shotQuality, simulateShot, skillOf, trajectory, type ShotScene } from '../../../src/engine/minigames/shot'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number, over: Partial<Record<SlotId, number>> = {}): Build => ({ attributes: { ...Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])), ...over } as Record<SlotId, number>, picks: [], archetype: 'SF', overall: ovr })
const league = initLeague(); const five = opponentFive(league, 'bos')
const scene = (over: Partial<ShotScene> = {}): ShotScene => ({ d: 6, releaseH: 2.05, gap: 1.5, who: { ...five[0], reach: 2.8 }, kind: 'mid', optionId: 'mgMid', ...over })

describe('skill', () => {
  test('60 = 0.5, 90 = 1, 40 = 0.25, fadiga reduz, atributo por tipo', () => {
    expect(skillOf(build(60), 27, 'three')).toBeCloseTo(0.5, 5); expect(skillOf(build(90), 27, 'mid')).toBeCloseTo(1, 5)
    expect(skillOf(build(40), 27, 'layup')).toBe(0.25); expect(skillOf(build(60), 27, 'three', 0.3)).toBeCloseTo(0.425, 5)
    const b = build(60, { three: 90, finishing: 40, handles: 75 })
    expect(skillOf(b, 27, 'three')).toBeCloseTo(1, 5); expect(skillOf(b, 27, 'dunk')).toBe(0.25); expect(skillOf(b, 27, 'mid')).toBeCloseTo(0.75, 5)
    expect(freeThrowQuality(b, 27)).toBeCloseTo(1, 5)
  })
})
describe('cena', () => {
  test('intervalos, determinismo, zona pela distância, defensor antes do aro', () => {
    const kinds = new Set<string>()
    for (let seed = 0; seed < 80; seed++) {
      const s = createScene(createRng(seed), five, build(80), 27)
      expect(s.d).toBeGreaterThanOrEqual(1.2); expect(s.d).toBeLessThan(8.5)
      expect(s.releaseH).toBeGreaterThanOrEqual(1.9); expect(s.releaseH).toBeLessThan(2.6)
      expect(s.gap).toBeGreaterThanOrEqual(0.6); expect(s.gap).toBeLessThanOrEqual(s.d - 0.4)
      expect(s.kind).toBe(s.d < 1.8 ? (s.d < 1.0 ? 'dunk' : 'layup') : s.d < 7.24 ? 'mid' : 'three')
      kinds.add(s.kind)
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3)
    expect(createScene(createRng(4), five, build(80), 27)).toEqual(createScene(createRng(4), five, build(80), 27))
    expect(createScene(createRng(4), five, build(60), 27).kind).not.toBe('dunk')
  })
})
describe('estilingue', () => {
  test('puxar pra trás e pra baixo = frente e cima; curto demais = null; velocidade clampada', () => {
    const l = launchFromPull(-1, -1)!
    expect(l.angle).toBeCloseTo(rad(45), 5); expect(l.speed).toBeCloseTo(Math.SQRT2 * 4, 5)
    expect(launchFromPull(-0.1, 0)).toBeNull(); expect(launchFromPull(-9, -9)!.speed).toBe(14); expect(launchFromPull(-0.3, -0.3)!.speed).toBe(2)
  })
  test('lançamento ideal = accuracy ≈ 1, fate in; ponto final no aro', () => {
    const sc = scene(); const f = simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d, sc.releaseH) })
    expect(f.fate).toBe('in'); expect(f.accuracy).toBeCloseTo(1, 3)
    const end = flightPoint(f, f.tEnd); expect(end.x).toBeCloseTo(sc.d, 3); expect(end.y).toBeCloseTo(RIM_H, 3)
  })
  test('forte demais = long, fraco = short (inclusive sem subir até o aro), raso por baixo da mão = blocked', () => {
    expect(simulateShot(scene(), { angle: rad(50), speed: 11 }).fate).toBe('long')
    expect(simulateShot(scene(), { angle: rad(50), speed: 6 }).fate).toBe('short')
    expect(simulateShot(scene(), { angle: rad(10), speed: 3 }).fate).toBe('short')
    const b = simulateShot(scene(), { angle: rad(20), speed: 10 }); expect(b.fate).toBe('blocked'); expect(b.accuracy).toBe(0)
    expect(simulateShot(scene(), { angle: rad(120), speed: 8 }).fate).toBe('short')
  })
  test('tolerância: 0.2 m fora ainda pontua na meia; finalização tolera mais', () => {
    const near = simulateShot(scene(), { angle: rad(50), speed: idealSpeed(rad(50), 6.2, 2.05) })
    expect(near.accuracy).toBeGreaterThan(0.3); expect(near.accuracy).toBeLessThan(0.8)
    const fin = scene({ d: 1.4, gap: 0.8, kind: 'layup', optionId: 'mgLayup' })
    const f = simulateShot(fin, { angle: rad(70), speed: idealSpeed(rad(70), 1.7, 2.05) })
    expect(f.accuracy).toBeGreaterThan(0.5)
  })
  test('aimNoise: skill 1 = sem ruído; skill 0.25 espalha; determinístico', () => {
    const l = { angle: rad(50), speed: 8 }
    expect(aimNoise(createRng(1), 1, l)).toEqual(l)
    const n = aimNoise(createRng(1), 0.25, l); expect(n).not.toEqual(l); expect(Math.abs(n.angle - l.angle)).toBeLessThan(rad(20))
    expect(aimNoise(createRng(1), 0.25, l)).toEqual(aimNoise(createRng(1), 0.25, l))
  })
  test('shotQuality ∈ [0,1], cresce com skill, 0 quando bloqueado', () => {
    const sc = scene(); const f = simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d, sc.releaseH) })
    expect(shotQuality(f, 1)).toBeCloseTo(1, 3); expect(shotQuality(f, 0.5)).toBeCloseTo(0.8, 3); expect(shotQuality(f, 0.25)).toBeCloseTo(0.7, 3)
    expect(shotQuality(simulateShot(sc, { angle: rad(20), speed: 10 }), 1)).toBe(0)
  })
  test('trajectory (lance livre) sai da altura de saída e chega ao aro', () => {
    const v = idealSpeed(rad(45), 4.57, 2.05); const tr = trajectory(rad(45), v, 2.05)
    expect(tr.pointAt(0).y).toBeCloseTo(2.05, 6); expect(tr.pointAt(tr.tEnd).x).toBeCloseTo(4.57, 3)
  })
})
```

- [ ] **Step 2: Run** → FAIL (missing exports).
- [ ] **Step 3: Implement** `shot.ts`:
```ts
import type { Build, Rng, SlotId } from '../types'
import { clamp01 } from './index'
import { ageMultiplier } from '../season'
import { bestDefender, type OppPlayer } from './common'

// ARREMESSO estilingue (spec 2026-09-03 arcade-ajustes §2). Cena sorteada pela seed local
// (distância, altura de saída, defensor-obstáculo); o jogador puxa e solta (vetor → velocidade);
// o ruído de mira cresce com (1 − skill); a física decide onde a bola cruza o aro. Puro.

export const G = 9.81, RIM_H = 3.05, ARC = 7.24, FINISH_D = 1.8
export const PULL_GAIN = 4.0, SPEED_MIN = 2, SPEED_MAX = 14
export const rad = (deg: number) => deg * Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type ShotKind = 'layup' | 'mid' | 'three' | 'dunk'
const ATTR: Record<ShotKind, SlotId> = { layup: 'finishing', dunk: 'finishing', mid: 'handles', three: 'three' }
const OPTION: Record<ShotKind, string> = { layup: 'mgLayup', dunk: 'mgDunk', mid: 'mgMid', three: 'mgThree' }
const TOL: Record<ShotKind, number> = { layup: 0.8, dunk: 0.8, mid: 0.45, three: 0.45 }

export function skillOf(build: Build, age: number, kind: ShotKind, fatigue = 0): number {
  const eff = build.attributes[ATTR[kind]] * ageMultiplier(age, build.attributes.physical)
  return clamp((eff - 30) / 60, 0.25, 1) * (1 - fatigue * 0.5)
}
export function freeThrowQuality(build: Build, age: number): number { return skillOf(build, age, 'three') }

export interface ShotScene { d: number; releaseH: number; gap: number; who: OppPlayer; kind: ShotKind; optionId: string }
export function createScene(rng: Rng, five: OppPlayer[], build: Build, age: number): ShotScene {
  const d = 1.2 + rng.next() * 7.3
  const releaseH = 1.9 + rng.next() * 0.7
  const gap = Math.min(d - 0.4, 0.8 + rng.next() * 1.6)
  const phys = build.attributes.physical * ageMultiplier(age, build.attributes.physical)
  const kind: ShotKind = d < FINISH_D ? (phys >= 75 && d < 1.0 ? 'dunk' : 'layup') : d < ARC ? 'mid' : 'three'
  return { d, releaseH, gap, who: bestDefender(five), kind, optionId: OPTION[kind] }
}

export interface Launch { angle: number; speed: number }
export function launchFromPull(dx: number, dy: number): Launch | null {
  const len = Math.hypot(dx, dy)
  if (len < 0.15) return null
  return { angle: Math.atan2(-dy, -dx), speed: clamp(len * PULL_GAIN, SPEED_MIN, SPEED_MAX) }
}
export function aimNoise(rng: Rng, skill: number, l: Launch): Launch {
  const u1 = Math.max(1e-9, rng.next()), u2 = rng.next()
  const r = Math.sqrt(-2 * Math.log(u1))
  const g1 = r * Math.cos(2 * Math.PI * u2), g2 = r * Math.sin(2 * Math.PI * u2)
  const k = 1 - skill
  return { angle: l.angle + g1 * k * rad(5), speed: l.speed * (1 + g2 * k * 0.06) }
}

export type Fate = 'in' | 'short' | 'long' | 'blocked'
export interface Flight { vx: number; vy: number; h0: number; tEnd: number; err: number; fate: Fate; accuracy: number }
export const flightPoint = (f: Flight, t: number) => ({ x: f.vx * t, y: f.h0 + f.vy * t - G * t * t / 2 })
export function simulateShot(scene: ShotScene, l: Launch): Flight {
  const vx = l.speed * Math.cos(l.angle), vy = l.speed * Math.sin(l.angle), h0 = scene.releaseH
  const y = (t: number) => h0 + vy * t - G * t * t / 2
  const tGround = (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G
  const miss = (fate: Fate, tEnd: number): Flight => ({ vx, vy, h0, tEnd, err: -Infinity, fate, accuracy: 0 })
  if (vx <= 0) return miss('short', tGround)
  const tb = scene.gap / vx
  if (tb < tGround && y(tb) < scene.who.reach) return miss('blocked', tb)
  const disc = vy * vy - 2 * G * (RIM_H - h0)
  if (disc < 0) return miss('short', tGround)
  const tc = (vy + Math.sqrt(disc)) / G
  const err = vx * tc - scene.d
  const accuracy = clamp01(1 - Math.abs(err) / TOL[scene.kind])
  const fate: Fate = err < -0.1 ? 'short' : err > 0.1 ? 'long' : 'in'
  return { vx, vy, h0, tEnd: tc, err, fate, accuracy }
}
export function shotQuality(f: Flight, skill: number): number { return f.accuracy * (0.6 + 0.4 * skill) }

// ---- física do lance livre (parábola automática) ----
export function idealSpeed(...) // unchanged
export interface Trajectory ... export function trajectory(...) // unchanged
```
Note the blocked check needs `y(tb) < reach` AND the ball actually reaches x=gap before the ground (`tb < tGround`); for a shot going over the head and short, fate short. The `rad(120)` case: vx < 0 → short.

- FreeThrows: `import { freeThrowQuality, idealSpeed, rad, RIM_H, trajectory }`; `const FT_D = 4.57, FT_H = 2.05; export const FLIGHT_MS = 900`; `trajectory(rad(45), idealSpeed(rad(45), FT_D, FT_H), FT_H)`; hoop at `px(FT_D)`. Remove `FLIGHT_MS` import from `./Shot`.

- [ ] **Step 4: Run** `npx vitest run tests/engine/minigames/shot.test.ts` → PASS. `Shot.tsx` won't typecheck yet — that's Task 4 (same commit if needed; otherwise commit engine + FreeThrows only after Task 4's tsc). Prefer: do Task 3 and 4 then one tsc check; commit separately anyway.
- [ ] **Step 5: Commit** `feat(arcade): arremesso — engine estilingue (cena sorteada, ruído por skill, obstáculo estático)`.

---

### Task 4: Arremesso UI — arrastar e soltar

**Files:**
- Rewrite: `src/ui/minigames/Shot.tsx`, `src/styles/mg-shot.css`
- Modify: `src/data/i18n/{pt,en}.json`, `tests/e2e-playthrough.mjs` (shot branch), `src/lab.tsx` (nothing — same props)

- [ ] **Step 1: i18n.** Remove `mg.shot.type.*`, `mg.shot.pickType`, `mg.shot.phase.pick`, `mg.shot.bank`, `mg.shot.open`. Add:
```
mg.shot.phase.aim   "MIRE"      / "AIM"
mg.shot.dragHint    "Arraste a bola pra trás e solte. Quanto mais puxar, mais forte." / "Drag the ball back and release. Pull farther for more power."
mg.shot.zone.finish "FINALIZAÇÃO" / "FINISH"
mg.shot.zone.mid    "MEIA DISTÂNCIA" / "MID-RANGE"
mg.shot.zone.three  "TRÊS" / "THREE"
```
Rewrite `mg.hint.shot` PT: `Arraste a bola pra trás e solte, como um estilingue. O marcador é um obstáculo parado: passe por cima da mão dele.` and `mg.rules.shot` PT:
```
Arraste a bola pra trás e solte: a direção e o tamanho da puxada viram o arco. O pontilhado mostra o começo do voo — quanto melhor seu atributo, mais longe você enxerga.
O marcador está PARADO com a mão erguida: bola que passa por baixo é toco.
Seu atributo (finalização perto, handles na meia, três de longe) também deixa a mira mais firme — atributo baixo treme mais.
Distância e altura da bola mudam a cada momento. Muito perto do aro = finalização.
```
(EN analog.) `mode.arcade.line1` stays.

- [ ] **Step 2: Component.** Replace `Shot.tsx`:
```tsx
import { useEffect, useMemo, useRef, useState, type JSX, type PointerEvent as RPointerEvent } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { attrMods, opponentFive } from '../../engine/minigames/common'
import { aimNoise, createScene, flightPoint, launchFromPull, RIM_H, shotQuality, simulateShot, skillOf, type Flight, type ShotScene } from '../../engine/minigames/shot'

const M = 30, X0 = 40, GY = 4.4 * M, H = 150, HAND = 0.3
const px = (xm: number) => X0 + xm * M
const py = (h: number) => Math.min(GY, Math.max(2, GY - h * M))
type Phase = 'aim' | 'flight' | 'done'
type UiFate = 'swish' | 'short' | 'long' | 'rimOut' | 'blocked'
const END: Record<UiFate, [number, number]> = { swish: [0, RIM_H - 0.2], short: [-1.2, RIM_H - 1.0], long: [0.8, RIM_H - 0.35], rimOut: [0.4, RIM_H + 0.15], blocked: [0, 0] }
const ZONE = { layup: 'finish', dunk: 'finish', mid: 'mid', three: 'three' } as const

export function ShotGame({ seed, context, build, age, quarter, league, number, lastName, lang, onResolve, outcome }: MinigameProps): JSX.Element {
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const mods = useMemo(() => attrMods(build, age, quarter), [build, age, quarter])
  const boot = useRef<{ rng: Rng; scene: ShotScene } | null>(null)
  if (!boot.current) { const rng = createRng(seed); boot.current = { rng, scene: createScene(rng, five, build, age) } }
  const { rng, scene } = boot.current
  const skill = skillOf(build, age, scene.kind, mods.fatigue)
  const W = X0 + (scene.d + 1.6) * M

  const [phase, setPhase] = useState<Phase>('aim')
  const [drag, setDrag] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [, setFrame] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const t0 = useRef(0), now = useRef(0), resolved = useRef(false)
  const onResolveRef = useRef(onResolve); onResolveRef.current = onResolve

  // pointer → metros (x pra direita, y pra cima), via CTM (o SVG fica letterboxado)
  const toM = (e: RPointerEvent) => { const m = svgRef.current?.getScreenCTM(); if (!m) return null; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: (p.x - X0) / M, y: (GY - p.y) / M } }
  const onDown = (e: RPointerEvent<SVGSVGElement>) => { if (phase !== 'aim') return; const p = toM(e); if (!p) return; svgRef.current?.setPointerCapture(e.pointerId); setDrag({ sx: p.x, sy: p.y, cx: p.x, cy: p.y }) }
  const onMove = (e: RPointerEvent<SVGSVGElement>) => { if (!drag) return; const p = toM(e); if (p) setDrag(d => d && { ...d, cx: p.x, cy: p.y }) }
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId)
    const l = launchFromPull(drag.cx - drag.sx, drag.cy - drag.sy); setDrag(null)
    if (!l || resolved.current) return
    resolved.current = true
    const f = simulateShot(scene, aimNoise(rng, skill, l))
    setFlight(f); t0.current = performance.now(); now.current = t0.current; setPhase('flight')
    onResolveRef.current({ optionId: scene.optionId, quality: shotQuality(f, skill) })
  }
  const flightMs = flight ? Math.max(600, flight.tEnd * 1000) : 0
  useEffect(() => {
    if (phase !== 'flight') return
    let raf = 0
    const loop = (ts: number) => { now.current = ts; if (ts - t0.current >= flightMs + 250) { setPhase('done'); return } setFrame(f => f + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, flightMs])

  const fate: UiFate | null = !flight || !outcome ? null : outcome.success ? 'swish' : flight.fate === 'blocked' ? 'blocked' : flight.fate === 'in' ? 'rimOut' : flight.fate
  const hoop = px(scene.d), rimY = py(RIM_H)
  // guia: arco previsto sem ruído, só o começo (fração cresce com skill)
  const guide = drag ? (() => { const l = launchFromPull(drag.cx - drag.sx, drag.cy - drag.sy); if (!l) return []; const f = simulateShot(scene, l); const n = Math.round(16 * (0.3 + 0.5 * skill)); return Array.from({ length: n }, (_, i) => flightPoint(f, (i + 1) / 16 * f.tEnd)) })() : []
  const ball = ballAt(phase, drag, flight, fate, now.current - t0.current, flightMs, scene)

  return (
    <div className="mg mg-shot">
      <div className="mg-sh-stage">
        <svg ref={svgRef} className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect className="mg-sh__paper" x={0} y={0} width={W} height={H} />
          {Array.from({ length: Math.ceil(W / 25) }, (_, i) => <rect key={i} className={'mg-sh__plank' + (i % 2 ? ' mg-sh__plank--b' : '')} x={i * 25} y={GY} width={25} height={H - GY} />)}
          <line className="mg-sh__floor" x1={0} y1={GY} x2={W} y2={GY} />
          <line className="mg-sh__rig" x1={hoop + 0.55 * M} y1={GY} x2={hoop + 0.55 * M} y2={rimY - 1.0 * M} />
          <line className="mg-sh__board" x1={hoop + 0.15 * M} y1={rimY - 1.05 * M} x2={hoop + 0.15 * M} y2={rimY + 0.3 * M} />
          <line className="mg-sh__rim" x1={hoop - 0.32 * M} y1={rimY} x2={hoop + 0.15 * M} y2={rimY} />
          <path className="mg-sh__net" d={`M ${hoop - 0.28 * M} ${rimY} L ${hoop - 0.08 * M} ${rimY + 0.5 * M} L ${hoop + 0.11 * M} ${rimY}`} />
          <Figure x={px(scene.gap)} them reach={scene.who.reach} label={scene.who.short} />
          <Figure x={X0} them={false} reach={phase === 'aim' ? scene.releaseH : scene.releaseH + 0.5} label={`${number ?? ''} ${lastName}`.trim()} />
          {guide.map((p, i) => <circle key={i} className="mg-sh__guide" cx={px(p.x)} cy={py(p.y)} r={1.6} />)}
          <circle className="mg-sh__ball" cx={px(ball.x)} cy={py(ball.y)} r={5} />
        </svg>
        <div className="mg-sh-hud">
          <div className="mg-sh-hud__row">
            <span className="mono-label mono-label--red">{t(lang, 'mg.shot.phase.' + (phase === 'aim' ? 'aim' : 'flight'))}</span>
            <span className="mg-sh-tagline">{t(lang, 'mg.shot.defender')} · {scene.who.short} · {scene.gap.toFixed(1)} m</span>
          </div>
          <span className="mg-sh-tagline">{t(lang, 'mg.shot.zone.' + ZONE[scene.kind])} · {scene.d.toFixed(1)} m</span>
        </div>
      </div>
      <div className="mg-sh-bar">
        <span className="mg-sh-label">{phase === 'aim' ? t(lang, 'mg.shot.dragHint') : t(lang, 'mg.shot.zone.' + ZONE[scene.kind])}</span>
        <span className="mg-sh-bar__line"><span className="mg-sh-bar__label">{t(lang, 'mg.shot.skill')}</span><span className="bar"><span className="bar__fill" style={{ width: `${Math.round(skill * 100)}%` }} /></span></span>
      </div>
      {phase === 'done' && outcome && (
        <div className={'mg-result' + (!outcome.success || outcome.injury ? ' mg-result--bad' : '')}>
          <span>{t(lang, outcome.injury ? 'mg.result.injury' : outcome.success ? 'mg.result.hit' : 'mg.result.miss')}</span>
          {fate && <span className="mg-result__sub">{t(lang, 'mg.shot.' + fate)}</span>}
        </div>
      )}
    </div>
  )
}
function Figure({ x, them, reach, label }: { x: number; them: boolean; reach: number; label: string }) { /* as today, arm tip at py(reach), head at py(1.8) */ }
// bola: na mão (segue a puxada até 1 m); no voo, trajetória real até 80 % e converge pro desfecho
function ballAt(phase, drag, flight, fate, elapsed, flightMs, scene) {
  const hand = { x: HAND, y: scene.releaseH }
  if (phase === 'aim' || !flight) { if (!drag) return hand; const dx = drag.cx - drag.sx, dy = drag.cy - drag.sy, len = Math.hypot(dx, dy), k = len > 1 ? 1 / len : 1; return { x: hand.x + dx * k, y: hand.y + dy * k } }
  const p = Math.min(1, Math.max(0, elapsed / flightMs))
  const pt = flightPoint(flight, p * flight.tEnd); pt.x += HAND
  const mix = (a: number, b: number, k: number) => a + (b - a) * k
  if (fate === 'blocked') { const k = Math.min(1, p / 0.5); return { x: mix(pt.x, HAND + scene.gap, k), y: Math.max(0.12, mix(pt.y, scene.who.reach, k) - Math.max(0, p - 0.5) * 4) } }
  if (p <= 0.8 || !fate) return { x: pt.x, y: Math.max(0.12, pt.y) }
  const [ex, ey] = END[fate]; const k = (p - 0.8) / 0.2
  return { x: mix(pt.x, scene.d + ex, k), y: mix(pt.y, ey, k) }
}
```
(The flight `x` is measured from the hand, so add `HAND` — and the hoop must be at `px(scene.d + HAND)`… simpler: put the hand at x = 0 (`HAND = 0`) so hoop = `px(d)`; shooter figure at `X0`, ball starts at `px(0)`. Use HAND = 0.)

- [ ] **Step 3: CSS** — drop `.mg-sh-pick*`, `.mg-sh-key`, `.mg-sh-pickbtn*`, `@media` pick rule; add `.mg-sh-stage { touch-action: none; cursor: grab } .mg-sh-svg { touch-action: none } .mg-sh__guide { fill: var(--ink); opacity: .45 }`; keep `.mg-sh-bar__line/.bar` styles (used by skill bar). `.mg-sh-bar__line { grid-template-columns: 90px 1fr; max-width: 320px }`.
- [ ] **Step 4: e2e** shot branch:
```js
    } else if (await arcadePage.locator('.mg-shot').count() > 0) {
      log('arcade minigame: arremesso estilingue — drag back and release')
      const box = await arcadePage.locator('.mg-sh-svg').boundingBox()
      await arcadePage.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.55)
      await arcadePage.mouse.down()
      await arcadePage.mouse.move(box.x + box.width * 0.02, box.y + box.height * 0.85, { steps: 8 })
      await arcadePage.mouse.up()
    }
```
- [ ] **Step 5:** tsc + `npm test` → PASS. Lab manual: drag/release, guide dots, block under the hand, result overlay.
- [ ] **Step 6: Commit** `feat(arcade): arremesso — arrasta e solta (estilingue), guia por skill, marcador-obstáculo, distância/altura sorteadas`.

---

### Task 5: Muralha engine — movimento contínuo

**Files:**
- Modify: `src/engine/minigames/defense.ts`
- Test: `tests/engine/minigames/defense.test.ts`

**Interfaces (produces):** `DuelState.move: { kind; at; dur; fromX; toX } | null`, `DuelState.defVx: number`, `DuelState.slideUntil: number`; `slide(s, dir: -1 | 0 | 1, input, hold = false)`; constants `SLIDE_SPEED = 3.2`, `BURST = 0.3`.

- [ ] **Step 1: Tests** — change the shadow policy line to `if (!inFront(s)) s = slide(s, s.attX > s.defX ? 1 : -1, inp, true); else s = slide(s, 0, inp)`; add:
```ts
  test('movimento contínuo: ele nunca salta (|Δx| por tick ≤ 0.35 fora do fim do drive) e avança devagar (attDist cai, ≥ 4)', () => {
    for (let seed = 0; seed < 30; seed++) {
      let s = createDuel(input()); const rng = createRng(seed); let prev = s
      for (let i = 0; i < 200 && s.phase === 'live'; i++) {
        s = step(s, 0.05, rng, input())
        if (s.phase === 'live') { expect(Math.abs(s.attX - prev.attX)).toBeLessThanOrEqual(0.35); expect(s.attDist).toBeLessThanOrEqual(prev.attDist); expect(s.attDist).toBeGreaterThanOrEqual(4) }
        prev = s
      }
    }
  })
  test('slide: segurar move a 3.2 m/s × speed; burst para sozinho em 0.3s; dir 0 para; no ar não desliza', () => {
    const inp = input(); const v = 3.2 * inp.mods.speed
    let s = slide(createDuel(inp), 1, inp, true); const rng = createRng(1)
    for (let i = 0; i < 10; i++) s = step(s, 0.05, rng, inp)
    expect(s.defX).toBeCloseTo(0.5 * v, 2)
    s = slide(s, 0, inp); s = step(s, 0.05, rng, inp); expect(s.defVx).toBe(0)
    let b = slide(createDuel(inp), -1, inp); const rng2 = createRng(2)
    for (let i = 0; i < 12; i++) b = step(b, 0.05, rng2, inp)
    expect(b.defVx).toBe(0); expect(b.defX).toBeCloseTo(-0.3 * v, 1)
    const air = { ...createDuel(inp), airborne: 1 }; expect(slide(air, 1, inp, true).defVx).toBe(0)
  })
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (`defense.ts`):
```ts
export const SLIDE_SPEED = 3.2, BURST = 0.3
const APPROACH = 0.45, MIN_DIST = 4.0
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
// DuelState: move: { kind: Move; at: number; dur: number; fromX: number; toX: number } | null; defVx: number; slideUntil: number
// createDuel: defVx: 0, slideUntil: 0
function targetX(s: DuelState, m: Move): number {
  switch (m) {
    case 'crossL': return clamp(s.attX - 0.9, -2.5, 2.5)
    case 'crossR': return clamp(s.attX + 0.9, -2.5, 2.5)
    case 'spin': return clamp(s.attX + (s.attX <= 0 ? 1.1 : -1.1), -2.5, 2.5)
    case 'driveL': return clamp(s.attX - 0.3, -2.5, 2.5)
    case 'driveR': return clamp(s.attX + 0.3, -2.5, 2.5)
    default: return s.attX
  }
}
function finishMove(s, m): DuelState {
  switch (m) {
    case 'driveL': case 'driveR': {
      const dir = m === 'driveR' ? 1 : -1
      if (!inFront(s) || s.airborne > 0) return { ...s, attX: clamp(s.attX + dir * 0.3, -2.5, 2.5), attDist: 1.2, phase: 'drive' }
      return s
    }
    case 'pass': return { ...s, phase: 'done' }
    case 'shoot': return { ...s, phase: 'shot' }
    default: return s
  }
}
// step: after decays —
  if (s.t >= s.slideUntil || s.airborne > 0) s.defVx = 0
  s.defX = clamp(s.defX + s.defVx * dt, -2.5, 2.5)
  s.attDist = Math.max(MIN_DIST, 7.5 - APPROACH * s.live)
// when picking a move: s.move = { kind, at: s.t, dur: DUR[kind] / input.difficulty, fromX: s.attX, toX: targetX(s, kind) }
// before the shoot/contest check: const m = s.move!; s.attX = lerp(m.fromX, m.toX, clamp01((s.t - m.at) / m.dur))
export function slide(s: DuelState, dir: -1 | 0 | 1, input: DuelInput, hold = false): DuelState {
  if (s.phase !== 'live' || s.airborne > 0) return s
  return { ...s, defVx: dir * SLIDE_SPEED * input.mods.speed, slideUntil: dir === 0 ? 0 : hold ? Infinity : s.t + BURST }
}
```
`clamp01` import from `./index` already exists. Keep `trySteal`'s attacker shove (`attX ± 1.2`) — it is the one allowed "jump" (test tolerance covers it? No: 1.2 > 0.35 — the test doesn't call trySteal, fine).
- [ ] **Step 4: Run** the defense file → PASS (check 'sombrear certo' still > 0.6; if not, raise SLIDE_SPEED to 3.6 and note it).
- [ ] **Step 5: Commit** `feat(arcade): muralha — atacante interpola o movimento e avança; defensor por velocidade (segurar/burst)`.

---

### Task 6: Muralha UI — WASD, segurar, transform suave, legenda; HANDOFF

**Files:**
- Modify: `src/ui/minigames/defenseFlow.ts`, `src/ui/minigames/Defense.tsx`, `src/ui/minigames/useSwipe.ts`, `src/styles/mg-defense.css`, `src/data/i18n/{pt,en}.json`, `tests/e2e-playthrough.mjs`, `HANDOFF.md`

- [ ] **Step 1: i18n.** Remove `mg.def.gest.*`. Add:
```
mg.def.key.left  "A ◀"   mg.def.key.right "▶ D"   mg.def.key.up "W ▲"   mg.def.key.down "S ▼"   (same in EN)
mg.def.keys.slide "A / D · deslizar (segure)" / "A / D · slide (hold)"
mg.def.keys.steal "S · roubar" / "S · steal"
mg.def.keys.arm   "W · contestar" / "W · contest"
```
Rewrite `mg.hint.defense` PT: `Segure A/D (ou ◀ ▶) pra acompanhar · S (ou Espaço) rouba com a bola exposta · W (ou ▲) arma a mão em cima.` and `mg.rules.defense` PT:
```
Ele vem com a bola. Fique na frente: segure A / D (ou as setas) pra deslizar. No celular, arraste no palco.
S (ou Espaço, ou ▼) = roubo — só vale com a bola exposta (bola acesa); a chance é sua defesa. Fora disso é erro, e o 2º erro é falta.
W (ou ▲) = CONTESTAR: arma a mão em cima. Se ele sobe pra valer, chance de toco (defesa). Se ele finta, você cai e ele infiltra — ou puxa falta. A postura dura ~1s: re-arme.
O cartão de TENDÊNCIAS diz quando armar. A posse dura ~9s.
```
(EN analog.)
- [ ] **Step 2: useSwipe** — delete the `key` handler and its add/remove lines (pointer only). `tests/ui/useSwipe.test.ts` untouched.
- [ ] **Step 3: defenseFlow** — `gesture`: `left/right → commit(slide(s, DIR[g], input))` (burst); add `hold = useCallback((dir: -1 | 0 | 1) => { const s = stRef.current; if (phaseRef.current !== 'live' || s.phase !== 'live') return; commit(slide(s, dir, input, true)) }, [commit, input])`; keyboard effect:
```ts
  useEffect(() => {
    if (phase !== 'live') return
    const held = new Set<string>()
    const dirOf = () => ((held.has('right') ? 1 : 0) + (held.has('left') ? -1 : 0)) as -1 | 0 | 1
    const side = (k: string) => k === 'a' || k === 'A' || k === 'ArrowLeft' ? 'left' : k === 'd' || k === 'D' || k === 'ArrowRight' ? 'right' : null
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
      const s = side(e.key)
      if (s) { e.preventDefault(); if (!held.has(s)) { held.add(s); hold(dirOf()) } return }
      if (e.repeat) return
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') { e.preventDefault(); gesture('up') }
      else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); gesture('tap') }
    }
    const up = (e: KeyboardEvent) => { const s = side(e.key); if (s && held.delete(s)) hold(dirOf()) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [phase, gesture, hold])
```
Export `hold` in `DuelFlow`.
- [ ] **Step 4: Defense.tsx** — magnets in `<g className={'mg-df__pos' + (st.phase === 'drive' ? ' mg-df__pos--drive' : '')} style={{ transform: `translate(${him.x}px, ${him.y}px)` }}>` with children at (0,0); same for you (no drive class). Cone path keeps absolute coords (it re-renders at 20 Hz; fine). Pad: `[['left','mg.def.key.left','mg.def.left'],['tap','mg.def.key.down','mg.def.steal'],['up','mg.def.key.up','mg.def.arm'],['right','mg.def.key.right','mg.def.right']]`; `GestBtn` renders `<kbd className="mg-df-padbtn__key">{key}</kbd><span>{label}</span>`; for left/right: `onPointerDown={() => flow.hold(dir)} onPointerUp/onPointerLeave/onPointerCancel={() => flow.hold(0)}`; others `onPointerDown={() => flow.gesture(g)}`. HUD legend: three spans from `mg.def.keys.*`.
- [ ] **Step 5: CSS** — `.mg-df__pos { transition: transform 60ms linear } .mg-df__pos--drive { transition-duration: 600ms } .mg-df-padbtn { display: flex; flex-direction: column; gap: 3px } .mg-df-padbtn__key { font-family: var(--mono); font-size: 13px; letter-spacing: .1em; color: var(--accent-warm) } @media (prefers-reduced-motion: reduce) { .mg-df__pos { transition: none } }`. Keep `.mg-df-gest` styles (reused for the key legend).
- [ ] **Step 6: e2e** muralha branch: `for k<12: await keyboard.down(k%2?'KeyD':'KeyA'); waitForTimeout(400); keyboard.up(...); if (k%4===3) keyboard.press('KeyW')`.
- [ ] **Step 7:** tsc + `npm test` → PASS; lab manual: hold A/D glides, W arms, S steals, no jumps.
- [ ] **Step 8: HANDOFF.md** — new "Estado" paragraph: ciclo **arcade ajustes** (decisão 27) with the six items, ⚠ assumptions (release height = "alturas"; defender obstacle without openness multiplier), spec/plan paths, "NÃO deployado".
- [ ] **Step 9: Commit** `feat(arcade): muralha — WASD/setas com segurar, swipe = burst, ímãs com transição, legenda das teclas; HANDOFF`.

---

## Self-review

- Spec 1.1 → T1/T2; 1.2 → T1/T2; 1.3 → T1; 2.x → T3/T4; 3.1 → T5/T6; 3.2 → T6; tests §4 → T1/T3/T5 + e2e in T4/T6; HANDOFF → T6. ✔
- Names: `planPass/plannedPass/reboundBy` (T1↔T2), `createScene/launchFromPull/aimNoise/simulateShot/flightPoint/shotQuality/skillOf(kind)` (T3↔T4), `slide(s, dir, input, hold)` + `hold()` (T5↔T6). ✔
