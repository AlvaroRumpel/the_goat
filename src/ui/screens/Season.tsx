import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t, type Lang } from '../../i18n'
import { teamById } from '../../data/teams'
import { effectiveOverall, performanceRatio, RETIRE_MIN_AGE } from '../../engine/season'
import { INTERACTIVE_EVENTS } from '../../engine/events'
import type { Focus, Headline } from '../../engine/types'
import { OfferCard, TeamSymbol } from '../components/OfferCard'
import { CareerBar } from '../components/CareerBar'
import { SeasonResult } from './SeasonResult'
import { SeasonAdvanceBody } from './SeasonAdvance'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const FOCUSES: Focus[] = ['scoring', 'defense', 'leadership', 'health']

export function Season(props: Props) {
  switch (props.state.phase) {
    case 'preseason': return <Preseason {...props} />
    case 'seasonResult': return <SeasonResult {...props} />
    case 'tradeDecision': return <TradeDecision {...props} />
    case 'eventDecision': return <EventDecision {...props} />
    case 'freeAgency': return <FreeAgency {...props} />
    case 'retireDecision': return <RetireDecision {...props} />
    default: return null
  }
}

// até 5 manchetes; drafts (podem ser muitas por ano) capados em 2.
function headlineItems(headlines: Headline[]): Headline[] {
  const items: Headline[] = []
  let draftCount = 0
  for (const h of headlines) {
    if (h.kind === 'draft') {
      if (draftCount >= 2) continue
      draftCount++
    }
    items.push(h)
    if (items.length >= 5) break
  }
  return items
}

function headlineText(lang: Lang, h: Headline): string {
  if (h.kind === 'trade') return t(lang, 'headline.trade', { player: h.playerName, from: h.fromTeamId.toUpperCase(), to: h.toTeamId.toUpperCase() })
  if (h.kind === 'retire') return t(lang, 'headline.retire', { player: h.playerName })
  return t(lang, 'headline.draft', { player: h.playerName, team: h.teamId.toUpperCase() })
}

function Preseason({ state, dispatch }: Props) {
  const lang = state.lang
  const offer = state.currentOffer!
  const team = teamById(offer.teamId)
  const [selected, setSelected] = useState<Focus>('scoring')
  const headlines = headlineItems(state.headlines).slice(0, 3)

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="headline" style={{ fontSize: 26 }}>{team.city} {team.name}</div>
          <TeamSymbol profile={offer.profile} />
        </div>

        {headlines.length > 0 && (
          <>
            <hr className="rule--double" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="mono-label">{t(lang, 'preseason.league')}</div>
              {headlines.map((h, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `2px solid ${i === 0 ? 'var(--red)' : 'var(--ink)'}`,
                    paddingLeft: 12, fontSize: 13, fontWeight: 600,
                  }}
                >
                  {headlineText(lang, h)}
                </div>
              ))}
            </div>
            <hr className="rule" />
          </>
        )}

        <div className="mono-label">{t(lang, 'preseason.work')}</div>
        <div>
          {FOCUSES.map((f, i) => {
            const isSel = f === selected
            return (
              <div key={f}>
                <button
                  type="button"
                  className={isSel ? 'strip strip--ink' : undefined}
                  onClick={() => setSelected(f)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
                    textAlign: 'left', padding: isSel ? undefined : '11px 0',
                  }}
                >
                  <span className="headline" style={{ fontSize: 16 }}>{t(lang, 'focus.' + f)}</span>
                  {isSel
                    ? <span className="mono" style={{ fontSize: 11, color: 'var(--accent-warm)' }}>{t(lang, `focus.${f}.desc`)}</span>
                    : <span className="hint">{t(lang, `focus.${f}.desc`)}</span>}
                </button>
                {i < FOCUSES.length - 1 && <hr className="rule--soft" />}
              </div>
            )
          })}
        </div>

        <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'PLAY_SEASON', focus: selected })}>
          {t(lang, 'preseason.start')}
        </button>
      </div>
    </div>
  )
}

function TradeDecision({ state, dispatch }: Props) {
  const lang = state.lang
  const pendingRegular = state.pendingRegular!
  const tradeOffer = pendingRegular.tradeOffer!
  const team = teamById(tradeOffer.teamId)

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      {state.calendar && <SeasonAdvanceBody state={state} />}
      <div className="modal-veil">
        <div className="crossroads-card">
          <div className="mono-label mono-label--red">{t(lang, 'crossroads.label')}</div>
          <div className="headline" style={{ fontSize: 26 }}>
            {t(lang, 'trade.desc', { team: `${team.city} ${team.name}` })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="mono-label">{t(lang, 'crossroads.ifStay')} · {t(lang, 'trade.stay.effect')}</div>
            <div className="mono-label mono-label--red">{t(lang, 'crossroads.ifAccept')} · {t(lang, 'trade.accept.effect')}</div>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'TRADE_DECISION', accept: true })}>
            {t(lang, 'trade.accept')}
          </button>
          <button type="button" className="btn btn--outline" onClick={() => dispatch({ type: 'TRADE_DECISION', accept: false })}>
            {t(lang, 'trade.reject')}
          </button>
          <div className="mono-label" style={{ textAlign: 'center' }}>{t(lang, 'crossroads.note')}</div>
        </div>
      </div>
    </div>
  )
}

