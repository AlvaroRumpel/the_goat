import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { initLeague } from '../../../src/data/league'
import { attrMods, opponentFive } from '../../../src/engine/minigames/common'
import {
  availableTypes, createStaticDefender, freeThrowQuality, idealSpeed, rad, refSpeed, resultFor, RIM_H,
  SHOTS, shotOpenness, shotQuality, skillOf, trajectory, type ShotType,
} from '../../../src/engine/minigames/shot'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number, over: Partial<Record<SlotId, number>> = {}): Build => ({
  attributes: { ...Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])), ...over } as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const ALL: ShotType[] = ['layup', 'floater', 'mid', 'stepback', 'fadeaway', 'three', 'bank', 'dunk']
const league = initLeague()

describe('fórmula skill × abertura (contrato spec B)', () => {
  test('skillOf: 60 = 0.5 neutro, 90 = 1.0, 40 clampa em 0.25, fadiga reduz', () => {
    expect(skillOf(build(60), 27, 'three')).toBeCloseTo(0.5, 5)
    expect(skillOf(build(90), 27, 'three')).toBeCloseTo(1, 5)
    expect(skillOf(build(40), 27, 'three')).toBe(0.25)
    expect(skillOf(build(60), 27, 'three', 0.3)).toBeCloseTo(0.5 * 0.85, 5)
  })
  test('skillOf usa o atributo do tipo', () => {
    const b = build(60, { three: 90, finishing: 40, handles: 75 })
    expect(skillOf(b, 27, 'three')).toBeCloseTo(1, 5); expect(skillOf(b, 27, 'stepback')).toBeCloseTo(1, 5)
    expect(skillOf(b, 27, 'layup')).toBe(0.25); expect(skillOf(b, 27, 'dunk')).toBe(0.25); expect(skillOf(b, 27, 'floater')).toBe(0.25)
    expect(skillOf(b, 27, 'mid')).toBeCloseTo(0.75, 5); expect(skillOf(b, 27, 'bank')).toBeCloseTo(0.75, 5); expect(skillOf(b, 27, 'fadeaway')).toBeCloseTo(0.75, 5)
  })
  test('skillOf: idade 35 < 27', () => { expect(skillOf(build(85), 35, 'mid')).toBeLessThan(skillOf(build(85), 27, 'mid')) })
  test('shotOpenness: colado (0.5m) = 0, 2.1m = 1, sep do tipo soma', () => {
    expect(shotOpenness('three', 0.5)).toBe(0); expect(shotOpenness('three', 2.1)).toBe(1)
    expect(shotOpenness('three', 1.3)).toBeCloseTo(0.5, 5)
    expect(shotOpenness('stepback', 0.5)).toBeCloseTo(1.2 / 1.6, 5)
  })
  test('shotQuality = skill × abertura, em [0,1], fadiga via mods', () => {
    const mods = attrMods(build(60), 27)
    expect(shotQuality('three', 2.1, build(60), 27, mods)).toBeCloseTo(0.5, 5)
    expect(shotQuality('three', 0.5, build(99), 27, mods)).toBe(0)
    const tired = attrMods(build(60, { physical: 50 }), 27, 4)
    expect(tired.fatigue).toBeGreaterThan(0)
    expect(shotQuality('three', 2.1, build(60, { physical: 50 }), 27, tired)).toBeLessThan(0.5)
    for (const t of ALL) for (const gap of [0.3, 1, 2.5]) { const q = shotQuality(t, gap, build(80), 27, mods); expect(q).toBeGreaterThanOrEqual(0); expect(q).toBeLessThanOrEqual(1) }
  })
  test('resultFor mapeia optionId dos 8 tipos; freeThrowQuality = skill de três', () => {
    const want: Record<ShotType, string> = { layup: 'mgLayup', floater: 'mgLayup', mid: 'mgMid', stepback: 'mgThree', fadeaway: 'mgMid', three: 'mgThree', bank: 'mgMid', dunk: 'mgDunk' }
    for (const t of ALL) expect(resultFor(t, 0.42)).toEqual({ optionId: want[t], quality: 0.42 })
    expect(freeThrowQuality(build(60, { three: 90 }), 27)).toBeCloseTo(1, 5)
  })
})

describe('defensor estático', () => {
  test('gap em 0.6..2.4, determinístico por seed, é o bestDefender', () => {
    const five = opponentFive(league, 'bos')
    for (let seed = 0; seed < 50; seed++) {
      const d = createStaticDefender(createRng(seed), five)
      expect(d.gap).toBeGreaterThanOrEqual(0.6); expect(d.gap).toBeLessThan(2.4)
      expect(five.some(p => p.id === d.who.id)).toBe(true)
    }
    expect(createStaticDefender(createRng(7), five)).toEqual(createStaticDefender(createRng(7), five))
  })
})

describe('repertório', () => {
  test('availableTypes por atributo', () => {
    expect(availableTypes(build(60), 27)).toEqual(['layup', 'floater', 'mid', 'three', 'bank'])
    expect(availableTypes(build(80), 27)).toEqual(ALL)
  })
  test('limites exatos das travas (idade 27, ageMultiplier = 1.0)', () => {
    expect(availableTypes(build(60, { finishing: 59 }), 27)).not.toContain('floater')
    expect(availableTypes(build(60, { handles: 70 }), 27)).toContain('stepback')
    expect(availableTypes(build(60, { clutch: 69 }), 27)).not.toContain('fadeaway')
    expect(availableTypes(build(60, { physical: 75 }), 27)).toContain('dunk')
  })
})

describe('parábola da animação', () => {
  test('refSpeed é finita e a trajetória sai da altura de saída e chega à do aro', () => {
    for (const t of ALL) {
      const v = refSpeed(t); expect(Number.isFinite(v)).toBe(true)
      const s = SHOTS[t]
      const angle = t === 'dunk' ? 60 : 45
      const tr = trajectory(rad(angle), idealSpeed(rad(angle), s.d, s.releaseH), s.releaseH)
      expect(tr.pointAt(0).y).toBeCloseTo(s.releaseH, 6)
      const end = tr.pointAt(tr.tEnd)
      expect(end.x).toBeCloseTo(s.d, 3); expect(end.y).toBeCloseTo(RIM_H, 3)
    }
  })
})
