import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t, type Lang } from '../../i18n'
import { teamById } from '../../data/teams'
import type { MomentOption, PendingGame, WatchedGameResult } from '../../engine/types'
import { scoreOf } from '../../engine/moments'
import { CareerBar } from '../components/CareerBar'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
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
  const titleClass = option.risk === 'bold' ? 'headline headline--red' : 'headline'
  return (
    <button
      type="button"
      style={{ padding: 14, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--rule)', background: 'var(--paper)' }}
      onClick={onClick}
    >
      <span className={titleClass} style={{ fontSize: 16, color: option.risk === 'reckless' ? 'var(--red)' : undefined }}>
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
          <div className="mono-label">{t(lang, 'game.kind.' + pg.context.kind)}</div>
          <div className="mono-label">{opp.id.toUpperCase()}</div>
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
        <div className="mono-label mono-label--red">{t(lang, 'game.round.' + pp.bracket.round)}</div>
        <div className="mono-label">{teamById(pp.opponentTeamId).id.toUpperCase()}</div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <GameHeader state={state} />

        <div style={{ textAlign: 'center' }}>
          <div className="headline headline--red" style={{ fontSize: 40 }}>{us} : {them}</div>
        </div>

        {lastOutcome && (
          <div className={lastOutcome.success ? 'strip strip--red' : 'strip strip--ink'} style={{ margin: 0, padding: 12, textAlign: 'center' }}>
            {t(lang, lastOutcome.success ? 'moment.success' : 'moment.fail')}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="headline" style={{ fontSize: 18, lineHeight: 1.4 }}>{t(lang, moment.situationKey, moment.params)}</div>
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
  const gameNumber = pp.seriesUs + pp.seriesThem + 1
  const seriesCloses = pp.seriesUs === 3
  const seriesOver = pp.seriesThem === 3

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} heavy />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="mono-label" style={{ textAlign: 'center' }}>{t(lang, 'game.round.' + pp.bracket.round)}</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div className="headline" style={{ fontSize: 92, lineHeight: 0.8, letterSpacing: '-0.04em' }}>{pp.seriesUs}</div>
          <div className="mono-label">{t(lang, 'series.label')}</div>
          <div className="headline" style={{ fontSize: 92, lineHeight: 0.8, letterSpacing: '-0.04em', color: 'var(--red)' }}>{pp.seriesThem}</div>
        </div>

        <div className="headline" style={{ fontSize: 20, textAlign: 'center' }}>
          {t(lang, 'series.at', { n: gameNumber, team: opp.city })}
        </div>

        <div className="mono" style={{ fontSize: 12, color: 'var(--dim)', textAlign: 'center' }}>
          {t(lang, 'game.series', { us: pp.seriesUs, them: pp.seriesThem })}
        </div>

        <div className="strip strip--ink" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="mono-label" style={{ color: 'var(--on-ink-dim)' }}>{t(lang, 'series.stake')}</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--accent-warm)' }}>
            {t(lang, 'series.win')} · {t(lang, seriesCloses ? 'series.winCloseout' : 'series.winEffect')}
          </div>
          <div className="headline" style={{ fontSize: 16, color: 'var(--red-soft)' }}>
            {t(lang, 'series.lose')} · {t(lang, seriesOver ? 'series.loseEffect' : 'series.loseGame')}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'ADVANCE_GAME' })}>
            {t(lang, 'series.play', { n: gameNumber })}
          </button>
          <button type="button" className="btn btn--outline" onClick={() => dispatch({ type: 'SKIP_SERIES' })}>
            {t(lang, 'series.sim', { n: gameNumber })}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Game(props: Props) {
  if (props.state.phase === 'playoffGame' && !props.state.pendingGame) return <SeriesScreen {...props} />
  return <MomentPanel {...props} />
}
