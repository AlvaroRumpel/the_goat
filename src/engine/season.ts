import { rollEvents } from './events'
import { makeOffers } from './offers'
import type { Build, Focus, RegularSeasonResult, Rng, SeasonResult, Team, TeamProfile } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function ageMultiplier(age: number): number {
  if (age < 22) return 0.85
  if (age < 25) return 0.93
  if (age <= 29) return 1.0
  return Math.max(0.72, 1.0 - (age - 29) * 0.02)
}

export function simRegularSeason(input: {
  build: Build; age: number; team: Team; profile: TeamProfile
  focus: Focus; rng: Rng; canTrade?: boolean
}): RegularSeasonResult {
  const { build, age, team, profile, focus, rng, canTrade = true } = input
  const m = ageMultiplier(age)
  const eff = (s: keyof Build['attributes']) => build.attributes[s] * m
  const events = rollEvents(rng, focus)

  const scoringRt = 0.35 * eff('three') + 0.30 * eff('finishing') + 0.20 * eff('handles') + 0.15 * eff('clutch')
  let ppg = clamp((scoringRt - 40) * 0.55 + (rng.next() * 3 - 1.5), 4, 38)
  if (profile === 'rebuild') ppg *= 1.15
  if (profile === 'contender') ppg *= 0.90
  if (focus === 'scoring') ppg += 2
  if (events.includes('coldstreak')) ppg -= 2
  if (build.archetype === 'SG' || build.archetype === 'SF') ppg += 1
  if (build.archetype === 'C') ppg -= 1
  ppg = clamp(ppg, 4, 38)

  let rpg = clamp((0.55 * eff('rebounding') + 0.30 * eff('physical') + 0.15 * eff('finishing') - 40) * 0.22, 2, 16)
  if (build.archetype === 'C') rpg += 3
  if (build.archetype === 'PF') rpg += 2
  if (build.archetype === 'PG') rpg -= 1.5
  rpg = clamp(rpg, 2, 16)

  let apg = clamp((0.60 * eff('passing') + 0.40 * eff('handles') - 40) * 0.18, 1, 12)
  if (build.archetype === 'PG') apg += 3
  if (build.archetype === 'SG') apg += 0.5
  if (build.archetype === 'C') apg -= 1
  apg = clamp(apg, 1, 12)

  const games = 82 - (events.includes('injury') ? rng.int(10, 35) : rng.int(0, 6))
  const tradeOffer = canTrade && rng.chance(0.10) ? makeOffers(rng, team.id)[rng.int(0, 2)] : null

  return {
    age, teamId: team.id, games,
    ppg: Math.round(ppg * 10) / 10,
    rpg: Math.round(rpg * 10) / 10,
    apg: Math.round(apg * 10) / 10,
    events, tradeOffer,
  }
}

export function simPostseason(input: {
  build: Build; regular: RegularSeasonResult; team: Team; focus: Focus; rng: Rng
}): SeasonResult {
  const { build, regular, team, focus, rng } = input
  const m = ageMultiplier(regular.age)
  const overallEff = build.overall * m
  let winPct = clamp((team.strength * 0.55 + overallEff * 0.45 - 35) / 55, 0.15, 0.85)
  if (focus === 'defense') winPct += 0.02
  if (focus === 'leadership') winPct += 0.03
  winPct = clamp(winPct, 0.15, 0.85)

  const effClutch = build.attributes.clutch * m + (regular.events.includes('rivalry') ? 6 : 0)
  const madePlayoffs = winPct > 0.5 || rng.chance(winPct)
  const titleProb = madePlayoffs
    ? clamp((winPct - 0.5) * 0.9 + (effClutch - 75) * 0.004, 0.01, 0.45)
    : 0
  const wonTitle = rng.chance(titleProb)

  const awards: SeasonResult['awards'] = []
  if (regular.ppg >= 20 || regular.apg >= 8 || regular.rpg >= 11) awards.push('allstar')
  if (regular.ppg >= 29 && rng.chance(0.5)) awards.push('scoring')
  if (regular.ppg >= 26 && winPct >= 0.6 && rng.chance(0.25)) awards.push('mvp')
  if (build.attributes.defense * m >= 90 && rng.chance(0.15)) awards.push('dpoy')
  if (wonTitle) {
    awards.push('ring')
    if (rng.chance(0.7)) awards.push('fmvp')
  }

  const { tradeOffer: _drop, ...rest } = regular
  return { ...rest, finalTeamId: team.id, madePlayoffs, wonTitle, awards }
}
