import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'

interface Props { state: GameState; dispatch: Dispatch<Action>; heavy?: boolean }

// Barra de carreira — todas as telas de preseason em diante (spec §2).
// Pré-carreira (home/attrDraft/draftDone/nbaDraft) não renderiza isto.
export function CareerBar({ state, dispatch, heavy }: Props) {
  const lang = state.lang
  const teamId = state.currentOffer?.teamId
  if (!teamId) return null
  const rings = state.career.seasons.filter(s => s.awards.includes('ring')).length
  const meta =
    t(lang, 'bar.meta', { n: state.career.seasons.length + 1, age: state.age, team: teamId.toUpperCase() }) +
    (rings > 0 ? t(lang, 'bar.rings', { n: rings }) : '')
  return (
    <div className={heavy ? 'topbar topbar--heavy' : 'topbar'}>
      <span className="topbar__meta">{meta}</span>
      <button type="button" className="topbar__link" onClick={() => dispatch({ type: 'OPEN_HUB' })}>
        {t(lang, 'bar.open')}
      </button>
    </div>
  )
}
