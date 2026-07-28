import { describe, expect, test } from 'vitest'
import { LEAGUE_PLAYERS, initLeague, FICTIONAL_FIRST, FICTIONAL_LAST } from '../../src/data/league'
import { TEAMS } from '../../src/data/teams'

describe('dataset da liga', () => {
  test('30 times × 9 jogadores', () => {
    for (const t of TEAMS) {
      expect(LEAGUE_PLAYERS.filter(p => p.teamId === t.id)).toHaveLength(9)
    }
  })
  test('ids únicos com prefixo lg-', () => {
    const ids = LEAGUE_PLAYERS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => id.startsWith('lg-'))).toBe(true)
  })
  test('ranges válidos', () => {
    for (const p of LEAGUE_PLAYERS) {
      expect(p.ovr).toBeGreaterThanOrEqual(55)
      expect(p.ovr).toBeLessThanOrEqual(99)
      expect(p.age).toBeGreaterThanOrEqual(18)
      expect(p.age).toBeLessThanOrEqual(40)
      expect(p.prevPpg).toBeNull()
    }
  })
  test('estrelas âncora presentes', () => {
    const names = LEAGUE_PLAYERS.map(p => p.name)
    for (const n of ['Nikola Jokic', 'Shai Gilgeous-Alexander', 'Victor Wembanyama', 'Luka Doncic', 'Giannis Antetokounmpo']) {
      expect(names).toContain(n)
    }
  })
  test('rookies e pools de nomes', () => {
    expect(LEAGUE_PLAYERS.filter(p => p.rookie).length).toBeGreaterThanOrEqual(8)
    expect(FICTIONAL_FIRST.length).toBeGreaterThanOrEqual(30)
    expect(FICTIONAL_LAST.length).toBeGreaterThanOrEqual(30)
    expect(initLeague().players).not.toBe(LEAGUE_PLAYERS)
  })
})
