import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { SLOT_ORDER, type SlotId } from '../../engine/types'
import { PLAYERS, playerById } from '../../data/players'
import { useSpin } from '../hooks/useMotion'
import { CountUp } from '../components/CountUp'
import { draftAttrs, malusAmount, weakestSlot } from '../../engine/draft'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

export function AttrDraft(props: Props) {
  if (props.state.phase === 'draftDone') return <DraftDone {...props} />
  return <DraftRound {...props} />
}

function DraftRound({ state, dispatch }: Props) {
  const [selected, setSelected] = useState<SlotId | null>(null)
  const lang = state.lang
  const goat = state.career.mode === 'goat'
  const player = playerById(state.currentPlayerId!)
  // A2: o sorteio é visto — o nome cicla outras lendas (índices fixos, zero RNG) por ~700ms
  const spinAlts = Array.from({ length: 12 }, (_, i) => PLAYERS[(PLAYERS.indexOf(player) + 17 * (i + 1)) % PLAYERS.length].name)
  const spin = useSpin(player.id, player.name, spinAlts, 700)
  const taken = new Map(state.picks.map(pk => [pk.slot, pk]))
  const { owned: myAttrs, pending: pendingMalus } = draftAttrs(state.picks)
  const sel = selected && !taken.has(selected) ? selected : null
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

  const shownName = spin.text
  const spaceIdx = shownName.indexOf(' ')
  const nameLine1 = spaceIdx === -1 ? shownName : shownName.slice(0, spaceIdx)
  const nameLine2 = spaceIdx === -1 ? '' : shownName.slice(spaceIdx + 1)
  const initials = shownName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const projectedOvr = sel
    ? (() => {
        const after = draftAttrs([...state.picks, { playerId: player.id, slot: sel }]).owned
        const vals = Object.values(after) as number[]
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      })()
    : 0

  return (
    <div className="screen">
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }} onClick={spin.skip}>
          <div style={{ flex: 1 }}>
            <div className="headline" style={{ fontSize: 27, opacity: spin.settled ? 1 : 0.55 }}>
              {nameLine1}<br />{nameLine2}
            </div>
            <div className="mono-label" style={{ marginTop: 6 }}>
              {goat
                ? t(lang, 'era.' + player.era)
                : t(lang, 'draft.legendMeta', { era: t(lang, 'era.' + player.era), slot: t(lang, 'slot.' + globalWeak) })}
            </div>
          </div>
          <div className="mono-ring">{initials}</div>
        </div>

        <div>
          <div className="hint" style={{ fontSize: 12.5 }}>{t(lang, goat ? 'draft.goat.hint' : 'draft.hint')}</div>
          {!goat && <div className="mono-label" style={{ marginTop: 4, fontSize: 9 }}>{t(lang, 'draft.legend')}</div>}
        </div>

        <div>
          {SLOT_ORDER.map((slot, i) => {
            const owned = taken.get(slot)
            const isLast = i === SLOT_ORDER.length - 1
            if (owned) {
              const round = state.picks.indexOf(owned) + 1
              const mine = myAttrs[slot]!
              const origin = playerById(owned.playerId).attrs[slot]
              return (
                <div key={slot}>
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 0', opacity: 0.6,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>
                        {t(lang, 'slot.' + slot)}
                      </div>
                      <div className="mono-label" style={{ marginTop: 4 }}>
                        {t(lang, 'draft.ownedRound', { n: round })}
                        {mine < origin ? ' · ' + t(lang, 'draft.ownedFrom', { from: origin }) : ''}
                      </div>
                    </div>
                    <div className="headline" style={{ fontSize: 22 }}>{mine}</div>
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
                    {!goat && (
                      <div className="mono-label" style={{ marginTop: 4 }}>
                        {t(lang, 'draft.price', {
                          slot: t(lang, 'slot.' + weakestSlot(player, slot)),
                          n: malusAmount(player.attrs[slot]),
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <div className="headline" style={{ fontSize: 22, color: isSel ? 'var(--accent-warm)' : undefined }}>
                      {goat ? '??' : <CountUp key={player.id} value={player.attrs[slot]} ms={550} />}
                    </div>
                    {!goat && (
                      <div
                        className="mono"
                        style={{ fontSize: 11, marginTop: 2, color: isSel ? 'var(--on-ink-dim)' : 'var(--dim)' }}
                      >
                        {t(lang, 'draft.yours', {
                          legend: player.attrs[slot],
                          yours: Math.max(40, player.attrs[slot] - pendingMalus[slot]),
                        })}
                      </div>
                    )}
                  </div>
                </button>
                {!isLast && <hr className="rule--soft" />}
              </div>
            )
          })}
        </div>

        {sel && !goat && (
          <div style={{ borderLeft: '2px solid var(--red)', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="mono-label">{t(lang, 'draft.projected', { n: projectedOvr })}</div>
          </div>
        )}

        {sel && (
          <button type="button" className="btn btn--primary" onClick={() => steal(sel)}>
            {goat ? t(lang, 'draft.goat.stealBtn', { slot: t(lang, 'slot.' + sel) }) : t(lang, 'draft.stealBtn', { slot: t(lang, 'slot.' + sel), n: player.attrs[sel] })}
          </button>
        )}

        {!goat && (
          <button
            type="button" className="btn btn--outline" disabled={state.rerollsLeft <= 0}
            onClick={reroll}
          >
            {state.rerollsLeft <= 0
              ? t(lang, 'draft.rerollUsed')
              : state.rerollsLeft === 1
                ? t(lang, 'draft.rerollOne')
                : t(lang, 'draft.reroll', { n: state.rerollsLeft })}
          </button>
        )}
      </div>
    </div>
  )
}

function DraftDone({ state, dispatch }: Props) {
  const lang = state.lang
  const build = state.build!
  const lowSlots = SLOT_ORDER.filter(slot => build.attributes[slot] < 70)

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div className="mono-label">{t(lang, 'draft.done.headline')}</div>
          <div className="headline headline--red" style={{ fontSize: 50, marginTop: 6 }}>
            {t(lang, 'archetype.name.' + build.archetype)}
          </div>
          <div className="mono-label" style={{ marginTop: 6 }}>{t(lang, 'archetype.pos.' + build.archetype)}</div>
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{t(lang, 'archetype.desc.' + build.archetype)}</p>

        <div className="strip strip--ink" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mono-label" style={{ color: 'var(--on-ink-dim)' }}>{t(lang, 'draft.done.debutOvr')}</div>
          <div className="headline" style={{ fontSize: 38, color: 'var(--accent-warm)' }}><CountUp value={build.overall} ms={900} /></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SLOT_ORDER.map(slot => {
            const val = build.attributes[slot]
            const low = val < 70
            return (
              <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="mono-label" style={{ width: 82, fontSize: 11 }}>{t(lang, 'slot.' + slot)}</div>
                <div className="bar" style={{ flex: 1 }}>
                  <div className={low ? 'bar__fill bar__fill--bad' : 'bar__fill'} style={{ width: `${val}%` }} />
                </div>
                <div className="mono" style={{ fontSize: 11, textAlign: 'right', width: 20 }}>{val}</div>
              </div>
            )
          })}
        </div>

        <hr className="rule" />
        <div className="hint">
          {lowSlots.length === 0
            ? t(lang, 'draft.done.lowNone')
            : t(lang, 'draft.done.low', {
                n: lowSlots.length,
                list: lowSlots.map(slot => t(lang, 'slot.' + slot)).join(' · '),
              })}
        </div>
        <hr className="rule" />

        <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'CONFIRM_BUILD' })}>
          {t(lang, 'draft.done.next')}
        </button>
      </div>
    </div>
  )
}
