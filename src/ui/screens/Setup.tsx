import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import type { GameMode } from '../../engine/types'
import { t } from '../../i18n'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const MODE_ORDER: readonly GameMode[] = ['normal', 'goat', 'rapido']
const LINE_KEYS = ['line1', 'line2', 'line3'] as const

export function Setup({ state, dispatch }: Props) {
  if (state.phase === 'setupMode') return <ModeStep state={state} dispatch={dispatch} />
  // Task 11 preenche setupIdentity.
  return <div className="screen" data-phase={state.phase} />
}

function ModeStep({ state, dispatch }: Props) {
  const { lang } = state
  const [sel, setSel] = useState<GameMode>('normal')

  const title = t(lang, 'setup.modeTitle')
  const words = title.split(' ')
  const mid = Math.ceil(words.length / 2)
  const titleTop = words.slice(0, mid).join(' ')
  const titleBottom = words.slice(mid).join(' ')

  return (
    <div className="screen">
      <hr className="rule--double" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 }}>
        <span className="mono-label">{t(lang, 'setup.step1')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 22, height: 4, background: 'var(--red)' }} />
          <div style={{ width: 22, height: 4, background: 'var(--track)' }} />
        </div>
      </div>

      <div style={{ paddingTop: 22 }}>
        <div className="headline" style={{ fontSize: 30 }}>
          {titleTop}<br />{titleBottom}
        </div>
        <div style={{ fontSize: 13, marginTop: 10, color: 'var(--dim)' }}>{t(lang, 'setup.modeSub')}</div>
      </div>

      <div style={{ marginTop: 20 }}>
        {MODE_ORDER.map((id, i) => {
          const isSel = id === sel
          const isLast = i === MODE_ORDER.length - 1
          if (isSel) {
            return (
              <div key={id}>
                <div className="strip strip--ink" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="headline" style={{ fontSize: 15 }}>{t(lang, `mode.${id}.name`)}</div>
                    <span className="mono-label" style={{ color: 'var(--accent-warm)' }}>{t(lang, 'setup.chosen')}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--ink-3)', margin: 0 }} />
                  <span className="mono-label" style={{ fontSize: 9 }}>{t(lang, 'setup.how')}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {LINE_KEYS.map((lineKey, li) => (
                      <div key={lineKey} style={{ display: 'flex' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--accent-warm)', width: 14 }}>
                          {String(li + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>{t(lang, `mode.${id}.${lineKey}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {!isLast && <hr className="rule" />}
              </div>
            )
          }
          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => setSel(id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                  textAlign: 'left', padding: '15px 0',
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase' }}>{t(lang, `mode.${id}.name`)}</div>
                  <div style={{ fontSize: 12, marginTop: 4, color: 'var(--body-dim)' }}>{t(lang, `mode.${id}.desc`)}</div>
                </div>
                <span className="mono" style={{ fontSize: 10 }}>{t(lang, `mode.${id}.meta`)}</span>
              </button>
              {!isLast && <hr className="rule" />}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button type="button" className="btn btn--ink" onClick={() => dispatch({ type: 'SET_MODE', mode: sel })}>
          {t(lang, 'setup.continue')}
        </button>
        <div className="mono-label" style={{ textAlign: 'center', marginTop: 12 }}>{t(lang, 'setup.modeNote')}</div>
      </div>
    </div>
  )
}