function EventDecision({ state, dispatch }: Props) {
  const lang = state.lang
  const ev = state.pendingEvents!.find(e => INTERACTIVE_EVENTS.includes(e))!
  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div className="modal-veil">
        <div className="crossroads-card">
          <div className="mono-label mono-label--red">{t(lang, 'crossroads.label')}</div>
          <div className="headline" style={{ fontSize: 26 }}>{t(lang, `eventdec.${ev}.title`)}</div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>{t(lang, `eventdec.${ev}.desc`)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="mono-label mono-label--red">{t(lang, 'eventdec.ifA')} · {t(lang, `eventdec.${ev}.aEffect`)}</div>
            <div className="mono-label">{t(lang, 'eventdec.ifB')} · {t(lang, `eventdec.${ev}.bEffect`)}</div>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'EVENT_DECISION', choice: 'a' })}>
            {t(lang, `eventdec.${ev}.a`)}
          </button>
          <button type="button" className="btn btn--outline" onClick={() => dispatch({ type: 'EVENT_DECISION', choice: 'b' })}>
            {t(lang, `eventdec.${ev}.b`)}
          </button>
          <div className="mono-label" style={{ textAlign: 'center' }}>{t(lang, 'crossroads.note')}</div>
        </div>
      </div>
    </div>
  )
}

function FreeAgency({ state, dispatch }: Props) {
  const lang = state.lang
  const ratio = performanceRatio(state.career.seasons)
  const heavyDecline = ratio !== null && ratio < 0.55
  const [selected, setSelected] = useState(0)
  const offer = state.offers[selected]
  const team = teamById(offer.teamId)
  const build = state.build!
  const effNow = effectiveOverall(build.overall, state.age, build.attributes.physical)
  const effPast = state.career.seasons.length >= 2
    ? effectiveOverall(build.overall, state.age - 2, build.attributes.physical)
    : 0
  const delta = effPast - effNow
  const showOvr = state.career.seasons.length >= 2 && delta > 0
  const [ovrBefore, ovrAfter] = showOvr ? t(lang, 'fa.ovrDrop', { n: effNow, delta }).split('↓') : ['', '']

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="mono-label">{t(lang, 'fa.over')}</div>
        <div className="headline" style={{ fontSize: 30 }}>
          {t(lang, 'fa.headline').split('\n').map((line, i) => <div key={i}>{line}</div>)}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>{t(lang, 'fa.desc')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {state.offers.map((o, i) => (
            <OfferCard
              key={o.teamId}
              team={teamById(o.teamId)}
              profile={o.profile}
              lang={lang}
              featured={i === selected}
              onClick={() => setSelected(i)}
              terms={t(lang, 'nbadraft.contractNote')}
              padding="27px 16px"
            />
          ))}
        </div>

        {showOvr && (
          <>
            <hr className="rule" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div className="mono-label">{t(lang, 'fa.ovrToday')}</div>
              <div className="mono" style={{ fontSize: 12 }}>
                {ovrBefore}<span style={{ color: 'var(--red)' }}>↓{ovrAfter}</span>
              </div>
            </div>
            <hr className="rule" />
          </>
        )}

        <button type="button" className="btn btn--ink" onClick={() => dispatch({ type: 'CHOOSE_OFFER', offer })}>
          {t(lang, 'nbadraft.sign', { team: `${team.city} ${team.name}` })}
        </button>

        {(state.age >= 31 || (heavyDecline && state.age >= RETIRE_MIN_AGE)) && (
          <button
            type="button"
            className="btn btn--outline btn--outline-red"
            onClick={() => dispatch({ type: 'RETIRE_DECISION', retire: true })}
          >
            {t(lang, 'fa.hang')}
          </button>
        )}
      </div>
    </div>
  )
}

function RetireDecision({ state, dispatch }: Props) {
  const lang = state.lang
  const n = state.career.seasons.length + 1
  const ratio = performanceRatio(state.career.seasons)
  const heavyDecline = ratio !== null && ratio < 0.55
  const build = state.build!
  const eovs = state.career.seasons.slice(-10).map(s => effectiveOverall(build.overall, s.age, build.attributes.physical))
  const peakIdx = eovs.indexOf(Math.max(...eovs))
  const current = eovs.at(-1) ?? build.overall
  const peak = Math.max(...eovs)

  return (
    <div className="screen retire-screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, textAlign: 'center' }}
      >
        <div className="mono-label">
          {t(lang, 'retire.season', { n })} · {t(lang, 'season.age', { age: state.age })}
        </div>
        <div className="retire-letter" style={{ fontSize: 34 }}>{t(lang, 'retire.title')}</div>
        <div style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--body-dim)' }}>
          {t(lang, heavyDecline ? 'retire.desc.pressure' : 'retire.desc', { age: state.age })}
        </div>

        <hr className="rule" style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span className="mono-label">{t(lang, 'retire.effOverall')}</span>
          <span className="mono">{peak} → {current}</span>
        </div>
        <div className="retire-decline" style={{ width: '100%' }}>
          {eovs.map((eov, i) => {
            const h = Math.max(4, Math.round(((eov - 40) / (99 - 40)) * 56))
            const cls = i === peakIdx ? 'retire-decline__bar retire-decline__bar--peak'
              : i >= eovs.length - 3 ? 'retire-decline__bar retire-decline__bar--late'
              : 'retire-decline__bar'
            return <div key={i} className={cls} style={{ height: h }} />
          })}
        </div>
        <hr className="rule" style={{ width: '100%' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'RETIRE_DECISION', retire: false })}>
          {t(lang, 'retire.continue')}
        </button>
        <button type="button" className="btn btn--outline btn--outline-red" onClick={() => dispatch({ type: 'RETIRE_DECISION', retire: true })}>
          {t(lang, 'retire.stop')}
        </button>
      </div>
    </div>
  )
}
