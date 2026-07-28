import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { simAwards, simNpcLines, simStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

const league = initLeague()

function run(seed: number, player: Partial<import('../../src/engine/league').PlayerAwardInput> = {}) {
  const rng = createRng(seed)
  const standings = simStandings({ league, playerTeamId: 'den', playerWins: 55, rng })
  const lines = simNpcLines(league, rng)
  return simAwards({
    league, lines, standings, playerName: 'Você', rng,
    player: { ppg: 24, rpg: 6, apg: 5, teamWinPct: 0.67, defRating: 70, rookie: false, prevPpg: 22, ...player },
  })
}

describe('simAwards', () => {
  test('estrutura: 4 corridas com top-5, vencedores definidos', () => {
    const { races, winners } = run(1)
    expect(races.map(r => r.award).sort()).toEqual(['dpoy', 'mip', 'mvp', 'roy'])
    // mip fica de fora: no ano 1 nenhum NPC tem prevPpg (LeaguePlayer.prevPpg é null
    // até uma temporada anterior existir — ver teste dedicado "MIP nulo no ano 1"
    // logo abaixo), então o pool de MIP tem no máximo 1 elegível ('you').
    for (const r of races) {
      if (r.award === 'mip') continue
      expect(r.top.length).toBeGreaterThanOrEqual(3)
    }
    expect(winners.mvp).toBeTruthy()
    expect(winners.dpoy).toBeTruthy()
  })
  test('MIP nulo no ano 1 (sem prevPpg de NPC)', () => {
    const { winners } = run(2, { rookie: true, prevPpg: null })
    expect(winners.mip).toBeNull()
  })
  // linha "monstro" recalibrada na Task 10: com o ppg de NPC na escala real da NBA
  // (líder ~30), o topo da corrida de MVP fica ~62-64 no composto ppg+1.4apg+1.1rpg.
  // 33/11/9 em time de 61 vitórias ≈ o que um build 99 entrega no pico.
  test('jogador monstro ganha MVP com frequência; mediano quase nunca', () => {
    let big = 0, mid = 0
    for (let i = 0; i < 200; i++) {
      if (run(100 + i, { ppg: 33, rpg: 11, apg: 9, teamWinPct: 0.75 }).winners.mvp === 'you') big++
      if (run(100 + i, { ppg: 18, rpg: 5, apg: 4, teamWinPct: 0.55 }).winners.mvp === 'you') mid++
    }
    expect(big / 200).toBeGreaterThan(0.35)
    expect(mid / 200).toBeLessThan(0.05)
  })
  test('DPOY exige build defensivo', () => {
    let low = 0, high = 0
    for (let i = 0; i < 200; i++) {
      if (run(300 + i, { defRating: 70 }).winners.dpoy === 'you') low++
      if (run(300 + i, { defRating: 96 }).winners.dpoy === 'you') high++
    }
    expect(low / 200).toBeLessThan(0.03)
    expect(high / 200).toBeGreaterThan(0.08)
  })
  test('ROY só entre rookies', () => {
    const { races } = run(4, { rookie: true, ppg: 19 })
    const royIds = races.find(r => r.award === 'roy')!.top.map(e => e.id)
    const rookieIds = new Set(league.players.filter(p => p.rookie).map(p => p.id))
    for (const id of royIds) expect(id === 'you' || rookieIds.has(id)).toBe(true)
  })
})
