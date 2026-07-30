import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { computeTitleProb, computeWinPct, finishSeason, simRegularSeason } from '../../src/engine/season'
import { teamById } from '../../src/data/teams'
import { SLOT_ORDER, type Build, type SlotId } from '../../src/engine/types'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})

describe('partes do season', () => {
  const rng = createRng(42)
  const team = teamById('okc')
  const regular = simRegularSeason({ build: build(90), age: 27, team, profile: 'contender', focus: 'scoring', rng, canTrade: false, events: [], choices: [] })

  test('computeWinPct nos limites do contrato', () => {
    const { winPct } = computeWinPct({ build: build(90), regular, strength: team.strength, focus: 'scoring', rng })
    expect(winPct).toBeGreaterThanOrEqual(0.15)
    expect(winPct).toBeLessThanOrEqual(0.85)
  })
  test('computeTitleProb preserva forma e clamps', () => {
    // constantes recalibradas na Task 11 (0.22→0.195, 0.0015→0.0013): ver comentário em computeTitleProb (season.ts)
    expect(computeTitleProb(0.85, 99)).toBeCloseTo(Math.min(0.16, (0.85 - 0.5) * 0.195 + (99 - 75) * 0.0013), 10)
    expect(computeTitleProb(0.15, 40)).toBe(0.01)
  })
  test('finishSeason: allstar/scoring/ring + extraAwards', () => {
    const s = finishSeason({
      regular: { ...regular, ppg: 27, rpg: 6, apg: 5 }, finalTeamId: 'okc', build: build(90),
      rng: createRng(7), winPct: 0.7, seed: 1, playoffRun: 'champion', wonTitle: true,
      extraAwards: ['mvp'], iconicMoments: [], chokes: 0,
    })
    expect(s.awards).toContain('allstar')
    expect(s.awards).toContain('ring')
    expect(s.awards).toContain('mvp')
    expect(s.seed).toBe(1)
    expect(s.playoffRun).toBe('champion')
    expect(s.madePlayoffs).toBe(true)
  })
})
