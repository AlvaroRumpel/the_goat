import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import type { MinigameProps } from './types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import {
  angleValue, availableTypes, DIST, evaluate, G, meterValue, rad, refSpeed, releaseHeight,
  resultFor, scenarioFor, trajectory, type ShotEval, type ShotType, type ShotVerdict,
} from '../../engine/minigames/shot'

// ARREMESSO — vista lateral em SVG. Física e qualidade vêm de engine/minigames/shot.ts;
// aqui só entrada (arrasto ou medidor), desenho e a animação que OBEDECE o outcome do engine.

const W = 1000, H = 560, FLOOR = 505, S = 95 // px por metro
const SHOOTER_X = 130
const MAX_DRAG = 220                          // px (viewBox) que valem força 1.0
const POWER_MAX = 1.6                         // força 1.0 = 1.6 × velocidade ideal a 45°
const FLIGHT_MS = 900, TAIL_MS = 500
const METER_POWER_MS = 1400, METER_ANGLE_MS = 1200
const MODE_KEY = 'thegoat:shotMode'

type Mode = 'drag' | 'meter'
type Fate = ShotVerdict
type Pt = [number, number]

const px = (xM: number) => SHOOTER_X + xM * S
const py = (yM: number) => FLOOR - yM * S
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]

function loadMode(): Mode { try { return localStorage.getItem(MODE_KEY) === 'meter' ? 'meter' : 'drag' } catch { return 'drag' } }
function saveMode(m: Mode) { try { localStorage.setItem(MODE_KEY, m) } catch { /* sem storage */ } }

// cauda da animação (metros, relativa à distância d): primeiro ponto = onde o voo termina
const TAILS: Record<Fate, (d: number) => Pt[]> = {
  swish: d => [[d, 3.05], [d, 2.5]],
  bank: d => [[d + 0.42, 3.35], [d, 3.05], [d, 2.5]],
  short: d => [[d - 0.3, 3.05], [d - 0.9, 2.3], [d - 1.3, 0.12]],
  long: d => [[d + 0.42, 3.4], [d - 0.4, 3.2], [d - 1.0, 0.12]],
  rimOut: d => [[d + 0.05, 3.05], [d - 0.2, 3.55], [d - 1.0, 0.12]],
}
function polyAt(pts: Pt[], q: number): Pt {
  const segs = pts.length - 1, f = q * segs, i = Math.min(segs - 1, Math.floor(f))
  return lerp(pts[i], pts[i + 1], f - i)
}

// arquibancada: bloco "ocupado" por hash fixo × densidade da torcida (sem rng na render)
const STAND_COLS = 26, STAND_ROWS = 3
const filled = (i: number, crowd: number) => ((i * 7919) % 97) / 97 < crowd
const CONFETTI: Pt[] = [[80, 70], [210, 120], [330, 60], [470, 140], [560, 90], [690, 130], [790, 70], [900, 110], [150, 170], [640, 40], [420, 190], [960, 160]]

