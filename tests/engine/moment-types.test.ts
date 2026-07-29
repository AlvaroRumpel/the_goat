import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { finishSeason, simRegularSeason } from '../../src/engine/season'
import { teamById } from '../../src/data/teams'
import { SLOT_ORDER, type Build, type SlotId } from '../../src/engine/types'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})

test('finishSeason carrega iconicMoments e chokes', () => {
  const rng = createRng(1)
  const regular = simRegularSeason({
    build: build(90), age: 27, team: teamById('okc'), profile: 'contender',
    focus: 'scoring', rng, canTrade: false, events: [], choices: [],
  })
  const s = finishSeason({
    regular, finalTeamId: 'okc', build: build(90), rng, winPct: 0.7,
    seed: 1, playoffRun: 'champion', wonTitle: true, extraAwards: [],
    iconicMoments: ['finalsBuzzer', 'sweep'], chokes: 1,
  })
  expect(s.iconicMoments).toEqual(['finalsBuzzer', 'sweep'])
  expect(s.chokes).toBe(1)
})
