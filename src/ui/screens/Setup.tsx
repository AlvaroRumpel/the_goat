import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

// Stub — Tasks 10/11 preenchem setupMode e setupIdentity. Sem texto visível;
// data-phase é só um hook de debug, não conteúdo pro usuário.
export function Setup({ state }: Props) {
  return <div className="screen" data-phase={state.phase} />
}
