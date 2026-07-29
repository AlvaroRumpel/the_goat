import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t, type Lang } from '../../i18n'
import { teamById } from '../../data/teams'
import { performanceRatio } from '../../engine/season'
import { partialMvpRace } from '../../engine/league'
import { INTERACTIVE_EVENTS } from '../../engine/events'
import type { Focus, Headline } from '../../engine/types'
import { OfferCard, TeamSymbol } from '../components/OfferCard'
import { RacesPanel, StandingsTable } from '../components/LeaguePanels'
import { CareerBar } from '../components/CareerBar'
import { SeasonResult } from './SeasonResult'

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
      <div className="grain" />
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
  const pending = state.pendingLeague!
  const partialRace = partialMvpRace(state.league!, pending.lines, pending.standings, {
    ppg: pendingRegular.ppg, rpg: pendingRegular.rpg, apg: pendingRegular.apg, teamWinPct: pending.winPct,
  })

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div className="grain" />
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <StandingsTable standings={pending.standings} playerTeamId={pendingRegular.teamId} lang={lang} scale={0.5} />
        <RacesPanel races={[partialRace]} lang={lang} scale={0.5} />
      </div>
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
      <div className="grain" />
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

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div className="screen__glow" />
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
        <div className="kicker">{t(lang, 'season.age', { age: state.age })}</div>
        <div className="display goldtext" style={{ fontSize: 42, textTransform: 'uppercase' }}>{t(lang, 'fa.title')}</div>
        <hr className="rule" />
        <div className="hint">{t(lang, 'fa.desc')}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {state.offers.map((offer, i) => (
            <OfferCard
              key={offer.teamId}
              team={teamById(offer.teamId)}
              profile={offer.profile}
              lang={lang}
              featured={i === 0}
              onClick={() => dispatch({ type: 'CHOOSE_OFFER', offer })}
            />
          ))}
        </div>

        {(state.age >= 31 || heavyDecline) && (
          <button type="button" className="btn btn--danger" onClick={() => dispatch({ type: 'RETIRE_DECISION', retire: true })}>
            {t(lang, 'retire.stop')}
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

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <div className="grain" />
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, textAlign: 'center' }}
      >
        <div className="kicker">
          {t(lang, 'season.age', { age: state.age })} · {t(lang, 'retire.season', { n })}
        </div>
        <div className="display" style={{ fontSize: 30 }}>{t(lang, 'retire.title')}</div>
        <hr className="rule" style={{ width: '80%' }} />
        <div className="hint">
          {t(lang, heavyDecline ? 'retire.desc.pressure' : 'retire.desc', { age: state.age })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'RETIRE_DECISION', retire: false })}>
          {t(lang, 'retire.continue')}
        </button>
        <button type="button" className="btn btn--danger" onClick={() => dispatch({ type: 'RETIRE_DECISION', retire: true })}>
          {t(lang, 'retire.stop')}
        </button>
      </div>
    </div>
  )
}
