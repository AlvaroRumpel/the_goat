import { makeOffers } from './offers'
import type { Build, EventChoice, Focus, GameEventId, RegularSeasonResult, Rng, SeasonResult, Team, TeamProfile } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function ageMultiplier(age: number, physical: number): number {
  if (age <= 26) return 0.78 + (age - 19) * (0.22 / 7)
  if (age <= 29) return 1.0
  const rate = clamp(0.035 - physical * 0.0002, 0.012, 0.035)
  return Math.max(0.6, 1.0 - (age - 29) * rate)
}

export function simRegularSeason(input: {
  build: Build; age: number; team: Team; profile: TeamProfile
  focus: Focus; rng: Rng; canTrade?: boolean
  events: GameEventId[]; choices: EventChoice[]
}): RegularSeasonResult {
  const { build, age, team, profile, focus, rng, canTrade = true, events, choices } = input
  const m = ageMultiplier(age, build.attributes.physical)
  const eff = (s: keyof Build['attributes']) => build.attributes[s] * m

  const scoringRt = 0.35 * eff('three') + 0.30 * eff('finishing') + 0.20 * eff('handles') + 0.15 * eff('clutch')
  let ppg = clamp((scoringRt - 61) * 0.78 + (rng.next() * 3 - 1.5), 4, 38)
  if (profile === 'rebuild') ppg *= 1.15
  if (profile === 'contender') ppg *= 0.90
  if (focus === 'scoring') ppg += 2
  if (events.includes('coldstreak')) ppg -= 2
  if (events.includes('hotstreak')) ppg += 2
  if (choices.includes('injuryEarly')) ppg -= 2
  if (build.archetype === 'SG' || build.archetype === 'SF') ppg += 1
  if (build.archetype === 'C') ppg -= 1
  ppg = clamp(ppg, 4, 38)

  let rpg = clamp((0.55 * eff('rebounding') + 0.30 * eff('physical') + 0.15 * eff('finishing') - 40) * 0.22, 2, 16)
  if (build.archetype === 'C') rpg += 3
  if (build.archetype === 'PF') rpg += 2
  if (build.archetype === 'PG') rpg -= 1.5
  rpg = clamp(rpg, 2, 16)

  let apg = clamp((0.60 * eff('passing') + 0.40 * eff('handles') - 47) * 0.18, 1, 12)
  if (build.archetype === 'PG') apg += 3
  if (build.archetype === 'SG') apg += 0.5
  if (build.archetype === 'C') apg -= 1
  apg = clamp(apg, 1, 12)

  const games = 82 - (events.includes('injury')
    ? (choices.includes('injuryEarly') ? rng.int(10, 18) : rng.int(10, 35))
    : rng.int(0, 6))
  const tradeP = events.includes('lockerroom') ? 0.20 : 0.10
  const tradeOffer = canTrade && rng.chance(tradeP) ? makeOffers(rng, team.id)[rng.int(0, 2)] : null

  return {
    age, teamId: team.id, games,
    ppg: Math.round(ppg * 10) / 10,
    rpg: Math.round(rpg * 10) / 10,
    apg: Math.round(apg * 10) / 10,
    events, choices, tradeOffer,
  }
}

export function performanceRatio(seasons: SeasonResult[]): number | null {
  if (seasons.length < 5) return null
  const last = seasons[seasons.length - 1].ppg
  const peak = Math.max(...seasons.map(s => s.ppg))
  return peak > 0 ? last / peak : null
}

export function simPostseason(input: {
  build: Build; regular: RegularSeasonResult; team: Team; focus: Focus; rng: Rng
}): SeasonResult {
  const { build, regular, team, focus, rng } = input
  const m = ageMultiplier(regular.age, build.attributes.physical)
  const overallEff = build.overall * m
  let winPct = clamp((team.strength * 0.55 + overallEff * 0.45 - 35) / 55, 0.15, 0.85)
  if (focus === 'defense') winPct += 0.02
  if (focus === 'leadership') winPct += 0.03
  if (regular.events.includes('coachchange')) winPct += rng.chance(0.5) ? 0.02 : -0.02
  if (regular.choices.includes('lockerFight')) winPct -= 0.03
  if (regular.choices.includes('lockerCalm')) winPct += 0.02
  winPct = clamp(winPct, 0.15, 0.85)

  let effClutch = build.attributes.clutch * m + (regular.events.includes('rivalry') ? 6 : 0)
  if (regular.choices.includes('lockerFight')) effClutch += 6
  const madePlayoffs = winPct > 0.5 || rng.chance(winPct)
  if (madePlayoffs && regular.events.includes('playoffspark')) effClutch += 8
  const titleProb = madePlayoffs
    ? clamp((winPct - 0.5) * 0.22 + (effClutch - 75) * 0.0015, 0.01, 0.16)
    : 0
  const wonTitle = rng.chance(titleProb)

  const awards: SeasonResult['awards'] = []
  if (regular.ppg >= 19 || regular.apg >= 8 || regular.rpg >= 11) awards.push('allstar')
  if (regular.ppg >= 26 && rng.chance(0.5)) awards.push('scoring')
  if (regular.ppg >= 23 && winPct >= 0.6 && rng.chance(0.25)) awards.push('mvp')
  if (build.attributes.defense * m >= 90 && rng.chance(0.15)) awards.push('dpoy')
  if (wonTitle) {
    awards.push('ring')
    if (rng.chance(0.7)) awards.push('fmvp')
  }

  const { tradeOffer: _drop, ...rest } = regular
  return { ...rest, finalTeamId: team.id, madePlayoffs, wonTitle, awards }
}
