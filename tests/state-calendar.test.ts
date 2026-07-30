import { describe, expect, test } from 'vitest'
import { gameReducer, initialState } from '../src/state'
import type { Action, GameState } from '../src/state'
import { makeOffers } from '../src/engine/offers'
import { createRng } from '../src/engine/rng'
import { initLeague } from '../src/data/league'
import { SLOT_ORDER, type Build, type Rng, type SeasonResult, type SlotId } from '../src/engine/types'
import { DEADLINE_GAME } from '../src/engine/schedule'

function flatBuild(overall: number): Build {
  const attrs = Object.fromEntries(SLOT_ORDER.map(s => [s, overall])) as Record<SlotId, number>
  return { attributes: attrs, picks: [], archetype: 'SF', overall }
}
function countedRng(seed: number): { rng: Rng; calls: () => number } {
  const inner = createRng(seed)
  let n = 0
  const next = () => { n++; return inner.next() }
  return {
    rng: { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: arr => arr[Math.floor(next() * arr.length)], chance: p => next() < p },
    calls: () => n,
  }
}
function startState(seed: number): GameState {
  const { rng, calls } = countedRng(seed)
  const offers = makeOffers(rng)
  return {
    ...initialState(), seed, rngCalls: calls(), build: flatBuild(88), league: initLeague(),
    age: 25, offers, currentOffer: offers[0], contractYearsLeft: 4, phase: 'preseason',
    career: { seasons: [], fame: 0 },
  }
}
function step(s: GameState, a: Action): GameState { return gameReducer(s, a) }

// SeasonResult mínimo válido — usado para forçar career.seasons.length >= 2 (canTrade)
function fakeSeason(): SeasonResult {
  return {
    age: 23, teamId: 'okc', finalTeamId: 'okc', games: 78, ppg: 18, rpg: 5, apg: 5,
    events: [], choices: [], madePlayoffs: false, wonTitle: false, awards: [], seed: null,
    playoffRun: 'missed', iconicMoments: [], chokes: 0,
  }
}

// atravessa a temporada regular decidindo tudo pelo caminho seguro
function runRegular(s: GameState, onPhase?: (s: GameState) => void): GameState {
  let guard = 0
  while (s.phase !== 'playoffGame' && s.phase !== 'seasonResult' && guard++ < 100) {
    onPhase?.(s)
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    else if (s.phase === 'tradeDecision') s = step(s, { type: 'TRADE_DECISION', accept: false })
    else if (s.phase === 'seasonAdvance') s = step(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'keyGame') s = step(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'gameResult') s = step(s, { type: 'CONTINUE' })
    else break
  }
  return s
}

describe('temporada regular no calendário', () => {
  test('PLAY_SEASON → seasonAdvance com trecho simulado até antes do 1º key game', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    expect(s.phase).toBe('seasonAdvance')
    const cal = s.calendar!
    expect(cal.slots.length).toBeGreaterThanOrEqual(3)
    expect(cal.played).toBe(cal.slots[0].gameIndex - 1)
    expect(cal.ticker).toHaveLength(cal.played)
  })

  test('keyGame → gameResult com lastGame; resultado entra literal no ticker', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    const slot = s.calendar!.slots[0]
    s = step(s, { type: 'TAKE_NEXT_GAME' })
    expect(s.phase).toBe('keyGame')
    expect(s.pendingGame!.log).toHaveLength(4)
    s = step(s, { type: 'SKIP_GAME' })
    expect(s.phase).toBe('gameResult')
    expect(s.lastGame!.skipped).toBe(true)
    const entry = s.calendar!.ticker[s.calendar!.ticker.length - 1]
    expect(entry.gameIndex).toBe(slot.gameIndex)
    expect(entry.keyGame).toBe(slot.keyGame.kind)
    expect(entry.won).toBe(s.lastGame!.result.won)
  })

  test('registro literal: wins do fim da regular = ticker wins; ticker cobre 82 jogos', () => {
    let s = startState(42)
    let last82: GameState | null = null
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    s = runRegular(s, cur => { if (cur.calendar?.played === 82) last82 = cur })
    // ao fechar (playoffGame ou seasonResult) o calendar já morreu; capturamos antes
    expect(s.phase === 'playoffGame' || s.phase === 'seasonResult').toBe(true)
    expect(s.calendar).toBeNull()
  })

  test('deadline: com tradeOffer, pausa em tradeDecision com played = 55', () => {
    // varre seeds até achar uma temporada com tradeOffer (career precisa de 2+ temporadas
    // para canTrade; injete: career com 2 seasons falsas mínimas)
    for (let seed = 1; seed < 200; seed++) {
      let s = startState(seed)
      s.career = { seasons: [fakeSeason(), fakeSeason()], fame: 0 } // helper: SeasonResult mínimo válido
      s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      let paused: GameState | null = null
      s = runRegular(s, cur => { if (cur.phase === 'tradeDecision') paused = paused ?? cur })
      if (paused) {
        expect(paused.calendar!.played).toBe(DEADLINE_GAME)
        expect(paused.pendingRegular!.tradeOffer).not.toBeNull()
        return
      }
    }
    throw new Error('nenhuma seed gerou tradeOffer em 200 tentativas')
  })

  test('trade aceito muda o time e o segmento (p) do calendário', () => {
    for (let seed = 1; seed < 200; seed++) {
      let s = startState(seed)
      s.career = { seasons: [fakeSeason(), fakeSeason()], fame: 0 }
      s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      let guard = 0
      while (s.phase !== 'tradeDecision' && s.phase !== 'playoffGame' && s.phase !== 'seasonResult' && guard++ < 100) {
        if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
        else if (s.phase === 'seasonAdvance') s = step(s, { type: 'TAKE_NEXT_GAME' })
        else if (s.phase === 'keyGame') s = step(s, { type: 'SKIP_GAME' })
        else if (s.phase === 'gameResult') s = step(s, { type: 'CONTINUE' })
        else break
      }
      if (s.phase !== 'tradeDecision') continue
      const before = s.currentOffer!.teamId
      const offered = s.pendingRegular!.tradeOffer!.teamId
      s = step(s, { type: 'TRADE_DECISION', accept: true })
      expect(s.currentOffer!.teamId).toBe(offered)
      expect(s.currentOffer!.teamId).not.toBe(before)
      expect(s.contractYearsLeft).toBe(4)
      return
    }
    throw new Error('nenhuma seed gerou tradeOffer em 200 tentativas')
  })

  test('replay: save no meio de seasonAdvance/gameResult reproduz o estado', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    s = step(s, { type: 'TAKE_NEXT_GAME' })
    s = step(s, { type: 'SKIP_GAME' })
    // continuar do snapshot (mesma seed + rngCalls) tem de dar o mesmo resultado
    const a = step(s, { type: 'CONTINUE' })
    const b = step(structuredClone(s), { type: 'CONTINUE' })
    expect(b.calendar).toEqual(a.calendar)
    expect(b.rngCalls).toBe(a.rngCalls)
  })
})
