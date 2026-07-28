import { describe, expect, test } from 'vitest'
import { drawMatchups, resolveDraft, computeArchetype } from '../../src/engine/draft'
import { createRng } from '../../src/engine/rng'
import { LEGENDS } from '../../src/data/legends'
import { SLOT_ORDER, type Legend, type SlotId } from '../../src/engine/types'

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
    expect(build.picks).toEqual(picks.map(p => p.id))
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
