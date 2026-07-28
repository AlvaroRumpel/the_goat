import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { SLOT_ORDER, type SlotId } from '../../engine/types'
import { playerById } from '../../data/players'
import { malusAmount, weakestSlot } from '../../engine/draft'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

export function AttrDraft({ state, dispatch }: Props) {
  const [selected, setSelected] = useState<SlotId | null>(null)
  if (state.phase === 'draftDone') return <DraftDone state={state} dispatch={dispatch} />

  const lang = state.lang
  const player = playerById(state.currentPlayerId!)
  const taken = new Map(state.picks.map(pk => [pk.slot, pk]))
  const sel = selected && !taken.has(selected) ? selected : null
  const malusSlot = sel ? weakestSlot(player, sel) : null
  const malusN = sel ? malusAmount(player.attrs[sel]) : 0
  // fraqueza global (sem exclusão) — só para exibição no card do jogador
  const globalWeak = SLOT_ORDER.reduce((w, s) => (player.attrs[s] < player.attrs[w] ? s : w), SLOT_ORDER[0])

  const steal = (slot: SlotId) => {
    dispatch({ type: 'DRAFT_STEAL', slot })
    setSelected(null)
  }
  const reroll = () => {
    dispatch({ type: 'DRAFT_REROLL' })
    setSelected(null)
  }

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

        <div className="card card--gold" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 22 }}>{player.name}</div>
            <div className="hint">{t(lang, 'draft.weakness', { slot: t(lang, 'slot.' + globalWeak) })}</div>
          </div>
          <div className="chip">{t(lang, 'era.' + player.era)}</div>
        </div>

        <div className="kicker kicker--gold" style={{ textAlign: 'center' }}>{t(lang, 'draft.choose')}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SLOT_ORDER.map(slot => {
            const owned = taken.get(slot)
            if (owned) {
              const ownedVal = playerById(owned.playerId).attrs[slot]
              return (
                <div key={slot} className="attr-cell attr-cell--off">
                  <div>
                    <div className="attr-cell__name">{t(lang, 'slot.' + slot)}</div>
                    <div className="attr-cell__owned">{t(lang, 'draft.owned', { n: ownedVal })}</div>
                  </div>
                  <div className="attr-cell__val">—</div>
                </div>
              )
            }
            return (
              <button
                key={slot} type="button"
                className={sel === slot ? 'attr-cell attr-cell--sel' : 'attr-cell'}
                onClick={() => setSelected(slot)}
              >
                <div className="attr-cell__name">{t(lang, 'slot.' + slot)}</div>
                <div className="attr-cell__val">{player.attrs[slot]}</div>
              </button>
            )
          })}
        </div>

        {sel && (
          <div className="preview-bar">
            {t(lang, 'draft.preview', { name: player.name, slot: t(lang, 'slot.' + malusSlot!), n: malusN })}
          </div>
        )}

        {sel && (
          <button type="button" className="btn btn--gold" onClick={() => steal(sel)}>
            {t(lang, 'draft.stealBtn', { slot: t(lang, 'slot.' + sel), n: player.attrs[sel] })}
          </button>
        )}

        <button
          type="button" className="btn btn--ghost" disabled={state.rerollUsed}
          onClick={reroll}
        >
          {state.rerollUsed ? t(lang, 'draft.rerollUsed') : t(lang, 'draft.reroll')}
        </button>

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
