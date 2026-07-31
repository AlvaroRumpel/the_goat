import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import {
  applyMoment, autoResolveGame, clockOf, dagger, expectedAutoDelta, finishWatchedGame, gameRngCalls,
  makeMoments, momentAts, momentWeight, resolveMoment, scoreOf, SITUATIONS, SLOT_SEQUENCE, startWatchedGame,
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
  test('gameRngCalls(n) = 6n + 4', () => {
    expect(gameRngCalls(2)).toBe(16)
    expect(gameRngCalls(3)).toBe(22)
    expect(gameRngCalls(5)).toBe(34)
  })
  test('jogo completo assistido consome gameRngCalls(n)', () => {
    const { rng, calls } = countedRng(1)
    const b = build(90)
    let g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, build: b, age: 27, rng })
    const n = g.moments.length
    expect(calls()).toBe(gameRngCalls(n) - 3 * n)   // tudo menos os resolves
    while (g.momentIndex < n) g = applyMoment(g, g.moments[g.momentIndex].options[0], b, 27, rng)
    expect(calls()).toBe(gameRngCalls(n))
    expect(g.momentIndex).toBe(n)
  })
  test('skip consome as MESMAS calls que assistido', () => {
    const b = build(90)
    const a = countedRng(7)
    let ga = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, build: b, age: 27, rng: a.rng })
    const n = ga.moments.length
    ga = autoResolveGame(ga, b, 27, a.rng)
    const c = countedRng(7)
    let gb = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 78, build: b, age: 27, rng: c.rng })
    while (gb.momentIndex < gb.moments.length) {
      const m = gb.moments[gb.momentIndex]
      gb = applyMoment(gb, m.options[1] ?? m.options[0], b, 27, c.rng)
    }
    expect(a.calls()).toBe(gameRngCalls(n))
    expect(c.calls()).toBe(gameRngCalls(n))
  })
  test('resolveMoment = exatamente 2 calls, com ou sem injuryRisk', () => {
    const a = countedRng(3)
    resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, 1, a.rng)
    expect(a.calls()).toBe(2)
    const b = countedRng(3)
    resolveMoment(build(80), 27, { id: 'y', attr: 'physical', risk: 'reckless', injuryRisk: 0.1 }, 1, b.rng)
    expect(b.calls()).toBe(2)
  })
})

describe('log do jogo', () => {
  test('n+1 linhas de ambientação no início, 2n+1 ao final, ordenadas por at', () => {
    const { rng } = countedRng(5)
    const b = flatBuild(85)
    let g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 72, build: b, age: 25, rng })
    const n = g.moments.length
    expect(g.log).toHaveLength(n + 1)
    expect(g.log.every(e => !e.fromDecision)).toBe(true)
    g = autoResolveGame(g, b, 25, rng)
    expect(g.log).toHaveLength(2 * n + 1)
    expect(g.log.filter(e => e.fromDecision)).toHaveLength(n)
    const ats = g.log.map(e => e.at)
    expect([...ats].sort((x, y) => x - y)).toEqual(ats)
  })
  test('BUG 3: placar do log soma os deltas já ocorridos — nunca anda pra trás', () => {
    // seeds várias porque o bug só aparece quando um momento vencedor precede uma
    // linha de ambientação
    for (let s = 0; s < 40; s++) {
      const { rng } = countedRng(6000 + s)
      const b = flatBuild(95)
      let g = startWatchedGame({ context: ctx, ourStrength: 90, oppStrength: 60, build: b, age: 27, rng })
      g = autoResolveGame(g, b, 27, rng)
      for (const e of g.log) {
        const deltas = g.outcomes
          .filter((_, i) => g.moments[i].at <= e.at)
          .reduce((acc, o) => acc + o.delta, 0)
        const frac = e.at / 48
        const expectedUs = Math.max(0, Math.round(100 * frac + (g.baseMargin * frac + deltas + e.jitter) / 2))
        expect(e.score.us).toBe(expectedUs)
      }
    }
  })
  test('placar da última linha bate com a margem final', () => {
    const { rng } = countedRng(9)
    const b = flatBuild(90)
    let g = startWatchedGame({ context: { kind: 'special', opponentTeamId: 'lal' }, ourStrength: 78, oppStrength: 70, build: b, age: 27, rng })
    g = autoResolveGame(g, b, 27, rng)
    const r = finishWatchedGame(g, b, 27)
    const last = g.log[g.log.length - 1]
    const final = scoreOf(r.margin)
    expect(Math.abs(last.score.us - final.us)).toBeLessThanOrEqual(2)
  })
  test('expectedDelta guardado no pending bate com o recomputado', () => {
    const { rng } = countedRng(21)
    const b = flatBuild(88)
    const g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 72, build: b, age: 26, rng })
    expect(g.expectedDelta).toBeCloseTo(expectedAutoDelta(b, 26, g.moments), 10)
  })
})

