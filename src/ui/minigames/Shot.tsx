import { useEffect, useMemo, useRef, useState, type JSX, type PointerEvent as RPointerEvent } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { attrMods, opponentFive } from '../../engine/minigames/common'
import {
  aimNoise, createScene, flightPoint, launchFromPull, RIM_H, shotQuality, simulateShot, skillOf,
  type Flight, type ShotScene,
} from '../../engine/minigames/shot'

// ARREMESSO estilingue (spec 2026-09-03 arcade-ajustes §2): vista lateral em SVG, papel sépia.
// Você à esquerda, aro à distância sorteada, defensor PARADO com a mão erguida entre vocês
// (só obstáculo). Arraste em qualquer ponto do palco e solte: a puxada vira o lançamento; o
// pontilhado mostra o começo do arco (mais longo com skill). O engine simula o voo e devolve a
// quality; o desfecho animado OBEDECE `outcome.success`.

const M = 30                      // metros → px do viewBox
const X0 = 40                     // sua mão (x = 0 m)
const GY = 4.4 * M                // chão
const H = 150
const px = (xm: number) => X0 + xm * M
const py = (h: number) => Math.min(GY, Math.max(2, GY - h * M))
const GUIDE_STEPS = 16

type Phase = 'aim' | 'flight' | 'done'
type UiFate = 'swish' | 'short' | 'long' | 'rimOut' | 'blocked'
// ponto final da animação em metros relativo ao aro (x) e altura (y)
const END: Record<UiFate, [number, number]> = {
  swish: [0, RIM_H - 0.2], short: [-1.2, RIM_H - 1.0], long: [0.8, RIM_H - 0.35], rimOut: [0.4, RIM_H + 0.15], blocked: [0, 0],
}
const ZONE: Record<ShotScene['kind'], string> = { layup: 'finish', dunk: 'finish', mid: 'mid', three: 'three' }
interface Drag { sx: number; sy: number; cx: number; cy: number }

