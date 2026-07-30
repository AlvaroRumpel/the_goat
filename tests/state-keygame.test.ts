import { describe, expect, test } from 'vitest'
import { gameReducer, initialState } from '../src/state'
import type { GameState } from '../src/state'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

function playToSeasonAdvance(seed: number): GameState {
  let s = gameReducer(initialState(), { type: 'NEW_GAME', seed })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  return s
}

function playToKeyGame(seed: number): GameState {
  const s = playToSeasonAdvance(seed)
  return gameReducer(s, { type: 'TAKE_NEXT_GAME' })
}

function finishSeasonFrom(s: GameState): GameState {
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 200) {
    if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else if (s.phase === 'keyGame' || s.phase === 'playoffGame') {
      // tela de série das finais (sem jogo aberto): SKIP_SERIES fecha a série
      s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
    }
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else break
  }
  return s
}

describe('fase keyGame', () => {
  test('PLAY_SEASON entra em seasonAdvance com calendário; TAKE_NEXT_GAME abre o 1º jogo', () => {
    const before = playToSeasonAdvance(31)
    expect(before.phase).toBe('seasonAdvance')
    expect(before.calendar!.slots.length).toBeGreaterThanOrEqual(3)
    const s = gameReducer(before, { type: 'TAKE_NEXT_GAME' })
    expect(s.phase).toBe('keyGame')
    expect(s.pendingGame).not.toBeNull()
    expect(s.pendingGame!.moments).toHaveLength(3)
  })
  test('DECIDE_MOMENT ×3 fecha o jogo e pausa em gameResult; CONTINUE segue o calendário', () => {
    let s = playToKeyGame(32)
    const nextSlotBefore = s.calendar!.nextSlot
    for (let i = 0; i < 3; i++) {
      const opt = s.pendingGame!.moments[s.pendingGame!.momentIndex].options[0]
      s = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: opt.id })
    }
    expect(s.phase).toBe('gameResult')
    expect(s.keyGameResults).toHaveLength(1)
    expect(s.calendar!.nextSlot).toBe(nextSlotBefore + 1)
    s = gameReducer(s, { type: 'CONTINUE' })
    expect(s.phase).not.toBe('gameResult')
  })
  test('SKIP_GAME até o fim chega em seasonResult (via playoffs se houver)', () => {
    let s = playToKeyGame(33)
    s = finishSeasonFrom(s)
    expect(s.phase).toBe('seasonResult')
    expect(s.keyGameResults.length).toBeGreaterThanOrEqual(3)
  })
  test('replay determinístico: decidir e pular são reprodutíveis', () => {
    const runA = finishSeasonFrom(playToKeyGame(34))
    const runB = finishSeasonFrom(playToKeyGame(34))
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB))
  })
  test('DECIDE_MOMENT com optionId inválido é no-op', () => {
    const s = playToKeyGame(35)
    const before = JSON.stringify(s)
    const after = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: 'nope' })
    expect(JSON.stringify(after)).toBe(before)
  })
})
