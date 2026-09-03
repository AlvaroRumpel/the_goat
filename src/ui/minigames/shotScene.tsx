import type { JSX } from 'react'
import { BALL_R, BOARD_HI, BOARD_LO, BOARD_X, RIM_H, RIM_R } from '../../engine/minigames/shot'

// Cena lateral em papel (arremesso estilingue + lances livres): M px por metro, chão em GY.
// Boneco proporcional de traço e tabela/aro/suporte desenhados em metros reais.

export const M = 30, GY = 4.8 * M, H = 5.35 * M
export const py = (h: number) => GY - h * M
export const SHOULDER = 1.55                  // m: ombro em pé
export const STAND_REACH = 2.25               // m: mão erguida em pé — bola acima disso = salto

// pés em A, quadril, tronco, cabeça, braço da frente até `hand` (px), braço de trás caído.
// `lift` (m) = salto (pés fora do chão). `x` = px do centro dos pés; `dir` = pra onde olha.
export function Figure({ x, dir, hand, shoulder = SHOULDER, lift = 0, them = false, label }: {
  x: number; dir: 1 | -1; hand: { x: number; y: number }; shoulder?: number; lift?: number; them?: boolean; label: string
}): JSX.Element {
  const sh = py(shoulder + lift), hip = py(shoulder - 0.55 + lift), foot = py(lift), back = py(shoulder - 0.45 + lift)
  const spread = 0.16 * M
  return (
    <g className={'mg-sh__fig' + (them ? ' mg-sh__fig--them' : '')}>
      <path d={`M ${x - spread} ${foot} L ${x} ${hip} L ${x + spread} ${foot} M ${x} ${hip} L ${x} ${sh} L ${x - dir * 0.22 * M} ${back} M ${x} ${sh} L ${hand.x} ${hand.y}`} />
      <circle cx={x} cy={py(shoulder + 0.22 + lift)} r={0.12 * M} />
      <text x={x} y={GY + 10} textAnchor="middle" className="mg-sh__tag">{label}</text>
    </g>
  )
}

// aro (centro em `x` px) + tabela 0.375 m atrás + braço/poste/base + rede trapézio com malha
export function Hoop({ x }: { x: number }): JSX.Element {
  const rimY = py(RIM_H), bx = x + BOARD_X * M, pole = bx + 0.9 * M, armY = py(RIM_H + 0.45)
  const r = RIM_R * M, netB = py(RIM_H - 0.42)
  return (
    <g>
      <path className="mg-sh__rig" d={`M ${pole} ${GY} L ${pole} ${armY} L ${bx} ${armY}`} />
      <rect className="mg-sh__base" x={pole - 0.3 * M} y={GY - 0.1 * M} width={0.6 * M} height={0.1 * M} />
      <line className="mg-sh__board" x1={bx} y1={py(BOARD_HI)} x2={bx} y2={py(BOARD_LO)} />
      <line className="mg-sh__bracket" x1={x + r} y1={rimY} x2={bx} y2={rimY} />
      <path className="mg-sh__net" d={
        `M ${x - r + 1} ${rimY} L ${x - 0.13 * M} ${netB} L ${x + 0.13 * M} ${netB} L ${x + r - 1} ${rimY}` +
        ` M ${x - 0.08 * M} ${rimY} L ${x - 0.05 * M} ${netB} M ${x + 0.08 * M} ${rimY} L ${x + 0.05 * M} ${netB}` +
        ` M ${x - 0.19 * M} ${py(RIM_H - 0.15)} L ${x + 0.19 * M} ${py(RIM_H - 0.15)} M ${x - 0.16 * M} ${py(RIM_H - 0.3)} L ${x + 0.16 * M} ${py(RIM_H - 0.3)}`} />
      <line className="mg-sh__rim" x1={x - r} y1={rimY} x2={x + r} y2={rimY} />
    </g>
  )
}

// `r` = rotação em rad (backspin: bola indo pra direita gira anti-horário → rotate negativo no SVG)
export function Ball({ x, y, r = 0 }: { x: number; y: number; r?: number }): JSX.Element {
  const R = BALL_R * M
  return (
    <g className="mg-sh__ball" transform={`rotate(${-r * 180 / Math.PI} ${x} ${y})`}>
      <circle cx={x} cy={y} r={R} />
      <path className="mg-sh__seam" d={`M ${x - R} ${y} L ${x + R} ${y} M ${x} ${y - R} Q ${x - R * 0.9} ${y} ${x} ${y + R}`} />
    </g>
  )
}

// chão: linha + tabuado
export function Floor({ w }: { w: number }): JSX.Element {
  return (
    <g>
      {Array.from({ length: Math.ceil(w / 25) }, (_, i) => <rect key={i} className={'mg-sh__plank' + (i % 2 ? ' mg-sh__plank--b' : '')} x={i * 25} y={GY} width={25} height={H - GY} />)}
      <line className="mg-sh__floor" x1={0} y1={GY} x2={w} y2={GY} />
    </g>
  )
}
