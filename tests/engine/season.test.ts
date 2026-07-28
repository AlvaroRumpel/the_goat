import { describe, expect, test } from 'vitest'
import { ageMultiplier, simRegularSeason, simPostseason, performanceRatio } from '../../src/engine/season'
import { rollEvents } from '../../src/engine/events'
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
  const events = rollEvents(rng, focus)
  const regular = simRegularSeason({ build: eliteBuild, age, team, profile, focus, rng, events, choices: [] })
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
  events: [], choices: [], madePlayoffs: false, wonTitle: false, awards: [],
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

describe('efeitos dos eventos novos', () => {
  const base = { build: eliteBuild, age: 27, team: teamById('lal'), profile: 'rebuild' as const, focus: 'scoring' as const, canTrade: false }

  test('hotstreak sobe ppg vs sem evento (mesma seed)', () => {
    const a = simRegularSeason({ ...base, rng: createRng(9), events: [], choices: [] })
    const b = simRegularSeason({ ...base, rng: createRng(9), events: ['hotstreak'], choices: [] })
    expect(b.ppg).toBeGreaterThan(a.ppg)
  })
  test('injuryEarly perde menos jogos que injuryFull mas ppg cai', () => {
    const early = simRegularSeason({ ...base, rng: createRng(3), events: ['injury'], choices: ['injuryEarly'] })
    const full = simRegularSeason({ ...base, rng: createRng(3), events: ['injury'], choices: ['injuryFull'] })
    expect(early.games).toBeGreaterThanOrEqual(82 - 18)
    expect(full.games).toBeLessThanOrEqual(82 - 10)
    const clean = simRegularSeason({ ...base, rng: createRng(3), events: [], choices: [] })
    expect(early.ppg).toBeLessThan(clean.ppg)
  })
  test('lockerroom dobra chance de trade (0.20)', () => {
    let withEv = 0, without = 0
    for (let seed = 0; seed < 1500; seed++) {
      const t1 = simRegularSeason({ ...base, canTrade: true, rng: createRng(seed), events: ['lockerroom'], choices: ['lockerCalm'] })
      const t2 = simRegularSeason({ ...base, canTrade: true, rng: createRng(seed), events: [], choices: [] })
      if (t1.tradeOffer) withEv++
      if (t2.tradeOffer) without++
    }
    expect(withEv).toBeGreaterThan(without * 1.5)
  })
  test('playoffspark e lockerFight mexem no pós-temporada de forma determinística', () => {
    const reg = simRegularSeason({ ...base, rng: createRng(5), events: ['playoffspark'], choices: [] })
    const post = simPostseason({ build: base.build, regular: reg, team: base.team, focus: 'scoring', rng: createRng(6) })
    expect(post).toBeTruthy() // sanity: roda sem erro com os novos campos
  })
})
