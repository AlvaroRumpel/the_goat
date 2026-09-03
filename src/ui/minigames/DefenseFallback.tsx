import type { JSX } from 'react'
import type { MinigameProps } from './types'
import { t } from '../../i18n'
import { CONE_HALF, inFront } from '../../engine/minigames/defense'
import type { Gesture } from './useSwipe'
import { GLYPH, useDuelFlow, type DuelFlow } from './defenseFlow'
import { DuelFrame } from './DuelFrame'

// MURALHA sem WebGL — mesmo fluxo (`useDuelFlow`) e mesmo HUD (`DuelFrame`), painel 2D em
// vista de cima: você e ele como ímãs no eixo x, o cone de contenção desenhado à frente e a
// bola acesa enquanto está exposta. O palco continua aceitando swipe; embaixo, os quatro
// botões (≥ 48px) pra quem joga com o dedo num aparelho sem WebGL.

const W = 300, H = 200
const CX = W / 2, M = 34          // metros → px no eixo x (±2.5 m cabem)
// profundidade comprimida de propósito: o cartão de tendências ocupa o alto à esquerda e a
// faixa de dicas os ~26 últimos do viewBox — ele fica entre os dois, a cesta logo abaixo de você
const YOU_Y = 134, K = 9, HIM_TOP = 62
const R = 11
// a câmera 3D espelha o eixo x (ela olha pra +z): o mesmo aqui, pra "esquerda" ser esquerda
const sx = (v: number) => CX - v * M

const KEYS: Array<[Gesture, string]> = [
  ['left', 'mg.def.left'], ['tap', 'mg.def.steal'], ['up', 'mg.def.contest'], ['right', 'mg.def.right'],
]

export function DefenseFallback(props: MinigameProps): JSX.Element {
  const flow = useDuelFlow(props)
  const { S, phase, star } = flow
  const { lang } = flow.props
  const win = flow.props.outcome?.success ?? true
  const you = sx(S.defX), him = sx(S.attX)
  const himY = Math.max(HIM_TOP, YOU_Y - S.attDist * K)
  const cover = inFront(S)
  const stolen = phase === 'end' && S.phase === 'steal' && win
  const ball = stolen ? { x: you + 15, y: YOU_Y } : { x: him + (S.exposed > 0 ? 0 : 15), y: himY + (S.exposed > 0 ? 16 : 4) }

  return (
    <DuelFrame flow={flow} footer={
      <div className="mg-df-pad">
        {KEYS.map(([g, key]) => <GestBtn key={key} flow={flow} g={g} label={t(lang, key)} />)}
      </div>
    }>
      <svg className="mg-df-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect className="mg-df-fb__bg" x={0} y={0} width={W} height={H} />
        {/* a cesta que ele ataca, atrás de você */}
        <path className="mg-df-fb__paint" d={`M ${CX - 2.45 * M} ${YOU_Y + 40} V ${YOU_Y + 12} H ${CX + 2.45 * M} V ${YOU_Y + 40}`} />
        <line className="mg-df-fb__rim" x1={CX - 12} y1={YOU_Y + 30} x2={CX + 12} y2={YOU_Y + 30} />
        {/* cone de contenção: no plano dele, a meia-abertura é exatamente CONE_HALF */}
        <path className={'mg-df-fb__cone' + (cover ? ' mg-df-fb__cone--on' : '')}
          d={`M ${you - 0.18 * M} ${YOU_Y} L ${you - CONE_HALF * M} ${himY} L ${you + CONE_HALF * M} ${himY} L ${you + 0.18 * M} ${YOU_Y} Z`} />
        {/* ele */}
        <g className="mg-df-fb__him">
          <circle cx={him} cy={himY} r={R} />
          <text x={him} y={himY + 4} textAnchor="middle">{star.short.slice(0, 2)}</text>
        </g>
        {S.move && <text className="mg-df-fb__glyph" x={him + R + 20} y={himY + 4}>{GLYPH[S.move.kind]}</text>}
        {/* você */}
        <g className={'mg-df-fb__you' + (S.airborne > 0 ? ' mg-df-fb__you--air' : '')}>
          <circle cx={you} cy={YOU_Y} r={R} />
          <text x={you} y={YOU_Y + 4} textAnchor="middle">{props.number ?? '—'}</text>
        </g>
        <circle className={'mg-df-fb__ball' + (S.exposed > 0 ? ' mg-df-fb__ball--loose' : '')}
          cx={ball.x} cy={ball.y} r={5} />
      </svg>
    </DuelFrame>
  )
}

// pointerdown = gesto imediato (e não dispara no teclado); Enter/Espaço são tratados aqui e
// param a propagação pra o listener global do useSwipe não contar o mesmo toque duas vezes.
function GestBtn({ flow, g, label }: { flow: DuelFlow; g: Gesture; label: string }): JSX.Element {
  return (
    <button type="button" className="mg-btn mg-df-padbtn" disabled={flow.phase !== 'live'}
      onPointerDown={() => flow.gesture(g)}
      onKeyDown={e => {
        if (e.key !== ' ' && e.key !== 'Enter') return
        e.preventDefault(); e.stopPropagation()
        flow.gesture(g)
      }}>{label}</button>
  )
}
