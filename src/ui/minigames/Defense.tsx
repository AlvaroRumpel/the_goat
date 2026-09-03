import type { JSX } from 'react'
import type { MinigameProps } from './types'
import { t } from '../../i18n'
import { CONE_HALF, inFront, type DuelState } from '../../engine/minigames/defense'
import { COURT } from '../../engine/minigames/playbook'
import type { Gesture } from './useSwipe'
import { clamp01, GLYPH, MOVES, useDuelFlow, type DuelFlow } from './defenseFlow'
import { COURT_LAYERS, D, MAG_FILTER, S, W } from './Court'

// MURALHA 2D (spec 2026-09-03 §C): meia-quadra da prancheta vista de cima, cesta no topo.
// Ele (ímã preto) desce em direção à cesta; você (ímã vermelho) fica entre os dois. Cone de
// contenção aceso = `inFront`. Bola acesa e maior enquanto exposta. Botões grandes + setas/
// Espaço/↑ + swipe no palco. O engine (defense.ts) é a verdade; o desfecho OBEDECE `outcome`.

const END_KEY: Record<DuelState['phase'], string> = {
  live: 'clock', done: 'pass', steal: 'steal', block: 'block', shot: 'shot', drive: 'drive', foul: 'foul', clock: 'clock',
}
const R_YOU = 56, R_HIM = 52
// gesto · glifo da tecla · rótulo
const KEYS: Array<[Gesture, string, string]> = [
  ['left', 'mg.def.key.left', 'mg.def.left'], ['tap', 'mg.def.key.down', 'mg.def.steal'],
  ['up', 'mg.def.key.up', 'mg.def.arm'], ['right', 'mg.def.key.right', 'mg.def.right'],
]
const at = (p: { x: number; y: number }) => ({ transform: `translate(${p.x}px, ${p.y}px)` })

