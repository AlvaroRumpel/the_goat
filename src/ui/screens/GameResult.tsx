import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { scoreOf } from '../../engine/moments'
import { CareerBar } from '../components/CareerBar'

interface Props { state: GameState; dispatch: Dispatch<Action> }

const MOMENT_CLOCK: Record<string, string> = { q2tactic: '2Q', q4pressure: '4Q', clutch: '0:21' }

export function GameResult({ state, dispatch }: Props) {
  const lang = state.lang
  const { context, result, skipped } = state.lastGame!
  const pp = state.pendingPlayoffs
  const champion = pp !== null && pp.bracket.round === 3 && pp.seriesUs === 4
  const { us, them } = scoreOf(result.margin)
  const headlineKey = champion ? 'result.headline.champion' : result.won ? 'result.headline.win' : 'result.headline.loss'

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} heavy />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
        <div className="headline headline--red" style={{ fontSize: 68, lineHeight: 0.88 }}>{t(lang, headlineKey)}</div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="headline" style={{ fontSize: 30 }}>{us}–{them}</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--dim)' }}>
            {t(lang, 'result.final')} · {context.opponentTeamId.toUpperCase()}
          </span>
        </div>

        <hr className="rule" />
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '18px 0' }}>
          {([['result.stats.pts', result.playerPts], ['result.stats.reb', result.reb], ['result.stats.ast', result.ast]] as const).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div className="headline" style={{ fontSize: 28 }}>{v}</div>
              <div className="mono-label">{t(lang, k)}</div>
            </div>
          ))}
        </div>
        <hr className="rule" />

        {!skipped && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="mono-label">{t(lang, 'result.decided')}</div>
            {result.outcomes.map(o => (
              <div key={o.momentId} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 11, width: 38, flexShrink: 0 }}>{MOMENT_CLOCK[o.momentId]}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{t(lang, 'option.' + o.optionId)}</span>
                <span className="headline" style={{ fontSize: 11, color: o.injury || !o.success ? 'var(--red)' : undefined }}>
                  {t(lang, o.injury ? 'result.verdict.hurt' : o.success ? 'result.verdict.ok' : 'result.verdict.fail')}
                </span>
              </div>
            ))}
          </div>
        )}

        {result.iconics.length > 0 && (
          <div className="strip strip--red" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'result.iconic')}</div>
            <div className="headline" style={{ fontSize: 19 }}>{t(lang, 'iconic.' + result.iconics[0])}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--on-red-dim)' }}>{t(lang, 'result.iconicPts')}</div>
          </div>
        )}

        <button type="button" className="btn btn--ink" style={{ marginTop: 'auto' }} onClick={() => dispatch({ type: 'CONTINUE' })}>
          {t(lang, champion ? 'result.ceremony' : 'result.continue')}
        </button>
      </div>
    </div>
  )
}