export function ShotGame({ seed, context, build, number, lang, onResolve, outcome }: MinigameProps) {
  const scenario = useMemo(() => scenarioFor(context, createRng(seed)), [seed, context])
  const types = useMemo(() => availableTypes(build), [build])
  const [type, setType] = useState<ShotType | null>(null)
  const [mode, setMode] = useState<Mode>(loadMode)
  const [drag, setDrag] = useState<{ angle: number; power: number; ptr: Pt } | null>(null)
  const [meter, setMeter] = useState({ stage: 0 as 0 | 1, t0: 0, power: 0 })
  const [shot, setShot] = useState<{ angle: number; speed: number; ev: ShotEval; t0: number } | null>(null)
  const [now, setNow] = useState(0)
  const [done, setDone] = useState(false)
  const resolved = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const d = type ? DIST[type] : DIST.three
  const h0 = type ? releaseHeight(type) : releaseHeight('three')
  const powerMs = METER_POWER_MS / scenario.meterSpeed, angleMs = METER_ANGLE_MS / scenario.meterSpeed

  // relógio: medidor oscilando ou bola voando. Ritmo é gameplay — não respeita reduced-motion.
  const ticking = type !== null && ((mode === 'meter' && !shot) || (shot !== null && !done))
  useEffect(() => {
    if (!ticking) return
    let id = 0
    const loop = () => { setNow(performance.now()); id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [ticking])
  useEffect(() => {
    if (shot && !done && now - shot.t0 >= FLIGHT_MS + TAIL_MS) setDone(true)
  }, [now, shot, done])

  function pickType(tp: ShotType) {
    setType(tp)
    setMeter({ stage: 0, t0: performance.now(), power: 0 })
  }
  function switchMode(m: Mode) {
    setMode(m); saveMode(m); setDrag(null)
    setMeter({ stage: 0, t0: performance.now(), power: 0 })
  }
  function shoot(angleDeg: number, speed: number) {
    if (!type || resolved.current) return
    resolved.current = true
    const ev = evaluate(type, rad(angleDeg), speed, build)
    onResolve(resultFor(type, ev.quality))
    setShot({ angle: rad(angleDeg), speed, ev, t0: performance.now() })
  }
  function meterTap() {
    if (!type || shot) return
    const tNow = performance.now()
    if (meter.stage === 0) { setMeter({ stage: 1, t0: tNow, power: meterValue(tNow - meter.t0, powerMs) }); return }
    shoot(angleValue(tNow - meter.t0, angleMs), meter.power * POWER_MAX * refSpeed(type))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shot) return
      if (!type) { const i = '1234'.indexOf(e.key); if (i >= 0 && types[i]) pickType(types[i]); return }
      if (mode === 'meter' && e.key === ' ') { e.preventDefault(); meterTap() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // --- arrasto ---
  const ballPx: Pt = [px(0), py(h0)]
  function toSvg(e: RPointerEvent): Pt {
    const r = svgRef.current!.getBoundingClientRect()
    return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]
  }
  function dragFrom(p: Pt) {
    const dx = ballPx[0] - p[0], dy = p[1] - ballPx[1]   // puxa pra trás/baixo = lança pra frente/cima
    const len = Math.hypot(dx, dy)
    const angle = clamp(Math.atan2(dy, dx) * 180 / Math.PI, 15, 75)
    return { angle, power: Math.min(1, len / MAX_DRAG), ptr: p }
  }
  const onBallDown = (e: RPointerEvent<SVGCircleElement>) => {
    if (mode !== 'drag' || !type || shot) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag(dragFrom(toSvg(e)))
  }
  const onBallMove = (e: RPointerEvent) => { if (drag) setDrag(dragFrom(toSvg(e))) }
  const onBallUp = () => {
    if (!drag || !type) return
    setDrag(null)
    if (drag.power > 0.06) shoot(drag.angle, drag.power * POWER_MAX * refSpeed(type))
  }

  // --- estado de mira (pra prever a trajetória) ---
  const meterAngle = angleValue(now - meter.t0, angleMs)
  const meterPower = meter.stage === 0 ? meterValue(now - meter.t0, powerMs) : meter.power
  const aim = shot ? null
    : mode === 'drag' ? (drag ? { angle: drag.angle, power: drag.power } : null)
    : meter.stage === 1 ? { angle: meterAngle, power: meter.power } : null
  let preview: string | null = null
  if (aim && type) {
    const tr = trajectory(rad(aim.angle), aim.power * POWER_MAX * refSpeed(type), h0)
    preview = Array.from({ length: 31 }, (_, i) => { const p = tr.pointAt(tr.tEnd * 1.08 * i / 30); return `${px(p.x)},${py(p.y)}` }).join(' ')
  }

  // --- animação do voo, obedecendo o outcome ---
  const fate: Fate = !shot ? 'swish'
    : outcome ? (outcome.success ? (shot.ev.quality > 0.7 ? 'swish' : 'bank') : shot.ev.verdict)
    : shot.ev.verdict === 'rimOut' ? 'swish' : shot.ev.verdict
  function ballNow(): Pt {
    if (!shot) return ballPx
    const el = now - shot.t0
    const tr = trajectory(shot.angle, shot.speed, h0)
    const tail = TAILS[fate](d)
    const physEnd = tr.pointAt(tr.tEnd)
    // erro grosseiro (>1m do aro): deixa a física seguir e cair no chão, sem "puxar" pro aro
    const wild = (fate === 'short' || fate === 'long') && Math.hypot(physEnd.x - tail[0][0], physEnd.y - tail[0][1]) > 1
    if (el < FLIGHT_MS) {
      const p = el / FLIGHT_MS, ph = tr.pointAt(p * tr.tEnd), phys: Pt = [px(ph.x), py(ph.y)]
      if (wild || p < 0.8) return phys
      return lerp(phys, [px(tail[0][0]), py(tail[0][1])], (p - 0.8) / 0.2)
    }
    const q = Math.min(1, (el - FLIGHT_MS) / TAIL_MS)
    if (wild) {
      const vy = shot.speed * Math.sin(shot.angle)
      const tFloor = (vy + Math.sqrt(vy * vy + 2 * G * (h0 - 0.12))) / G
      const p = tr.pointAt(tr.tEnd + (tFloor - tr.tEnd) * q)
      return [px(p.x), py(p.y)]
    }
    const p = polyAt(tail, q)
    return [px(p[0]), py(p[1])]
  }
  const ball = ballNow()

  // --- desenho ---
  const rimX = px(d), rimY = py(3.05)
  const boardX = rimX + 27
  const readAngle = shot ? shot.angle * 180 / Math.PI : aim?.angle ?? (mode === 'meter' ? meterAngle : null)
  const readPower = shot ? shot.speed / (POWER_MAX * refSpeed(type ?? 'three')) : aim?.power ?? (mode === 'meter' ? meterPower : null)
  const banner = scenario.backdrop === 'playoff' ? t(lang, 'game.kind.playoff') : scenario.backdrop === 'finals' ? t(lang, 'game.kind.finals') : null
  const stands: ReactNode[] = []
  for (let r = 0; r < STAND_ROWS; r++) for (let c = 0; c < STAND_COLS; c++) {
    const i = r * STAND_COLS + c, on = filled(i, scenario.crowd)
    const fill = on ? (scenario.backdrop === 'rivalry' ? 'var(--red)' : 'var(--rule)') : 'var(--paper-3)'
    stands.push(<rect key={i} x={10 + c * 38} y={70 + r * 34} width={32} height={26} fill={fill} />)
  }

  return (
    <div className="mg mg-shot">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="mg-sh-scene" role="img"
        onPointerDown={mode === 'meter' ? meterTap : undefined}>
        {/* fundo */}
        {banner && <>
          <rect x={0} y={14} width={W} height={34} fill="var(--ink)" />
          <text x={W / 2} y={38} textAnchor="middle" className="mg-sh-banner">{banner.toUpperCase()}</text>
        </>}
        {stands}
        {scenario.backdrop === 'finals' && CONFETTI.map(([x, y], i) =>
          <rect key={i} x={x} y={y} width={9} height={14} transform={`rotate(${(i * 37) % 90} ${x} ${y})`}
            fill={i % 3 === 0 ? 'var(--red)' : i % 3 === 1 ? 'var(--accent-warm)' : 'var(--ink)'} />)}
        <text x={16} y={200} className="mg-sh-tag">{t(lang, scenario.home ? 'mg.shot.home' : 'mg.shot.away')}</text>
        <rect x={0} y={FLOOR} width={W} height={H - FLOOR} fill="var(--paper-3)" />
        <line x1={0} y1={FLOOR} x2={W} y2={FLOOR} stroke="var(--ink)" strokeWidth={3} />

        {/* cesta */}
        <line x1={boardX + 40} y1={rimY - 40} x2={boardX + 40} y2={FLOOR} stroke="var(--ink)" strokeWidth={6} />
        <line x1={boardX + 8} y1={rimY - 40} x2={boardX + 40} y2={rimY - 40} stroke="var(--ink)" strokeWidth={6} />
        <rect x={boardX} y={rimY - 72} width={8} height={104} fill={scenario.home ? 'var(--paper-2)' : 'var(--red)'} stroke="var(--ink)" strokeWidth={3} />
        {Array.from({ length: 5 }, (_, i) =>
          <line key={i} x1={rimX - 18 + i * 9} y1={rimY} x2={rimX - 10 + i * 5} y2={rimY + 42} stroke="var(--ink)" strokeWidth={1.5} opacity={0.6} />)}
        <line x1={rimX - 21} y1={rimY} x2={rimX + 21} y2={rimY} stroke="var(--red)" strokeWidth={5} />
        <text x={rimX} y={FLOOR + 32} textAnchor="middle" className="mg-sh-tag">{d.toFixed(2)} m</text>

        {/* você */}
        <circle cx={SHOOTER_X - 30} cy={FLOOR - 172} r={16} fill="var(--ink)" />
        <rect x={SHOOTER_X - 44} y={FLOOR - 150} width={28} height={100} fill="var(--ink)" />
        <rect x={SHOOTER_X - 44} y={FLOOR - 50} width={11} height={50} fill="var(--ink)" />
        <rect x={SHOOTER_X - 27} y={FLOOR - 50} width={11} height={50} fill="var(--ink)" />
        <line x1={SHOOTER_X - 30} y1={FLOOR - 130} x2={ballPx[0] - 6} y2={ballPx[1] + 6} stroke="var(--ink)" strokeWidth={9} strokeLinecap="round" />
        {number !== null && <text x={SHOOTER_X - 30} y={FLOOR - 105} textAnchor="middle" className="mg-sh-num">{number}</text>}

        {/* mira */}
        {preview && <polyline points={preview} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="6 8" opacity={0.7} />}
        {drag && <line x1={ballPx[0]} y1={ballPx[1]} x2={drag.ptr[0]} y2={drag.ptr[1]} stroke="var(--red)" strokeWidth={3} strokeDasharray="4 4" />}
        {type && mode === 'meter' && !shot && <>
          <rect x={30} y={py(0.3) - 180} width={22} height={180} fill="var(--ink)" />
          <rect x={30} y={py(0.3) - 180 * meterPower} width={22} height={180 * meterPower} fill="var(--accent-warm)" />
          <line x1={26} y1={py(0.3) - 180 / POWER_MAX} x2={56} y2={py(0.3) - 180 / POWER_MAX} stroke="var(--red)" strokeWidth={3} />
          {meter.stage === 1 && <line x1={ballPx[0]} y1={ballPx[1]} x2={ballPx[0] + 130 * Math.cos(rad(meterAngle))} y2={ballPx[1] - 130 * Math.sin(rad(meterAngle))}
            stroke="var(--red)" strokeWidth={4} strokeLinecap="round" />}
        </>}

        {/* bola */}
        <circle cx={ball[0]} cy={ball[1]} r={12} fill="var(--red)" stroke="var(--ink)" strokeWidth={2} />
        {type && mode === 'drag' && !shot &&
          <circle cx={ballPx[0]} cy={ballPx[1]} r={60} fill="transparent" className={'mg-sh-ball' + (drag ? ' mg-sh-ball--drag' : '')}
            onPointerDown={onBallDown} onPointerMove={onBallMove} onPointerUp={onBallUp} onPointerCancel={onBallUp} />}
      </svg>

      <div className="mg-sh-bar">
        {!type ? <>
          <span className="mg-sh-label">{t(lang, 'mg.shot.pickType')}</span>
          <div className="mg-row">
            {types.map((tp, i) =>
              <button key={tp} type="button" onClick={() => pickType(tp)}
                className={'mg-btn' + (tp === 'three' ? ' mg-btn--warm' : tp === 'dunk' ? ' mg-btn--red' : '')}>
                <span className="mg-sh-key">{i + 1}</span>{t(lang, 'mg.type.' + tp)}
              </button>)}
          </div>
        </> : <div className="mg-sh-row">
          <div className="mg-sh-modes">
            {(['drag', 'meter'] as const).map(m =>
              <button key={m} type="button" disabled={!!shot} onClick={() => switchMode(m)}
                className={'mg-sh-mode' + (mode === m ? ' mg-sh-mode--on' : '')}>{t(lang, 'mg.shot.mode.' + m)}</button>)}
          </div>
          <span className="mg-sh-label">
            {shot ? t(lang, 'mg.type.' + type) : mode === 'drag' ? t(lang, 'mg.shot.dragHint') : t(lang, meter.stage === 0 ? 'mg.shot.tapPower' : 'mg.shot.tapAngle')}
          </span>
          <div className="mg-sh-readouts">
            <span>{t(lang, 'mg.shot.angle')} <b>{readAngle === null ? '--' : Math.round(readAngle)}°</b></span>
            <span>{t(lang, 'mg.shot.power')} <b>{readPower === null ? '--' : Math.round(readPower * 100)}%</b></span>
          </div>
        </div>}
      </div>

      {done && outcome && (
        <div className={'mg-result' + (!outcome.success || outcome.injury ? ' mg-result--bad' : '')}>
          <span>{t(lang, outcome.injury ? 'mg.result.injury' : outcome.success ? 'mg.result.hit' : 'mg.result.miss')}</span>
          <span className="mg-result__sub">{t(lang, 'mg.shot.' + fate)}</span>
        </div>)}
    </div>
  )
}
