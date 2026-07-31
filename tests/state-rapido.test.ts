import { describe, expect, test } from 'vitest'
import { gameReducer } from '../src/state'
import type { GameState } from '../src/state'
import type { GameMode } from '../src/engine/types'
import { beginCareer } from './helpers/career'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

// setup+draft+oferta até preseason — mesmo padrão de tests/state-playoffs.test.ts,
// parametrizado por mode (draft/oferta não consomem rng diferente por mode).
function careerAtPreseason({ mode, seed }: { mode: GameMode; seed: number }): GameState {
  let s = beginCareer({ seed, mode })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  return gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
}

// modo rápido: PLAY_SEASON não deveria pausar em mais nada além de eventDecision/tradeDecision.
function runFullSeasonRapido(seed: number): GameState {
  let s = careerAtPreseason({ mode: 'rapido', seed })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  let guard = 0
  while ((s.phase === 'eventDecision' || s.phase === 'tradeDecision') && guard++ < 20) {
    s = s.phase === 'eventDecision'
      ? gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
      : gameReducer(s, { type: 'TRADE_DECISION', accept: false })
  }
  return s
}

// modo normal, dando RUN_TO_PLAYOFFS na 1ª seasonAdvance e SKIP em tudo depois —
// as mesmas escolhas de eventDecision/tradeDecision do lado rápido, para a comparação valer.
function runFullSeasonSkippingEverything(seed: number): GameState {
  let s = careerAtPreseason({ mode: 'normal', seed })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 300) {
    if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'RUN_TO_PLAYOFFS' })
    else if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else if (s.phase === 'playoffGame') {
      s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
    } else break
  }
  return s
}

describe('modo rápido', () => {
  test('temporada inteira sem fases de jogo: PLAY_SEASON nunca para em seasonAdvance/keyGame/playoffGame/gameResult', () => {
    const s = runFullSeasonRapido(123)
    expect(s.phase).toBe('seasonResult')
    expect(s.calendar).toBeNull()
    expect(s.seasonOutcome).not.toBeNull()
  })

  test.each([777, 4242])('replay: mesmo seed (%i) em rapido = mesmo desfecho de um jogador que pula tudo no normal', (seed) => {
    const finalRapido = runFullSeasonRapido(seed)
    const finalNormal = runFullSeasonSkippingEverything(seed)
    expect(finalRapido.phase).toBe('seasonResult')
    expect(finalNormal.phase).toBe('seasonResult')
    expect(finalRapido.career.seasons[0]).toEqual(finalNormal.career.seasons[0])
    expect(finalRapido.rngCalls).toBe(finalNormal.rngCalls)
  })
})
