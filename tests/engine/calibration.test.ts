import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { defaultOption } from '../../src/engine/moments'
import { makeOffers } from '../../src/engine/offers'
import { computeVerdict } from '../../src/engine/verdict'
import { initLeague } from '../../src/data/league'
import { gameReducer, initialState } from '../../src/state'
import type { Action, GameState } from '../../src/state'
import { SLOT_ORDER, type Build, type Rng, type SlotId, type Tier } from '../../src/engine/types'

// Harness DIRIGIDO PELO REDUCER (src/state.ts): nada é replicado aqui. Cada temporada
// é a mesma sequência de dispatches que a UI faz — PLAY_SEASON → jogos-chave →
// [tradeDecision] → playoffs jogo a jogo → ADVANCE. Antes da Task 8 o harness chamava
// simBracket direto, calibrando um caminho que quem classifica nunca percorre.

type Policy = 'auto' | 'bold'

function flatBuild(overall: number): Build {
  const attrs = Object.fromEntries(SLOT_ORDER.map(s => [s, overall])) as Record<SlotId, number>
  return { attributes: attrs, picks: [], archetype: 'SF', overall }
}

function countedRng(seed: number): { rng: Rng; calls: () => number } {
  const inner = createRng(seed)
  let n = 0
  const next = () => { n++; return inner.next() }
  return {
    rng: {
      next,
      int: (min, max) => min + Math.floor(next() * (max - min + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
    },
    calls: () => n,
  }
}

// Equivalente a CONFIRM_BUILD + CHOOSE_OFFER, mas com a build injetada: a calibração
// varre overall, não o draft. Consome as mesmas calls que makeOffers no reducer.
function startState(overall: number, seed: number): GameState {
  const { rng, calls } = countedRng(seed)
  const offers = makeOffers(rng)
  return {
    ...initialState(), seed, rngCalls: calls(), build: flatBuild(overall), league: initLeague(),
    age: 19, offers, currentOffer: offers[0], contractYearsLeft: 4, phase: 'preseason',
  }
}

// auto = sempre a opção segura (idêntico a SKIP_GAME); bold = sempre a opção ousada.
function gameAction(s: GameState, policy: Policy): Action {
  if (policy === 'auto') return { type: 'SKIP_GAME' }
  const m = s.pendingGame!.moments[s.pendingGame!.momentIndex]
  const option = m.options.find(o => o.risk === 'bold') ?? defaultOption(m)
  return { type: 'DECIDE_MOMENT', optionId: option.id }
}

function playSeason(s: GameState, policy: Policy): GameState {
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 400) {
    if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else if (s.pendingGame) s = gameReducer(s, gameAction(s, policy))
    else if (s.phase === 'playoffGame') s = gameReducer(s, { type: 'ADVANCE_GAME' })
    else break
  }
  return s
}

// política fixa do spec: até os 40, foco scoring, sem trades, 1ª oferta na free agency.
function simCareer(overall: number, seed: number, policy: Policy) {
  let s = startState(overall, seed)
  let guard = 0
  while (s.phase !== 'verdict' && guard++ < 60) {
    if (s.phase === 'preseason') s = playSeason(s, policy)
    else if (s.phase === 'seasonResult') s = gameReducer(s, { type: 'ADVANCE' })
    else if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    else if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
    else break
  }
  if (s.phase !== 'verdict') throw new Error('simCareer truncado: guard de 60 iterações estourou')
  const seasons = s.career.seasons
  const peakSeasons = seasons.filter(x => x.age >= 26 && x.age <= 29)
  const avg = (f: (x: typeof seasons[number]) => number) =>
    peakSeasons.length ? peakSeasons.reduce((n, x) => n + f(x), 0) / peakSeasons.length : 0
  const verdict = computeVerdict(s.career)
  return {
    verdict,
    peak: { ppg: avg(x => x.ppg), rpg: avg(x => x.rpg), apg: avg(x => x.apg) },
    hadAllstar: seasons.some(x => x.awards.includes('allstar')),
    hadDpoy: seasons.some(x => x.awards.includes('dpoy')),
    hadRoy: seasons.some(x => x.awards.includes('roy')),
    iconicCount: seasons.reduce((n, x) => n + (x.iconicMoments?.length ?? 0), 0),
    titleRate: seasons.filter(x => x.seed !== null).length
      ? seasons.filter(x => x.wonTitle).length / seasons.filter(x => x.seed !== null).length
      : 0,
  }
}

// N=200 é o tamanho do baseline (docs/superpowers/plans/2026-07-28-calibracao-baseline-liga.md).
// A trava do dono goatRate(99) < 0.02 precisa de mais resolução: em N=200 o statistic
// anda de 0.005 em 0.005 e mesmo o engine pré-Task-8 (taxa real 0.0133) reprova em ~1/3
// dos blocos de seed. O teste do 99 roda com N maior — mesma trava, medida melhor.
const N_GOAT = 600

function distribution(overall: number, policy: Policy = 'auto', N = 200) {
  const results = Array.from({ length: N }, (_, i) => simCareer(overall, 1000 + i, policy))
  const verdicts = results.map(r => r.verdict)
  const rings = verdicts.map(v => v.counts.ring).sort((a, b) => a - b)
  const tiers = verdicts.map(v => v.tier)
  const rate = (t: Tier) => tiers.filter(x => x === t).length / N
  const mean = (f: (r: typeof results[number]) => number) =>
    Math.round((results.reduce((n, r) => n + f(r), 0) / N) * 100) / 100
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
    peakPpg: Math.round((results.reduce((n, r) => n + r.peak.ppg, 0) / N) * 10) / 10,
    peakRpg: Math.round((results.reduce((n, r) => n + r.peak.rpg, 0) / N) * 10) / 10,
    peakApg: Math.round((results.reduce((n, r) => n + r.peak.apg, 0) / N) * 10) / 10,
    allstarRate: Math.round((results.filter(r => r.hadAllstar).length / N) * 1000) / 1000,
    dpoyRate: results.filter(r => r.hadDpoy).length / N,
    royRate: results.filter(r => r.hadRoy).length / N,
    // médias de contagem — diagnóstico de calibração (o que empurra o score)
    avgMvp: mean(r => r.verdict.counts.mvp),
    avgDpoy: mean(r => r.verdict.counts.dpoy),
    ringsAvg: mean(r => r.verdict.counts.ring),
    iconicAvg: mean(r => r.iconicCount),
    iconicPointsAvg: mean(r => r.verdict.iconicPoints),
    titleRateInPlayoffs: mean(r => r.titleRate),
    scoreP90: verdicts.map(v => v.score).sort((a, b) => a - b)[Math.floor(N * 0.9)],
  }
}

