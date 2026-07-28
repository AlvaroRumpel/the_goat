import { describe, expect, test } from 'vitest'
import { drawMatchups, resolveDraft, computeArchetype, drawPlayer, malusAmount, resolveBuild, weakestSlot } from '../../src/engine/draft'
import { createRng } from '../../src/engine/rng'
import { LEGENDS } from '../../src/data/legends'
import { PLAYERS, playerById } from '../../src/data/players'
import { SLOT_ORDER, type Legend, type SlotId, type DraftPick } from '../../src/engine/types'

const bySlot = (slot: SlotId) => LEGENDS.filter(l => l.slot === slot)

describe('drawMatchups', () => {
  test('8 matchups, slot order, 2 distinct legends of matching slot', () => {
    const ms = drawMatchups(createRng(1))
    expect(ms.map(m => m.slot)).toEqual(SLOT_ORDER)
    for (const m of ms) {
      expect(m.a.slot).toBe(m.slot)
      expect(m.b.slot).toBe(m.slot)
      expect(m.a.id).not.toBe(m.b.id)
    }
  })
  test('deterministic per seed', () => {
    expect(drawMatchups(createRng(5))).toEqual(drawMatchups(createRng(5)))
  })
})

describe('resolveDraft', () => {
  test('applies values then maluses with floor 40', () => {
    // pick first legend of each slot
    const picks: Legend[] = SLOT_ORDER.map(s => bySlot(s)[0])
    const build = resolveDraft(picks)
    for (const s of SLOT_ORDER) {
      const base = picks.find(p => p.slot === s)!.value
      const malusSum = picks.filter(p => p.malusSlot === s).reduce((n, p) => n + p.malus, 0)
      expect(build.attributes[s]).toBe(Math.max(40, base - malusSum))
    }
    expect(build.picks).toEqual(picks.map(p => ({ playerId: p.id, slot: p.slot })))
    expect(build.overall).toBeGreaterThan(0)
  })
})

describe('computeArchetype', () => {
  const flat = Object.fromEntries(SLOT_ORDER.map(s => [s, 80])) as Record<SlotId, number>
  test('balanced build → SF', () => {
    expect(computeArchetype(flat)).toBe('SF')
  })
  test('pass+handles heavy → PG', () => {
    expect(computeArchetype({ ...flat, passing: 99, handles: 99, rebounding: 55, finishing: 55 })).toBe('PG')
  })
  test('rebound+defense heavy → C', () => {
    expect(computeArchetype({ ...flat, rebounding: 99, defense: 99, finishing: 95, passing: 50, handles: 50, three: 50 })).toBe('C')
  })
})

describe('drawPlayer', () => {
  test('não repete jogador já sorteado', () => {
    const rng = createRng(7)
    const drawn: string[] = []
    for (let i = 0; i < 30; i++) {
      const pl = drawPlayer(rng, drawn)
      expect(drawn).not.toContain(pl.id)
      drawn.push(pl.id)
    }
  })
  test('determinístico por seed', () => {
    expect(drawPlayer(createRng(3), []).id).toBe(drawPlayer(createRng(3), []).id)
  })
})

describe('malusAmount', () => {
  test('escala leve, clamp 1..5', () => {
    expect(malusAmount(99)).toBe(5)
    expect(malusAmount(95)).toBe(4)
    expect(malusAmount(83)).toBe(2)
    expect(malusAmount(77)).toBe(1)
    expect(malusAmount(50)).toBe(1)   // piso 1
  })
})

describe('weakestSlot', () => {
  test('menor atributo excluindo o roubado', () => {
    const curry = playerById('curry')   // rebounding 55 é o mais fraco
    expect(weakestSlot(curry, 'three')).toBe('rebounding')
    // roubando o próprio ponto fraco, cai no segundo mais fraco
    expect(weakestSlot(curry, 'rebounding')).not.toBe('rebounding')
  })
})

describe('resolveBuild', () => {
  test('bases + maluses na fraqueza, piso 40', () => {
    // 8 picks: um slot de cada, jogadores distintos quaisquer
    const rng = createRng(11)
    const drawn: string[] = []
    const picks: DraftPick[] = SLOT_ORDER.map(slot => {
      const pl = drawPlayer(rng, drawn)
      drawn.push(pl.id)
      return { playerId: pl.id, slot }
    })
    const build = resolveBuild(picks)
    // recomputa na mão
    const expected = {} as Record<string, number>
    for (const pk of picks) expected[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
    for (const pk of picks) {
      const pl = playerById(pk.playerId)
      const target = weakestSlot(pl, pk.slot)
      expected[target] = Math.max(40, expected[target] - malusAmount(pl.attrs[pk.slot]))
    }
    for (const s of SLOT_ORDER) expect(build.attributes[s]).toBe(expected[s])
    expect(build.picks).toEqual(picks)
    expect(build.overall).toBeGreaterThan(0)
  })
})