describe('resolução', () => {
  test('atributo alto = mais sucesso (estatístico)', () => {
    let hi = 0, lo = 0
    for (let i = 0; i < 300; i++) {
      const { rng: r1 } = countedRng(1000 + i)
      if (resolveMoment(build(95), 27, { id: 'x', attr: 'three', risk: 'bold' }, 1, r1).success) hi++
      const { rng: r2 } = countedRng(1000 + i)
      if (resolveMoment(build(65), 27, { id: 'x', attr: 'three', risk: 'bold' }, 1, r2).success) lo++
    }
    expect(hi).toBeGreaterThan(lo + 50)
  })
  test('safe > bold > reckless em prob; reckless > bold > safe em delta', () => {
    let s = 0, b = 0, r = 0
    for (let i = 0; i < 300; i++) {
      const mk = () => countedRng(2000 + i).rng
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, 1, mk()).success) s++
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'bold' }, 1, mk()).success) b++
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'reckless' }, 1, mk()).success) r++
    }
    expect(s).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(r)
    const dS = resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, 1, countedRng(1).rng)
    const dR = resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'reckless' }, 1, countedRng(1).rng)
    expect(Math.abs(dR.delta)).toBeGreaterThanOrEqual(Math.abs(dS.delta))
  })
  test('lesão só com injuryRisk e rara', () => {
    let inj = 0
    for (let i = 0; i < 500; i++) {
      const { rng } = countedRng(3000 + i)
      if (resolveMoment(build(80), 27, { id: 'x', attr: 'physical', risk: 'reckless', injuryRisk: 0.08 }, 1, rng).injury) inj++
    }
    expect(inj / 500).toBeGreaterThan(0.02)
    expect(inj / 500).toBeLessThan(0.15)
    const { rng } = countedRng(1)
    expect(resolveMoment(build(80), 27, { id: 'x', attr: 'three', risk: 'safe' }, 1, rng).injury).toBe(false)
  })
})

describe('peso constante 3/n', () => {
  test('momentWeight', () => {
    expect(momentWeight(3)).toBeCloseTo(1, 10)
    expect(momentWeight(5)).toBeCloseTo(0.6, 10)
    expect(momentWeight(2)).toBeCloseTo(1.5, 10)
  })
  test('E[Σ deltas] é o mesmo para n=2, 3 e 5 quando as situações têm a mesma safe', () => {
    // build flat: toda safe tem o mesmo atributo efetivo, então o peso é a única
    // variável — é exatamente a invariância que segura a calibração.
    const b = flatBuild(85)
    const mk = (n: number) => momentAts(n).map((at, _i) => ({
      id: 'clutch' as const, situationKey: `moment.clutch.s0`, at, clock: '',
      params: {}, options: SITUATIONS.clutch[0],
    }))
    const e2 = expectedAutoDelta(b, 27, mk(2))
    const e3 = expectedAutoDelta(b, 27, mk(3))
    const e5 = expectedAutoDelta(b, 27, mk(5))
    expect(e2).toBeCloseTo(e3, 8)
    expect(e5).toBeCloseTo(e3, 8)
  })
  test('resolveMoment aplica o peso no delta e continua em 2 calls', () => {
    const playHurt = SITUATIONS.q4pressure[0][2]   // O.playHurt: tem injuryRisk, cobre os 2 calls "sempre consumidos"
    const a = countedRng(3)
    const full = resolveMoment(build(99), 27, playHurt, 1, a.rng)
    expect(a.calls()).toBe(2)
    const c = countedRng(3)
    const half = resolveMoment(build(99), 27, playHurt, 0.6, c.rng)
    expect(c.calls()).toBe(2)
    expect(half.success).toBe(full.success)
    expect(half.injury).toBe(full.injury)
    expect(half.delta).toBeCloseTo(full.delta * 0.6, 10)
  })
})

