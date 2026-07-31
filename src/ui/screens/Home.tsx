import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'

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

      <div style={{ paddingTop: 44 }}>
        <div className="headline headline--red" style={{ fontSize: 66, lineHeight: 0.86, letterSpacing: '-0.035em' }}>
          {titleTop}<br />{titleBottom}
        </div>
        <hr className="rule" style={{ margin: '18px 0' }} />
        <div style={{ fontSize: 21, fontWeight: 500, maxWidth: 300 }}>{t(lang, 'home.tagline')}</div>
        <p className="hint" style={{ marginTop: 16 }}>{t(lang, 'home.explain')}</p>
      </div>

      <div style={{ marginTop: 'auto' }}>
        {resumePhase !== null && (
          <>
            <hr className="rule" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
              <div>
                <div className="mono-label">{t(lang, 'home.inProgress')}</div>
                <div className="mono-label">
                  {t(lang, 'home.saveline', {
                    n: career.seasons.length + 1,
                    age: state.age,
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
          onClick={() => dispatch({ type: 'NEW_GAME', seed: Date.now() % 2 ** 31 })}
        >
          {t(lang, 'home.play')}
        </button>

        <div className="mono-label" style={{ textAlign: 'center', marginTop: 12 }}>
          {t(lang, resumePhase !== null ? 'home.noteWipe' : 'home.note')}
        </div>
      </div>
    </div>
  )
}
