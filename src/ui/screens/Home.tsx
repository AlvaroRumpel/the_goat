import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import { shortName } from '../format'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

export function Home({ state, dispatch }: Props) {
  const { lang, resumePhase, career, currentOffer } = state
  const [titleTop, titleBottom] = t(lang, 'home.title').split(' ')

  return (
    <div className="screen">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18 }}>
        <span className="mono-label">{t(lang, 'home.edition')}</span>
        <div style={{ display: 'flex', gap: 1 }}>
          {(['pt', 'en'] as const).map(l => (
            <button
              key={l}
              type="button"
              className={`chip${lang === l ? ' chip--on' : ''}`}
              onClick={() => dispatch({ type: 'SET_LANG', lang: l })}
            >
              {t(lang, `lang.${l}`)}
            </button>
          ))}
        </div>
      </header>

      <hr className="rule--double" style={{ marginTop: 14 }} />

      <div style={{ paddingTop: 38 }}>
        <div className="headline headline--red" style={{ fontSize: 66, lineHeight: 0.86, letterSpacing: '-0.035em' }}>
          {titleTop}<br />{titleBottom}
        </div>
        <hr className="rule" style={{ margin: '18px 0' }} />
        <div style={{ fontSize: 21, fontWeight: 500, maxWidth: 300 }}>{t(lang, 'home.tagline')}</div>

        <hr className="rule" style={{ marginTop: 16 }} />
        <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <span className="mono-label">{t(lang, 'home.steps.label')}</span>
          {([1, 2, 3] as const).map(n => (
            <div key={n} style={{ display: 'flex' }}>
              <span className="headline" style={{ fontSize: 13, color: 'var(--red)', width: 16 }}>{n}</span>
              <span style={{ fontSize: 13, lineHeight: 1.4 }}>{t(lang, `home.steps.${n}`)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        {resumePhase !== null && (
          <>
            <hr className="rule" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
              <div>
                <div className="mono-label">{t(lang, 'home.inProgress')}</div>
                <div className="mono-label">
                  {t(lang, 'home.savelineId', {
                    name: shortName(career),
                    number: career.number ?? '—',
                    n: career.seasons.length + 1,
                    team: currentOffer ? teamById(currentOffer.teamId).id.toUpperCase() : '—',
                  })}
                </div>
              </div>
              <button type="button" className="topbar__link" onClick={() => dispatch({ type: 'RESUME' })}>
                {t(lang, 'home.continue')}
              </button>
            </div>
            <hr className="rule" />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <span className="mono-label">{t(lang, 'settings.timePressure')}</span>
          <button
            type="button"
            className={`chip${state.timePressure ? ' chip--on' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_TIME_PRESSURE' })}
          >
            {t(lang, state.timePressure ? 'settings.on' : 'settings.off')}
          </button>
        </div>

        <button
          type="button"
          className="btn btn--ink"
          style={{ marginTop: resumePhase !== null ? 16 : 0 }}
          onClick={() => dispatch({ type: 'START_SETUP' })}
        >
          {t(lang, 'home.play')}
        </button>

        <div className="mono-label" style={{ textAlign: 'center', marginTop: 12 }}>
          {t(lang, resumePhase !== null ? 'home.noteSetup' : 'home.note')}
        </div>
      </div>
    </div>
  )
}
