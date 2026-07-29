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

  const spaceIdx = player.name.indexOf(' ')
  const nameLine1 = spaceIdx === -1 ? player.name : player.name.slice(0, spaceIdx)
  const nameLine2 = spaceIdx === -1 ? '' : player.name.slice(spaceIdx + 1)
  const initials = player.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const projectedOvr = sel
    ? Math.round(
        (state.picks.reduce((sum, pk) => sum + playerById(pk.playerId).attrs[pk.slot], 0) + player.attrs[sel]) /
          (state.picks.length + 1),
      )
    : 0

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="mono-label">{t(lang, 'draft.round', { n: state.draftRound + 1 })}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {SLOT_ORDER.map((slot, i) => (
              <div
                key={slot}
                style={{
                  width: 14,
                  height: 4,
                  background:
                    i < state.draftRound ? 'var(--ink)' : i === state.draftRound ? 'var(--red)' : 'var(--track)',
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="headline" style={{ fontSize: 27 }}>
              {nameLine1}<br />{nameLine2}
            </div>
            <div className="mono-label" style={{ marginTop: 6 }}>
              {t(lang, 'draft.legendMeta', { era: t(lang, 'era.' + player.era), slot: t(lang, 'slot.' + globalWeak) })}
            </div>
          </div>
          <div className="mono-ring">{initials}</div>
        </div>

        <div>
          {SLOT_ORDER.map((slot, i) => {
            const owned = taken.get(slot)
            const isLast = i === SLOT_ORDER.length - 1
            if (owned) {
              const round = state.picks.indexOf(owned) + 1
              return (
                <div key={slot}>
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 0', opacity: 0.45,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', textDecoration: 'line-through' }}>
                        {t(lang, 'slot.' + slot)}
                      </div>
                      <div className="mono-label" style={{ marginTop: 4 }}>
                        {t(lang, 'draft.ownedRound', { n: round })}
                      </div>
                    </div>
                    <div className="headline" style={{ fontSize: 22 }}>—</div>
                  </div>
                  {!isLast && <hr className="rule--soft" />}
                </div>
              )
            }
            const isSel = sel === slot
            return (
              <div key={slot}>
                <button
                  type="button"
                  data-testid="attr-row"
                  className={isSel ? 'strip strip--ink' : undefined}
                  onClick={() => setSelected(slot)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%',
                    textAlign: 'left', padding: isSel ? undefined : '11px 0',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
                      {t(lang, 'slot.' + slot)}
                    </div>
                    <div className="mono-label" style={{ marginTop: 4 }}>
                      {t(lang, 'draft.price', {
                        slot: t(lang, 'slot.' + weakestSlot(player, slot)),
                        n: malusAmount(player.attrs[slot]),
                      })}
                    </div>
                  </div>
                  <div className="headline" style={{ fontSize: 22, color: isSel ? 'var(--accent-warm)' : undefined }}>
                    {player.attrs[slot]}
                  </div>
                </button>
                {!isLast && <hr className="rule--soft" />}
              </div>
            )
          })}
        </div>

        {sel && (
          <div style={{ borderLeft: '2px solid var(--red)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 13 }}>
              {t(lang, 'draft.preview', { name: player.name, slot: t(lang, 'slot.' + malusSlot!), n: malusN })}
            </div>
            <div className="mono-label">{t(lang, 'draft.projected', { n: projectedOvr })}</div>
          </div>
        )}

        {sel && (
          <button type="button" className="btn btn--primary" onClick={() => steal(sel)}>
            {t(lang, 'draft.stealBtn', { slot: t(lang, 'slot.' + sel), n: player.attrs[sel] })}
          </button>
        )}

        <button
          type="button" className="btn btn--outline" disabled={state.rerollUsed}
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
