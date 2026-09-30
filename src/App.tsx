import { useEffect, useReducer } from 'react'
import { gameReducer, initialState, loadState } from './state'
import { Home } from './ui/screens/Home'
import { Setup } from './ui/screens/Setup'
import { AttrDraft } from './ui/screens/AttrDraft'
import { NbaDraft } from './ui/screens/NbaDraft'
import { Season } from './ui/screens/Season'
import { Verdict } from './ui/screens/Verdict'
import { Game } from './ui/screens/Game'
import { GameResult } from './ui/screens/GameResult'
import { SeasonAdvance } from './ui/screens/SeasonAdvance'
import { Hub } from './ui/screens/Hub'
import { AdSlot } from './ui/components/AdSlot'

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    const saved = loadState()
    // ?lang=en|pt (links das páginas estáticas) manda sobre o save; sem ele, pt.
    const q = new URLSearchParams(window.location.search).get('lang')
    const urlLang = q === 'en' || q === 'pt' ? q : null
    if (!saved) return initialState(urlLang ?? 'pt')
    if (urlLang) saved.lang = urlLang
    if (saved.phase === 'home') return saved
    // boot sempre na Home; nada é persistido até o primeiro dispatch (spec §4)
    const midSetup = saved.phase === 'setupMode' || saved.phase === 'setupIdentity'
    // Save só é apagado em BEGIN_CAREER ("Começar a carreira", irreversível) — abrir/
    // navegar o Setup preserva o resumePhase do save anterior (Setup não tem back).
    return { ...saved, phase: 'home' as const, resumePhase: midSetup ? (saved.resumePhase ?? null) : saved.phase, hubOpen: false }
  })
  const p = state.phase
  // A1: a seção SEO estática do index.html só aparece na Home
  useEffect(() => { document.body.dataset.phase = p }, [p])
  useEffect(() => { document.documentElement.lang = state.lang === 'pt' ? 'pt-BR' : 'en' }, [state.lang])
  const screen =
    p === 'home' ? <Home state={state} dispatch={dispatch} /> :
    p === 'setupMode' || p === 'setupIdentity' ? <Setup state={state} dispatch={dispatch} /> :
    p === 'attrDraft' || p === 'draftDone' ? <AttrDraft state={state} dispatch={dispatch} /> :
    p === 'nbaDraft' ? <NbaDraft state={state} dispatch={dispatch} /> :
    p === 'verdict' ? <Verdict state={state} dispatch={dispatch} /> :
    p === 'keyGame' || p === 'playoffGame' ? <Game state={state} dispatch={dispatch} /> :
    p === 'gameResult' ? <GameResult state={state} dispatch={dispatch} /> :
    p === 'seasonAdvance' ? <SeasonAdvance state={state} dispatch={dispatch} /> :
    <Season state={state} dispatch={dispatch} />
  return (
    <>
      {/* hub aberto = tela de baixo inerte (sem foco/tab por trás do overlay) */}
      <div style={{ display: 'contents' }} inert={state.hubOpen}>{screen}</div>
      {state.hubOpen && <Hub state={state} dispatch={dispatch} />}
      <AdSlot slot="bar" />
    </>
  )
}
