import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import { performanceRatio } from '../../engine/season'
import { INTERACTIVE_EVENTS } from '../../engine/events'
import type { Focus } from '../../engine/types'
import { OfferCard } from '../components/OfferCard'
import { StatLine } from '../components/StatLine'
import { PlayerPanel, RacesPanel, StandingsTable } from '../components/LeaguePanels'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const FOCUSES: Focus[] = ['scoring', 'defense', 'leadership', 'health']
const BAD_EVENTS = new Set(['injury', 'coldstreak', 'lockerroom'])
const HIGHLIGHT_AWARDS = new Set(['ring', 'fmvp', 'mvp'])

export function Season(props: Props) {
  switch (props.state.phase) {
    case 'preseason': return <Preseason {...props} />
    case 'seasonResult': return <SeasonResultView {...props} />
    case 'tradeDecision': return <TradeDecision {...props} />
    case 'eventDecision': return <EventDecision {...props} />
    case 'freeAgency': return <FreeAgency {...props} />
    case 'retireDecision': return <RetireDecision {...props} />
    default: return null
  }
}

function Preseason({ state, dispatch }: Props) {
  const lang = state.lang
  const year = 2026 + state.career.seasons.length
  const team = teamById(state.currentOffer!.teamId)

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="kicker">
            {t(lang, 'season.title', { year })} · {t(lang, 'season.age', { age: state.age })}
          </div>
          <div className="kicker">{team.id.toUpperCase()}</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div className="kicker kicker--gold">{t(lang, 'season.focus.kicker')}</div>
          <div className="display" style={{ fontSize: 28, marginTop: 8 }}>{t(lang, 'season.focus.title')}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FOCUSES.map(f => (
            <button
              key={f}
              type="button"
              className="card"
              style={{ padding: 18, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8 }}
              onClick={() => dispatch({ type: 'PLAY_SEASON', focus: f })}
            >
              <span className="display" style={{ fontSize: 18 }}>{t(lang, 'focus.' + f)}</span>
              <span className="hint" style={{ textAlign: 'left' }}>{t(lang, `focus.${f}.desc`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

type ResultTab = 'result' | 'standings' | 'races' | 'you'
const RESULT_TABS: ResultTab[] = ['result', 'standings', 'races', 'you']

function SeasonResultView({ state, dispatch }: Props) {
  const lang = state.lang
  const [tab, setTab] = useState<ResultTab>('result')
  const season = state.career.seasons[state.career.seasons.length - 1]
  const year = 2026 + state.career.seasons.length - 1
  const team = teamById(season.finalTeamId)
  const outcome = state.seasonOutcome

  return (
    <div className="screen">
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="kicker">
            {t(lang, 'season.title', { year })} · {t(lang, 'season.age', { age: season.age })}
          </div>
          <div className="kicker">{team.id.toUpperCase()}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {RESULT_TABS.map(tb => (
            <button
              key={tb}
              type="button"
              className={tab === tb ? 'chip' : 'chip chip--dim'}
              onClick={() => setTab(tb)}
            >
              {t(lang, 'tabs.' + tb)}
            </button>
          ))}
        </div>

        {tab === 'result' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <StatLine value={String(season.ppg)} label={t(lang, 'stat.pts')} />
              <StatLine value={String(season.rpg)} label={t(lang, 'stat.reb')} />
              <StatLine value={String(season.apg)} label={t(lang, 'stat.ast')} />
            </div>
            <div className="hint">{t(lang, 'season.games', { n: season.games })}</div>

            <hr className="rule" />

            {season.events.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {season.events.map(ev => (
                  <div key={ev} className={BAD_EVENTS.has(ev) ? 'evrow evrow--bad' : 'evrow'}>
                    {t(lang, 'event.' + ev)}
                  </div>
                ))}
              </div>
            )}

            {season.wonTitle ? (
              <div className="banner" style={{ padding: 16, textAlign: 'center' }}>
                <span className="display goldtext" style={{ fontSize: 20 }}>{t(lang, 'season.title.won')}</span>
              </div>
            ) : !season.madePlayoffs ? (
              <div className="banner banner--bad" style={{ padding: 16, textAlign: 'center' }}>
                {t(lang, 'season.playoffs.missed')}
              </div>
            ) : (
              <div className="banner" style={{ padding: 16, textAlign: 'center' }}>
                {t(lang, 'season.playoffs.made')}
              </div>
            )}

            {season.awards.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {season.awards.map(a => (
                  <span key={a} className={HIGHLIGHT_AWARDS.has(a) ? 'chip' : 'chip chip--dim'}>
                    {t(lang, 'award.' + a)}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'standings' && outcome && (
          <StandingsTable standings={outcome.standings} playerTeamId={season.finalTeamId} lang={lang} />
        )}

        {tab === 'races' && outcome && (
          <RacesPanel races={outcome.races} lang={lang} />
        )}

        {tab === 'you' && <PlayerPanel state={state} />}

        <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'ADVANCE' })}>
          {t(lang, 'season.advance')}
        </button>
      </div>
    </div>
  )
}

function TradeDecision({ state, dispatch }: Props) {
  const lang = state.lang
  const tradeOffer = state.pendingRegular!.tradeOffer!
  const team = teamById(tradeOffer.teamId)

  return (
    <div className="screen">
      <div className="grain" />
      <div className="modal-veil">
        <div
          className="card card--gold"
          style={{ padding: 24, maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}
        >
          <div className="kicker kicker--gold">{t(lang, 'trade.title')}</div>
          <div className="display" style={{ fontSize: 22 }}>
            {t(lang, 'trade.desc', { team: `${team.city} ${team.name}` })}
          </div>
          <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'TRADE_DECISION', accept: true })}>
            {t(lang, 'trade.accept')}
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'TRADE_DECISION', accept: false })}>
            {t(lang, 'trade.reject')}
          </button>
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
      <div className="grain" />
      <div className="modal-veil">
        <div className="card card--gold" style={{ padding: 24, maxWidth: 360, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <div className="kicker kicker--gold">{t(lang, `eventdec.${ev}.title`)}</div>
          <div className="display" style={{ fontSize: 20 }}>{t(lang, `eventdec.${ev}.desc`)}</div>
          <button type="button" className="btn btn--gold" onClick={() => dispatch({ type: 'EVENT_DECISION', choice: 'a' })}>
            {t(lang, `eventdec.${ev}.a`)}
          </button>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'EVENT_DECISION', choice: 'b' })}>
            {t(lang, `eventdec.${ev}.b`)}
          </button>
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
