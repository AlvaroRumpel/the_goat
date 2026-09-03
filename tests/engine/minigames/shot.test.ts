import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { initLeague } from '../../../src/data/league'
import { opponentFive } from '../../../src/engine/minigames/common'
import {
  aimNoise, createScene, flightPoint, freeThrowQuality, idealSpeed, launchFromPull, rad, RIM_H, shotQuality,
  simulateShot, skillOf, trajectory, type ShotScene,
} from '../../../src/engine/minigames/shot'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number, over: Partial<Record<SlotId, number>> = {}): Build => ({
  attributes: { ...Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])), ...over } as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const league = initLeague()
const five = opponentFive(league, 'bos')
const scene = (over: Partial<ShotScene> = {}): ShotScene => ({ d: 6, releaseH: 2.05, gap: 1.5, who: { ...five[0], reach: 2.8 }, kind: 'mid', optionId: 'mgMid', ...over })

describe('skill', () => {
  test('60 = 0.5, 90 = 1, 40 = 0.25, fadiga reduz, atributo por tipo', () => {
    expect(skillOf(build(60), 27, 'three')).toBeCloseTo(0.5, 5); expect(skillOf(build(90), 27, 'mid')).toBeCloseTo(1, 5)
    expect(skillOf(build(40), 27, 'layup')).toBe(0.25); expect(skillOf(build(60), 27, 'three', 0.3)).toBeCloseTo(0.425, 5)
    const b = build(60, { three: 90, finishing: 40, handles: 75 })
    expect(skillOf(b, 27, 'three')).toBeCloseTo(1, 5); expect(skillOf(b, 27, 'dunk')).toBe(0.25); expect(skillOf(b, 27, 'mid')).toBeCloseTo(0.75, 5)
    expect(skillOf(build(85), 35, 'mid')).toBeLessThan(skillOf(build(85), 27, 'mid'))
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
      expect(five.some(p => p.id === s.who.id)).toBe(true)
      kinds.add(s.kind)
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3)
    expect(createScene(createRng(4), five, build(80), 27)).toEqual(createScene(createRng(4), five, build(80), 27))
    for (let seed = 0; seed < 80; seed++) expect(createScene(createRng(seed), five, build(60), 27).kind).not.toBe('dunk')
  })
})

describe('estilingue', () => {
  test('puxar pra trás e pra baixo = frente e cima; curto demais = null; velocidade clampada', () => {
    const l = launchFromPull(-1, -1)!
    expect(l.angle).toBeCloseTo(rad(45), 5); expect(l.speed).toBeCloseTo(Math.SQRT2 * 4, 5)
    expect(launchFromPull(-0.1, 0)).toBeNull()
    expect(launchFromPull(-9, -9)!.speed).toBe(14); expect(launchFromPull(-0.3, -0.3)!.speed).toBe(2)
  })
  test('lançamento ideal = accuracy ≈ 1, fate in; ponto final no aro', () => {
    const sc = scene()
    const f = simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d, sc.releaseH) })
    expect(f.fate).toBe('in'); expect(f.accuracy).toBeCloseTo(1, 3)
    const end = flightPoint(f, f.tEnd); expect(end.x).toBeCloseTo(sc.d, 3); expect(end.y).toBeCloseTo(RIM_H, 3)
  })
  test('forte demais = long, fraco = short (inclusive sem subir até o aro), raso por baixo da mão = blocked, pra trás = short', () => {
    expect(simulateShot(scene(), { angle: rad(50), speed: 11 }).fate).toBe('long')
    expect(simulateShot(scene(), { angle: rad(50), speed: 6 }).fate).toBe('short')
    expect(simulateShot(scene(), { angle: rad(80), speed: 3 }).fate).toBe('short')
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
    const n = aimNoise(createRng(1), 0.25, l)
    expect(n).not.toEqual(l); expect(Math.abs(n.angle - l.angle)).toBeLessThan(rad(20))
    expect(aimNoise(createRng(1), 0.25, l)).toEqual(aimNoise(createRng(1), 0.25, l))
  })
  test('shotQuality ∈ [0,1], cresce com skill, 0 quando bloqueado', () => {
    const sc = scene()
    const f = simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d, sc.releaseH) })
    expect(shotQuality(f, 1)).toBeCloseTo(1, 3); expect(shotQuality(f, 0.5)).toBeCloseTo(0.8, 3); expect(shotQuality(f, 0.25)).toBeCloseTo(0.7, 3)
    expect(shotQuality(simulateShot(sc, { angle: rad(20), speed: 10 }), 1)).toBe(0)
  })
  test('trajectory (lance livre) sai da altura de saída e chega ao aro', () => {
    const v = idealSpeed(rad(45), 4.57, 2.05); const tr = trajectory(rad(45), v, 2.05)
    expect(tr.pointAt(0).y).toBeCloseTo(2.05, 6); expect(tr.pointAt(tr.tEnd).x).toBeCloseTo(4.57, 3)
  })
})