export function ShotGame({ seed, context, build, age, quarter, league, number, lastName, lang, onResolve, outcome }: MinigameProps): JSX.Element {
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const mods = useMemo(() => attrMods(build, age, quarter), [build, age, quarter])
  // seed local: 3 calls na cena + 2 no ruído do soltar — criado UMA vez
  const boot = useRef<{ rng: Rng; scene: ShotScene } | null>(null)
  if (!boot.current) { const rng = createRng(seed); boot.current = { rng, scene: createScene(rng, five, build, age) } }
  const { rng, scene } = boot.current
  const skill = skillOf(build, age, scene.kind, mods.fatigue)
  const W = X0 + (scene.d + 1.6) * M

  const [phase, setPhase] = useState<Phase>('aim')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [, setFrame] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const t0 = useRef(0), now = useRef(0), resolved = useRef(false)
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  // pointer → metros (x pra direita, y pra cima), via CTM: o SVG fica letterboxado no palco
  const toM = (e: RPointerEvent) => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: (p.x - X0) / M, y: (GY - p.y) / M }
  }
  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (phase !== 'aim') return
    const p = toM(e); if (!p) return
    svgRef.current?.setPointerCapture(e.pointerId)
    setDrag({ sx: p.x, sy: p.y, cx: p.x, cy: p.y })
  }
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const p = toM(e); if (p) setDrag(d => d && { ...d, cx: p.x, cy: p.y })
  }
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId)
    const l = launchFromPull(drag.cx - drag.sx, drag.cy - drag.sy)
    setDrag(null)
    if (!l || resolved.current) return
    resolved.current = true
    const f = simulateShot(scene, aimNoise(rng, skill, l))
    setFlight(f); t0.current = performance.now(); now.current = t0.current; setPhase('flight')
    onResolveRef.current({ optionId: scene.optionId, quality: shotQuality(f, skill) })
  }

  // voo: rAF pelo tempo real da parábola (mín. 600 ms) + 250 ms de assentamento, depois 'done'
  const flightMs = flight ? Math.max(600, flight.tEnd * 1000) : 0
  useEffect(() => {
    if (phase !== 'flight') return
    let raf = 0
    const loop = (ts: number) => {
      now.current = ts
      if (ts - t0.current >= flightMs + 250) { setPhase('done'); return }
      setFrame(f => f + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, flightMs])

  // desfecho obedece o engine; a geometria só escolhe a narração do erro
  const fate: UiFate | null = !flight || !outcome ? null
    : outcome.success ? 'swish' : flight.fate === 'blocked' ? 'blocked' : flight.fate === 'in' ? 'rimOut' : flight.fate
  const hoop = px(scene.d), rimY = py(RIM_H)
  const guide = drag ? guideDots(scene, drag, skill) : []
  const ball = ballAt(phase, drag, flight, fate, now.current - t0.current, flightMs, scene)

  return (
    <div className="mg mg-shot">
      <div className="mg-sh-stage">
        <svg ref={svgRef} className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect className="mg-sh__paper" x={0} y={0} width={W} height={H} />
          {Array.from({ length: Math.ceil(W / 25) }, (_, i) => <rect key={i} className={'mg-sh__plank' + (i % 2 ? ' mg-sh__plank--b' : '')} x={i * 25} y={GY} width={25} height={H - GY} />)}
          <line className="mg-sh__floor" x1={0} y1={GY} x2={W} y2={GY} />
          <line className="mg-sh__rig" x1={hoop + 0.55 * M} y1={GY} x2={hoop + 0.55 * M} y2={rimY - 1.0 * M} />
          <line className="mg-sh__board" x1={hoop + 0.15 * M} y1={rimY - 1.05 * M} x2={hoop + 0.15 * M} y2={rimY + 0.3 * M} />
          <line className="mg-sh__rim" x1={hoop - 0.32 * M} y1={rimY} x2={hoop + 0.15 * M} y2={rimY} />
          <path className="mg-sh__net" d={`M ${hoop - 0.28 * M} ${rimY} L ${hoop - 0.08 * M} ${rimY + 0.5 * M} L ${hoop + 0.11 * M} ${rimY}`} />
          <Figure x={px(scene.gap)} them reach={scene.who.reach} label={scene.who.short} />
          <Figure x={X0} them={false} reach={phase === 'aim' ? scene.releaseH : scene.releaseH + 0.5} label={`${number ?? ''} ${lastName}`.trim()} />
          {guide.map((p, i) => <circle key={i} className="mg-sh__guide" cx={px(p.x)} cy={py(p.y)} r={1.6} />)}
          <circle className="mg-sh__ball" cx={px(ball.x)} cy={py(ball.y)} r={5} />
        </svg>
        <div className="mg-sh-hud">
          <div className="mg-sh-hud__row">
            <span className="mono-label mono-label--red">{t(lang, 'mg.shot.phase.' + (phase === 'aim' ? 'aim' : 'flight'))}</span>
            <span className="mg-sh-tagline">{t(lang, 'mg.shot.defender')} · {scene.who.short} · {scene.gap.toFixed(1)} m</span>
          </div>
          <span className="mg-sh-tagline">{t(lang, 'mg.shot.zone.' + ZONE[scene.kind])} · {scene.d.toFixed(1)} m</span>
        </div>
      </div>

      <div className="mg-sh-bar">
        <span className="mg-sh-label">{t(lang, phase === 'aim' ? 'mg.shot.dragHint' : 'mg.shot.zone.' + ZONE[scene.kind])}</span>
        <span className="mg-sh-bar__line">
          <span className="mg-sh-bar__label">{t(lang, 'mg.shot.skill')}</span>
          <span className="bar"><span className="bar__fill" style={{ width: `${Math.round(skill * 100)}%` }} /></span>
        </span>
      </div>

      {phase === 'done' && outcome && (
        <div className={'mg-result' + (!outcome.success || outcome.injury ? ' mg-result--bad' : '')}>
          <span>{t(lang, outcome.injury ? 'mg.result.injury' : outcome.success ? 'mg.result.hit' : 'mg.result.miss')}</span>
          {fate && <span className="mg-result__sub">{t(lang, 'mg.shot.' + fate)}</span>}
        </div>
      )}
    </div>
  )
}

// boneco de traço: pernas, tronco, cabeça, braço até `reach` (mão em cima / bola na mão)
function Figure({ x, them, reach, label }: { x: number; them: boolean; reach: number; label: string }): JSX.Element {
  const hip = py(0.95), head = py(1.8)
  return (
    <g className={'mg-sh__fig' + (them ? ' mg-sh__fig--them' : '')}>
      <line x1={x} y1={GY} x2={x - 6} y2={hip} />
      <line x1={x} y1={GY} x2={x + 6} y2={hip} />
      <line x1={x} y1={hip} x2={x} y2={head + 5} />
      <line x1={x} y1={py(1.5)} x2={x + (them ? -6 : 6)} y2={py(reach)} />
      <circle cx={x} cy={head} r={5} />
      <text x={x} y={GY + 11} textAnchor="middle" className="mg-sh__tag">{label}</text>
    </g>
  )
}

// guia da mira: arco previsto SEM ruído, só a fração (0.3 + 0.5 × skill) do voo
function guideDots(scene: ShotScene, drag: Drag, skill: number): Array<{ x: number; y: number }> {
  const l = launchFromPull(drag.cx - drag.sx, drag.cy - drag.sy)
  if (!l) return []
  const f = simulateShot(scene, l)
  const n = Math.round(GUIDE_STEPS * (0.3 + 0.5 * skill))
  return Array.from({ length: n }, (_, i) => flightPoint(f, (i + 1) / GUIDE_STEPS * f.tEnd)).filter(p => p.y > 0)
}

// bola: na mão (segue a puxada até 1 m); no voo, trajetória real até 80 % e converge pro
// ponto do desfecho (que OBEDECE `outcome`); bloqueada = para na mão dele e cai
function ballAt(phase: Phase, drag: Drag | null, flight: Flight | null, fate: UiFate | null, elapsed: number, flightMs: number, scene: ShotScene): { x: number; y: number } {
  const hand = { x: 0, y: scene.releaseH }
  if (phase === 'aim' || !flight) {
    if (!drag) return hand
    const dx = drag.cx - drag.sx, dy = drag.cy - drag.sy, len = Math.hypot(dx, dy), k = len > 1 ? 1 / len : 1
    return { x: hand.x + dx * k, y: Math.max(0.12, hand.y + dy * k) }
  }
  const p = Math.min(1, Math.max(0, elapsed / flightMs))
  const pt = flightPoint(flight, p * flight.tEnd)
  const mix = (a: number, b: number, k: number) => a + (b - a) * k
  if (fate === 'blocked') {
    const k = Math.min(1, p / 0.5)
    return { x: mix(pt.x, scene.gap, k), y: Math.max(0.12, mix(pt.y, scene.who.reach, k) - Math.max(0, p - 0.5) * 4) }
  }
  if (p <= 0.8 || !fate) return { x: pt.x, y: Math.max(0.12, pt.y) }
  const [ex, ey] = END[fate]
  const k = (p - 0.8) / 0.2
  return { x: mix(pt.x, scene.d + ex, k), y: mix(pt.y, ey, k) }
}
