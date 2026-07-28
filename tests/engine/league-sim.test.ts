import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { simNpcLines, simStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

describe('simStandings', () => {
  const league = initLeague()
  const standings = simStandings({ league, playerTeamId: 'uta', playerWins: 50, rng: createRng(1) })

  test('30 times, wins plausíveis, time do jogador exato', () => {
    expect(standings).toHaveLength(30)
    for (const s of standings) {
      expect(s.wins).toBeGreaterThanOrEqual(10)
      expect(s.wins).toBeLessThanOrEqual(70)
    }
    expect(standings.find(s => s.teamId === 'uta')!.wins).toBe(50)
  })
  test('8 seeds por conferência, sem repetição', () => {
    for (const conf of ['east', 'west'] as const) {
      const seeded = standings.filter(s => s.conf === conf && s.seed !== null)
      expect(seeded).toHaveLength(8)
      expect(new Set(seeded.map(s => s.seed)).size).toBe(8)
      const sorted = [...standings.filter(s => s.conf === conf)].sort((a, b) => b.wins - a.wins)
      expect(sorted[0].seed).toBe(1)   // melhor record é seed 1
    }
  })
  test('determinístico por seed', () => {
    const a = simStandings({ league, playerTeamId: 'uta', playerWins: 50, rng: createRng(9) })
    const b = simStandings({ league, playerTeamId: 'uta', playerWins: 50, rng: createRng(9) })
    expect(a).toEqual(b)
  })
})

describe('simNpcLines', () => {
  const league = initLeague()
  const lines = simNpcLines(league, createRng(2))
  test('linha por jogador, ranges plausíveis', () => {
    expect(lines).toHaveLength(league.players.length)
    for (const l of lines) {
      expect(l.ppg).toBeGreaterThanOrEqual(2)
      expect(l.ppg).toBeLessThanOrEqual(36)
      expect(l.rpg).toBeGreaterThanOrEqual(0.5)
      expect(l.rpg).toBeLessThanOrEqual(16)
      expect(l.apg).toBeGreaterThanOrEqual(0.3)
      expect(l.apg).toBeLessThanOrEqual(12)
    }
  })
  test('líder de pontos entre 24 e 36', () => {
    const top = Math.max(...lines.map(l => l.ppg))
    expect(top).toBeGreaterThanOrEqual(24)
    expect(top).toBeLessThanOrEqual(36)
  })
})
