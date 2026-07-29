import { describe, expect, test } from 'vitest'
import { computeVerdict } from '../../src/engine/verdict'
import type { Award, Career, SeasonResult } from '../../src/engine/types'
import { createRng } from '../../src/engine/rng'
import { drawPlayer, resolveBuild } from '../../src/engine/draft'
import { SLOT_ORDER, type DraftPick } from '../../src/engine/types'
import { simRegularSeason, computeWinPct, computeTitleProb, finishSeason } from '../../src/engine/season'
import { rollEvents, autoResolve } from '../../src/engine/events'
import { teamById } from '../../src/data/teams'
import { makeOffers } from '../../src/engine/offers'

function season(over: Partial<SeasonResult>): SeasonResult {
  return {
    age: 25, teamId: 'okc', finalTeamId: 'okc', games: 78,
    ppg: 12, rpg: 5, apg: 3, events: [], choices: [], madePlayoffs: false,
    wonTitle: false, awards: [], seed: null, playoffRun: 'missed', ...over,
  }
}

describe('computeVerdict', () => {
  test('short mediocre career → peladeiro or rolePlayer', () => {
    const c: Career = { seasons: [season({ ppg: 8 }), season({ ppg: 9, age: 26 })], fame: 0 }
    expect(['peladeiro', 'rolePlayer']).toContain(computeVerdict(c).tier)
  })
  test('GOAT career (6 rings, 5 mvps, 18 seasons of 28ppg) → goat', () => {
    const seasons: SeasonResult[] = []
    for (let i = 0; i < 18; i++) {
      const ring = i >= 6 && i < 12
      const awards: Award[] = [
        'allstar', ...(i >= 4 && i < 9 ? ['mvp' as const] : []),
        ...(ring ? ['ring' as const, 'fmvp' as const] : []),
      ]
      seasons.push(season({
        age: 19 + i, ppg: 28, games: 80, madePlayoffs: true, wonTitle: ring,
        awards,
      }))
    }
    expect(computeVerdict({ seasons, fame: 50 }).tier).toBe('goat')
  })
  test('loyalty bonus applies only for 10+ single-team seasons', () => {
    const loyal: Career = { seasons: Array.from({ length: 10 }, (_, i) => season({ age: 19 + i })), fame: 0 }
    const moved: Career = {
      seasons: loyal.seasons.map((s, i) => (i === 5 ? { ...s, finalTeamId: 'lal' } : s)),
      fame: 0,
    }
    expect(computeVerdict(loyal).score).toBe(computeVerdict(moved).score + 40)
  })
  test('totals accumulate', () => {
    const v = computeVerdict({ seasons: [season({ ppg: 10, games: 80 })], fame: 0 })
    expect(v.totals.points).toBe(800)
  })
  test('high score but weak trophies (2 rings, 1 mvp) → legend, not goat', () => {
    const seasons: SeasonResult[] = []
    for (let i = 0; i < 20; i++) {
      const ring = i < 2
      const awards: Award[] = [
        'allstar', 'scoring',
        ...(i === 0 ? ['mvp' as const] : []),
        ...(ring ? ['ring' as const, 'fmvp' as const] : []),
      ]
      seasons.push(season({ age: 19 + i, ppg: 27, games: 80, madePlayoffs: true, wonTitle: ring, awards }))
    }
    const v = computeVerdict({ seasons, fame: 1300 })
    expect(v.score).toBeGreaterThanOrEqual(1950)
    expect(v.tier).toBe('legend')
  })

  test('roy e mip pontuam no score', () => {
    const with_ = computeVerdict({ seasons: [season({ awards: ['roy', 'mip'] })], fame: 0 })
    const without = computeVerdict({ seasons: [season()], fame: 0 })
    expect(with_.score - without.score).toBe(30)
  })

  test('calibration: full random careers — goat rate < 2%, not all peladeiro', () => {
    const tiers: Record<string, number> = {}
    for (let seed = 0; seed < 300; seed++) {
      const rng = createRng(seed)
      const drawnIds: string[] = []
      const picks: DraftPick[] = SLOT_ORDER.map(slot => {
        const pl = drawPlayer(rng, drawnIds)
        drawnIds.push(pl.id)
        return { playerId: pl.id, slot }
      })
      const build = resolveBuild(picks)
      let offer = makeOffers(rng)[rng.int(0, 2)]
      const seasons = []
      for (let age = 19; age <= 36; age++) {
        const team = teamById(offer.teamId)
        const focus = (['scoring', 'defense', 'leadership', 'health'] as const)[rng.int(0, 3)]
        const events = rollEvents(rng, focus)
        const choices = autoResolve(events)
        const regular = simRegularSeason({ build, age, team, profile: offer.profile, focus, rng, events, choices })
        const finalTeam = regular.tradeOffer && rng.chance(0.5) ? teamById(regular.tradeOffer.teamId) : team
        // composição sintética sem liga: isola as partes do season.ts
        const { winPct, effClutch } = computeWinPct({ build, regular, strength: finalTeam.strength, focus, rng })
        const madePlayoffs = winPct > 0.5 || rng.chance(winPct)
        const clutchAdj = madePlayoffs && regular.events.includes('playoffspark') ? effClutch + 8 : effClutch
        const wonTitle = madePlayoffs && rng.chance(computeTitleProb(winPct, clutchAdj))
        seasons.push(finishSeason({
          regular, finalTeamId: finalTeam.id, build, rng, winPct, seed: null,
          playoffRun: wonTitle ? 'champion' : madePlayoffs ? 'r1' : 'missed', wonTitle,
          extraAwards: [],
        }))
        if ((age - 19) % 4 === 3) offer = makeOffers(rng, finalTeam.id)[rng.int(0, 2)]
      }
      const t = computeVerdict({ seasons, fame: 0 }).tier
      tiers[t] = (tiers[t] ?? 0) + 1
    }
    expect((tiers.goat ?? 0) / 300).toBeLessThan(0.02)
    expect(Object.keys(tiers).length).toBeGreaterThanOrEqual(3)
  })
})
