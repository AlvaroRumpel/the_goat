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
  return <IdentityStep state={state} dispatch={dispatch} />
}

const NUMBER_SUGGESTIONS = [3, 8, 11, 24, 77] as const

function IdentityStep({ state, dispatch }: Props) {
  const { lang } = state
  const [name, setName] = useState('')
  const [number, setNumber] = useState<number | null>(null)
  const [typing, setTyping] = useState(false)

  const trimmed = name.trim()
  const lastName = trimmed.split(/\s+/).at(-1) ?? ''
  const showPress = trimmed.length >= 2
  const canBegin = trimmed.length >= 2 && number !== null

  return (
    <div className="screen">
      <hr className="rule--double" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 }}>
        <span className="mono-label">{t(lang, 'setup.step2')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ width: 22, height: 4, background: 'var(--ink)' }} />
          <div style={{ width: 22, height: 4, background: 'var(--red)' }} />
        </div>
      </div>

      <div style={{ marginTop: 22, border: '1px solid var(--rule)', background: 'var(--paper-2)', padding: '18px 18px 20px', textAlign: 'center' }}>
        <span className="mono-label" style={{ letterSpacing: '0.24em' }}>{t(lang, 'setup.jersey')}</span>
        {showPress ? (
          <div className="headline" style={{ fontSize: 17, letterSpacing: '0.14em', marginTop: 10 }}>{lastName}</div>
        ) : null}
        <div
          className="headline"
          style={{ fontSize: 108, lineHeight: 0.82, color: 'var(--red)', marginTop: 6, opacity: number === null ? 0.25 : 1 }}
        >
          {number === null ? '00' : String(number).padStart(2, '0')}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <label className="mono-label" htmlFor="setup-name">{t(lang, 'setup.nameLabel')}</label>
        <input
          id="setup-name"
          type="text"
          value={name}
          maxLength={22}
          onChange={e => setName(e.target.value)}
          style={{
            display: 'block', width: '100%', marginTop: 8, padding: '4px 0',
            border: 'none', borderRadius: 0, background: 'transparent', outline: 'none',
            borderBottom: '1px solid var(--ink)', fontSize: 24, fontWeight: 700,
          }}
        />
        {showPress ? (
          <div className="hint" style={{ marginTop: 8 }}>{t(lang, 'setup.press', { lastName })}</div>
        ) : null}
      </div>

      <div style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="mono-label">{t(lang, 'setup.numberLabel')}</span>
          <button type="button" className="topbar__link" onClick={() => setTyping(v => !v)}>
            {t(lang, 'setup.typeOther')}
          </button>
        </div>
        {typing ? (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={99}
            value={number ?? ''}
            onChange={e => {
              const v = e.target.value
              if (v === '') { setNumber(null); return }
              const n = Math.trunc(Number(v))
              if (Number.isNaN(n)) return
              setNumber(Math.min(99, Math.max(0, n)))
            }}
            style={{
              display: 'block', width: '100%', marginTop: 10, padding: '4px 0',
              border: 'none', borderRadius: 0, background: 'transparent', outline: 'none',
              borderBottom: '1px solid var(--ink)', fontSize: 24, fontWeight: 700,
            }}
          />
        ) : (
          <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
            {NUMBER_SUGGESTIONS.map(n => {
              const isSel = n === number
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNumber(n)}
                  style={{
                    flex: 1, height: 44,
                    border: isSel ? 'none' : '1px solid var(--rule)',
                    background: isSel ? 'var(--ink)' : 'transparent',
                  }}
                >
                  <span
                    className="headline"
                    style={{ fontSize: 17, color: isSel ? 'var(--on-ink)' : 'var(--dim)' }}
                  >
                    {String(n).padStart(2, '0')}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 22, borderLeft: '2px solid var(--red)', paddingLeft: 12 }}>
        <span className="mono-label">{t(lang, 'setup.modeRecap')}</span>
        <div className="headline" style={{ fontSize: 15, marginTop: 4 }}>{t(lang, `mode.${state.setup.mode}.name`)}</div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canBegin}
          onClick={() => dispatch({ type: 'BEGIN_CAREER', seed: Date.now() % 2 ** 31, name, number: number! })}
        >
          {t(lang, 'setup.begin')}
        </button>
        <div className="mono-label" style={{ textAlign: 'center', marginTop: 12 }}>{t(lang, 'setup.beginNote')}</div>
      </div>
    </div>
  )
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
