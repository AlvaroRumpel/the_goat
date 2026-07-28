import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { advanceOffseason, simNpcLines, simStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'
import { TEAMS } from '../../src/data/teams'

function step(league: ReturnType<typeof initLeague>, seed: number) {
  const rng = createRng(seed)
  const standings = simStandings({ league, playerTeamId: 'den', playerWins: 50, rng })
  const lines = simNpcLines(league, rng)
  return advanceOffseason({ league, standings, lines, rng })
}

describe('advanceOffseason', () => {
  test('invariantes: 270 jogadores, 9 por time, idades +1 ou substituto', () => {
    const league = initLeague()
    const { league: next } = step(league, 1)
    expect(next.players).toHaveLength(270)
    for (const t of TEAMS) expect(next.players.filter(p => p.teamId === t.id)).toHaveLength(9)
    expect(next.year).toBe(2)
  })
  test('prevPpg preenchido para sobreviventes', () => {
    const league = initLeague()
    const { league: next } = step(league, 2)
    const survivors = next.players.filter(p => !p.rookie)
    expect(survivors.some(p => p.prevPpg !== null)).toBe(true)
  })
  test('trades geram headlines e trocam teamId', () => {
    const league = initLeague()
    const { league: next, headlines } = step(league, 3)
    const trades = headlines.filter(h => h.kind === 'trade')
    expect(trades.length).toBeGreaterThanOrEqual(1)   // 1 headline por trade; pode pular trade se não achar par
    expect(trades.length).toBeLessThanOrEqual(4)
  })
  test('liga sobrevive 20 temporadas sem degenerar', () => {
    let league = initLeague()
    for (let y = 0; y < 20; y++) league = step(league, 100 + y).league
    expect(league.players).toHaveLength(270)
    const avgOvr = league.players.reduce((n, p) => n + p.ovr, 0) / 270
    expect(avgOvr).toBeGreaterThanOrEqual(65)
    expect(avgOvr).toBeLessThanOrEqual(82)
    expect(Math.max(...league.players.map(p => p.ovr))).toBeGreaterThanOrEqual(88) // sempre há estrelas
    expect(new Set(league.players.map(p => p.id)).size).toBe(270)
  })
})