describe('jogo', () => {
  test('finishWatchedGame determinístico e coerente', () => {
    const { rng } = countedRng(9)
    let g = startWatchedGame({ context: ctx, ourStrength: 80, oppStrength: 70, build: build(90), age: 27, rng })
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
          context: ctx, ourStrength: 70, oppStrength: 70, build: build(ovr), age: 27, rng,
          targetWinP: p,
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
      let g = startWatchedGame({ context: ctx, ourStrength: 85, oppStrength: 55, build: build(85), age: 27, rng })
      g = autoResolveGame(g, build(85), 27, rng)
      if (finishWatchedGame(g, build(85), 27).won) wins++
    }
    expect(wins / 200).toBeGreaterThan(0.7)
  })
  test('placar da última linha do log consistente com a margem final', () => {
    const { rng } = countedRng(9)
    const b = flatBuild(90)
    let g = startWatchedGame({
      context: { kind: 'special', opponentTeamId: 'lal' },
      ourStrength: 78, oppStrength: 70, build: b, age: 27, rng,
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
      ourStrength: 75, oppStrength: 72, build: b, age: 25, rng,
    })
    g = autoResolveGame(g, b, 25, rng)
    const a = finishWatchedGame(g, b, 25)
    const c = finishWatchedGame(g, b, 25)
    expect(a.reb).toBe(c.reb)             // sem rng
    expect(a.reb).toBeGreaterThanOrEqual(1); expect(a.reb).toBeLessThanOrEqual(22)
    expect(a.ast).toBeGreaterThanOrEqual(1); expect(a.ast).toBeLessThanOrEqual(18)
  })
})

