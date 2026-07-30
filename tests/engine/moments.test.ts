import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import {
  GAME_RNG_CALLS, applyMoment, autoResolveGame, defaultOption, expectedAutoDelta, finishWatchedGame,
  makeMoments, resolveMoment, scoreOf, startWatchedGame,
} from '../../src/engine/moments'
import { SLOT_ORDER, type Build, type SlotId, type WatchedGameContext } from '../../src/engine/types'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const flatBuild = build
const ctx: WatchedGameContext = { kind: 'rivalry', opponentTeamId: 'bos' }

function countedRng(seed: number) {
  const inner = createRng(seed)
  let n = 0
  const rng = {
    next: () => { n++; return inner.next() },
    int: (a: number, b: number) => a + Math.floor((n++, inner.next()) * (b - a + 1)),
    pick: <T,>(arr: T[]) => arr[Math.floor((n++, inner.next()) * arr.length)],
    chance: (p: number) => (n++, inner.next()) < p,
  }
  return { rng, calls: () => n }
}

describe('contrato de rng calls', () => {
  test('jogo completo assistido = exatamente GAME_RNG_CALLS', () => {
    const { rng, calls } = countedRng(1)
    let g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, rng })
    expect(calls()).toBe(12)   // 1 baseMargin + 3 makeMoments + 4×2 ambientação
    for (let i = 0; i < 3; i++) g = applyMoment(g, g.moments[g.momentIndex].options[0], build(90), 27, rng)
    expect(calls()).toBe(GAME_RNG_CALLS)
    expect(g.momentIndex).toBe(3)
  })
  test('skip consome as MESMAS calls que assistido', () => {
    const a = countedRng(7)
    let ga = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, rng: a.rng })
    ga = autoResolveGame(ga, build(90), 27, a.rng)
    const b = countedRng(7)
    let gb = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, rng: b.rng })
    for (let i = 0; i < 3; i++) gb = applyMoment(gb, gb.moments[gb.momentIndex].options[1] ?? gb.moments[gb.momentIndex].options[0], build(90), 27, b.rng)
    expect(a.calls()).toBe(GAME_RNG_CALLS)
    expect(b.calls()).toBe(GAME_RNG_CALLS)   // opção diferente, mesmo nº de calls
  })
  test('resolveMoment = exatamente 2 calls, com ou sem injuryRisk', () => {
    const a = countedRng(3)
    resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, a.rng)
    expect(a.calls()).toBe(2)
    const b = countedRng(3)
    resolveMoment(build(80), 27, { id: 'y', attr: 'physical', risk: 'reckless', injuryRisk: 0.1 }, b.rng)
    expect(b.calls()).toBe(2)
  })
})

describe('resolução', () => {
  test('atributo alto = mais sucesso (estatístico)', () => {
    let hi = 0, lo = 0
    for (let i = 0; i < 300; i++) {
      const { rng: r1 } = countedRng(1000 + i)
      if (resolveMoment(build(95), 27, { id: 'x', attr: 'three', risk: 'bold' }, r1).success) hi++
      const { rng: r2 } = countedRng(1000 + i)
      if (resolveMoment(build(65), 27, { id: 'x', attr: 'three', risk: 'bold' }, r2).success) lo++
    }
    expect(hi).toBeGreaterThan(lo + 50)
  })
  test('safe > bold > reckless em prob; reckless > bold > safe em delta', () => {
    let s = 0, b = 0, r = 0
    for (let i = 0; i < 300; i++) {
      const mk = () => countedRng(2000 + i).rng
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, mk()).success) s++
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'bold' }, mk()).success) b++
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'reckless' }, mk()).success) r++
    }
    expect(s).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(r)
    const dS = resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, countedRng(1).rng)
    const dR = resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'reckless' }, countedRng(1).rng)
    expect(Math.abs(dR.delta)).toBeGreaterThanOrEqual(Math.abs(dS.delta))
  })
  test('lesão só com injuryRisk e rara', () => {
    let inj = 0
    for (let i = 0; i < 500; i++) {
      const { rng } = countedRng(3000 + i)
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'physical', risk: 'reckless', injuryRisk: 0.08 }, rng).injury) inj++
    }
    expect(inj / 500).toBeGreaterThan(0.02)
    expect(inj / 500).toBeLessThan(0.15)
    const { rng } = countedRng(1)
    expect(resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, rng).injury).toBe(false)
  })
})