export function DefenseGame(props: MinigameProps): JSX.Element {
  const flow = useDuelFlow(props)
  const { S: st, phase, showResult, star, tend } = flow
  const { lang, outcome, number } = props
  const pct = (n: number) => Math.round(n * 100) + '%'
  const contain = st.live > 0 ? clamp01(st.contain / st.live) : 0
  const whistle = outcome ? !outcome.success && (st.phase === 'steal' || st.phase === 'block') : false
  const endKey = whistle ? 'foul' : END_KEY[st.phase]
  const made = st.freeThrows ? st.freeThrows.filter(Boolean).length : 0

  // metros → viewBox: ele a attDist da cesta, você a meio caminho (mín. 1.6 m da cesta)
  const him = { x: (COURT.basket.x + st.attX) * S, y: (COURT.basket.y + st.attDist) * S }
  const you = { x: (COURT.basket.x + st.defX) * S, y: (COURT.basket.y + Math.max(1.6, 1.6 + (st.attDist - 1.2) * 0.5)) * S }
  const cover = inFront(st)
  const stolen = phase === 'end' && st.phase === 'steal' && (outcome?.success ?? true)
  const ball = stolen ? { x: you.x + 40, y: you.y } : { x: him.x + (st.exposed > 0 ? 0 : 40), y: him.y + (st.exposed > 0 ? 70 : -10) }

  const card = (big: boolean) => (
    <div className={'mg-df-card' + (big ? ' mg-df-card--big' : '')}>
      <span className="mg-df-card__name">{star.short} · {star.pos} · {star.ovr}</span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.shoot')}</span><b>{pct(tend.shoot)}</b></span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.drive', { side: t(lang, 'mg.def.side.' + tend.side) })}</span><b>{pct(tend.drive)}</b></span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.pass')}</span><b>{pct(tend.pass)}</b></span>
      <span className="mg-df-card__line mg-df-card__last"><span>{t(lang, 'mg.def.last')}</span><b>{st.log.length ? st.log.slice(-4).map(m => GLYPH[m]).join(' ') : '—'}</b></span>
    </div>
  )

  return (
    <div className="mg mg-defense">
      <div className="mg-df-stage" ref={flow.stageRef}>
        <svg className="mg-df-svg" viewBox={`0 0 ${W} ${D}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {MAG_FILTER}
          {COURT_LAYERS}
          <path className={'mg-df__cone' + (cover ? ' mg-df__cone--on' : '')}
            d={`M ${you.x - 18} ${you.y} L ${him.x - CONE_HALF * S} ${him.y} L ${him.x + CONE_HALF * S} ${him.y} L ${you.x + 18} ${you.y} Z`} />
          {/* ímãs por transform + transição CSS de 60 ms: o tick de 20 Hz vira deslize contínuo (o drive também é interpolado no engine) */}
          <g className="mg-pb__them mg-df__pos" style={at(him)}>
            <circle r={R_HIM} className="mg-pb__mag mg-pb__mag--them" filter="url(#pb-mag)" />
            <text y={14} className="mg-pb__num mg-pb__num--them">{star.short.slice(0, 2)}</text>
            <text y={R_HIM + 40} className="mg-pb__tag">{star.short}</text>
            {st.move && <text className="mg-df__glyph" x={R_HIM + 30} y={16}>{GLYPH[st.move.kind]}</text>}
            {st.move && <text className="mg-df__glyph-name" x={R_HIM + 30} y={44}>{t(lang, 'mg.def.move.' + st.move.kind)}</text>}
          </g>
          <g className={'mg-pb__us mg-df__pos' + (st.airborne > 0 ? ' mg-df__you--air' : '') + (st.armed > 0 ? ' mg-df__you--armed' : '')} style={at(you)}>
            <circle r={R_YOU} className="mg-pb__mag" filter="url(#pb-mag)" />
            <text y={15} className="mg-pb__num">{number ?? '★'}</text>
            <text y={R_YOU + 40} className="mg-pb__tag">{t(lang, 'mg.you')}</text>
          </g>
          <circle className={'mg-pb__ball mg-df__pos' + (st.exposed > 0 ? ' mg-df__ball--loose' : '')} style={at(ball)} r={st.exposed > 0 ? 34 : 26} />
        </svg>
        <div className="mg-df-hud">
          <div className="mg-df-top">
            {phase === 'card' ? <span /> : card(false)}
            <div className="mg-df-right">
              <span className="mg-df-clock">{t(lang, 'mg.clock')}<b>{Math.max(0, Math.ceil(st.clock))}</b></span>
              <span className="mg-df-contain">{t(lang, 'mg.def.contain')}
                <span className="mg-df-contain__track"><span className="mg-df-contain__fill" style={{ width: pct(contain) }} /></span>
              </span>
              {st.armed > 0 && <span className="mg-df-armed">{t(lang, 'mg.def.armed')}</span>}
            </div>
          </div>
          {phase === 'live' && (
            <div className="mg-df-legend" aria-label={t(lang, 'mg.def.legend')}>
              {MOVES.map(m => <span key={m}><b>{GLYPH[m]}</b>{t(lang, 'mg.def.move.' + m)}</span>)}
            </div>
          )}
          {phase === 'live' && (
            <div className="mg-df-gest">
              <span>{t(lang, 'mg.def.keys.slide')}</span><span>{t(lang, 'mg.def.keys.steal')}</span><span>{t(lang, 'mg.def.keys.arm')}</span>
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
            {st.fouled && <small>{t(lang, 'mg.def.ft', { made })}</small>}
            {st.bitFake && !st.fouled && <small>{t(lang, 'mg.def.bitFake')}</small>}
          </div>
        )}
        {showResult && outcome && (
          <div className={'mg-result' + (outcome.success ? '' : ' mg-result--bad')}>
            <span>{t(lang, outcome.success ? 'mg.result.stop' : 'mg.result.scored')}</span>
            <span className="mg-result__sub">{outcome.success ? t(lang, 'option.' + st.result!.optionId) : t(lang, 'mg.def.end.' + endKey)}</span>
            {st.bitFake && <span className="mg-result__sub">{t(lang, 'mg.def.bitFake')}</span>}
          </div>
        )}
      </div>
      <div className="mg-df-pad">
        {KEYS.map(([g, key, label]) => <GestBtn key={g} flow={flow} g={g} keyLabel={t(lang, key)} label={t(lang, label)} on={g === 'up' && st.armed > 0} />)}
      </div>
    </div>
  )
}

// ESQ/DIR: segurar desliza (pointerdown liga, soltar/sair desliga); ROUBAR/CONTESTAR: gesto no
// pointerdown. Enter/Espaço tratados aqui e param a propagação pro listener global de teclado
// (defenseFlow) não contar o mesmo toque duas vezes.
function GestBtn({ flow, g, keyLabel, label, on }: { flow: DuelFlow; g: Gesture; keyLabel: string; label: string; on: boolean }): JSX.Element {
  const holds = g === 'left' || g === 'right'
  const release = holds ? () => flow.hold(0) : undefined
  return (
    <button type="button" className={'mg-btn mg-df-padbtn' + (on ? ' mg-pb__armed' : '')} aria-pressed={g === 'up' ? on : undefined}
      disabled={flow.phase !== 'live'}
      onPointerDown={() => holds ? flow.hold(g === 'left' ? -1 : 1) : flow.gesture(g)}
      onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
      onKeyDown={e => { if (e.key !== ' ' && e.key !== 'Enter') return; e.preventDefault(); e.stopPropagation(); flow.gesture(g) }}>
      <kbd className="mg-df-padbtn__key">{keyLabel}</kbd>
      <span>{label}</span>
    </button>
  )
}
