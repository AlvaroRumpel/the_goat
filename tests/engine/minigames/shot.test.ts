import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { SLOT_ORDER, type Build, type SlotId, type WatchedGameContext } from '../../../src/engine/types'
import { attrMods, opponentFive } from '../../../src/engine/minigames/common'
import { initLeague } from '../../../src/data/league'
import {
  angleValue, availableTypes, bankCrossX, createCloseout, crossX, evaluate, freeThrowQuality, idealSpeed,
  jumpTiming, meterValue, rad, refSpeed, resultFor, scenarioFor, SHOTS, stepCloseout, trajectory, type ShotType,
} from '../../../src/engine/minigames/shot'

const build = (ovr: number, over: Partial<Record<SlotId, number>> = {}): Build => ({
  attributes: { ...Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])), ...over } as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const H3 = SHOTS.three.releaseH
const mods80 = attrMods(build(80), 27)

describe('shot physics', () => {
  test('idealSpeed at 50° for the three crosses the rim center', () => {
    const v = idealSpeed(rad(50), 7.24, H3)
    expect(Number.isFinite(v)).toBe(true)
    expect(Math.abs(crossX(rad(50), v, H3)! - 7.24)).toBeLessThan(0.01)
    expect(evaluate('three', rad(50), v, { closeout: null, jump: null, mods: mods80 }).quality).toBeCloseTo(1, 3)
  })

  test('angle too flat → no solution', () => {
    expect(Number.isNaN(idealSpeed(rad(5), 7.24, H3))).toBe(true)
    expect(crossX(rad(5), 3, H3)).toBeNull()
    expect(evaluate('three', rad(5), 3, { closeout: null, jump: null, mods: mods80 }).quality).toBe(0)
  })

  test('speed off the ideal → quality lower, monotonic', () => {
    const v = idealSpeed(rad(50), 7.24, H3)
    const q = (k: number) => evaluate('three', rad(50), v * k, { closeout: null, jump: null, mods: mods80 }).quality
    expect(q(1)).toBeGreaterThan(q(1.03))
    expect(q(1.03)).toBeGreaterThan(q(1.06))
    expect(q(1.06)).toBeGreaterThanOrEqual(q(1.12))
    expect(q(1.12)).toBeLessThan(q(1))
    expect(q(1)).toBeGreaterThan(q(0.97))
    expect(q(0.97)).toBeGreaterThan(q(0.94))
    expect(q(0.94)).toBeGreaterThanOrEqual(q(0.88))
    expect(evaluate('three', rad(50), v * 1.12, { closeout: null, jump: null, mods: mods80 }).verdict).toBe('long')
    expect(evaluate('three', rad(50), v * 0.88, { closeout: null, jump: null, mods: mods80 }).verdict).toBe('short')
  })

  test('flat entry (20°) halves the tolerance', () => {
    // mesma sobra de 0.2m nos dois: velocidade ideal para d+0.2
    const flat = evaluate('three', rad(20), idealSpeed(rad(20), 7.44, H3), { closeout: null, jump: null, mods: mods80 })
    const arc = evaluate('three', rad(50), idealSpeed(rad(50), 7.44, H3), { closeout: null, jump: null, mods: mods80 })
    expect(flat.entryAngle).toBeLessThan(32)
    expect(arc.entryAngle).toBeGreaterThan(32)
    expect(flat.err).toBeCloseTo(0.2, 2)
    expect(arc.err).toBeCloseTo(0.2, 2)
    expect(flat.quality).toBeLessThan(arc.quality)
  })

  test('layup is more tolerant than the three for the same error', () => {
    const lay = evaluate('layup', rad(60), idealSpeed(rad(60), SHOTS.layup.d + 0.3, SHOTS.layup.releaseH), { closeout: null, jump: null, mods: mods80 })
    const three = evaluate('three', rad(60), idealSpeed(rad(60), SHOTS.three.d + 0.3, H3), { closeout: null, jump: null, mods: mods80 })
    expect(lay.err).toBeCloseTo(0.3, 2)
    expect(three.err).toBeCloseTo(0.3, 2)
    expect(lay.quality).toBeGreaterThan(three.quality)
  })

  test('dunk: any speed within 30% of the ideal is perfect', () => {
    const v = refSpeed('dunk')
    expect(evaluate('dunk', rad(60), v * 1.29, { closeout: null, jump: null, mods: mods80 }).quality).toBe(1)
    expect(evaluate('dunk', rad(60), v * 0.71, { closeout: null, jump: null, mods: mods80 }).quality).toBe(1)
    expect(evaluate('dunk', rad(60), v * 1.6, { closeout: null, jump: null, mods: mods80 }).quality).toBeLessThan(1)
  })

  test('quality stays in [0,1] over a grid', () => {
    for (const type of Object.keys(SHOTS) as ShotType[])
      for (let a = 10; a <= 80; a += 5)
        for (let v = 0; v <= 20; v += 0.5) {
          const q = evaluate(type, rad(a), v, { closeout: null, jump: null, mods: mods80 }).quality
          expect(q).toBeGreaterThanOrEqual(0)
          expect(q).toBeLessThanOrEqual(1)
        }
  })

  test('trajectory sampler starts at release height and ends at rim height', () => {
    const v = idealSpeed(rad(50), 7.24, H3)
    const tr = trajectory(rad(50), v, H3)
    expect(tr.pointAt(0)).toEqual({ x: 0, y: H3 })
    const end = tr.pointAt(tr.tEnd)
    expect(end.y).toBeCloseTo(3.05, 6)
    expect(end.x).toBeCloseTo(7.24, 6)
  })
})