describe('jogo', () => {
  test('makeMoments: 3 momentos, ids na ordem, 2-3 opções cada', () => {
    const { rng, calls } = countedRng(5)
    const ms = makeMoments(ctx, rng)
    expect(calls()).toBe(3)
    expect(ms.map(m => m.id)).toEqual(['q2tactic', 'q4pressure', 'clutch'])
    for (const m of ms) {
      expect(m.options.length).toBeGreaterThanOrEqual(2)
      expect(m.options.some(o => o.risk === 'safe')).toBe(true)
    }
  })
  test('finishWatchedGame determinístico e coerente', () => {
    const { rng } = countedRng(9)
    let g = startWatchedGame({ context: ctx, ourStrength: 80, oppStrength: 70, rng })
    g = autoResolveGame(g, build(90), 27, rng)
    const r1 = finishWatchedGame(g, build(90), 27)
    const r2 = finishWatchedGame(g, build(90), 27)
    expect(r1).toEqual(r2)
    expect(r1.won).toBe(r1.margin > 0)
    expect(r1.playerPts).toBeGreaterThanOrEqual(6)
    expect(r1.playerPts).toBeLessThanOrEqual(65)
  })
  test('probabilidade-alvo: P(vitória | auto) bate targetWinP (Monte Carlo)', () => {
    // mecanismo central da Task 8 — se isto quebrar, a taxa de título deixa de bater
    // o titleProb (bug de 2.02× da Task 7).
    for (const [p, ovr] of [[0.35, 80], [0.5, 90], [0.65, 99]] as const) {
      let wins = 0
      const runs = 2000
      for (let i = 0; i < runs; i++) {
        const { rng } = countedRng(50000 + i)
        let g = startWatchedGame({
          context: ctx, ourStrength: 70, oppStrength: 70, rng,
          targetWinP: p, expectedDelta: expectedAutoDelta(build(ovr), 27),
        })
        expect(g.winP).toBeCloseTo(p, 10)   // winP guardado = alvo, por construção
        g = autoResolveGame(g, build(ovr), 27, rng)
        if (finishWatchedGame(g, build(ovr), 27).won) wins++
      }
      expect(Math.abs(wins / runs - p)).toBeLessThan(0.04)
    }
  }, 30000)
  test('força importa: time muito superior vence mais (estatístico)', () => {
    let wins = 0
    for (let i = 0; i < 200; i++) {
      const { rng } = countedRng(4000 + i)
      let g = startWatchedGame({ context: ctx, ourStrength: 85, oppStrength: 55, rng })
      g = autoResolveGame(g, build(85), 27, rng)
      if (finishWatchedGame(g, build(85), 27).won) wins++
    }
    expect(wins / 200).toBeGreaterThan(0.7)
  })
  test('log: 4 linhas de ambientação no início, 7 ao final, ordenadas por at', () => {
    const { rng } = countedRng(5)
    const b = flatBuild(85)
    let g = startWatchedGame({
      context: { kind: 'rivalry', opponentTeamId: 'bos' },
      ourStrength: 75, oppStrength: 72, rng,
      expectedDelta: expectedAutoDelta(b, 25),
    })
    expect(g.log).toHaveLength(4)
    expect(g.log.every(e => !e.fromDecision)).toBe(true)
    while (g.momentIndex < 3) g = applyMoment(g, defaultOption(g.moments[g.momentIndex]), b, 25, rng)
    expect(g.log).toHaveLength(7)
    expect(g.log.filter(e => e.fromDecision)).toHaveLength(3)
    const ats = g.log.map(e => e.at)
    expect([...ats].sort((a, b) => a - b)).toEqual(ats)
  })
  test('contrato: jogo completo consome GAME_RNG_CALLS (21)', () => {
    const { rng, calls } = countedRng(5)
    const b = flatBuild(85)
    let g = startWatchedGame({
      context: { kind: 'seedRace', opponentTeamId: 'den' },
      ourStrength: 75, oppStrength: 72, rng, expectedDelta: expectedAutoDelta(b, 25),
    })
    g = autoResolveGame(g, b, 25, rng)
    expect(calls()).toBe(GAME_RNG_CALLS)
    expect(GAME_RNG_CALLS).toBe(21)
  })
  test('placar da última linha do log consistente com a margem final', () => {
    const { rng } = countedRng(9)
    const b = flatBuild(90)
    let g = startWatchedGame({
      context: { kind: 'special', opponentTeamId: 'lal' },
      ourStrength: 78, oppStrength: 70, rng, expectedDelta: expectedAutoDelta(b, 27),
    })
    g = autoResolveGame(g, b, 27, rng)
    const r = finishWatchedGame(g, b, 27)
    const last = g.log[g.log.length - 1]
    const final = scoreOf(r.margin)
    expect(Math.abs(last.score.us - final.us)).toBeLessThanOrEqual(2)
    expect(Math.abs(last.score.them - final.them)).toBeLessThanOrEqual(2)
  })
  test('reb/ast determinísticos e dentro das faixas', () => {
    const { rng } = countedRng(5)
    const b = flatBuild(85)
    let g = startWatchedGame({
      context: { kind: 'rivalry', opponentTeamId: 'bos' },
      ourStrength: 75, oppStrength: 72, rng, expectedDelta: expectedAutoDelta(b, 25),
    })
    g = autoResolveGame(g, b, 25, rng)
    const a = finishWatchedGame(g, b, 25)
    const c = finishWatchedGame(g, b, 25)
    expect(a.reb).toBe(c.reb)             // sem rng
    expect(a.reb).toBeGreaterThanOrEqual(1); expect(a.reb).toBeLessThanOrEqual(22)
    expect(a.ast).toBeGreaterThanOrEqual(1); expect(a.ast).toBeLessThanOrEqual(18)
  })
})

