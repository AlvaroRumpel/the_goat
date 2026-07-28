import type { Dispatch } from 'react'
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

  return (
    <div className="screen">
      <div className="screen__glow" />
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
        <div className="kicker">{t(lang, 'nbadraft.title')}</div>
        <div className="display goldtext" style={{ fontSize: 52 }}>
          {t(lang, 'nbadraft.picked', { n: state.pickNumber ?? 0 })}
        </div>
        <hr className="rule" />
        <div className="hint">{t(lang, 'nbadraft.choose')}</div>

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
      </div>
    </div>
  )
}
