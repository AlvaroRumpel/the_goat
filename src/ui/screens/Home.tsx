import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

// No "Continue" button: Home only renders when phase === 'home', and any
// persisted non-home save resumes straight into its phase via loadState().
export function Home({ state, dispatch }: Props) {
  const lang = state.lang

  return (
    <div className="screen">
      <div className="screen__glow" />
      <div className="grain" />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="chip chip--dim"
          onClick={() => dispatch({ type: 'SET_LANG', lang: lang === 'pt' ? 'en' : 'pt' })}
        >
          {lang === 'pt' ? 'EN' : 'PT'}
        </button>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <div className="kicker kicker--gold">{t(lang, 'home.kicker')}</div>
        <div className="display goldtext" style={{ fontSize: 72, lineHeight: 1 }}>
          {t(lang, 'home.title')}
        </div>
        <div className="hint">{t(lang, 'home.tagline')}</div>
        <div className="chip">{t(lang, 'home.free')}</div>
      </div>

      <button
        type="button"
        className="btn btn--gold"
        onClick={() => dispatch({ type: 'NEW_GAME', seed: Date.now() % 2 ** 31 })}
      >
        {t(lang, 'home.play')}
      </button>
    </div>
  )
}
