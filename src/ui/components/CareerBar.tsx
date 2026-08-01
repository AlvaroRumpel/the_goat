import type { Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { shortName } from '../format'

interface Props { state: GameState; dispatch: Dispatch<Action>; heavy?: boolean }

// Barra de carreira — todas as telas de preseason em diante (spec §2).
// Pré-carreira (home/attrDraft/draftDone/nbaDraft) não renderiza isto.
export function CareerBar({ state, dispatch, heavy }: Props) {
  const lang = state.lang
  const teamId = state.currentOffer?.teamId
  if (!teamId) return null
  const { career } = state
  const rings = career.seasons.filter(s => s.awards.includes('ring')).length
  const n = career.seasons.length + 1
  const team = teamId.toUpperCase()
  const meta = career.name
    ? t(lang, 'bar.metaId', { name: shortName(career), number: career.number ?? '—', n, team })
    : t(lang, 'bar.meta', { n, age: state.age, team })
  const full = meta + (rings > 0 ? t(lang, 'bar.rings', { n: rings }) : '')
  return (
    <div className={heavy ? 'topbar topbar--heavy' : 'topbar'}>
      <span className="topbar__meta">{full}</span>
      <button type="button" className="topbar__link" onClick={() => dispatch({ type: 'OPEN_HUB' })}>
        {t(lang, 'bar.open')}
      </button>
    </div>
  )
}
