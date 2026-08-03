import { t, type Lang } from '../../i18n'
import { effectiveOverall } from '../../engine/season'
import type { AwardRace, TeamStanding } from '../../engine/types'
import type { GameState } from '../../state'

export function sortStandings(entries: TeamStanding[]): TeamStanding[] {
  return [...entries].sort((a, b) => b.wins - a.wins || a.teamId.localeCompare(b.teamId))
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
      <span style={{ fontWeight: isPlayer ? 700 : 400, color: isPlayer ? 'var(--red)' : undefined }}>
        {entry.seed ?? '–'} · {entry.teamId.toUpperCase()}
      </span>
      <span className={isPlayer ? undefined : 'hint'} style={{ fontWeight: isPlayer ? 700 : 400, color: isPlayer ? 'var(--red)' : undefined }}>
        {wins}-{losses}
      </span>
    </div>
  )
}

export function StandingsTable(props: { standings: TeamStanding[]; playerTeamId: string; lang: Lang; scale?: number }) {
  const { standings, playerTeamId, lang, scale = 1 } = props
  const byConf = (conf: 'east' | 'west') => sortStandings(standings.filter(s => s.conf === conf))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {scale < 1 && <div className="hint">{t(lang, 'standings.partial')}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {(['east', 'west'] as const).map(conf => (
          <div key={conf} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="mono-label">{t(lang, `standings.${conf}`)}</div>
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
        <div key={race.award} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--rule)' }}>
          <div className="mono-label mono-label--red">{t(lang, 'award.' + race.award)}</div>
          {race.top.map((entry, i) => {
            const isYou = entry.id === 'you'
            return (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontWeight: isYou ? 700 : 400, color: isYou ? 'var(--red)' : undefined }}>
                  {i + 1}. {isYou ? t(lang, 'races.you') : entry.name}
                </span>
                <span className={isYou ? undefined : 'hint'} style={{ fontWeight: isYou ? 700 : 400, color: isYou ? 'var(--red)' : undefined }}>
                  {entry.value.toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// standings condensada (decisão 1 do DECISOES-C1.md): top-4 por conferência + a linha
// do jogador se ele estiver fora do top-4.
export function StandingsTop4(props: { standings: TeamStanding[]; playerTeamId: string; lang: Lang }) {
  const { standings, playerTeamId, lang } = props
  const byConf = (conf: 'east' | 'west') => sortStandings(standings.filter(s => s.conf === conf))

  return (
    <div className="result__standings">
      {(['east', 'west'] as const).map(conf => {
        const rows = byConf(conf)
        const top4 = rows.slice(0, 4)
        const playerRow = rows.find(r => r.teamId === playerTeamId)
        const playerOutside = playerRow && !top4.includes(playerRow)
        return (
          <div key={conf} className="result__standings-col">
            <div className="mono-label">{t(lang, `standings.${conf}`)}</div>
            {[...top4, ...(playerOutside ? [playerRow] : [])].map(entry => (
              <div
                key={entry.teamId}
                className={entry.teamId === playerTeamId ? 'result__standings-row result__standings-row--you' : 'result__standings-row'}
              >
                <span>{entry.seed ?? '–'} · {entry.teamId.toUpperCase()}</span>
                <span className={entry.teamId === playerTeamId ? 'mono' : 'mono hint'} style={entry.teamId === playerTeamId ? { color: 'var(--red)', fontWeight: 700 } : undefined}>
                  {entry.wins}-{82 - entry.wins}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// corrida de prêmios condensada: uma barra por award, líder cheio + 2º normalizado.
export function RaceBars(props: { races: AwardRace[]; lang: Lang }) {
  const { races, lang } = props
  return (
    <div className="result__races">
      {races.map(race => {
        const [leader, runnerUp] = race.top
        const runnerPct = leader && runnerUp && leader.value > 0 ? Math.round((runnerUp.value / leader.value) * 100) : 0
        return (
          <div key={race.award} className="result__race">
            <div className="mono-label">
              {t(lang, 'award.' + race.award)} — {leader ? (leader.id === 'you' ? t(lang, 'races.you') : leader.name) : t(lang, 'races.none')}
            </div>
            {leader && (
              <div className="bar"><div className="bar__fill" style={{ width: '100%' }} /></div>
            )}
            {runnerUp && (
              <div className="bar"><div className="bar__fill bar__fill--dim" style={{ width: `${runnerPct}%` }} /></div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// trajetória de overall efetivo das últimas até-9 temporadas, mesma leitura do Hub.
export function TrajectoryBars({ state }: { state: GameState }) {
  const { build } = state
  if (!build) return null
  const bars = state.career.seasons.slice(-9).map(s => effectiveOverall(build.overall, s.age, build.attributes.physical))
  return (
    <div className="hub__traj-bars">
      {bars.map((eov, i, arr) => {
        const h = Math.max(4, Math.round(((eov - 40) / (99 - 40)) * 64))
        return (
          <div key={i} className={i === arr.length - 1 ? 'hub__traj-bar hub__traj-bar--last' : 'hub__traj-bar'} style={{ height: h }} />
        )
      })}
    </div>
  )
}
