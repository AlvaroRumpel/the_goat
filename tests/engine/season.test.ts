import { describe, expect, test } from 'vitest'
import { ageMultiplier, simRegularSeason, simPostseason } from '../../src/engine/season'
import { resolveBuild } from '../../src/engine/draft'
import { createRng } from '../../src/engine/rng'
import { teamById } from '../../src/data/teams'
import { PLAYERS } from '../../src/data/players'
import { SLOT_ORDER } from '../../src/engine/types'
import type { DraftPick, Focus } from '../../src/engine/types'

// build sintético com o melhor jogador por atributo — equivalente ao antigo eliteBuild via LEGENDS
const elitePicks: DraftPick[] = SLOT_ORDER.map(slot => ({
  slot,
  playerId: PLAYERS.reduce((best, pl) => (pl.attrs[slot] > best.attrs[slot] ? pl : best), PLAYERS[0]).id,
}))
const eliteBuild = resolveBuild(elitePicks)

function fullSeason(seed: number, age = 26, teamId = 'okc', profile: 'contender' | 'rebuild' | 'bigmarket' = 'contender', focus: Focus = 'scoring') {
  const rng = createRng(seed)
  const team = teamById(teamId)
  const regular = simRegularSeason({ build: eliteBuild, age, team, profile, focus, rng })
  return simPostseason({ build: eliteBuild, regular, team, focus, rng })
}

describe('ageMultiplier', () => {
  test('peak at 25-29, decline after', () => {
    expect(ageMultiplier(26)).toBe(1.0)
    expect(ageMultiplier(19)).toBeLessThan(1.0)
    expect(ageMultiplier(35)).toBeLessThan(ageMultiplier(31))
    expect(ageMultiplier(40)).toBeGreaterThanOrEqual(0.72)
  })
})

describe('simRegularSeason', () => {
  test('stats within sane bounds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = fullSeason(seed)
      expect(s.ppg).toBeGreaterThanOrEqual(4); expect(s.ppg).toBeLessThanOrEqual(38)
      expect(s.rpg).toBeGreaterThanOrEqual(2); expect(s.rpg).toBeLessThanOrEqual(16)
      expect(s.apg).toBeGreaterThanOrEqual(1); expect(s.apg).toBeLessThanOrEqual(12)
      expect(s.games).toBeGreaterThanOrEqual(40); expect(s.games).toBeLessThanOrEqual(82)
    }
  })
  test('rebuild profile yields higher ppg than contender (elite build, avg over seeds)', () => {
    let reb = 0, con = 0
    for (let seed = 0; seed < 200; seed++) {
      reb += fullSeason(seed, 26, 'uta', 'rebuild').ppg
      con += fullSeason(seed, 26, 'okc', 'contender').ppg
    }
    expect(reb).toBeGreaterThan(con)
  })
  test('old age lowers output', () => {
    let prime = 0, old = 0
    for (let seed = 0; seed < 200; seed++) {
      prime += fullSeason(seed, 27).ppg
      old += fullSeason(seed, 38).ppg
    }
    expect(old).toBeLessThan(prime)
  })
})

describe('simPostseason', () => {
  test('elite build on contender wins titles sometimes but not always', () => {
    let titles = 0
    for (let seed = 0; seed < 300; seed++) if (fullSeason(seed).wonTitle) titles++
    expect(titles).toBeGreaterThan(10)
    expect(titles).toBeLessThan(200)
  })
  test('ring award accompanies title', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = fullSeason(seed)
      expect(s.awards.includes('ring')).toBe(s.wonTitle)
    }
  })
})
