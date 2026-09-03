import { useEffect, useMemo, useRef, useState, type JSX, type PointerEvent as RPointerEvent } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { attrMods, opponentFive } from '../../engine/minigames/common'
import {
  aimNoise, ballPath, createScene, flightPoint, launchFromPull, RIM_H, shotQuality, simulateShot, skillOf, stageFlight,
  type Flight, type ShotScene,
} from '../../engine/minigames/shot'
import { Ball, Figure, Floor, GY, H, Hoop, M, py, STAND_REACH } from './shotScene'

// ARREMESSO estilingue (spec 2026-09-03 arcade-ajustes §2): vista lateral em SVG, papel sépia.
// Você à esquerda, aro à distância sorteada, defensor PARADO com a mão erguida entre vocês
// (só obstáculo). Arraste em qualquer ponto do palco e solte: a puxada vira o lançamento; o
// pontilhado mostra o começo do arco (mais longo com skill). O engine simula o voo e devolve a
// quality; a animação toca `ballPath` (aro, tabela, chão, mão) de um voo que OBEDECE `outcome`.

const X0 = 1.4 * M                // sua mão (x = 0 m)
const W_MIN = 7.4 * M             // bandeja não vira zoom gigante
const PATH_HZ = 60, SETTLE_MS = 350
const GUIDE_STEPS = 16
const px = (xm: number) => X0 + xm * M

type Phase = 'aim' | 'flight' | 'done'
type UiFate = 'swish' | 'short' | 'long' | 'rimOut' | 'blocked'
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
  const W = Math.max(W_MIN, X0 + (scene.d + 1.9) * M)

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

  // `outcome` chega um render depois do soltar: até lá toca o voo cru (o começo é igual)
  const path = useMemo(() => {
    if (!flight) return null
    const ok = outcome ? outcome.success : flight.fate === 'in'
    const p = ballPath(scene, stageFlight(scene, flight, ok), ok, PATH_HZ)
    // acerto: corta 0.5 s depois de sair pela rede (o erro quica até parar)
    const out = ok ? p.findIndex(q => q.y < RIM_H - 0.6 && Math.abs(q.x - scene.d) < 0.4) : -1
    return out > 0 ? p.slice(0, out + PATH_HZ / 2) : p
  }, [flight, outcome, scene])
  const flightMs = path ? path.length / PATH_HZ * 1000 : 0
  useEffect(() => {
    if (phase !== 'flight') return
    let raf = 0
    const loop = (ts: number) => {
      now.current = ts
      if (ts - t0.current >= flightMs + SETTLE_MS) { setPhase('done'); return }
      setFrame(f => f + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase, flightMs])

  // desfecho obedece o engine; a geometria só escolhe a narração do erro
  const fate: UiFate | null = !flight || !outcome ? null
    : outcome.success ? 'swish' : flight.fate === 'blocked' ? 'blocked' : flight.fate === 'in' ? 'rimOut' : flight.fate
  const guide = drag ? guideDots(scene, drag, skill) : []
  const ball = ballAt(phase, drag, path, now.current - t0.current, scene)
  const lift = Math.max(0, scene.releaseH - STAND_REACH)
  const hand = phase === 'aim' ? ball : { x: 0, y: scene.releaseH }

  return (
    <div className="mg mg-shot">
      <div className="mg-sh-stage">
        <svg ref={svgRef} className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <rect className="mg-sh__paper" x={0} y={0} width={W} height={H} />
          <Floor w={W} />
          <Hoop x={px(scene.d)} />
          <Figure x={px(scene.gap + 0.28)} dir={-1} them hand={{ x: px(scene.gap), y: py(scene.who.reach) }} shoulder={scene.who.reach - 0.85} label={scene.who.short} />
          <Figure x={px(-0.3)} dir={1} lift={lift} hand={{ x: px(hand.x), y: py(hand.y) }} label={`${number ?? ''} ${lastName}`.trim()} />
          {guide.map((p, i) => <circle key={i} className="mg-sh__guide" cx={px(p.x)} cy={py(p.y)} r={1.4} />)}
          <Ball x={px(ball.x)} y={py(ball.y)} />
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

// guia da mira: arco previsto SEM ruído, só a fração (0.3 + 0.5 × skill) do voo
function guideDots(scene: ShotScene, drag: Drag, skill: number): Array<{ x: number; y: number }> {
  const l = launchFromPull(drag.cx - drag.sx, drag.cy - drag.sy)
  if (!l) return []
  const f = simulateShot(scene, l)
  const n = Math.round(GUIDE_STEPS * (0.3 + 0.5 * skill))
  return Array.from({ length: n }, (_, i) => flightPoint(f, (i + 1) / GUIDE_STEPS * f.tEnd)).filter(p => p.y > 0)
}

// bola: na mão (segue a puxada até 1 m); no voo, amostra do `ballPath` pelo tempo real
function ballAt(phase: Phase, drag: Drag | null, path: Array<{ x: number; y: number }> | null, elapsed: number, scene: ShotScene): { x: number; y: number } {
  const hand = { x: 0, y: scene.releaseH }
  if (phase === 'aim' || !path) {
    if (!drag) return hand
    const dx = drag.cx - drag.sx, dy = drag.cy - drag.sy, len = Math.hypot(dx, dy), k = len > 1 ? 1 / len : 1
    return { x: hand.x + dx * k, y: Math.max(0.12, hand.y + dy * k) }
  }
  return path[Math.min(path.length - 1, Math.max(0, Math.floor(elapsed / 1000 * PATH_HZ)))]
}
