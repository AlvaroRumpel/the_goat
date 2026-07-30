import { describe, expect, test } from 'vitest'
import { projectedNpcLines, projectedStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

describe('projectedNpcLines/projectedStandings — determinísticas, sem rng', () => {
  test('mesma entrada produz sempre a mesma saída (sem jitter)', () => {
    const league = initLeague()
    const a = projectedNpcLines(league)
    const b = projectedNpcLines(league)
    expect(a).toEqual(b)
    expect(a).toHaveLength(league.players.length)
    for (const l of a) {
      expect(l.ppg).toBeGreaterThanOrEqual(2)
      expect(l.ppg).toBeLessThanOrEqual(36)
    }
  })
  test('projectedStandings cobre os 30 times, wins dentro de faixa plausível', () => {
    const league = initLeague()
    const standings = projectedStandings(league)
    expect(standings).toHaveLength(30)
    for (const s of standings) {
      expect(s.wins).toBeGreaterThanOrEqual(12)
      expect(s.wins).toBeLessThanOrEqual(68)
    }
  })
})