describe('calibração de dificuldade (política: até 40, foco scoring)', () => {
  test('83 overall: anéis raros, legend raro', () => {
    const d = distribution(83)
    if (process.env.CALIBRATE) console.log('83:', JSON.stringify(d, null, 2))
    expect(d.ringsMedian).toBeLessThanOrEqual(2)
    expect(d.legendRate).toBeLessThan(0.15)
  }, 300000)
  test('95 overall: legend alcançável', () => {
    const d = distribution(95)
    if (process.env.CALIBRATE) console.log('95:', JSON.stringify(d, null, 2))
    expect(d.legendRate).toBeGreaterThan(0.2)
    expect(d.mvpRate).toBeGreaterThan(0.5)
  }, 250000)
  test('relatório completo (só com CALIBRATE=1)', () => {
    if (!process.env.CALIBRATE) return
    for (const ov of [75, 90]) console.log(`${ov}:`, JSON.stringify(distribution(ov), null, 2))
  }, 350000)
  test('79 overall: médias de pico realistas', () => {
    const d = distribution(79)
    if (process.env.CALIBRATE) console.log('79:', JSON.stringify(d, null, 2))
    expect(d.peakPpg).toBeGreaterThanOrEqual(12)
    expect(d.peakPpg).toBeLessThanOrEqual(19)
    // ROY não é carimbo: build fraca perde a corrida com frequência (ROY_NPC_BOOST)
    expect(d.royRate).toBeLessThan(0.8)
  }, 280000)
  test('99 overall: elite pontua como elite', () => {
    const d = distribution(99, 'auto', N_GOAT)
    if (process.env.CALIBRATE) console.log('99:', JSON.stringify(d, null, 2))
    expect(d.peakPpg).toBeGreaterThanOrEqual(26)
    expect(d.peakPpg).toBeLessThanOrEqual(34)
    expect(d.goatRate).toBeLessThan(0.02)
  }, 600000)
})

describe('políticas de momento', () => {
  test('bold dá edge real mas não quebra o jogo (95 overall)', () => {
    const auto = distribution(95, 'auto')
    const bold = distribution(95, 'bold')
    if (process.env.CALIBRATE) console.log('95 auto vs bold:', JSON.stringify({ auto, bold }, null, 2))
    expect(bold.ringsAvg).toBeGreaterThan(auto.ringsAvg * 1.05)
    expect(bold.ringsAvg).toBeLessThan(auto.ringsAvg * 1.8)
    expect(bold.goatRate).toBeLessThan(0.04)   // trava de sanidade do dono
  }, 600000)
  test('icônicos: auto gera poucos, bold gera mais; cap respeitado', () => {
    const auto = distribution(90, 'auto')
    const bold = distribution(90, 'bold')
    if (process.env.CALIBRATE) console.log('90 auto vs bold:', JSON.stringify({ auto, bold }, null, 2))
    // auto só alcança `sweep` (resultado de série); todo icônico de jogada exige ousadia
    expect(bold.iconicAvg).toBeGreaterThan(auto.iconicAvg)
    expect(auto.iconicPointsAvg).toBeLessThanOrEqual(100)
    expect(bold.iconicPointsAvg).toBeLessThanOrEqual(100)
  }, 600000)
})
