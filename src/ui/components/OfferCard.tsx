import { t, type Lang } from '../../i18n'
import type { Team, TeamProfile } from '../../engine/types'

interface Props {
  team: Team
  profile: TeamProfile
  lang: Lang
  featured: boolean
  onClick: () => void
}

export function OfferCard({ team, profile, lang, featured, onClick }: Props) {
  const desc = t(lang, 'profile.' + profile)
  const chipLabel = desc.split(' — ')[0]
  return (
    <button
      type="button"
      className={featured ? 'card card--gold' : 'card'}
      style={{
        padding: 20,
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      onClick={onClick}
    >
      <span className={featured ? 'chip' : 'chip chip--dim'}>{chipLabel}</span>
      <span className="display" style={{ fontSize: 22 }}>{team.city} {team.name}</span>
      <span className="hint" style={{ textAlign: 'left' }}>{desc}</span>
    </button>
  )
}
