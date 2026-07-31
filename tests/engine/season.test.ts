import { describe, expect, test } from 'vitest'
import { ageMultiplier, simRegularSeason, computeWinPct, computeTitleProb, finishSeason, performanceRatio } from '../../src/engine/season'
import { rollEvents } from '../../src/engine/events'
import { resolveBuild } from '../../src/engine/draft'
import { createRng } from '../../src/engine/rng'
import { teamById } from '../../src/data/teams'
import { PLAYERS } from '../../src/data/players'
import { SLOT_ORDER } from '../../src/engine/types'
import type { Build, DraftPick, EventChoice, Focus, GameEventId, RegularSeasonResult, Rng, SeasonResult, Team } from '../../src/engine/types'

// build sintético com o melhor jogador por atributo — equivalente ao antigo eliteBuild via LEGENDS
const elitePicks: DraftPick[] = SLOT_ORDER.map(slot => ({
  slot,
  playerId: PLAYERS.reduce((best, pl) => (pl.attrs[slot] > best.attrs[slot] ? pl : best), PLAYERS[0]).id,
}))
const eliteBuild = resolveBuild(elitePicks)

// composição sintética sem liga: isola as partes do season.ts.
// Mantido aqui só para os testes deste arquivo; a composição "de verdade" vive em state.ts.
function composePostseason(input: { build: Build; regular: RegularSeasonResult; team: Team; focus: Focus; rng: Rng }): SeasonResult {
  const { build, regular, team, focus, rng } = input
  const { winPct, effClutch } = computeWinPct({ build, regular, strength: team.strength, focus, rng })
  const madePlayoffs = winPct > 0.5 || rng.chance(winPct)
  const clutchAdj = madePlayoffs && regular.events.includes('playoffspark') ? effClutch + 8 : effClutch
  const wonTitle = madePlayoffs && rng.chance(computeTitleProb(winPct, clutchAdj))
  return finishSeason({
    regular, finalTeamId: team.id, build, rng, winPct, seed: null,
    playoffRun: wonTitle ? 'champion' : madePlayoffs ? 'r1' : 'missed', wonTitle,
    extraAwards: [], iconicMoments: [], chokes: 0,
  })
}

function fullSeason(seed: number, age = 26, teamId = 'okc', profile: 'contender' | 'rebuild' | 'bigmarket' = 'contender', focus: Focus = 'scoring') {
  const rng = createRng(seed)
  const team = teamById(teamId)
  const events = rollEvents(rng, focus)
  const regular = simRegularSeason({ build: eliteBuild, age, team, profile, focus, rng, events, choices: [] })
  return composePostseason({ build: eliteBuild, regular, team, focus, rng })
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
  seed: null, playoffRun: 'missed',
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

describe('composePostseason (provisório — winPct/titleProb/finishSeason)', () => {
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
    const post = composePostseason({ build: base.build, regular: reg, team: base.team, focus: 'scoring', rng: createRng(6) })
    expect(post).toBeTruthy() // sanity: roda sem erro com os novos campos
  })
})

// Weak team (uta, strength 55) keeps baseline winPct comfortably between the 0.15/0.85
// clamps and above 0.5 even after the worst-case negative delta (lockerFight -0.03), so
// madePlayoffs always short-circuits true and the recorded chance() call order is stable
// across scenarios — letting us capture the exact titleProb passed to rng.chance().
describe('efeitos determinísticos do pós-temporada (winPct/effClutch)', () => {
  const team = teamById('uta')
  const m = ageMultiplier(27, eliteBuild.attributes.physical)
  const baseWinPct = Math.min(0.85, Math.max(0.15, (team.strength * 0.55 + eliteBuild.overall * m * 0.45 - 35) / 55))
  const baseClutch = eliteBuild.attributes.clutch * m

  function regularWith(events: GameEventId[], choices: EventChoice[] = []): RegularSeasonResult {
    return { age: 27, teamId: team.id, games: 70, ppg: 12, rpg: 5, apg: 3, events, choices, tradeOffer: null }
  }

  // Records every p passed to chance() and always answers true, so madePlayoffs/wonTitle
  // resolve deterministically and titleProb is always calls[0] (no event) or calls[1]
  // (coachchange, whose own 0.5 coin-flip is recorded first).
  function recordingRng(): { rng: Rng; calls: number[] } {
    const calls: number[] = []
    const rng: Rng = { next: () => 0.5, int: (min) => min, pick: (arr) => arr[0], chance: (p) => { calls.push(p); return true } }
    return { rng, calls }
  }

  // constantes recalibradas na Task 11 (0.22→0.195, 0.0015→0.0013) e na Task 8 do ciclo
  // jogo vivo (0.195→0.1775, 0.0013→0.00118): ver comentário em computeTitleProb (season.ts)
  const titleProb = (winPct: number, effClutch: number) =>
    Math.min(0.16, Math.max(0.01, (winPct - 0.5) * 0.1775 + (effClutch - 75) * 0.00118))

  test('baseline titleProb', () => {
    const { rng, calls } = recordingRng()
    composePostseason({ build: eliteBuild, regular: regularWith([]), team, focus: 'scoring', rng })
    expect(calls[0]).toBeCloseTo(titleProb(baseWinPct, baseClutch), 6)
  })

  test('coachchange: chance(0.5)=true → winPct +0.02', () => {
    const { rng, calls } = recordingRng()
    composePostseason({ build: eliteBuild, regular: regularWith(['coachchange']), team, focus: 'scoring', rng })
    expect(calls[0]).toBeCloseTo(0.5) // the coachchange coin-flip itself
    expect(calls[1]).toBeCloseTo(titleProb(baseWinPct + 0.02, baseClutch), 6)
  })

  test('lockerFight: winPct -0.03, effClutch +6', () => {
    const { rng, calls } = recordingRng()
    composePostseason({ build: eliteBuild, regular: regularWith([], ['lockerFight']), team, focus: 'scoring', rng })
    expect(calls[0]).toBeCloseTo(titleProb(baseWinPct - 0.03, baseClutch + 6), 6)
  })

  test('lockerCalm: winPct +0.02', () => {
    const { rng, calls } = recordingRng()
    composePostseason({ build: eliteBuild, regular: regularWith([], ['lockerCalm']), team, focus: 'scoring', rng })
    expect(calls[0]).toBeCloseTo(titleProb(baseWinPct + 0.02, baseClutch), 6)
  })

  test('playoffspark: effClutch +8 apenas quando madePlayoffs', () => {
    const { rng, calls } = recordingRng()
    composePostseason({ build: eliteBuild, regular: regularWith(['playoffspark']), team, focus: 'scoring', rng })
    expect(calls[0]).toBeCloseTo(titleProb(baseWinPct, baseClutch + 8), 6)
  })
})
