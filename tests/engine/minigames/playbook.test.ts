import { describe, expect, test } from 'vitest'
import {
  COURT, FORMATIONS, createPlaybook, inPaint, moveTo, openness, pass, shoot, shotOptionFor, step,
  type PlaybookState,
} from '../../../src/engine/minigames/playbook'
import { createRng } from '../../../src/engine/rng'

const ctx = { kind: 'rivalry' as const, handles: 80, passing: 80 }
const DT = 0.05

function run(seed: number, steps: number, act?: (s: PlaybookState, i: number) => PlaybookState) {
  const rng = createRng(seed)
  let s = createPlaybook(rng, ctx)
  for (let i = 0; i < steps; i++) {
    if (act) s = act(s, i)
    s = step(s, DT, rng)
  }
  return s
}
const script = (s: PlaybookState, i: number) => {
  if (i === 3) return moveTo(s, 7.62, 3)
  if (i === 40) return pass(s, 2, createRng(1))
  return s
}
const inside = (p: { x: number; y: number }) =>
  p.x >= 0 && p.x <= COURT.w && p.y >= 0 && p.y <= COURT.d

describe('playbook', () => {
  test('deterministic for a seed + same inputs', () => {
    expect(run(42, 120, script)).toEqual(run(42, 120, script))
    expect(run(42, 120, script)).not.toEqual(run(43, 120, script))
  })

  test('formations: 5 attackers, you (0) beyond the arc or on a wing, all inside court', () => {
    for (const f of Object.values(FORMATIONS)) {
      expect(f).toHaveLength(5)
      expect(f.every(inside)).toBe(true)
    }
  })

  test('everyone stays inside the court after 240 steps of chasing corners', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = run(seed, 240, (st, i) => (i % 50 === 0 ? moveTo(st, i % 100 ? 40 : -40, i % 3 ? 99 : -99) : st))
      expect(s.attackers.every(inside)).toBe(true)
      expect(s.defenders.every(inside)).toBe(true)
    }
  })

  test('pass: defender on the lane can intercept over many seeds; a clear lane never does', () => {
    const base = createPlaybook(createRng(7), { ...ctx, passing: 40 })
    // defensor plantado no meio da linha 0 → 1
    const a = base.attackers[0], b = base.attackers[1]
    const blocked: PlaybookState = {
      ...base,
      defenders: base.defenders.map((d, i) => (i === 0 ? { ...d, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : d)),
    }
    let picks = 0
    for (let seed = 0; seed < 200; seed++) if (pass(blocked, 1, createRng(seed)).turnover === 'intercept') picks++
    expect(picks).toBeGreaterThan(0)
    expect(picks).toBeLessThan(200)

    // pista limpa: todos os defensores longe de qualquer linha de passe
    const clear: PlaybookState = { ...base, defenders: base.defenders.map(d => ({ ...d, x: 7.62, y: 13.5 })) }
    for (let seed = 0; seed < 200; seed++) {
      const r = pass(clear, 3, createRng(seed))
      expect(r.turnover).toBeUndefined()
      expect(r.ball.flying).toEqual({ from: 0, to: 3, progress: 0 })
    }
  })

  test('pass lands after 0.35s and the receiver becomes holder', () => {
    const rng = createRng(3)
    let s = createPlaybook(rng, ctx)
    s = pass(s, 4, rng)
    for (let i = 0; i < 8; i++) s = step(s, DT, rng)
    expect(s.ball.flying).toBeNull()
    expect(s.ball.holder).toBe(4)
    expect(shotOptionFor(s)).toBe('mgAssist')
  })

  test('help defender collapses onto the holder in the paint', () => {
    const rng = createRng(5)
    let s = createPlaybook(rng, ctx)
    s = moveTo(s, COURT.basket.x, 3.5)
    while (!inPaint(s.attackers[0]) && s.phase === 'live') s = step(s, DT, rng)
    expect(s.phase).toBe('live')
    s = step(s, DT, rng)
    expect(s.helper).not.toBeNull()
    expect(s.helper).not.toBe(s.defenders.findIndex(d => d.man === 0))
    const helper = s.defenders[s.helper!]
    expect(helper.target).toEqual(s.attackers[0])
  })

  test('clock expiry → turnover clock, mgMid, quality 0', () => {
    const s = run(9, 20 * COURT.clock + 2)
    expect(s.phase).toBe('turnover')
    expect(s.turnover).toBe('clock')
    expect(s.result).toEqual({ optionId: 'mgMid', quality: 0, turnover: true })
    // congela depois de terminar
    expect(step(s, DT, createRng(1))).toBe(s)
  })

  test('shotOptionFor by holder position', () => {
    const base = createPlaybook(createRng(11), ctx)
    const at = (x: number, y: number): PlaybookState => ({
      ...base, attackers: base.attackers.map((p, i) => (i === 0 ? { x, y } : p)),
    })
    expect(shotOptionFor(at(7.62, 2.5))).toBe('layup-or-dunk')
    expect(shotOptionFor(at(7.62, 5))).toBe('mgMid')
    expect(shotOptionFor(at(7.62, 9.5))).toBe('mgThree')
    expect(shotOptionFor(at(0.5, 2))).toBe('mgThree')     // canto
    expect(shotOptionFor(at(2, 2))).toBe('mgMid')         // dentro da linha do canto
    expect(shotOptionFor({ ...base, ball: { holder: 2, flying: null } })).toBe('mgAssist')

    const rim = at(7.62, 2.5)
    expect(shoot(rim)).toBe(rim)                           // no-op sem finish
    expect(shoot(at(7.62, 2.5), 'dunk').result?.optionId).toBe('mgDunk')
    expect(shoot(at(7.62, 2.5), 'layup').result?.optionId).toBe('mgLayup')
    expect(shoot(at(7.62, 9.5)).result?.optionId).toBe('mgThree')
    expect(shoot(at(7.62, 9.5)).phase).toBe('shooting')
  })

  test('quality in [0,1], higher with farther defenders, ×0.85 under 2s', () => {
    const base = createPlaybook(createRng(13), ctx)
    const far: PlaybookState = { ...base, defenders: base.defenders.map(d => ({ ...d, x: 1, y: 13 })) }
    const tight: PlaybookState = { ...base, defenders: base.defenders.map(d => ({ ...d, ...base.attackers[0] })) }
    for (const s of [base, far, tight]) {
      const q = shoot(s).result!.quality
      expect(q).toBeGreaterThanOrEqual(0)
      expect(q).toBeLessThanOrEqual(1)
      expect(q).toBe(openness(s, 0))
    }
    expect(shoot(far).result!.quality).toBe(1)
    expect(shoot(tight).result!.quality).toBe(0)
    expect(shoot(far).result!.quality).toBeGreaterThan(shoot(base).result!.quality)
    expect(shoot({ ...far, clock: 1.5 }).result!.quality).toBeCloseTo(0.85)
  })
})
