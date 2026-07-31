import { useEffect, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import type { PendingGame, WatchedGameResult } from '../../engine/types'
import { scoreOf } from '../../engine/moments'
import { CareerBar } from '../components/CareerBar'
import { usePlayReveal } from '../hooks/usePlayReveal'

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
  const clock = moment?.clock ?? '4Q 00:00'
  const ourId = (state.currentOffer?.teamId ?? state.pendingPlayoffs?.finalOffer.teamId ?? '').toUpperCase()
  const oppId = pending.context.opponentTeamId.toUpperCase()

  const texts = pending.log.map(e => t(lang, e.textKey, e.params))
  const reveal = usePlayReveal({
    texts,
    ats: pending.log.map(e => e.at),
    stopAt: moment?.at ?? null,
  })
  const lastShown = pending.log[Math.max(0, reveal.shown - 1)]
  const { us, them } = reveal.done && pending.momentIndex >= pending.moments.length
    ? scoreOf(liveMargin(pending))
    : (lastShown?.score ?? scoreOf(0))

  // teclas 1/2/3 (9c): escolhem a opção do momento aberto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.hubOpen) return
      if (!reveal.done) return
      if (!moment) return
      const i = ['1', '2', '3'].indexOf(e.key)
      if (i >= 0 && moment.options[i]) dispatch({ type: 'DECIDE_MOMENT', optionId: moment.options[i].id })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moment, dispatch, state.hubOpen, reveal.done])

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <GameHeader state={state} />
      <div className="game-layout">
        <div className="game-score">
          <span className="headline" style={{ fontSize: 26 }}>{us}<span className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', marginLeft: 6 }}>{ourId}</span></span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-warm)' }}>{clock}</span>
          <span className="headline" style={{ fontSize: 26 }}><span className="mono" style={{ fontSize: 10, color: 'var(--on-ink-dim)', marginRight: 6 }}>{oppId}</span>{them}</span>
        </div>

        <div className="game-plays" onClick={reveal.skip}>
          {pending.log.slice(0, reveal.shown).map((e, i, arr) => {
            const opacity = [0.28, 0.42, 0.58, 0.75, 1][Math.max(0, 4 - (arr.length - 1 - i))]
            const behind = e.score.us < e.score.them
            return (
              <div key={i} className={e.fromDecision ? 'game-play game-play--decision' : 'game-play'} style={{ opacity }}>
                <span className="mono" style={{ fontSize: 12, width: 64, whiteSpace: 'nowrap', flexShrink: 0 }}>{e.clock}</span>
                <span style={{ fontSize: 12, lineHeight: 1.4, flex: 1 }}>{texts[i]}</span>
                <span className="mono" style={{ fontSize: 12, color: behind ? 'var(--red)' : undefined }}>{e.score.us}–{e.score.them}</span>
              </div>
            )
          })}
          {reveal.typing !== null && (
            <div className="game-play game-play--typing">
              <span className="mono" style={{ fontSize: 12, width: 64, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {pending.log[reveal.shown]?.clock}
              </span>
              <span style={{ fontSize: 12, lineHeight: 1.4, flex: 1 }}>{reveal.typing}</span>
            </div>
          )}
        </div>

        <div className="game-desktop-hint mono-label">
          {t(lang, 'game.keys')}
        </div>

        <div className="game-side">
          <div className="game-moments">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="mono-label">{t(lang, 'game.momentsLabel')}</span>
              <span className="mono-label mono-label--red">
                {t(lang, 'game.momentsCount', {
                  n: pending.momentIndex + (pending.momentIndex < pending.moments.length ? 1 : 0),
                  total: pending.moments.length,
                })}
              </span>
            </div>
            <div className="moment-strip" style={{ marginTop: 8 }}>
              {pending.moments.map((m, i) => {
                const done = pending.outcomes[i]
                if (done) {
                  return (
                    <div key={m.id} className="moment-card moment-card--done">
                      <div style={{ height: 3, background: done.delta > 0 ? 'var(--ink)' : 'var(--red)' }} />
                      <span className="mono-label">{t(lang, 'moment.' + m.id + '.label')}</span>
                      <span className="mono" style={{ fontSize: 12 }}>{done.delta > 0 ? `+${done.delta}` : done.delta}</span>
                    </div>
                  )
                }
                const now = i === pending.momentIndex
                return (
                  <div key={m.id} className={now ? 'moment-card moment-card--now' : 'moment-card'}>
                    <span className={now ? 'mono-label mono-label--red' : 'mono-label'}>{t(lang, 'moment.' + m.id + '.label')}</span>
                    {now && <span className="headline" style={{ fontSize: 13 }}>{t(lang, 'game.now')}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {reveal.done && moment && (
            <div className="game-decision">
              <div style={{ fontSize: 17, lineHeight: 1.4 }}>{t(lang, moment.situationKey, moment.params)}</div>
              <div className="game-decision__options">
                {moment.options.map((option, i) => (
                  <button key={option.id} type="button"
                    className={option.risk === 'bold' ? 'game-option game-option--bold' : 'game-option'}
                    onClick={() => dispatch({ type: 'DECIDE_MOMENT', optionId: option.id })}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      <span className="mono" style={{ fontSize: 10, marginRight: 8, opacity: 0.6 }}>{i + 1}</span>
                      {t(lang, 'option.' + option.id)}
                      {option.risk !== 'safe' && <span className="mono" style={{ fontSize: 9, color: 'var(--red)', marginLeft: 8 }}>{t(lang, 'risk.' + option.risk).toUpperCase()}</span>}
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: option.risk === 'bold' ? 'var(--dim)' : 'var(--on-ink-dim)' }}>
                      {t(lang, 'slot.' + option.attr)}{option.injuryRisk !== undefined ? ` · ${t(lang, 'risk.injury')}` : ''}
                    </span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => dispatch({ type: 'SKIP_GAME' })}
                className="mono-label" style={{ background: 'none', border: 0, color: 'var(--on-ink-dim)', textAlign: 'center', cursor: 'pointer' }}>
                {t(lang, 'game.simulate')}
              </button>
            </div>
          )}
        </div>
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
