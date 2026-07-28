import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'

describe('createRng', () => {
  test('same seed → same sequence', () => {
    const a = createRng(42), b = createRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })
  test('different seeds differ', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })
  test('int stays in inclusive range', () => {
    const r = createRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 5)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(5)
    }
  })
  test('pick returns member', () => {
    const r = createRng(9)
    expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']))
  })
})