describe('shot scenario + helpers', () => {
  const ctx = (kind: WatchedGameContext['kind']): WatchedGameContext => ({ kind, opponentTeamId: 'bos' })

  test('scenarioFor maps kinds and is deterministic per seed', () => {
    expect(scenarioFor(ctx('rivalry'), createRng(1)).backdrop).toBe('rivalry')
    expect(scenarioFor(ctx('playoff'), createRng(1)).backdrop).toBe('playoff')
    expect(scenarioFor(ctx('finals'), createRng(1)).backdrop).toBe('finals')
    expect(scenarioFor(ctx('seedRace'), createRng(1)).backdrop).toBe('regular')
    expect(scenarioFor(ctx('special'), createRng(1)).backdrop).toBe('regular')
    expect(scenarioFor(ctx('finals'), createRng(1)).meterSpeed).toBe(1.25)
    expect(scenarioFor(ctx('playoff'), createRng(1)).meterSpeed).toBe(1)
    for (const seed of [1, 42, 999]) {
      const a = scenarioFor(ctx('rivalry'), createRng(seed)), b = scenarioFor(ctx('rivalry'), createRng(seed))
      expect(a).toEqual(b)
      expect(a.crowd).toBeGreaterThanOrEqual(0)
      expect(a.crowd).toBeLessThan(1)
    }
  })

  test('meterValue / angleValue bounded and periodic', () => {
    for (let t = 0; t < 5000; t += 37) {
      const m = meterValue(t, 1400), a = angleValue(t, 1200)
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThanOrEqual(1)
      expect(a).toBeGreaterThanOrEqual(25)
      expect(a).toBeLessThanOrEqual(70)
      expect(meterValue(t + 1400, 1400)).toBeCloseTo(m, 9)
      expect(angleValue(t + 1200, 1200)).toBeCloseTo(a, 9)
    }
    expect(meterValue(0, 1400)).toBe(0)
    expect(meterValue(700, 1400)).toBe(1)
    expect(angleValue(600, 1200)).toBe(70)
  })
})

const mods = attrMods(build(85), 27)
const five = opponentFive(initLeague(), 'bos')

