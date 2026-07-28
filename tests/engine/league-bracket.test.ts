import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { simBracket, simStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

const league = initLeague()

describe('simBracket', () => {
  test('campeão é um dos 16 classificados', () => {
    const rng = createRng(3)
    const standings = simStandings({ league, playerTeamId: 'uta', playerWins: 30, rng })
    const seeded = new Set(standings.filter(s => s.seed !== null).map(s => s.teamId))
    const { championTeamId, playerRun } = simBracket({ standings, league, playerTeamId: null, playerTitleProb: 0, rng })
    expect(seeded.has(championTeamId)).toBe(true)
    expect(playerRun).toBe('missed')
  })
  test('taxa agregada de título do jogador ≈ titleProb (±40% rel.)', () => {
    const titleProb = 0.12
    let titles = 0
    const N = 2000
    for (let i = 0; i < N; i++) {
      const rng = createRng(5000 + i)
      const standings = simStandings({ league, playerTeamId: 'den', playerWins: 55, rng })
      const r = simBracket({ standings, league, playerTeamId: 'den', playerTitleProb: titleProb, rng })
      if (r.wonTitle) titles++
    }
    const rate = titles / N
    expect(rate).toBeGreaterThan(titleProb * 0.6)
    expect(rate).toBeLessThan(titleProb * 1.4)
  }, 20000)
  test('playerRun coerente com wonTitle', () => {
    for (let i = 0; i < 50; i++) {
      const rng = createRng(100 + i)
      const standings = simStandings({ league, playerTeamId: 'okc', playerWins: 60, rng })
      const r = simBracket({ standings, league, playerTeamId: 'okc', playerTitleProb: 0.14, rng })
      if (r.wonTitle) expect(r.playerRun).toBe('champion')
      else expect(['r1', 'semi', 'conf', 'finals']).toContain(r.playerRun)
    }
  })
})
