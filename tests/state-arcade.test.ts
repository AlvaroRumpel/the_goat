import { describe, expect, test } from 'vitest'
import { gameReducer } from '../src/state'
import type { GameState } from '../src/state'
import { beginCareer } from './helpers/career'
import { MINIGAME_OPTION_IDS } from '../src/engine/moments'
import { minigameFor } from '../src/engine/minigames'
import type { GameMode } from '../src/engine/types'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

function playToKeyGame(seed: number, mode: GameMode): GameState {
  let s = beginCareer({ seed, mode })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  return gameReducer(s, { type: 'TAKE_NEXT_GAME' })
}

describe('modo arcade — minigames no lugar das opções', () => {
  test('DECIDE_MOMENT com exec usa o catálogo mg*, segura o último momento e FINISH_GAME fecha', () => {
    let s = playToKeyGame(41, 'arcade')
    expect(s.phase).toBe('keyGame')
    const n = s.pendingGame!.moments.length
    const kinds = s.pendingGame!.moments.map(minigameFor)
    expect(kinds.at(-1)).toBe('shot')
    for (let i = 0; i < n; i++) {
      const kind = kinds[i]
      const optionId = kind === 'shot' ? 'mgThree' : kind === 'defense' ? 'mgLock' : 'mgAssist'
      s = gameReducer(s, { type: 'DECIDE_MOMENT', optionId, exec: { quality: 1 } })
      expect(MINIGAME_OPTION_IDS).toContain(s.pendingGame!.outcomes[i].optionId)
    }
    // último momento resolvido mas o jogo NÃO fechou: a UI anima e despacha FINISH_GAME
    expect(s.phase).toBe('keyGame')
    expect(s.pendingGame!.momentIndex).toBe(n)
    const callsBefore = s.rngCalls
    s = gameReducer(s, { type: 'FINISH_GAME' })
    expect(s.phase).toBe('gameResult')
    expect(s.rngCalls).toBe(callsBefore)           // fechar é zero rng
    expect(s.keyGameResults).toHaveLength(1)
  })

  test('rngCalls após um jogo é idêntico ao modo normal com a mesma seed', () => {
    let a = playToKeyGame(42, 'arcade')
    let b = playToKeyGame(42, 'normal')
    expect(a.pendingGame!.moments.map(m => m.situationKey)).toEqual(b.pendingGame!.moments.map(m => m.situationKey))
    const n = a.pendingGame!.moments.length
    for (let i = 0; i < n; i++) {
      a = gameReducer(a, { type: 'DECIDE_MOMENT', optionId: 'mgMid', exec: { quality: 0.5 } })
      b = gameReducer(b, { type: 'DECIDE_MOMENT', optionId: b.pendingGame!.moments[i].options[0].id })
    }
    a = gameReducer(a, { type: 'FINISH_GAME' })
    expect(a.phase).toBe('gameResult')
    expect(b.phase).toBe('gameResult')
    expect(a.rngCalls).toBe(b.rngCalls)
  })

  test('turnover força erro; quality 1 com mgLayup em build 99 acerta', () => {
    let s = playToKeyGame(43, 'arcade')
    s = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: 'mgAssist', exec: { quality: 0, turnover: true } })
    expect(s.pendingGame!.outcomes[0].success).toBe(false)
  })

  test('exec fora do arcade é ignorado e mg* não é aceito', () => {
    const s = playToKeyGame(44, 'normal')
    const after = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: 'mgThree', exec: { quality: 1 } })
    expect(after).toBe(s)
    const ok = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: s.pendingGame!.moments[0].options[0].id, exec: { quality: 1 } })
    expect(ok.pendingGame!.outcomes[0].optionId).toBe(s.pendingGame!.moments[0].options[0].id)
  })

  test('FINISH_GAME antes do último momento é no-op', () => {
    const s = playToKeyGame(45, 'arcade')
    expect(gameReducer(s, { type: 'FINISH_GAME' })).toBe(s)
  })

  test('SKIP_GAME continua fechando o jogo no arcade (política auto)', () => {
    let s = playToKeyGame(46, 'arcade')
    s = gameReducer(s, { type: 'SKIP_GAME' })
    expect(s.phase).toBe('gameResult')
  })

  test('mgFreeThrow resolve no arcade', () => {
    let s = playToKeyGame(47, 'arcade')
    s = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: 'mgFreeThrow', exec: { quality: 0.9 } })
    expect(s.pendingGame!.outcomes[0].optionId).toBe('mgFreeThrow')
  })
})
