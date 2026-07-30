import { useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import { OfferCard } from '../components/OfferCard'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

export function NbaDraft({ state, dispatch }: Props) {
  const lang = state.lang
  const [selected, setSelected] = useState(0)
  const offer = state.offers[selected]
  const team = teamById(offer.teamId)

  return (
    <div className="screen">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="mono-label">{t(lang, 'nbadraft.called')}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div className="headline headline--red" style={{ fontSize: 72 }}>
            {t(lang, 'nbadraft.pickOrd', { n: state.pickNumber ?? 0 })}
          </div>
          <div className="headline" style={{ fontSize: 22 }}>{t(lang, 'nbadraft.pick')}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {state.offers.map((o, i) => (
            <OfferCard
              key={o.teamId}
              team={teamById(o.teamId)}
              profile={o.profile}
              lang={lang}
              featured={i === selected}
              onClick={() => setSelected(i)}
            />
          ))}
        </div>

        <button type="button" className="btn btn--ink" onClick={() => dispatch({ type: 'CHOOSE_OFFER', offer })}>
          {t(lang, 'nbadraft.sign', { team: `${team.city} ${team.name}` })}
        </button>
        <div className="mono-label" style={{ textAlign: 'center' }}>{t(lang, 'nbadraft.contractNote')}</div>
      </div>
    </div>
  )
}