describe('repertório', () => {
  test('availableTypes por atributo', () => {
    expect(availableTypes(build(55), 27)).toEqual(['layup', 'mid', 'three', 'bank'])
    expect(availableTypes(build(95), 27)).toEqual(['layup', 'floater', 'mid', 'stepback', 'fadeaway', 'three', 'bank', 'dunk'])
  })
  test('velocidade ideal acerta o aro para todo tipo (exceto dunk)', () => {
    for (const t of Object.keys(SHOTS) as ShotType[]) {
      if (t === 'dunk') continue
      const s = SHOTS[t]; const v = idealSpeed(rad(50), s.d, s.releaseH)
      const ev = evaluate(t, rad(50), v, { closeout: null, jump: null, mods })
      expect(ev.err).toBeLessThan(0.02); expect(ev.quality).toBeGreaterThan(0.95)
    }
  })
  test('salto perfeito > sem salto > salto errado; contestado reduz', () => {
    const v = idealSpeed(rad(50), SHOTS.three.d, SHOTS.three.releaseH) * 1.03
    const q = (jump: 'perfect' | 'hit' | 'miss' | null, closeout = null as ReturnType<typeof createCloseout> | null) => evaluate('three', rad(50), v, { closeout, jump, mods }).quality
    expect(q('perfect')).toBeGreaterThan(q(null)); expect(q(null)).toBeGreaterThan(q('miss'))
    let c = createCloseout(createRng(1), { difficulty: 1, defender: five[0], sep: 0 }); for (let i = 0; i < 200; i++) c = stepCloseout(c, 0.05)
    expect(c.arrived).toBe(true); expect(q(null, c)).toBeLessThan(q(null))
  })
  test('arco baixo com a mão levantada = bloqueado', () => {
    let c = createCloseout(createRng(2), { difficulty: 1, defender: five[0], sep: 0 }); while (!c.handUp) c = stepCloseout(c, 0.05)
    const flat = evaluate('three', rad(18), idealSpeed(rad(18), 7.24, 2.05) || 12, { closeout: c, jump: null, mods })
    expect(flat.blocked).toBe(true); expect(flat.quality).toBe(0); expect(flat.verdict).toBe('blocked')
  })
  test('step-back/fadeaway afastam o closeout (sep)', () => {
    const a = createCloseout(createRng(3), { difficulty: 1, defender: five[0], sep: SHOTS.stepback.sep }), b = createCloseout(createRng(3), { difficulty: 1, defender: five[0], sep: 0 })
    expect(a.x).toBeGreaterThan(b.x)
  })
  test('tabela: bankCrossX devolve x perto do aro para o tiro certo e evaluate usa bankAim', () => {
    const d = SHOTS.bank.d, v = idealSpeed(rad(52), d + 0.6, 2.05)   // mira 0.6m "além" do aro → reflete de volta
    const x = bankCrossX(rad(52), v, 2.05, d)
    expect(x).not.toBeNull(); expect(Math.abs(x! - d)).toBeLessThan(0.5)
    const ev = evaluate('bank', rad(52), v, { closeout: null, jump: null, mods, bankAim: true })
    expect(ev.quality).toBeGreaterThan(0.5)
  })
  test('fadiga reduz a força efetiva (mesmo input, mais curto)', () => {
    const tired = attrMods(build(80, { physical: 50 }), 27, 4)
    const v = idealSpeed(rad(50), 7.24, 2.05)
    expect(evaluate('three', rad(50), v, { closeout: null, jump: null, mods: tired }).verdict).toBe('short')
  })
  test('resultFor mapeia optionId; freeThrowQuality é média; jumpTiming usa a janela', () => {
    const ev = evaluate('layup', rad(55), idealSpeed(rad(55), 1.5, 2.3), { closeout: null, jump: null, mods })
    expect(resultFor('layup', ev).optionId).toBe('mgLayup'); expect(resultFor('stepback', ev).optionId).toBe('mgThree'); expect(resultFor('bank', ev).optionId).toBe('mgMid')
    expect(freeThrowQuality([1, 0.5])).toBeCloseTo(0.75, 5)
    expect(jumpTiming(0.5, 0.5, mods)).toBe('perfect'); expect(jumpTiming(0.9, 0.5, mods)).toBe('miss')
  })
})
