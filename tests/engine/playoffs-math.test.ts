import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { bo7WinProb, npcRound, pGameForSeries, resolveRest, seedBracket } from '../../src/engine/playoffs'
import { simStandings } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

const league = initLeague()

describe('bo7', () => {
  test('valores conhecidos', () => {
    expect(bo7WinProb(0.5)).toBeCloseTo(0.5, 10)
    expect(bo7WinProb(0.7)).toBeGreaterThan(0.87)
    expect(bo7WinProb(0)).toBe(0)
    expect(bo7WinProb(1)).toBe(1)
  })
  test('pGameForSeries inverte bo7WinProb', () => {
    for (const p of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      expect(bo7WinProb(pGameForSeries(p))).toBeCloseTo(p, 6)
    }
  })
})

describe('bracket por rodadas', () => {
  const rng = createRng(11)
  const standings = simStandings({ league, playerTeamId: 'den', playerWins: 55, rng })
  test('seedBracket: 8 por conferência', () => {
    const bs = seedBracket(standings)
    expect(bs.aliveEast).toHaveLength(8)
    expect(bs.aliveWest).toHaveLength(8)
    expect(bs.round).toBe(0)
  })
  test('npcRound preserva o jogador e reduz o resto pela metade', () => {
    const bs = seedBracket(standings)
    const denSeeded = bs.aliveWest.includes('den')
    if (!denSeeded) return   // seed 55 wins quase sempre classifica; guard para o raro
    const { next, playerOpponent } = npcRound(bs, league, 'den', createRng(12))
    expect(playerOpponent).not.toBeNull()
    expect(next.aliveWest).toContain('den')
    expect(next.aliveWest).toContain(playerOpponent!)
    expect(next.aliveEast).toHaveLength(4)   // east toda resolvida (4 vencedores)
    expect(next.aliveWest).toHaveLength(5)   // 3 vencedores NPC + jogador + oponente (par pendente)
    expect(next.round).toBe(bs.round)        // round só avança via advancePlayer/derrota
  })
  test('resolveRest devolve campeão entre os vivos', () => {
    const bs = seedBracket(standings)
    const champ = resolveRest(bs, league, createRng(13))
    expect([...bs.aliveEast, ...bs.aliveWest]).toContain(champ)
  })
})
