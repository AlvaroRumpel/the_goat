import { t, type Lang } from '../../i18n'
import { effectiveOverall } from '../../engine/season'
import { teamById } from '../../data/teams'
import type { AwardRace, LeagueSeasonOutcome, LeagueState, RaceAward, TeamStanding } from '../../engine/types'
import type { GameState } from '../../state'
import { StatLine } from './StatLine'

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 240, h = 48
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke="var(--gold, #c9a227)" strokeWidth="2" />
    </svg>
  )
}

function StandingsRow({ entry, isPlayer, scale }: { entry: TeamStanding; isPlayer: boolean; scale: number }) {
  const wins = Math.round(entry.wins * scale)
  const losses = Math.round((82 - entry.wins) * scale)
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        padding: '5px 0', fontSize: 13,
      }}
    >
      <span className={isPlayer ? 'goldtext' : undefined} style={{ fontWeight: isPlayer ? 700 : 400 }}>
        {entry.seed ?? '–'} · {entry.teamId.toUpperCase()}
      </span>
      <span className={isPlayer ? 'goldtext' : 'hint'} style={{ fontWeight: isPlayer ? 700 : 400 }}>
        {wins}-{losses}
      </span>
    </div>
  )
}

export function StandingsTable(props: { standings: TeamStanding[]; playerTeamId: string; lang: Lang; scale?: number }) {
  const { standings, playerTeamId, lang, scale = 1 } = props
  const byConf = (conf: 'east' | 'west') =>
    standings.filter(s => s.conf === conf).sort((a, b) => b.wins - a.wins)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {scale < 1 && <div className="hint">{t(lang, 'standings.partial')}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {(['east', 'west'] as const).map(conf => (
          <div key={conf} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="kicker">{t(lang, `standings.${conf}`)}</div>
            {byConf(conf).map(entry => (
              <StandingsRow key={entry.teamId} entry={entry} isPlayer={entry.teamId === playerTeamId} scale={scale} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RacesPanel(props: { races: AwardRace[]; lang: Lang; scale?: number }) {
  const { races, lang, scale = 1 } = props
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {scale < 1 && <div className="hint">{t(lang, 'races.partial')}</div>}
      {races.map(race => (
        <div key={race.award} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="kicker kicker--gold">{t(lang, 'award.' + race.award)}</div>
          {race.top.map((entry, i) => {
            const isYou = entry.id === 'you'
            return (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className={isYou ? 'goldtext' : undefined} style={{ fontWeight: isYou ? 700 : 400 }}>
                  {i + 1}. {isYou ? t(lang, 'races.you') : entry.name}
                </span>
                <span className={isYou ? 'goldtext' : 'hint'} style={{ fontWeight: isYou ? 700 : 400 }}>
                  {(entry.value * scale).toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const RACE_AWARDS: RaceAward[] = ['mvp', 'dpoy', 'roy', 'mip']

export function CeremonyPanel(props: { outcome: LeagueSeasonOutcome; league: LeagueState; lang: Lang }) {
  const { outcome, league, lang } = props
  const { winners, championTeamId, playerRun } = outcome
  const team = teamById(championTeamId)

  const nameOf = (award: RaceAward): string => {
    const id = winners[award]
    if (!id) return '—'
    if (id === 'you') return t(lang, 'races.you')
    return league.players.find(p => p.id === id)?.name ?? '—'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="kicker kicker--gold">{t(lang, 'ceremony.title')}</div>
      <div className="banner" style={{ padding: 16, textAlign: 'center' }}>
        <span className="display goldtext" style={{ fontSize: 18 }}>
          {t(lang, 'ceremony.champion', { team: `${team.city} ${team.name}` })}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {RACE_AWARDS.map(award => (
          <div key={award} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="hint">{t(lang, 'award.' + award)}</span>
            <span>{nameOf(award)}</span>
          </div>
        ))}
      </div>
      <div className="hint" style={{ textAlign: 'center' }}>{t(lang, 'run.' + playerRun)}</div>
    </div>
  )
}

export function PlayerPanel({ state }: { state: GameState }) {
  const { lang, build, age, career } = state
  if (!build) return null
  const ovr = effectiveOverall(build.overall, age, build.attributes.physical)
  const curve = career.seasons.map(s => effectiveOverall(build.overall, s.age, build.attributes.physical))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center' }}>
        <StatLine value={String(ovr)} label={t(lang, 'you.ovr')} />
        <StatLine value={String(build.overall)} label={t(lang, 'you.ovrBase')} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div className="kicker">{t(lang, 'you.curve')}</div>
        <Sparkline values={curve} />
      </div>
    </div>
  )
}
