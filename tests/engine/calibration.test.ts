import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { autoResolve, rollEvents } from '../../src/engine/events'
import { simPostseason, simRegularSeason } from '../../src/engine/season'
import { computeVerdict } from '../../src/engine/verdict'
import { makeOffers } from '../../src/engine/offers'
import { teamById } from '../../src/data/teams'
import { SLOT_ORDER, type Build, type Career, type SlotId, type Tier } from '../../src/engine/types'

function flatBuild(overall: number): Build {
  const attrs = Object.fromEntries(SLOT_ORDER.map(s => [s, overall])) as Record<SlotId, number>
  return { attributes: attrs, picks: [], archetype: 'SF', overall }
}

// política fixa do spec: até os 40, foco scoring, 1ª oferta a cada 4 anos,
// sem trades, escolha segura nos eventos interativos
function simCareer(build: Build, seed: number) {
  const rng = createRng(seed)
  const career: Career = { seasons: [], fame: 0 }
  let offer = makeOffers(rng)[0]
  let contractYears = 4
  let injuryProne = false
  for (let age = 19; age <= 40; age++) {
    if (contractYears === 0) {
      offer = makeOffers(rng, offer.teamId)[0]
      contractYears = 4
    }
    const team = teamById(offer.teamId)
    const events = rollEvents(rng, 'scoring', injuryProne)
    injuryProne = false
    const choices = autoResolve(events)
    const regular = simRegularSeason({
      build, age, team, profile: offer.profile, focus: 'scoring', rng,
      canTrade: false, events, choices,
    })
    const season = simPostseason({ build, regular, team, focus: 'scoring', rng })
    career.seasons.push(season)
    if (season.events.includes('viral')) career.fame += 10
    if (offer.profile === 'bigmarket') career.fame += 2
    contractYears--
  }
  return computeVerdict(career)
}

const N = 200

function distribution(overall: number) {
  const verdicts = Array.from({ length: N }, (_, i) => simCareer(flatBuild(overall), 1000 + i))
  const rings = verdicts.map(v => v.counts.ring).sort((a, b) => a - b)
  const tiers = verdicts.map(v => v.tier)
  const rate = (t: Tier) => tiers.filter(x => x === t).length / N
  return {
    ringsMedian: rings[Math.floor(N / 2)],
    ringsP90: rings[Math.floor(N * 0.9)],
    mvpRate: verdicts.filter(v => v.counts.mvp > 0).length / N,
    legendRate: rate('legend') + rate('goat'),
    goatRate: rate('goat'),
    tiers: Object.fromEntries(
      (['peladeiro', 'rolePlayer', 'starter', 'allstar', 'superstar', 'legend', 'goat'] as Tier[])
        .map(t => [t, rate(t)]),
    ),
    avgPoints: Math.round(verdicts.reduce((n, v) => n + v.totals.points, 0) / N),
  }
}

describe('calibração de dificuldade (política: até 40, foco scoring)', () => {
  test('83 overall: anéis raros, legend raro', () => {
    const d = distribution(83)
    if (process.env.CALIBRATE) console.log('83:', JSON.stringify(d, null, 2))
    expect(d.ringsMedian).toBeLessThanOrEqual(2)
    expect(d.legendRate).toBeLessThan(0.15)
  }, 30000)
  test('95 overall: legend alcançável', () => {
    const d = distribution(95)
    if (process.env.CALIBRATE) console.log('95:', JSON.stringify(d, null, 2))
    expect(d.legendRate).toBeGreaterThan(0.2)
  }, 30000)
  test('relatório completo (só com CALIBRATE=1)', () => {
    if (!process.env.CALIBRATE) return
    for (const ov of [75, 90]) console.log(`${ov}:`, JSON.stringify(distribution(ov), null, 2))
  }, 60000)
})
