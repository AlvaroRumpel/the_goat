import { describe, expect, test } from 'vitest'
import { ageMultiplier, simRegularSeason, simPostseason, performanceRatio } from '../../src/engine/season'
import { resolveBuild } from '../../src/engine/draft'
import { createRng } from '../../src/engine/rng'
import { teamById } from '../../src/data/teams'
import { PLAYERS } from '../../src/data/players'
import { SLOT_ORDER } from '../../src/engine/types'
import type { DraftPick, Focus, SeasonResult } from '../../src/engine/types'

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
  test('rookie fraco, pico 26-29', () => {
    expect(ageMultiplier(19, 80)).toBeCloseTo(0.78, 2)
    expect(ageMultiplier(22, 80)).toBeCloseTo(0.78 + 3 * (0.22 / 7), 3)
    expect(ageMultiplier(26, 80)).toBeCloseTo(1.0, 3)
    expect(ageMultiplier(29, 80)).toBe(1.0)
  })
  test('declínio pós-29 depende do físico', () => {
    expect(ageMultiplier(30, 99)).toBeCloseTo(1 - (0.035 - 99 * 0.0002), 4)   // ~0.9848
    expect(ageMultiplier(35, 99)).toBeGreaterThan(ageMultiplier(35, 60))
    expect(ageMultiplier(30, 0)).toBeCloseTo(1 - 0.035, 4)                     // rate clampada em 0.035
  })
  test('piso 0.60', () => {
    expect(ageMultiplier(60, 40)).toBe(0.6)
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

const seasonWithPpg = (ppg: number): SeasonResult => ({
  age: 25, teamId: 'lal', finalTeamId: 'lal', games: 82, ppg, rpg: 5, apg: 5,
  events: [], madePlayoffs: false, wonTitle: false, awards: [],
})

describe('performanceRatio', () => {
  test('null com menos de 5 temporadas', () => {
    expect(performanceRatio([seasonWithPpg(20)])).toBeNull()
  })
  test('última / pico', () => {
    const seasons = [28, 30, 29, 27, 18].map(seasonWithPpg)
    expect(performanceRatio(seasons)).toBeCloseTo(18 / 30, 4)
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