describe('contagem e posição dos momentos', () => {
  test('makeMoments consome 1 (jitter) + n calls', () => {
    const { rng, calls } = countedRng(5)
    const ms = makeMoments(ctx, rng)
    expect(calls()).toBe(1 + ms.length)
  })
  test('último momento é sempre o clutch, em 47.65', () => {
    for (let s = 0; s < 60; s++) {
      const { rng } = countedRng(700 + s)
      const ms = makeMoments({ kind: 'finals', opponentTeamId: 'bos' }, rng)
      expect(ms[ms.length - 1].id).toBe('clutch')
      expect(ms[ms.length - 1].at).toBeCloseTo(47.65, 5)
    }
  })
  test('contagem por kind, com jitter de ±1, dentro de [2,5]', () => {
    const seen: Record<string, Set<number>> = { rivalry: new Set(), playoff: new Set(), finals: new Set() }
    for (let s = 0; s < 300; s++) {
      for (const kind of ['rivalry', 'playoff', 'finals'] as const) {
        const { rng } = countedRng(9000 + s)
        seen[kind].add(makeMoments({ kind, opponentTeamId: 'bos' }, rng).length)
      }
    }
    expect([...seen.rivalry].sort()).toEqual([2, 3, 4])
    expect([...seen.playoff].sort()).toEqual([3, 4, 5])
    expect([...seen.finals].sort()).toEqual([4, 5])   // 6 seria clampado para 5
    for (const kind of Object.keys(seen)) {
      for (const n of seen[kind]) { expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(5) }
    }
  })
  test('slots saem do fim da sequência, na ordem, sem repetir', () => {
    for (let s = 0; s < 60; s++) {
      const { rng } = countedRng(800 + s)
      const ms = makeMoments({ kind: 'finals', opponentTeamId: 'bos' }, rng)
      const ids = ms.map(m => m.id)
      expect(new Set(ids).size).toBe(ids.length)
      const expected = [...SLOT_SEQUENCE.slice(0, 4).slice(-(ms.length - 1)), 'clutch']
      expect(ids).toEqual(expected)
    }
  })
  test('ats estritamente crescentes, começando em 10', () => {
    const { rng } = countedRng(11)
    const ms = makeMoments({ kind: 'finals', opponentTeamId: 'bos' }, rng)
    expect(ms[0].at).toBeCloseTo(10, 5)
    for (let i = 1; i < ms.length; i++) expect(ms[i].at).toBeGreaterThan(ms[i - 1].at)
    expect(ms.every(m => m.clock === clockOf(m.at))).toBe(true)
  })
  test('situationKey aponta para a situação sorteada e as opções batem', () => {
    const { rng } = countedRng(13)
    const ms = makeMoments(ctx, rng)
    for (const m of ms) {
      const i = Number(m.situationKey.split('.s')[1])
      expect(m.situationKey).toBe(`moment.${m.id}.s${i}`)
      expect(m.options).toEqual(SITUATIONS[m.id][i])
      expect(m.options.filter(o => o.risk === 'safe')).toHaveLength(1)
    }
  })
})

import { ALL_OPTION_IDS } from '../../src/engine/moments'

describe('BUG 1 e 2: contagem dinâmica e clutch como último outcome', () => {
  test('autoResolveGame fecha em moments.length, não em 3', () => {
    for (let s = 0; s < 40; s++) {
      const { rng } = countedRng(7000 + s)
      const b = flatBuild(85)
      let g = startWatchedGame({ context: { kind: 'finals', opponentTeamId: 'bos' }, ourStrength: 80, oppStrength: 75, build: b, age: 27, rng })
      g = autoResolveGame(g, b, 27, rng)
      expect(g.momentIndex).toBe(g.moments.length)
      expect(g.outcomes).toHaveLength(g.moments.length)
    }
  })
  test('dagger lê o ÚLTIMO outcome (o clutch), com qualquer n', () => {
    const mk = (n: number, lastRisk: 'safe' | 'bold') => ({
      outcomes: Array.from({ length: n }, (_, i) => ({
        momentId: 'clutch' as const,
        optionId: i === n - 1 ? (lastRisk === 'bold' ? 'clutchThree' : 'safePass') : 'clutchThree',
        success: true, injury: false, delta: 1, clock: '',
      })),
    })
    for (const n of [2, 3, 4, 5]) {
      expect(dagger(mk(n, 'bold'))).toBe(true)
      expect(dagger(mk(n, 'safe'))).toBe(false)
    }
  })
  test('outcome carrega o clock do momento', () => {
    const { rng } = countedRng(31)
    const b = flatBuild(85)
    let g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 72, build: b, age: 25, rng })
    const clocks = g.moments.map(m => m.clock)
    g = autoResolveGame(g, b, 25, rng)
    expect(g.outcomes.map(o => o.clock)).toEqual(clocks)
  })
  test('resultado carrega expectedDelta do pending', () => {
    const { rng } = countedRng(33)
    const b = flatBuild(85)
    let g = startWatchedGame({ context: ctx, ourStrength: 75, oppStrength: 72, build: b, age: 25, rng })
    const exp = g.expectedDelta
    g = autoResolveGame(g, b, 25, rng)
    expect(finishWatchedGame(g, b, 25).expectedDelta).toBeCloseTo(exp, 10)
  })
})

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
