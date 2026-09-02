import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { SLOT_ORDER, type Build, type SlotId, type WatchedGameContext } from '../../../src/engine/types'
import {
  angleValue, availableTypes, crossX, DIST, evaluate, idealSpeed, meterValue, rad, refSpeed, releaseHeight,
  resultFor, scenarioFor, trajectory,
} from '../../../src/engine/minigames/shot'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const B = build(80)
const H3 = releaseHeight('three')

describe('shot physics', () => {
  test('idealSpeed at 50° for the three crosses the rim center', () => {
    const v = idealSpeed(rad(50), 7.24, H3)
    expect(Number.isFinite(v)).toBe(true)
    expect(Math.abs(crossX(rad(50), v, H3)! - 7.24)).toBeLessThan(0.01)
    expect(evaluate('three', rad(50), v, B).quality).toBeCloseTo(1, 3)
  })

  test('angle too flat → no solution', () => {
    expect(Number.isNaN(idealSpeed(rad(5), 7.24, H3))).toBe(true)
    expect(crossX(rad(5), 3, H3)).toBeNull()
    expect(evaluate('three', rad(5), 3, B).quality).toBe(0)
  })

  test('speed off the ideal → quality lower, monotonic', () => {
    const v = idealSpeed(rad(50), 7.24, H3)
    const q = (k: number) => evaluate('three', rad(50), v * k, B).quality
    expect(q(1)).toBeGreaterThan(q(1.03))
    expect(q(1.03)).toBeGreaterThan(q(1.06))
    expect(q(1.06)).toBeGreaterThanOrEqual(q(1.12))
    expect(q(1.12)).toBeLessThan(q(1))
    expect(q(1)).toBeGreaterThan(q(0.97))
    expect(q(0.97)).toBeGreaterThan(q(0.94))
    expect(q(0.94)).toBeGreaterThanOrEqual(q(0.88))
    expect(evaluate('three', rad(50), v * 1.12, B).verdict).toBe('long')
    expect(evaluate('three', rad(50), v * 0.88, B).verdict).toBe('short')
  })

  test('flat entry (20°) halves the tolerance', () => {
    // mesma sobra de 0.2m nos dois: velocidade ideal para d+0.2
    const flat = evaluate('three', rad(20), idealSpeed(rad(20), 7.44, H3), B)
    const arc = evaluate('three', rad(50), idealSpeed(rad(50), 7.44, H3), B)
    expect(flat.entryAngle).toBeLessThan(32)
    expect(arc.entryAngle).toBeGreaterThan(32)
    expect(flat.err).toBeCloseTo(0.2, 2)
    expect(arc.err).toBeCloseTo(0.2, 2)
    expect(flat.quality).toBeLessThan(arc.quality)
  })

  test('layup is more tolerant than the three for the same error', () => {
    const lay = evaluate('layup', rad(60), idealSpeed(rad(60), DIST.layup + 0.3, releaseHeight('layup')), B)
    const three = evaluate('three', rad(60), idealSpeed(rad(60), DIST.three + 0.3, H3), B)
    expect(lay.err).toBeCloseTo(0.3, 2)
    expect(three.err).toBeCloseTo(0.3, 2)
    expect(lay.quality).toBeGreaterThan(three.quality)
  })

  test('dunk: any speed within 30% of the ideal is perfect', () => {
    const v = refSpeed('dunk')
    expect(evaluate('dunk', rad(60), v * 1.29, B).quality).toBe(1)
    expect(evaluate('dunk', rad(60), v * 0.71, B).quality).toBe(1)
    expect(evaluate('dunk', rad(60), v * 1.6, B).quality).toBeLessThan(1)
  })

  test('quality stays in [0,1] over a grid', () => {
    for (const type of ['layup', 'mid', 'three', 'dunk'] as const)
      for (let a = 10; a <= 80; a += 5)
        for (let v = 0; v <= 20; v += 0.5) {
          const q = evaluate(type, rad(a), v, B).quality
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

  test('resultFor maps types to option ids', () => {
    expect(resultFor('layup', 0.5)).toEqual({ optionId: 'mgLayup', quality: 0.5 })
    expect(resultFor('mid', 1)).toEqual({ optionId: 'mgMid', quality: 1 })
    expect(resultFor('three', 0)).toEqual({ optionId: 'mgThree', quality: 0 })
    expect(resultFor('dunk', 2)).toEqual({ optionId: 'mgDunk', quality: 1 })
  })

  test('dunk only with physical ≥ 75', () => {
    expect(availableTypes(build(74))).toEqual(['layup', 'mid', 'three'])
    expect(availableTypes(build(75))).toEqual(['layup', 'mid', 'three', 'dunk'])
  })
})
