import { describe, expect, test } from 'vitest'
import { LEGENDS } from '../../src/data/legends'
import { SLOT_ORDER } from '../../src/engine/types'

describe('LEGENDS integrity', () => {
  test('24 legends, unique ids', () => {
    expect(LEGENDS).toHaveLength(24)
    expect(new Set(LEGENDS.map(l => l.id)).size).toBe(24)
  })
  test('exactly 3 legends per slot', () => {
    for (const slot of SLOT_ORDER)
      expect(LEGENDS.filter(l => l.slot === slot)).toHaveLength(3)
  })
  test('values 90..99, malus 3..10, malusSlot valid and != slot', () => {
    for (const l of LEGENDS) {
      expect(l.value).toBeGreaterThanOrEqual(90)
      expect(l.value).toBeLessThanOrEqual(99)
      expect(l.malus).toBeGreaterThanOrEqual(3)
      expect(l.malus).toBeLessThanOrEqual(10)
      expect(SLOT_ORDER).toContain(l.malusSlot)
      expect(l.malusSlot).not.toBe(l.slot)
    }
  })
  test('higher value → higher malus (per slot, monotonic)', () => {
    for (const slot of SLOT_ORDER) {
      const group = LEGENDS.filter(l => l.slot === slot).sort((a, b) => a.value - b.value)
      for (let i = 1; i < group.length; i++)
        expect(group[i].malus).toBeGreaterThanOrEqual(group[i - 1].malus)
    }
  })
})
