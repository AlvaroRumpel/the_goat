import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t, type Lang } from '../../i18n'
import { teamById } from '../../data/teams'
import type { MomentOption, PendingGame, WatchedGameResult } from '../../engine/types'
import { CareerBar } from '../components/CareerBar'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

// placar fictício: 100 de base +/- metade da margem parcial — puramente visual.
export function scoreOf(margin: number): { us: number; them: number } {
  return { us: Math.round(100 + margin / 2), them: Math.round(100 - margin / 2) }
}

function liveMargin(pending: PendingGame): number {
  return pending.baseMargin + pending.outcomes.reduce((n, o) => n + o.delta, 0)
}

export function resultScoreText(r: WatchedGameResult): string {
  const { us, them } = scoreOf(r.margin)
  return `${us}-${them}`
}

function OptionButton({ option, lang, onClick }: { option: MomentOption; lang: Lang; onClick: () => void }) {
  const attrLabel = option.attr2
    ? `${t(lang, 'slot.' + option.attr)} + ${t(lang, 'slot.' + option.attr2)}`
    : t(lang, 'slot.' + option.attr)
  const titleClass = option.risk === 'bold' ? 'display goldtext' : 'display'
  return (
    <button
      type="button"
      className="card"
      style={{ padding: 14, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4 }}
      onClick={onClick}
    >
      <span className={titleClass} style={{ fontSize: 16, color: option.risk === 'reckless' ? 'var(--danger)' : undefined }}>
        {t(lang, 'option.' + option.id)}
      </span>
      <span className="hint" style={{ textAlign: 'left' }}>
        {attrLabel} · {t(lang, 'risk.' + option.risk)}
        {option.injuryRisk !== undefined ? ` · ${t(lang, 'risk.injury')}` : ''}
      </span>
    </button>
  )
}

function GameHeader({ state }: { state: GameState }) {
  const lang = state.lang
  if (state.phase === 'keyGame') {
    const pg = state.pendingGame!
    const opp = teamById(pg.context.opponentTeamId)
    const lastResult = state.keyGameResults.at(-1)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="kicker">{t(lang, 'game.kind.' + pg.context.kind)}</div>
          <div className="kicker">{opp.id.toUpperCase()}</div>
        </div>
        {lastResult && <div className="hint">{t(lang, 'game.lastResult', { score: resultScoreText(lastResult) })}</div>}
      </div>
    )
  }
  const pp = state.pendingPlayoffs!
  const finals = pp.bracket.round === 3
  const gameNumber = state.pendingGame?.context.gameNumber ?? pp.seriesUs + pp.seriesThem + 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="kicker kicker--gold">{t(lang, 'game.round.' + pp.bracket.round)}</div>
        <div className="kicker">{teamById(pp.opponentTeamId).id.toUpperCase()}</div>
      </div>
      {finals && (
        <div className="hint">
          {t(lang, 'game.series', { us: pp.seriesUs, them: pp.seriesThem })} · {t(lang, 'game.number', { n: gameNumber })}
        </div>
      )}
    </div>
  )
}

function MomentPanel({ state, dispatch }: Props) {
  const lang = state.lang
  const pending = state.pendingGame!
  const moment = pending.moments[pending.momentIndex]
  const { us, them } = scoreOf(liveMargin(pending))
  const lastOutcome = pending.outcomes.at(-1)

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <GameHeader state={state} />

        <div style={{ textAlign: 'center' }}>
          <div className="display goldtext" style={{ fontSize: 40 }}>{us} : {them}</div>
        </div>

        {lastOutcome && (
          <div className={lastOutcome.success ? 'banner' : 'banner banner--bad'} style={{ padding: 12, textAlign: 'center' }}>
            {t(lang, lastOutcome.success ? 'moment.success' : 'moment.fail')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="display" style={{ fontSize: 18, lineHeight: 1.4 }}>{t(lang, moment.situationKey, moment.params)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {moment.options.map(option => (
              <OptionButton
                key={option.id}
                option={option}
                lang={lang}
                onClick={() => dispatch({ type: 'DECIDE_MOMENT', optionId: option.id })}
              />
            ))}
          </div>
        </div>

        <button type="button" className="btn" onClick={() => dispatch({ type: 'SKIP_GAME' })}>
          {t(lang, 'game.simulate')}
        </button>
      </div>
    </div>
  )
}

function SeriesScreen({ state, dispatch }: Props) {
  const lang = state.lang
  const pp = state.pendingPlayoffs!
  const opp = teamById(pp.opponentTeamId)

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} heavy />
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, flex: 1, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div className="kicker kicker--gold">{t(lang, 'game.round.' + pp.bracket.round)}</div>
        <div className="kicker">{opp.id.toUpperCase()}</div>
        <div className="display goldtext" style={{ fontSize: 56 }}>{pp.seriesUs} : {pp.seriesThem}</div>
        <div className="hint">{t(lang, 'series.title')}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'ADVANCE_GAME' })}>
          {t(lang, 'series.next')}
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'SKIP_SERIES' })}>
          {t(lang, 'series.simAll')}
        </button>
      </div>
    </div>
  )
}

export function Game(props: Props) {
  if (props.state.phase === 'playoffGame' && !props.state.pendingGame) return <SeriesScreen {...props} />
  return <MomentPanel {...props} />
}
