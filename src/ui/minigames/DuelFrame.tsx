import type { JSX, ReactNode } from 'react'
import { t } from '../../i18n'
import type { DuelState } from '../../engine/minigames/defense'
import { clamp01, GLYPH, type DuelFlow } from './defenseFlow'

const END_KEY: Record<DuelState['phase'], string> = {
  live: 'clock', done: 'pass', steal: 'steal', block: 'block', shot: 'shot',
  drive: 'drive', foul: 'foul', clock: 'clock',
}

// Moldura comum: palco (a cena entra como `children`), cartão de tendências, relógio,
// contenção, dicas de gesto, grito do desfecho e o overlay de resultado.
export function DuelFrame({ flow, children, footer }: { flow: DuelFlow; children: ReactNode; footer?: ReactNode }): JSX.Element {
  const { S, phase, showResult, star, tend } = flow
  const { lang, outcome } = flow.props
  const pct = (n: number) => Math.round(n * 100) + '%'
  const sideLabel = t(lang, 'mg.def.side.' + tend.side)
  const contain = S.live > 0 ? clamp01(S.contain / S.live) : 0
  // roubo/toco que o engine reprovou vira apito do juiz (a animação obedece o desfecho)
  const whistle = outcome ? !outcome.success && (S.phase === 'steal' || S.phase === 'block') : false
  const endKey = whistle ? 'foul' : END_KEY[S.phase]
  const made = S.freeThrows ? S.freeThrows.filter(Boolean).length : 0

  const card = (big: boolean) => (
    <div className={'mg-df-card' + (big ? ' mg-df-card--big' : '')}>
      <span className="mg-df-card__name">{star.short} · {star.pos} · {star.ovr}</span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.shoot')}</span><b>{pct(tend.shoot)}</b></span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.drive', { side: sideLabel })}</span><b>{pct(tend.drive)}</b></span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.pass')}</span><b>{pct(tend.pass)}</b></span>
      <span className="mg-df-card__line mg-df-card__last">
        <span>{t(lang, 'mg.def.last')}</span>
        <b>{S.log.length ? S.log.slice(-4).map(m => GLYPH[m]).join(' ') : '—'}</b>
      </span>
    </div>
  )

  return (
    <div className="mg mg-defense">
      <div className="mg-df-stage" ref={flow.stageRef}>
        {children}
        <div className="mg-df-hud">
          <div className="mg-df-top">
            {phase === 'card' ? <span /> : card(false)}
            <div className="mg-df-right">
              <span className="mg-df-clock">{t(lang, 'mg.clock')}<b>{Math.max(0, Math.ceil(S.clock))}</b></span>
              <span className="mg-df-contain">
                {t(lang, 'mg.def.contain')}
                <span className="mg-df-contain__track"><span className="mg-df-contain__fill" style={{ width: pct(contain) }} /></span>
              </span>
            </div>
          </div>
          {phase === 'live' && (
            <div className="mg-df-gest">
              <span>{t(lang, 'mg.def.gest.slide')}</span>
              <span>{t(lang, 'mg.def.gest.tap')}</span>
              <span>{t(lang, 'mg.def.gest.up')}</span>
            </div>
          )}
        </div>
        {phase === 'card' && (
          <div className="mg-df-intro">
            <span className="mono-label mono-label--red">{t(lang, 'mg.def.card.title')}</span>
            {card(true)}
            <span className="mg-df-ready">{t(lang, 'mg.def.ready')}</span>
          </div>
        )}
        {phase === 'end' && (
          <div className="mg-df-shout">
            {t(lang, 'mg.def.end.' + endKey)}
            {S.fouled && <small>{t(lang, 'mg.def.ft', { made })}</small>}
            {S.bitFake && !S.fouled && <small>{t(lang, 'mg.def.bitFake')}</small>}
          </div>
        )}
        {showResult && outcome && (
          <div className={'mg-result' + (outcome.success ? '' : ' mg-result--bad')}>
            <span>{t(lang, outcome.success ? 'mg.result.stop' : 'mg.result.scored')}</span>
            <span className="mg-result__sub">
              {outcome.success ? t(lang, 'option.' + S.result!.optionId) : t(lang, 'mg.def.end.' + endKey)}
            </span>
            {S.bitFake && <span className="mg-result__sub">{t(lang, 'mg.def.bitFake')}</span>}
          </div>
        )}
      </div>
      {footer}
    </div>
  )
}
