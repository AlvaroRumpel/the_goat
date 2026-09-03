import { lazy, Suspense, useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { minigameFor, minigameSeed, type MinigameResult } from '../../engine/minigames'
import { opponentStar } from '../../engine/minigames/common'
import { PlaybookGame } from './Playbook'
import { ShotFallback } from './ShotFallback'
import { DefenseFallback } from './DefenseFallback'
import { hasWebGL } from './three/webgl'

// three.js só entra no bundle de quem abre arremesso/muralha com WebGL (chunk próprio)
const ShotGame = lazy(() => import('./Shot').then(m => ({ default: m.ShotGame })))
const DefenseGame = lazy(() => import('./Defense').then(m => ({ default: m.DefenseGame })))

const HOLD_MS = 1400
// pré-carrega o chunk do three enquanto o jogador lê as regras (evita o fallback do Suspense no JOGAR)
const preload: Record<string, () => Promise<unknown>> = { shot: () => import('./Shot'), defense: () => import('./Defense') }

// Painel de decisão do modo arcade: no lugar das 2-3 opções, o minigame do momento.
// Fluxo: minigame chama onResolve → DECIDE_MOMENT (engine resolve com exec) → o painel
// segura o MESMO minigame por HOLD_MS com `outcome` preenchido (animação do desfecho)
// → solta. No último momento o reducer NÃO fecha o jogo (arcade segura em
// momentIndex === moments.length); FINISH_GAME fecha depois da animação.
export function ArcadePanel({ state, dispatch, active }: { state: GameState; dispatch: Dispatch<Action>; active: boolean }) {
  const lang = state.lang
  const pending = state.pendingGame!
  const [holding, setHolding] = useState<number | null>(null)
  const [readyIdx, setReadyIdx] = useState<number | null>(null)   // momento cuja tela de regras já foi aceita
  const idx = holding ?? pending.momentIndex
  const moment = pending.moments[idx]
  const outcome = pending.outcomes[idx] ?? null
  const seedRef = useRef<{ idx: number; seed: number } | null>(null)
  if (moment && seedRef.current?.idx !== idx) seedRef.current = { idx, seed: minigameSeed(state.seed, state.rngCalls) }
  const firstGame = state.career.seasons.length === 0 && state.keyGameResults.length === 0
  const lastMoment = pending.momentIndex >= pending.moments.length

  useEffect(() => {
    if (holding === null) return
    const id = setTimeout(() => {
      setHolding(null)
      if (lastMoment) dispatch({ type: 'FINISH_GAME' })
    }, HOLD_MS)
    return () => clearTimeout(id)
  }, [holding, lastMoment, dispatch])

  // jogo já resolvido (ex.: recarregou no meio do hold): fecha sem animação
  useEffect(() => {
    if (holding === null && lastMoment) dispatch({ type: 'FINISH_GAME' })
  }, [holding, lastMoment, dispatch])

  // estável: os minigames guardam esta função em ref e um novo objeto por render reiniciaria
  // os efeitos deles (laço de rAF/intervalo) a cada frame
  const onResolve = useCallback((r: MinigameResult) => {
    if (holding !== null) return
    setHolding(idx)
    dispatch({ type: 'DECIDE_MOMENT', optionId: r.optionId, exec: { quality: r.quality, turnover: r.turnover } })
  }, [holding, idx, dispatch])

  if (!moment) return null
  if (holding === null && !active) return null
  const kind = minigameFor(moment)
  // sem WebGL, arremesso e muralha caem no painel 2D (mesmo fluxo, outro desenho)
  const Comp = kind === 'shot' ? (hasWebGL() ? ShotGame : ShotFallback)
    : kind === 'defense' ? (hasWebGL() ? DefenseGame : DefenseFallback)
    : PlaybookGame
  const star = opponentStar(state.league!, pending.context.opponentTeamId)
  // nada monta (relógio nenhum corre) antes do JOGAR
  const ready = readyIdx === idx || holding !== null
  return (
    <div className="game-decision mg-frame">
      {firstGame && (
        <div className="hint" style={{ borderLeft: '2px solid var(--red)', paddingLeft: 10 }}>
          {t(lang, 'game.tutorialArcade')}
        </div>
      )}
      <div className="mg-frame__head">
        <span className="mono-label mono-label--red">{t(lang, 'mg.title.' + kind)}</span>
        <span className="mono-label">{t(lang, 'moment.' + moment.id + '.label')}</span>
        <span className="mono-label mg-frame__opp">{star.short} · {star.pos} · {star.ovr}</span>
      </div>
      <div style={{ fontSize: 15, lineHeight: 1.4 }}>{t(lang, moment.situationKey, moment.params)}</div>
      <div className="mg-frame__hint">{t(lang, 'mg.hint.' + kind)}</div>
      {!ready ? (
        <ReadyCard kind={kind} lang={lang} onGo={() => setReadyIdx(idx)} />
      ) : <Suspense fallback={<div className="mg" style={{ minHeight: 200 }} />}>
        <Comp
          key={idx}
          seed={seedRef.current!.seed}
          context={pending.context}
          build={state.build!}
          age={state.age}
          quarter={Math.min(4, Math.floor(moment.at / 12) + 1)}
          league={state.league!}
          number={state.career.number}
          lastName={state.career.lastName}
          lang={lang}
          onResolve={onResolve}
          outcome={outcome}
        />
      </Suspense>}
      {holding === null && (
        <button type="button" onClick={() => dispatch({ type: 'SKIP_GAME' })}
          className="mono-label" style={{ background: 'none', border: 0, color: 'var(--on-ink-dim)', textAlign: 'center', cursor: 'pointer' }}>
          {t(lang, 'game.simulate')}
        </button>
      )}
    </div>
  )
}

// "Está pronto?": título, regras (uma linha por passo) e JOGAR. Só depois o minigame monta.
function ReadyCard({ kind, lang, onGo }: { kind: string; lang: GameState['lang']; onGo(): void }) {
  useEffect(() => { void preload[kind]?.() }, [kind])
  return (
    <div className="mg mg-ready">
      <span className="mono-label mono-label--red">{t(lang, 'mg.ready.title')}</span>
      <h2 className="mg-ready__title">{t(lang, 'mg.title.' + kind)}</h2>
      <span className="mono-label">{t(lang, 'mg.ready.how')}</span>
      <ol className="mg-ready__rules">
        {t(lang, 'mg.rules.' + kind).split('\n').map((line, i) => <li key={i}>{line}</li>)}
      </ol>
      <button type="button" className="mg-btn mg-btn--red mg-ready__go" onClick={onGo}>{t(lang, 'mg.ready.go')}</button>
    </div>
  )
}
