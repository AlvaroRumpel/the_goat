import type { Dispatch } from 'react'
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
          <div className="mono-label">{t(lang, 'result.honors')}</div>
          <div className="result__honors">
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
