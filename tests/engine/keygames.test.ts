import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { selectKeyGames } from '../../src/engine/moments'
import { initLeague } from '../../src/data/league'
import { TEAMS } from '../../src/data/teams'

const league = initLeague()
function counted(seed: number) {
  const inner = createRng(seed); let n = 0
  return {
    rng: { next: () => (n++, inner.next()), int: (a: number, b: number) => a + Math.floor((n++, inner.next()) * (b - a + 1)), pick: <T,>(arr: T[]) => arr[Math.floor((n++, inner.next()) * arr.length)], chance: (p: number) => (n++, inner.next()) < p },
    calls: () => n,
  }
}

describe('selectKeyGames', () => {
  test('3 jogos sem rivalry event, 4 com; exatamente 3 rng calls', () => {
    const a = counted(1)
    const g3 = selectKeyGames({ league, playerTeamId: 'uta', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng: a.rng })
    expect(g3).toHaveLength(3)
    expect(a.calls()).toBe(3)
    const b = counted(1)
    const g4 = selectKeyGames({ league, playerTeamId: 'uta', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: true, rng: b.rng })
    expect(g4).toHaveLength(4)
    expect(b.calls()).toBe(3)
  })
  test('nunca joga contra si; oponentes distintos nos 3 primeiros', () => {
    for (let s = 0; s < 20; s++) {
      const { rng } = counted(100 + s)
      const games = selectKeyGames({ league, playerTeamId: 'okc', prevStandings: null, prevChampionTeamId: 'okc', hasRivalryEvent: false, rng })
      expect(games.every(g => g.opponentTeamId !== 'okc')).toBe(true)
      expect(new Set(games.slice(0, 3).map(g => g.opponentTeamId)).size).toBe(3)
    }
  })
  test('rivalry é da mesma conferência', () => {
    const { rng } = counted(5)
    const games = selectKeyGames({ league, playerTeamId: 'uta', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng })
    const conf = new Map(TEAMS.map(t => [t.id, t.conf]))
    expect(conf.get(games[0].opponentTeamId)).toBe('west')
  })
  test('determinístico por seed', () => {
    const a = selectKeyGames({ league, playerTeamId: 'lal', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng: counted(9).rng })
    const b = selectKeyGames({ league, playerTeamId: 'lal', prevStandings: null, prevChampionTeamId: null, hasRivalryEvent: false, rng: counted(9).rng })
    expect(a).toEqual(b)
  })
})
