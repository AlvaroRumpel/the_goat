import { describe, expect, test } from 'vitest'
import { rollEvents } from '../../src/engine/events'
import { createRng } from '../../src/engine/rng'

describe('rollEvents', () => {
  test('returns 0..2 unique events', () => {
    for (let seed = 0; seed < 200; seed++) {
      const evs = rollEvents(createRng(seed), 'scoring')
      expect(evs.length).toBeLessThanOrEqual(2)
      expect(new Set(evs).size).toBe(evs.length)
    }
  })
  test('health focus halves injury rate', () => {
    let injuriesNormal = 0, injuriesHealth = 0
    for (let seed = 0; seed < 2000; seed++) {
      if (rollEvents(createRng(seed), 'scoring').includes('injury')) injuriesNormal++
      if (rollEvents(createRng(seed + 10000), 'health').includes('injury')) injuriesHealth++
    }
    expect(injuriesHealth).toBeLessThan(injuriesNormal * 0.75)
  })
  test('deterministic per seed', () => {
    expect(rollEvents(createRng(9), 'defense')).toEqual(rollEvents(createRng(9), 'defense'))
  })
})
