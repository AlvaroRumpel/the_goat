import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import { projectedSeed } from '../../engine/schedule'
import { partialMvpRace, projectedNpcLines, projectedStandings } from '../../engine/league'
import { RaceBars } from '../components/LeaguePanels'
import { CareerBar } from '../components/CareerBar'

interface Props { state: GameState; dispatch: Dispatch<Action> }

export function SeasonAdvanceBody({ state }: { state: GameState }) {
  const lang = state.lang
  const cal = state.calendar!
  const teamId = state.currentOffer!.teamId
  const wins = cal.ticker.filter(g => g.won).length
  const losses = cal.ticker.length - wins
  const next = cal.slots[cal.nextSlot] ?? null
  const conf = teamById(teamId).conf
  const pos = projectedSeed(state.league!, teamId, cal.ticker.length ? wins / cal.ticker.length : 0.5)
  const reg = state.pendingRegular!
  const doneW = (cal.played / 82) * 100
  const currentW = next ? ((next.gameIndex - cal.played) / 82) * 100 : 0
  const mvpRace = partialMvpRace(
    state.league!, projectedNpcLines(state.league!), projectedStandings(state.league!),
    { ppg: reg.ppg, rpg: reg.rpg, apg: reg.apg, teamWinPct: cal.ticker.length ? wins / cal.ticker.length : 0.5 },
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
      <div className="mono-label">{t(lang, 'advance.title')}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="headline" style={{ fontSize: 44 }}>
          {wins}<span style={{ color: 'var(--dim)' }}>—</span><span style={{ color: 'var(--red)' }}>{losses}</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'right' }}>
          <div>{t(lang, 'advance.gameOf', { n: cal.played })}</div>
          <div>{t(lang, 'advance.pos', { pos, conf: t(lang, 'advance.conf.' + conf) })}</div>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', height: 8, background: 'var(--track)' }}>
          <div style={{ width: `${doneW}%`, background: 'var(--ink)' }} />
          <div style={{ width: `${currentW}%`, background: 'var(--red)' }} />
        </div>
        {next && <div className="mono-label" style={{ marginTop: 6 }}>{t(lang, 'advance.nextKey', { n: next.gameIndex })}</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="mono-label">{t(lang, 'advance.ticker')}</div>
        {[...cal.ticker].slice(-9).reverse().map((g, i) => (
          <div key={g.gameIndex} style={{ display: 'flex', gap: 10, alignItems: 'baseline', opacity: 1 - i * 0.1025 }}>
            <span className="mono" style={{ fontSize: 12, width: 30, flexShrink: 0 }}>J{g.gameIndex}</span>
            <span className="headline" style={{ fontSize: 12, color: g.won ? undefined : 'var(--red)' }}>
              {t(lang, g.won ? 'advance.win' : 'advance.loss')}
            </span>
            <span className="mono" style={{ fontSize: 12, flex: 1 }}>
              {g.opponentTeamId.toUpperCase()} {g.ourScore}–{g.oppScore}
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--dim)' }}>{t(lang, 'advance.pts', { n: g.playerPts })}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="mono-label">{t(lang, 'advance.raceLabel')}</div>
        <RaceBars races={[mvpRace]} lang={lang} />
      </div>

      <div style={{ borderLeft: '2px solid var(--red)', paddingLeft: 12 }}>
        <span className="mono-label">{t(lang, 'advance.stops')}</span>
      </div>
    </div>
  )
}

export function SeasonAdvance({ state, dispatch }: Props) {
  const lang = state.lang
  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} />
      <SeasonAdvanceBody state={state} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        <button type="button" className="btn btn--ink" onClick={() => dispatch({ type: 'TAKE_NEXT_GAME' })}>
          {t(lang, 'advance.take')}
        </button>
        <button type="button" className="btn btn--outline" onClick={() => dispatch({ type: 'RUN_TO_PLAYOFFS' })}>
          {t(lang, 'advance.run')}
        </button>
      </div>
    </div>
  )
}