import { SITUATIONS, SLOT_SEQUENCE, ALL_OPTION_IDS } from '../../src/engine/moments'

describe('catálogo de situações', () => {
  test('5 slots na ordem cronológica, clutch por último', () => {
    expect(SLOT_SEQUENCE).toEqual(['openTone', 'q2tactic', 'q3swing', 'q4pressure', 'clutch'])
  })
  test('cada slot tem 5 situações; cada situação tem 2-3 opções e exatamente uma safe', () => {
    for (const slot of SLOT_SEQUENCE) {
      const pool = SITUATIONS[slot]
      expect(pool).toHaveLength(5)
      for (const options of pool) {
        expect(options.length).toBeGreaterThanOrEqual(2)
        expect(options.length).toBeLessThanOrEqual(3)
        expect(options.filter(o => o.risk === 'safe')).toHaveLength(1)
        expect(new Set(options.map(o => o.id)).size).toBe(options.length)
      }
    }
  })
  test('um id de opção nunca tem dois riscos/atributos diferentes no catálogo', () => {
    const byId = new Map<string, string>()
    for (const slot of SLOT_SEQUENCE) {
      for (const options of SITUATIONS[slot]) {
        for (const o of options) {
          const sig = `${o.risk}|${o.attr}|${o.attr2 ?? ''}|${o.injuryRisk ?? ''}`
          if (byId.has(o.id)) expect(byId.get(o.id)).toBe(sig)
          else byId.set(o.id, sig)
        }
      }
    }
    expect(ALL_OPTION_IDS.length).toBe(byId.size)
  })
})
