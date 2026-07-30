import { makeOffers } from './offers'
import type { Award, Build, EventChoice, Focus, GameEventId, IconicMomentId, PlayoffRun, RegularSeasonResult, Rng, SeasonResult, Team, TeamProfile, TeamStanding } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function ageMultiplier(age: number, physical: number): number {
  if (age <= 26) return 0.78 + (age - 19) * (0.22 / 7)
  if (age <= 29) return 1.0
  const rate = clamp(0.035 - physical * 0.0002, 0.012, 0.035)
  return Math.max(0.6, 1.0 - (age - 29) * rate)
}

export function effectiveOverall(overall: number, age: number, physical: number): number {
  return Math.round(overall * ageMultiplier(age, physical))
}

export function simRegularSeason(input: {
  build: Build; age: number; team: Team; profile: TeamProfile
  focus: Focus; rng: Rng; canTrade?: boolean
  events: GameEventId[]; choices: EventChoice[]
  standings?: TeamStanding[]   // tabela da temporada anterior — ofertas do deadline por vitórias
}): RegularSeasonResult {
  const { build, age, team, profile, focus, rng, canTrade = true, events, choices, standings } = input
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
  const tradeOffer = canTrade && rng.chance(tradeP) ? makeOffers(rng, team.id, standings)[rng.int(0, 2)] : null

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

// strength: vem de rosterStrength(league, teamId) — força de elenco real (spec §2).
// O jogador NÃO entra no roster passado (a fórmula já soma overallEff * 0.45 à parte).
export function computeWinPct(input: {
  build: Build; regular: RegularSeasonResult; strength: number; focus: Focus; rng: Rng
}): { winPct: number; effClutch: number } {
  const { build, regular, strength, focus, rng } = input
  const m = ageMultiplier(regular.age, build.attributes.physical)
  const overallEff = build.overall * m
  let winPct = clamp((strength * 0.55 + overallEff * 0.45 - 35) / 55, 0.15, 0.85)
  if (focus === 'defense') winPct += 0.02
  if (focus === 'leadership') winPct += 0.03
  if (regular.events.includes('coachchange')) winPct += rng.chance(0.5) ? 0.02 : -0.02
  if (regular.choices.includes('lockerFight')) winPct -= 0.03
  if (regular.choices.includes('lockerCalm')) winPct += 0.02
  winPct = clamp(winPct, 0.15, 0.85)

  let effClutch = build.attributes.clutch * m + (regular.events.includes('rivalry') ? 6 : 0)
  if (regular.choices.includes('lockerFight')) effClutch += 6
  return { winPct, effClutch }
}

export function computeTitleProb(winPct: number, effClutch: number): number {
  // Calibração(c2) — Task 11: builds de elite (99) quase sempre batem no clamp de
  // winPct (0.85), então o excesso acima de 0.5 era constante ~0.35 e o termo de
  // winPct virava um piso alto de titleProb para toda build de overall alto (90-99),
  // empurrando a cauda de anéis que faz goatRate(99) passar de 0.02 (medido: 0.0217
  // em N=600). 0.22 → 0.195 e 0.0015 → 0.0013: reduz esse piso ~10-13% sem mexer no
  // floor/cap (0.01/0.16, nunca atingido nesta faixa de winPct/effClutch). Builds
  // fracas (winPct perto de 0.5) quase não sentem — a trava 83/79 tem folga grande.
  return clamp((winPct - 0.5) * 0.195 + (effClutch - 75) * 0.0013, 0.01, 0.16)
}

export function finishSeason(input: {
  regular: RegularSeasonResult; finalTeamId: string; build: Build; rng: Rng
  winPct: number; seed: number | null; playoffRun: PlayoffRun; wonTitle: boolean
  extraAwards: Award[]   // mvp/dpoy/roy/mip vindos do modelo de ranking (Task 8)
  iconicMoments: IconicMomentId[]; chokes: number
}): SeasonResult {
  const { regular, finalTeamId, rng, seed, playoffRun, wonTitle, extraAwards, iconicMoments, chokes } = input
  const awards: Award[] = []
  if (regular.ppg >= 19 || regular.apg >= 8 || regular.rpg >= 11) awards.push('allstar')
  if (regular.ppg >= 26 && rng.chance(0.5)) awards.push('scoring')
  awards.push(...extraAwards)
  if (wonTitle) {
    awards.push('ring')
    if (rng.chance(0.7)) awards.push('fmvp')
  }
  const { tradeOffer: _drop, ...rest } = regular
  return { ...rest, finalTeamId, madePlayoffs: playoffRun !== 'missed', wonTitle, seed, playoffRun, awards, iconicMoments, chokes }
}
