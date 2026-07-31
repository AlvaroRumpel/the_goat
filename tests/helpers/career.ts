import { gameReducer, initialState } from '../../src/state'
import type { GameState } from '../../src/state'
import type { GameMode } from '../../src/engine/types'

// Substitui o antigo dispatch direto de NEW_GAME: START_SETUP + SET_MODE + BEGIN_CAREER,
// devolvendo o mesmo estado pós-draft-inicial (phase 'attrDraft') que NEW_GAME devolvia.
export function beginCareer(
  { mode = 'normal', seed, name = 'Test Player', number = 1 }: { mode?: GameMode; seed: number; name?: string; number?: number },
): GameState {
  let s = gameReducer(initialState(), { type: 'START_SETUP' })
  s = gameReducer(s, { type: 'SET_MODE', mode })
  return gameReducer(s, { type: 'BEGIN_CAREER', seed, name, number })
}
