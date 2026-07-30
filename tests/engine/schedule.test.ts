import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { buildCalendar, CALENDAR_RNG_CALLS, DEADLINE_GAME } from '../../src/engine/schedule'
import type { KeyGame, Rng } from '../../src/engine/types'

function countedRng(seed: number): { rng: Rng; calls: () => number } {
  const inner = createRng(seed)
  let n = 0
  const next = () => { n++; return inner.next() }
  return {
    rng: {
      next,
      int: (min, max) => min + Math.floor(next() * (max - min + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
    },
    calls: () => n,
  }
}

const THREE: KeyGame[] = [
  { kind: 'rivalry', opponentTeamId: 'bos' },
  { kind: 'seedRace', opponentTeamId: 'den' },
  { kind: 'special', opponentTeamId: 'lal' },
]
const FOUR: KeyGame[] = [...THREE, { kind: 'rivalry', opponentTeamId: 'bos' }]

describe('buildCalendar', () => {
  test('slots dentro das janelas das âncoras, ordenados, sem colisão com o deadline', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { rng } = countedRng(seed)
      const { slots, deadlineIndex } = buildCalendar(FOUR, rng)
      expect(deadlineIndex).toBe(DEADLINE_GAME)
      expect(slots).toHaveLength(4)
      const idx = slots.map(s => s.gameIndex)
      expect([...idx].sort((a, b) => a - b)).toEqual(idx)          // ordenado
      expect(new Set(idx).size).toBe(4)                            // sem duplicata
      for (const s of slots) expect(s.gameIndex).not.toBe(DEADLINE_GAME)
      const byKind = (k: string) => slots.find(s => s.keyGame.kind === k)!.gameIndex
      expect(byKind('seedRace')).toBeGreaterThanOrEqual(49)
      expect(byKind('seedRace')).toBeLessThanOrEqual(54)
      expect(byKind('special')).toBeGreaterThanOrEqual(27)
      expect(byKind('special')).toBeLessThanOrEqual(33)
    }
  })
  test('contrato: 4 calls fixas, com 3 ou 4 key games', () => {
    for (const games of [THREE, FOUR]) {
      const { rng, calls } = countedRng(7)
      buildCalendar(games, rng)
      expect(calls()).toBe(CALENDAR_RNG_CALLS)
    }
  })
})
