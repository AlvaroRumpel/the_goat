import { t, type Lang } from '../../i18n'
import type { Legend } from '../../engine/types'

interface Props {
  legend: Legend
  lang: Lang
  variant: 'gold' | 'plain'
  onClick: () => void
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function LegendCard({ legend, lang, variant, onClick }: Props) {
  const gold = variant === 'gold'
  return (
    <div
      className={gold ? 'card card--gold' : 'card'}
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <div className={gold ? 'mono-ring' : 'mono-ring mono-ring--dim'}>{initials(legend.name)}</div>
      <div className="display" style={{ fontSize: 20 }}>{legend.name}</div>
      <div className="hint">{t(lang, 'draft.signature', { slot: t(lang, 'slot.' + legend.slot) })}</div>
      <div style={{ color: 'var(--danger)', fontSize: 12 }}>
        {t(lang, 'draft.malus', { slot: t(lang, 'slot.' + legend.malusSlot), n: legend.malus })}
      </div>
      <div className={gold ? 'display goldtext' : 'display'} style={{ fontSize: 64 }}>{legend.value}</div>
      <button type="button" className={gold ? 'btn btn--gold' : 'btn'} style={{ width: '100%' }} onClick={onClick}>
        {t(lang, 'draft.steal')}
      </button>
    </div>
  )
}
