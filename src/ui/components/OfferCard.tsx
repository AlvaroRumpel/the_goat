import { t, type Lang } from '../../i18n'
import type { Team, TeamProfile } from '../../engine/types'
import { Crest } from './Crest'

interface Props {
  team: Team
  profile: TeamProfile
  lang: Lang
  featured: boolean
  onClick: () => void
  terms?: string
  padding?: string
}

export function OfferCard({ team, profile, lang, featured, onClick, terms, padding = '20px 16px' }: Props) {
  const dim = featured ? 'var(--on-red-dim)' : 'var(--dim)'
  return (
    <button
      type="button"
      className={featured ? 'strip--red' : undefined}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding,
        textAlign: 'left',
        border: featured ? 'none' : '1px solid var(--rule)',
        color: featured ? 'var(--on-red)' : 'var(--ink)',
      }}
    >
      <Crest teamId={team.id} size={34} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div className="headline" style={{ fontSize: 17, color: featured ? 'var(--on-red)' : 'var(--ink)' }}>
          {team.city} {team.name}
        </div>
        <div className="mono-label" style={{ color: dim }}>{t(lang, 'profile.chip.' + profile)}</div>
        <div style={{ fontSize: 12, color: featured ? 'var(--on-red)' : 'var(--ink)' }}>
          {t(lang, 'profile.promise.' + profile)}
        </div>
        {terms && <div className="mono-label" style={{ color: dim }}>{terms}</div>}
      </div>
    </button>
  )
}
