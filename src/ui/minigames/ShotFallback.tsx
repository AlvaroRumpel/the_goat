import type { JSX } from 'react'
import type { MinigameProps } from './types'
import { RIM_H, refSpeed, SHOTS, rad, trajectory, type ShotType } from '../../engine/minigames/shot'
import { clamp, FLIGHT_MS, POWER_MAX, readout, useShotFlow, type Fate, type Live } from './shotFlow'
import { ShotFrame } from './ShotFrame'

// ARREMESSO sem WebGL — mesmo fluxo (`useShotFlow`) e mesmo HUD (`ShotFrame`), painel 2D em
// vista lateral: chão, aro na distância real do tipo escolhido, arco previsto enquanto você
// mira, silhueta do defensor com a linha da mão em `closeout.x` e a bola voando pelo mesmo
// desfecho do engine.

const M = 30                      // metros → px do viewBox
const X0 = 34                     // você, na esquerda
const GY = 186                    // linha do chão
const W = 300, H = 200

const px = (xm: number) => X0 + xm * M
const py = (h: number) => clamp(GY - h * M, 2, GY)
// ponto final da animação em metros (x = distância do arremessador, y = altura)
const END: Record<Fate, [number, number]> = {
  swish: [0, RIM_H - 0.2], bank: [0, RIM_H - 0.2], short: [-1.2, RIM_H - 1.0],
  long: [0.8, RIM_H - 0.35], rimOut: [0.4, RIM_H + 0.15], blocked: [0, 0], clockOut: [0, 0],
}

export function ShotFallback(props: MinigameProps): JSX.Element {
  const flow = useShotFlow(props)
  const { L, phase, type, fate } = flow
  const aim = readout(flow)
  const d = type ? SHOTS[type].d : SHOTS.three.d
  const hoop = px(d)
  const rimY = py(RIM_H)
  const ball = ballAt(L, type, fate, d)
  const arcPts = phase === 'aim' && type && aim.angle !== null && aim.power ? arc(type, aim.angle, aim.power) : null

  return (
    <ShotFrame flow={flow}>
      <svg className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect className="mg-sh-fb__bg" x={0} y={0} width={W} height={H} />
        <line className="mg-sh-fb__floor" x1={0} y1={GY} x2={W} y2={GY} />
        {/* aro: poste, tabela, argola e rede */}
        <line className="mg-sh-fb__rig" x1={hoop + 0.55 * M} y1={GY} x2={hoop + 0.55 * M} y2={rimY - 1.0 * M} />
        <line className="mg-sh-fb__board" x1={hoop + 0.15 * M} y1={rimY - 1.05 * M} x2={hoop + 0.15 * M} y2={rimY + 0.3 * M} />
        <line className="mg-sh-fb__rim" x1={hoop - 0.32 * M} y1={rimY} x2={hoop + 0.15 * M} y2={rimY} />
        <path className="mg-sh-fb__net" d={`M ${hoop - 0.28 * M} ${rimY} L ${hoop - 0.08 * M} ${rimY + 0.5 * M} L ${hoop + 0.11 * M} ${rimY}`} />

        {arcPts && <polyline className="mg-sh-fb__arc" points={arcPts} />}

        {L.co && <Defender x={px(L.co.x)} handH={L.co.handH} up={L.co.handUp} />}
        <Shooter up={phase === 'jump' || phase === 'flight' || phase === 'done'} />
        <circle className="mg-sh-fb__ball" cx={px(ball.x)} cy={py(ball.y)} r={5} />
      </svg>
    </ShotFrame>
  )
}

function Shooter({ up }: { up: boolean }): JSX.Element {
  const hip = py(0.95), head = py(up ? 2.0 : 1.75)
  return (
    <g className="mg-sh-fb__you">
      <line x1={X0} y1={GY} x2={X0 - 6} y2={hip} />
      <line x1={X0} y1={GY} x2={X0 + 6} y2={hip} />
      <line x1={X0 - 6} y1={hip} x2={X0 + 6} y2={hip} />
      <line x1={X0} y1={hip} x2={X0} y2={head + 5} />
      <line x1={X0} y1={py(up ? 1.75 : 1.5)} x2={X0 + 8} y2={py(up ? 2.5 : 1.15)} />
      <circle cx={X0} cy={head} r={5} />
    </g>
  )
}

function Defender({ x, handH, up }: { x: number; handH: number; up: boolean }): JSX.Element {
  const hip = py(0.95), head = py(1.75), hand = py(up ? handH : 1.1)
  return (
    <g className={'mg-sh-fb__def' + (up ? ' mg-sh-fb__def--up' : '')}>
      <line x1={x} y1={GY} x2={x - 6} y2={hip} />
      <line x1={x} y1={GY} x2={x + 6} y2={hip} />
      <line x1={x} y1={hip} x2={x} y2={head + 5} />
      <circle cx={x} cy={head} r={5} />
      <line className="mg-sh-fb__hand" x1={x} y1={py(1.5)} x2={x - 4} y2={hand} />
      <line className="mg-sh-fb__hand" x1={x - 10} y1={hand} x2={x + 2} y2={hand} />
    </g>
  )
}

// arco previsto da mira corrente: a MESMA parábola que o engine vai avaliar no lock
function arc(type: ShotType, angleDeg: number, power: number): string {
  const s = SHOTS[type]
  const tr = trajectory(rad(angleDeg), power * POWER_MAX * refSpeed(type), s.releaseH)
  const end = tr.tEnd * 1.05
  return Array.from({ length: 25 }, (_, i) => {
    const p = tr.pointAt(end * i / 24)
    return `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`
  }).join(' ')
}

// Bola: na mão até soltar; no voo segue a parábola do engine e nos últimos 25% converge
// pro ponto do desfecho (que OBEDECE `outcome`), como na cena 3D.
function ballAt(l: Live, type: ShotType | null, fate: Fate | null, d: number): { x: number; y: number } {
  if (!l.shot || !type) return l.phase === 'pick' || l.phase === 'aim' ? { x: 0.35, y: 1.15 } : { x: 0.2, y: 2.5 }
  const s = SHOTS[type]
  const tr = trajectory(l.shot.angle, l.shot.speed, s.releaseH)
  const p = clamp((l.now - l.shot.t0) / FLIGHT_MS, 0, 1.15)
  const pt = tr.pointAt(p * tr.tEnd * 1.05)
  const mix = (a: number, b: number, k: number) => a + (b - a) * k
  if (fate === 'blocked') {
    const k = Math.min(1, p / 0.35)
    const hx = l.co?.handX ?? 1, hh = (l.co?.handH ?? 2.7) + 0.1
    return { x: mix(pt.x, hx, k), y: mix(pt.y, hh, k) - Math.max(0, p - 0.35) * 4 }
  }
  if (p <= 0.8) return pt
  const [ex, ey] = END[fate ?? 'swish']
  const k = (p - 0.8) / 0.2
  return { x: mix(pt.x, d + ex, k), y: mix(pt.y, ey, k) }
}
