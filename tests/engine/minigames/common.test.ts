import { describe, expect, test } from 'vitest'
import { initLeague } from '../../../src/data/league'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'
import { attrMods, bestDefender, difficulty, freeThrowP, opponentFive, opponentStar, reboundChance, reboundWindow, tendencies, timingHit } from '../../../src/engine/minigames/common'

const build = (ovr: number, over: Partial<Record<SlotId, number>> = {}): Build => ({
  attributes: { ...Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])), ...over } as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const league = initLeague()

describe('adversário real', () => {
  test('opponentFive: 5 do time, ordenados por ovr desc, com short e speed em faixa', () => {
    const five = opponentFive(league, 'bos')
    expect(five).toHaveLength(5)
    expect(five.every(p => league.players.find(l => l.id === p.id)?.teamId === 'bos')).toBe(true)
    for (let i = 1; i < 5; i++) expect(five[i - 1].ovr).toBeGreaterThanOrEqual(five[i].ovr)
    for (const p of five) { expect(p.speed).toBeGreaterThanOrEqual(3.0); expect(p.speed).toBeLessThanOrEqual(4.4); expect(p.short).toBe(p.short.toUpperCase()) }
  })
  test('opponentStar é o primeiro; bestDefender prefere tag defender', () => {
    const five = opponentFive(league, 'bos')
    expect(opponentStar(league, 'bos').id).toBe(five[0].id)
    const d = bestDefender(five)
    if (five.some(p => p.tags.includes('defender'))) expect(d.tags).toContain('defender')
    else expect(d.id).toBe(five[0].id)
  })
  test('tendencies somam 1 e shooter arremessa mais', () => {
    const base = opponentStar(league, 'bos')
    const sh = tendencies({ ...base, tags: ['shooter'] }), pm = tendencies({ ...base, tags: ['playmaker'] })
    expect(sh.shoot + sh.drive + sh.pass).toBeCloseTo(1, 6)
    expect(sh.shoot).toBeGreaterThan(pm.shoot)
    expect(pm.pass).toBeGreaterThan(sh.pass)
  })
})

describe('dificuldade e mods', () => {
  test('difficulty cresce com kind e ovr', () => {
    expect(difficulty('finals', 90)).toBeGreaterThan(difficulty('playoff', 90))
    expect(difficulty('playoff', 90)).toBeGreaterThan(difficulty('rivalry', 90))
    expect(difficulty('rivalry', 95)).toBeGreaterThan(difficulty('rivalry', 70))
    expect(difficulty('rivalry', 60)).toBeCloseTo(0.85, 5)
  })
  test('attrMods: atributo alto melhora cada mod na direção certa', () => {
    const lo = attrMods(build(55), 27), hi = attrMods(build(95), 27)
    expect(hi.speed).toBeGreaterThan(lo.speed)
    expect(hi.feint).toBeGreaterThan(lo.feint)
    expect(hi.stripResist).toBeGreaterThan(lo.stripResist)
    expect(hi.laneSafety).toBeGreaterThan(lo.laneSafety)
    expect(hi.jumpWindow).toBeGreaterThan(lo.jumpWindow)
    expect(hi.reactMs).toBeGreaterThan(lo.reactMs)
    expect(hi.stealWindow).toBeGreaterThan(lo.stealWindow)
    expect(hi.boxWindow).toBeGreaterThan(lo.boxWindow)
    expect(hi.tremor).toBeLessThan(lo.tremor)
    expect(hi.tol.three).toBeGreaterThan(lo.tol.three)
    expect(hi.blockP).toBeGreaterThan(lo.blockP)
    expect(hi.stealP).toBeGreaterThan(lo.stealP)
    expect(hi.reboundP).toBeGreaterThan(lo.reboundP)
  })
  test('fadiga só no 4Q com físico baixo', () => {
    expect(attrMods(build(80, { physical: 55 }), 27, 4).fatigue).toBeGreaterThan(0)
    expect(attrMods(build(80, { physical: 55 }), 27, 2).fatigue).toBe(0)
    expect(attrMods(build(80, { physical: 80 }), 27, 4).fatigue).toBe(0)
  })
  test('idade entra via ageMultiplier (35 anos < 27)', () => {
    expect(attrMods(build(85), 35).speed).toBeLessThan(attrMods(build(85), 27).speed)
  })
})

describe('helpers', () => {
  test('timingHit', () => {
    expect(timingHit(0.5, 0.5, 0.1)).toBe('perfect')
    expect(timingHit(0.58, 0.5, 0.1)).toBe('hit')
    expect(timingHit(0.7, 0.5, 0.1)).toBe('miss')
  })
  test('reboundWindow: reboteiro melhor = janela mais estreita; clampa em 0.05..0.3', () => {
    const mods = attrMods(build(80), 27)
    const five = opponentFive(league, 'bos')
    const withOvr = (ovr: number) => five.map((p, i) => i === 0 ? { ...p, ovr, tags: ['rebounder' as const] } : { ...p, tags: [] })
    expect(reboundWindow(mods, withOvr(95))).toBeLessThan(reboundWindow(mods, withOvr(60)))
    expect(reboundWindow(mods, withOvr(75))).toBeCloseTo(mods.boxWindow, 6)
    expect(reboundWindow({ ...mods, boxWindow: 0.9 }, withOvr(60))).toBe(0.3)
    expect(reboundWindow({ ...mods, boxWindow: 0.06 }, withOvr(99))).toBe(0.05)
  })
  test('freeThrowP clampa', () => {
    expect(freeThrowP(60)).toBeCloseTo(0.62, 5)
    expect(freeThrowP(20)).toBe(0.4)
    expect(freeThrowP(120)).toBe(0.92)
  })
  test('blockP/stealP/reboundP: valores e clamps do contrato', () => {
    const m60 = attrMods(build(60), 27), m99 = attrMods(build(99), 27), m40 = attrMods(build(40), 27)
    expect(m60.blockP).toBeCloseTo(0.35, 5); expect(m60.stealP).toBeCloseTo(0.45, 5); expect(m60.reboundP).toBeCloseTo(0.4, 5)
    expect(m99.blockP).toBeCloseTo(0.584, 5); expect(m99.stealP).toBeCloseTo(0.684, 5); expect(m99.reboundP).toBeCloseTo(0.634, 5)
    expect(attrMods(build(99, { defense: 99, physical: 99 }), 27).blockP).toBeLessThanOrEqual(0.6)
    expect(m40.blockP).toBeCloseTo(0.23, 5); expect(m40.stealP).toBeCloseTo(0.33, 5); expect(m40.reboundP).toBeCloseTo(0.28, 5)
  })
  test('reboundChance: reboteiro melhor = chance menor; clampa em 0.05..0.85', () => {
    const mods = attrMods(build(80), 27)
    const five = opponentFive(league, 'bos')
    const withOvr = (ovr: number) => five.map((p, i) => i === 0 ? { ...p, ovr, tags: ['rebounder' as const] } : { ...p, tags: [] })
    expect(reboundChance(mods, withOvr(95))).toBeLessThan(reboundChance(mods, withOvr(60)))
    expect(reboundChance(mods, withOvr(75))).toBeCloseTo(mods.reboundP, 6)
    expect(reboundChance({ ...mods, reboundP: 0.9 }, withOvr(50))).toBe(0.85)
    expect(reboundChance({ ...mods, reboundP: 0.06 }, withOvr(99))).toBe(0.05)
  })
})
