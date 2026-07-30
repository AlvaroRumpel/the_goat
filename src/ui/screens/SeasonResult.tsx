import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import type { RaceAward } from '../../engine/types'
import { CareerBar } from '../components/CareerBar'
import { StandingsTop4, RaceBars, TrajectoryBars } from '../components/LeaguePanels'
import { StatLine } from '../components/StatLine'
import { resultScoreText } from './Game'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const BAD_EVENTS = new Set(['injury', 'coldstreak', 'lockerroom'])
const HIGHLIGHT_AWARDS = new Set(['ring', 'fmvp', 'mvp'])
const RACE_AWARDS: RaceAward[] = ['mvp', 'dpoy', 'roy', 'mip']

export function SeasonResult({ state, dispatch }: Props) {
  const lang = state.lang
  const season = state.career.seasons.at(-1)!
  const outcome = state.seasonOutcome!
  const year = 2026 + state.career.seasons.length
  const championTeam = teamById(outcome.championTeamId)
  const [view, setView] = useState<'ceremony' | 'balance'>('ceremony')
  const mvpId = outcome.winners.mvp
  const mvpName = mvpId === 'you' ? t(lang, 'races.you') : mvpId ? state.league!.players.find(p => p.id === mvpId)?.name ?? '—' : '—'
  const mvpLine = mvpId === 'you'
    ? { ppg: season.ppg, rpg: season.rpg, apg: season.apg }
    : outcome.lines.find(l => l.playerId === mvpId) ?? { ppg: 0, rpg: 0, apg: 0 }

  const nameOf = (award: RaceAward): string => {
    const id = outcome.winners[award]
    if (!id) return '—'
    if (id === 'you') return t(lang, 'races.you')
    return state.league!.players.find(p => p.id === id)?.name ?? '—'
  }

  const highlightAwards = season.awards.filter(a => HIGHLIGHT_AWARDS.has(a))
  const playerConf = outcome.standings.find(s => s.teamId === season.finalTeamId)?.conf
  const bannerBits = [
    highlightAwards.length > 0 ? highlightAwards.map(a => t(lang, 'award.' + a)).join(' + ') : null,
    season.playoffRun !== 'missed' && season.seed != null && playerConf
      ? t(lang, 'result.confPos', { seed: season.seed, conf: t(lang, 'standings.' + playerConf) })
      : null,
  ].filter(Boolean)

  if (view === 'ceremony') {
    return (
      <div className="screen">
        <CareerBar state={state} dispatch={dispatch} heavy />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center', flex: 1, justifyContent: 'center' }}>
          <div className="mono-label">{t(lang, 'ceremony.title')} · {year}</div>
          <hr className="rule--double" style={{ width: '100%' }} />
          <div className="mono-label mono-label--red">{t(lang, 'ceremony.mvpLabel')}</div>
          <div className="mono-ring" style={{ width: 64, height: 64, fontSize: 20 }}>{mvpName.slice(0, 2).toUpperCase()}</div>
          <div className="headline headline--red" style={{ fontSize: 34 }}>{mvpName}</div>
          <div className="mono">{t(lang, 'ceremony.line', { ppg: mvpLine.ppg, rpg: mvpLine.rpg, apg: mvpLine.apg })}</div>
          <hr className="rule--double" style={{ width: '100%' }} />

          <div className="mono-label">{t(lang, 'result.honors')}</div>
          <div className="result__honors" style={{ width: '100%' }}>
            <div className="result__honor-row">
              <span>{t(lang, 'result.champion')}</span>
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>{championTeam.city} {championTeam.name}</span>
            </div>
            {RACE_AWARDS.map(award => (
              <div key={award} className="result__honor-row">
                <span className="hint">{t(lang, 'award.' + award)}</span>
                <span>{nameOf(award)}</span>
              </div>
            ))}
          </div>

          <div className="strip strip--red" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="mono-label" style={{ color: 'var(--on-red-dim)' }}>{t(lang, 'ceremony.campaignLabel')}</span>
            <span className="headline" style={{ fontSize: 17 }}>{t(lang, 'run.' + season.playoffRun)}</span>
          </div>
        </div>
        <button type="button" className="btn btn--ink" onClick={() => setView('balance')}>
          {t(lang, 'ceremony.viewBalance')}
        </button>
      </div>
    )
  }

  return (
    <div className="screen">
      <CareerBar state={state} dispatch={dispatch} heavy />
      <div className="result">
        <div className="strip strip--red result__banner">
          <div className="headline result__banner-title">{t(lang, 'run.' + season.playoffRun)}</div>
          {bannerBits.length > 0 && <div className="mono result__banner-meta">{bannerBits.join(' · ')}</div>}
        </div>

        <div className="result__left">
          <hr className="rule" />
          <div className="result__stats">
            <StatLine value={String(season.ppg)} label={t(lang, 'stat.pts')} />
            <StatLine value={String(season.rpg)} label={t(lang, 'stat.reb')} />
            <StatLine value={String(season.apg)} label={t(lang, 'stat.ast')} />
            <StatLine value={String(season.games)} label={t(lang, 'result.games')} />
          </div>
          <hr className="rule" />

          <div className="mono-label">{t(lang, 'result.lines')}</div>
          {season.events.length > 0 && (
            <div className="result__evlist">
              {season.events.map(ev => (
                <div key={ev} className={BAD_EVENTS.has(ev) ? 'evline evline--bad' : 'evline'}>
                  {t(lang, 'event.' + ev)}
                </div>
              ))}
            </div>
          )}

          {state.keyGameResults.length > 0 && (
            <>
              <div className="mono-label">{t(lang, 'result.lived')}</div>
              <div className="result__keygames">
                {state.keyGameResults.map((r, i) => (
                  <div key={i} className="result__keygame-row">
                    <span style={{ fontWeight: 700, color: r.won ? undefined : 'var(--red)' }}>
                      {t(lang, r.won ? 'keygames.win' : 'keygames.loss')} · {resultScoreText(r)}
                    </span>
                    <span className="mono">{r.playerPts} {t(lang, 'stat.pts')}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {season.iconicMoments.length > 0 && (
            <div className="result__chips">
              {season.iconicMoments.map((id, i) => <span key={i} className="chip">{t(lang, 'iconic.' + id)}</span>)}
            </div>
          )}
        </div>

        <div className="result__right">
          <div className="mono-label">{t(lang, 'result.leagueTrajectory')}</div>
          <StandingsTop4 standings={outcome.standings} playerTeamId={season.finalTeamId} lang={lang} />
          <RaceBars races={outcome.races} lang={lang} />
          <TrajectoryBars state={state} />
        </div>

        <div className="result__footer">
          <button type="button" className="btn btn--ink" onClick={() => dispatch({ type: 'ADVANCE' })}>
            {t(lang, 'result.advance', { year })}
          </button>
          <button type="button" className="btn btn--outline result__view-career" onClick={() => dispatch({ type: 'OPEN_HUB' })}>
            {t(lang, 'result.viewCareer')}
          </button>
        </div>
      </div>
    </div>
  )
}
