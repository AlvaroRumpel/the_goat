import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { SLOT_ORDER } from '../../engine/types'
import { LegendCard } from '../components/LegendCard'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

export function AttrDraft({ state, dispatch }: Props) {
  if (state.phase === 'draftDone') return <DraftDone state={state} dispatch={dispatch} />

  const lang = state.lang
  const matchup = state.matchups[state.draftRound]
  const [first, second] = matchup.a.value >= matchup.b.value ? [matchup.a, matchup.b] : [matchup.b, matchup.a]

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="kicker">{t(lang, 'draft.round', { n: state.draftRound + 1 })}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SLOT_ORDER.map((slot, i) => (
              <div
                key={slot}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  border: '1px solid var(--border-gold)',
                  background: i < state.draftRound ? 'var(--gold)' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="kicker kicker--gold">{t(lang, 'draft.title')}</div>
          <div className="display" style={{ fontSize: 28, marginTop: 8 }}>{t(lang, 'slot.' + matchup.slot)}</div>
        </div>

        <LegendCard legend={first} lang={lang} variant="gold" onClick={() => dispatch({ type: 'PICK_LEGEND', legend: first })} />
        <LegendCard legend={second} lang={lang} variant="plain" onClick={() => dispatch({ type: 'PICK_LEGEND', legend: second })} />

        <div className="hint">{t(lang, 'draft.hint')}</div>
      </div>
    </div>
  )
}

function DraftDone({ state, dispatch }: Props) {
  const lang = state.lang
  const build = state.build!
  const archetypeName = t(lang, 'archetype.' + build.archetype).split(' (')[0]

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="kicker">{t(lang, 'draft.done.title')}</div>
          <div className="display goldtext" style={{ fontSize: 40, marginTop: 8 }}>{archetypeName}</div>
          <div className="hint" style={{ marginTop: 4 }}>{t(lang, 'draft.done.overall', { n: build.overall })}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SLOT_ORDER.map(slot => {
            const val = build.attributes[slot]
            const low = val < 70
            return (
              <div className="attr-row" key={slot}>
                <div className="attr-row__name">{t(lang, 'slot.' + slot)}</div>
                <div className="attr-row__bar">
                  <div
                    className={low ? 'attr-row__fill attr-row__fill--low' : 'attr-row__fill'}
                    style={{ width: `${val}%` }}
                  />
                </div>
                <div className="attr-row__val" style={low ? { color: 'var(--danger)' } : undefined}>{val}</div>
              </div>
            )
          })}
        </div>

        <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'CONFIRM_BUILD' })}>
          {t(lang, 'draft.done.next')}
        </button>
      </div>
    </div>
  )
}
