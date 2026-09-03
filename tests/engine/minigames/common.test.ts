import { describe, expect, test } from 'vitest'
import { initLeague } from '../../../src/data/league'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'
import { attrMods, bestDefender, difficulty, freeThrowP, opponentFive, opponentStar, reboundChance, teammates, tendencies, type Mate } from '../../../src/engine/minigames/common'

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
    expect(hi.reactMs).toBeGreaterThan(lo.reactMs)
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
