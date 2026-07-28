import { describe, expect, test } from 'vitest'
import { INTERACTIVE_EVENTS, autoResolve, rollEvents } from '../../src/engine/events'
import { createRng } from '../../src/engine/rng'

describe('rollEvents', () => {
  test('máximo 2 eventos', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(rollEvents(createRng(seed), 'scoring').length).toBeLessThanOrEqual(2)
    }
  })
  test('hotstreak nunca junto com coldstreak', () => {
    for (let seed = 0; seed < 500; seed++) {
      const ev = rollEvents(createRng(seed), 'scoring')
      expect(ev.includes('hotstreak') && ev.includes('coldstreak')).toBe(false)
    }
  })
  test('injuryProne aumenta frequência de lesão', () => {
    let base = 0, prone = 0
    for (let seed = 0; seed < 2000; seed++) {
      if (rollEvents(createRng(seed), 'scoring').includes('injury')) base++
      if (rollEvents(createRng(seed), 'scoring', true).includes('injury')) prone++
    }
    expect(prone).toBeGreaterThan(base)
  })
  test('foco health reduz lesão pela metade (antes do multiplicador)', () => {
    let normal = 0, health = 0
    for (let seed = 0; seed < 2000; seed++) {
      if (rollEvents(createRng(seed), 'scoring').includes('injury')) normal++
      if (rollEvents(createRng(seed), 'health').includes('injury')) health++
    }
    expect(health).toBeLessThan(normal * 0.75)
  })
})

describe('autoResolve', () => {
  test('escolhas seguras', () => {
    expect(autoResolve(['injury', 'lockerroom'])).toEqual(['injuryFull', 'lockerCalm'])
    expect(autoResolve(['rivalry'])).toEqual([])
  })
  test('INTERACTIVE_EVENTS', () => {
    expect(INTERACTIVE_EVENTS).toEqual(['injury', 'lockerroom'])
  })
})
