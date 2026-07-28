import { useReducer } from 'react'
import { gameReducer, initialState, loadState } from './state'
import { Home } from './ui/screens/Home'
import { AttrDraft } from './ui/screens/AttrDraft'
import { NbaDraft } from './ui/screens/NbaDraft'
import { Season } from './ui/screens/Season'
import { Verdict } from './ui/screens/Verdict'

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => loadState() ?? initialState('pt'))
  const p = state.phase
  if (p === 'home') return <Home state={state} dispatch={dispatch} />
  if (p === 'attrDraft' || p === 'draftDone') return <AttrDraft state={state} dispatch={dispatch} />
  if (p === 'nbaDraft') return <NbaDraft state={state} dispatch={dispatch} />
  if (p === 'verdict') return <Verdict state={state} dispatch={dispatch} />
  return <Season state={state} dispatch={dispatch} />
}
