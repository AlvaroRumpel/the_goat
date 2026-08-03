import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { effectiveOverall } from '../../engine/season'
import { teamById } from '../../data/teams'
import { SLOT_ORDER, type Award } from '../../engine/types'
import { StandingsTable } from '../components/LeaguePanels'
import { Crest } from '../components/Crest'
import { Icon } from '../components/Icon'
import { AdSlot } from '../components/AdSlot'

interface Props { state: GameState; dispatch: Dispatch<Action> }

// ordem fixa pedida pela task 5 (não é a mesma do veredito)
const TROPHY_AWARDS: Award[] = ['ring', 'mvp', 'fmvp', 'allstar', 'scoring', 'dpoy', 'roy', 'mip']

export function Hub({ state, dispatch }: Props) {
  const { lang, career, build, age, currentOffer, contractYearsLeft, seasonOutcome } = state
  const seasons = career.seasons
  const teamId = currentOffer?.teamId
  const team = teamId ? teamById(teamId) : null
  const rings = seasons.filter(s => s.awards.includes('ring')).length

  const counts = Object.fromEntries(TROPHY_AWARDS.map(a => [a, 0])) as Record<Award, number>
  for (const s of seasons) for (const a of s.awards) counts[a]++

  const iconics = seasons.flatMap((s, i) => s.iconicMoments.map(id => ({ year: 2026 + i, id })))

  const ovr = build ? effectiveOverall(build.overall, age, build.attributes.physical) : 0
  const last9 = seasons.slice(-9).map((s, i, arr) => ({
    eov: build ? effectiveOverall(build.overall, s.age, build.attributes.physical) : 0,
    isLast: i === arr.length - 1,
  }))

  return (
    <div className="hub">
      <div className="screen hub__inner">
        <header className="hub__header">
          <span className="headline" style={{ fontSize: 22 }}>{t(lang, 'hub.title')}</span>
          <button type="button" className="topbar__link" onClick={() => dispatch({ type: 'CLOSE_HUB' })}>
            {t(lang, 'hub.close')}
          </button>
        </header>

        <div className="hub__grid">
          {/* status */}
          <section className="hub__status" style={{ gridArea: 'status' }}>
            {teamId && (
              <span className="mono-label">
                {t(lang, 'bar.meta', { n: seasons.length + 1, age, team: teamId.toUpperCase() })}
              </span>
            )}
            {team && (
              <span className="headline headline--red" style={{ fontSize: 22 }}>
                {team.city} {team.name}
              </span>
            )}
            {rings > 0 && (
              <div className="hub__rings">
                {Array.from({ length: rings }).map((_, i) => <Icon key={i} name="ring" tone="red" size={16} />)}
              </div>
            )}
          </section>

          {/* tabela de temporadas */}
          <section className="hub__table" style={{ gridArea: 'table' }}>
            <div className="mono-label">{t(lang, 'hub.seasons')}</div>
            <div className="hub__row hub__row--head">
              <span className="hub__cell">{t(lang, 'hub.col.year')}</span>
              <span className="hub__cell">{t(lang, 'hub.col.team')}</span>
              <span className="hub__cell">{t(lang, 'hub.col.ppg')}</span>
              <span className="hub__cell hub__cell--wide">{t(lang, 'hub.col.rpg')}</span>
              <span className="hub__cell hub__cell--wide">{t(lang, 'hub.col.apg')}</span>
              <span className="hub__cell">{t(lang, 'hub.col.outcome')}</span>
              <span className="hub__cell hub__cell--wide">{t(lang, 'hub.col.honors')}</span>
            </div>
            {seasons.length === 0 && (
              <>
                <hr className="rule--soft" />
                <div className="mono-label">{t(lang, 'hub.empty')}</div>
              </>
            )}
            {seasons.map((s, i) => (
              <div key={i}>
                <hr className="rule--soft" />
                <div className="hub__row">
                  <span className="hub__cell mono">{2026 + i}</span>
                  <span className="hub__cell mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Crest teamId={s.finalTeamId} size={16} />
                    {s.finalTeamId.toUpperCase()}
                  </span>
                  <span className="hub__cell mono">{s.ppg.toFixed(1)}</span>
                  <span className="hub__cell hub__cell--wide mono">{s.rpg.toFixed(1)}</span>
                  <span className="hub__cell hub__cell--wide mono">{s.apg.toFixed(1)}</span>
                  <span className="hub__cell mono">{t(lang, 'run.' + s.playoffRun)}</span>
                  <span className="hub__cell hub__cell--wide mono">
                    {s.awards.map(a => t(lang, 'award.' + a)).join(' · ')}
                  </span>
                </div>
              </div>
            ))}
          </section>

          {/* atributos + monograma/arquétipo/trajetória (desktop) */}
          <section className="hub__profile" style={{ gridArea: 'profile' }}>
            {build && (
              <>
                <div className="hub__monogram-block">
                  <div className="mono-ring hub__monogram">{build.archetype}</div>
                  <span className="mono-label mono-label--red">{t(lang, 'archetype.name.' + build.archetype)}</span>
                </div>
                <div className="mono-label">{t(lang, 'hub.attrs', { n: ovr })}</div>
                <div className="hub__bars">
                  {SLOT_ORDER.map(slot => {
                    const val = build.attributes[slot]
                    const low = val < 70
                    return (
                      <div key={slot} className="hub__bar-row">
                        <span className="mono-label" style={{ fontSize: 11 }}>{t(lang, 'slot.' + slot)}</span>
                        <div className="bar">
                          <div className={low ? 'bar__fill bar__fill--bad' : 'bar__fill'} style={{ width: `${val}%` }} />
                        </div>
                        <span className="mono">{val}</span>
                      </div>
                    )
                  })}
                </div>
                {last9.length > 0 && (
                  <div className="hub__trajectory">
                    <div className="mono-label">{t(lang, 'hub.trajectory')}</div>
                    <div className="hub__traj-bars">
                      {last9.map((s, i) => {
                        const h = Math.max(4, Math.round(((s.eov - 40) / (99 - 40)) * 64))
                        return (
                          <div
                            key={i}
                            className={s.isLast ? 'hub__traj-bar hub__traj-bar--last' : 'hub__traj-bar'}
                            style={{ height: h }}
                          />
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="mono-label hub__scrollhint" style={{ textAlign: 'center' }}>
            {t(lang, 'hub.scrollHint')}
          </div>

          {/* troféus */}
          <section className="hub__trophies" style={{ gridArea: 'trophies' }}>
            <div className="mono-label">{t(lang, 'hub.trophies')}</div>
            <div className="hub__trophy-list">
              {TROPHY_AWARDS.map(a => (
                <div key={a} className={a === 'ring' && counts[a] > 0 ? 'hub__trophy-row strip--red' : 'hub__trophy-row'}>
                  <span className="mono-label" style={a === 'ring' && counts[a] > 0 ? { color: 'inherit' } : undefined}>
                    {t(lang, 'award.' + a)}
                  </span>
                  <span className="headline" style={{ fontSize: 18 }}>{counts[a]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* momentos icônicos */}
          {iconics.length > 0 && (
            <section className="hub__moments" style={{ gridArea: 'iconics' }}>
              <div className="mono-label">{t(lang, 'hub.moments')}</div>
              {iconics.map((m, i) => (
                <div key={i} className="hub__moment-row">
                  <span className="mono" style={{ color: 'var(--red)' }}>{m.year}</span>
                  <span>{t(lang, 'iconic.' + m.id)}</span>
                </div>
              ))}
            </section>
          )}

          {/* liga */}
          {seasonOutcome?.standings && teamId && (
            <section className="hub__league" style={{ gridArea: 'league' }}>
              <div className="mono-label">{t(lang, 'hub.league')}</div>
              <StandingsTable standings={seasonOutcome.standings} playerTeamId={teamId} lang={lang} />
            </section>
          )}

          {/* contrato/fama */}
          <section className="hub__contract" style={{ gridArea: 'contract' }}>
            <div className="mono-label">{t(lang, 'hub.contract', { n: contractYearsLeft })}</div>
            <div className="mono-label">{t(lang, 'hub.fame', { n: career.fame })}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
              <span className="mono-label">{t(lang, 'settings.timePressure')}</span>
              <button
                type="button"
                className={`chip${state.timePressure ? ' chip--on' : ''}`}
                onClick={() => dispatch({ type: 'TOGGLE_TIME_PRESSURE' })}
              >
                {t(lang, state.timePressure ? 'settings.on' : 'settings.off')}
              </button>
            </div>
          </section>
          <AdSlot slot="pause" />
        </div>
      </div>
    </div>
  )
}
