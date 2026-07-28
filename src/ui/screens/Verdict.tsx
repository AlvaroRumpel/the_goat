import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { computeVerdict } from '../../engine/verdict'
import type { Award } from '../../engine/types'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const AWARDS: Award[] = ['allstar', 'mvp', 'dpoy', 'scoring', 'fmvp', 'ring']

export function Verdict({ state, dispatch }: Props) {
  const lang = state.lang
  const { totals, counts, tier, score } = computeVerdict(state.career)

  return (
    <div className="screen">
      <div className="screen__glow" style={{ transform: 'translateX(-50%) scale(1.4)' }} />
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
        <div className="kicker">{t(lang, 'verdict.title')}</div>
        <div className="display goldtext" style={{ fontSize: 64 }}>{t(lang, 'tier.' + tier)}</div>
        <div className="hint">{t(lang, 'verdict.score', { n: score })}</div>
        <hr className="rule" style={{ width: '100%' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.points')}</span>
            <span className="display" style={{ fontSize: 24 }}>{totals.points}</span>
          </div>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.seasons2')}</span>
            <span className="display" style={{ fontSize: 24 }}>{totals.seasons}</span>
          </div>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.rings')}</span>
            <span className="display" style={{ fontSize: 24, color: counts.ring > 0 ? 'var(--gold-hi)' : undefined }}>
              {counts.ring}
            </span>
          </div>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.mvps')}</span>
            <span className="display" style={{ fontSize: 24, color: counts.mvp > 0 ? 'var(--gold-hi)' : undefined }}>
              {counts.mvp}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {AWARDS.filter(a => counts[a] > 0).map(a => (
            <span key={a} className="chip">{counts[a]}× {t(lang, 'award.' + a)}</span>
          ))}
        </div>

        {/* Share is a placeholder — Task 14 wires the actual share action. */}
        <button type="button" className="btn btn--gold" style={{ width: '100%', opacity: 0.6 }} disabled>
          {t(lang, 'share.button')}
        </button>
        <button type="button" className="btn" style={{ width: '100%' }} onClick={() => dispatch({ type: 'RESET' })}>
          {t(lang, 'share.again')}
        </button>
      </div>
    </div>
  )
}
