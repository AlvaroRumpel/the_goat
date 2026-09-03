import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { buildCalendar, CALENDAR_RNG_CALLS, DEADLINE_GAME, simStretch, STRETCH_CALLS_PER_GAME, projectedSeed } from '../../src/engine/schedule'
import { initLeague } from '../../src/data/league'
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
  test('âncora por papel, não por posição: arcade [rivalry, special] agenda special na sua própria janela', () => {
    const ARCADE: KeyGame[] = [
      { kind: 'rivalry', opponentTeamId: 'bos' },
      { kind: 'special', opponentTeamId: 'lal' },
    ]
    for (let seed = 1; seed <= 50; seed++) {
      const { rng } = countedRng(seed)
      const { slots } = buildCalendar(ARCADE, rng)
      expect(slots).toHaveLength(2)
      const byKind = (k: string) => slots.find(s => s.keyGame.kind === k)!.gameIndex
      expect(byKind('special')).toBeGreaterThanOrEqual(27)
      expect(byKind('special')).toBeLessThanOrEqual(33)
      expect(byKind('special')).not.toBeGreaterThanOrEqual(49)          // não cai na janela do seedRace
    }
    // modo normal [rivalry, seedRace, special, rivalry] continua com seedRace em [49, 54]
    const { rng } = countedRng(7)
    const { slots } = buildCalendar(FOUR, rng)
    const byKind = (k: string) => slots.find(s => s.keyGame.kind === k)!.gameIndex
    expect(byKind('seedRace')).toBeGreaterThanOrEqual(49)
    expect(byKind('seedRace')).toBeLessThanOrEqual(54)
  })
})

describe('simStretch', () => {
  test('gera um jogo por índice com contrato de 4 calls/jogo', () => {
    const { rng, calls } = countedRng(3)
    const games = simStretch({ from: 5, to: 16, p: 0.6, ppg: 24, playerTeamId: 'okc', rng })
    expect(games).toHaveLength(12)
    expect(calls()).toBe(12 * STRETCH_CALLS_PER_GAME)
    expect(games.map(g => g.gameIndex)).toEqual(Array.from({ length: 12 }, (_, i) => 5 + i))
    for (const g of games) {
      expect(g.opponentTeamId).not.toBe('okc')
      expect(g.won ? g.ourScore > g.oppScore : g.oppScore > g.ourScore).toBe(true)
      expect(g.playerPts).toBeGreaterThanOrEqual(2)
    }
  })
  test('from > to → vazio, zero calls', () => {
    const { rng, calls } = countedRng(3)
    expect(simStretch({ from: 10, to: 9, p: 0.6, ppg: 20, playerTeamId: 'okc', rng })).toEqual([])
    expect(calls()).toBe(0)
  })
  test('taxa de vitória converge para p', () => {
    const { rng } = countedRng(11)
    const games = simStretch({ from: 1, to: 82, p: 0.7, ppg: 25, playerTeamId: 'okc', rng })
    const wins = games.filter(g => g.won).length
    expect(wins / 82).toBeGreaterThan(0.55)
    expect(wins / 82).toBeLessThan(0.85)
  })
})

describe('projectedSeed', () => {
  test('determinístico, 1..15, monotônico no winPct', () => {
    const league = initLeague()
    const high = projectedSeed(league, 'okc', 0.85)
    const low = projectedSeed(league, 'okc', 0.20)
    expect(high).toBeGreaterThanOrEqual(1)
    expect(low).toBeLessThanOrEqual(15)
    expect(high).toBeLessThanOrEqual(low)
    expect(projectedSeed(league, 'okc', 0.85)).toBe(high)   // sem rng
  })
})
