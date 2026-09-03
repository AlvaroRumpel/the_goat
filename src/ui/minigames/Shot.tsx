import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { attrMods, opponentFive } from '../../engine/minigames/common'
import {
  availableTypes, createStaticDefender, rad, refSpeed, REF_ANGLE, resultFor, RIM_H, SHOTS, shotOpenness,
  shotQuality, skillOf, trajectory, type ShotType, type StaticDefender,
} from '../../engine/minigames/shot'

// ARREMESSO 2D (spec 2026-09-03 §B): vista lateral em SVG, papel sépia. Você à esquerda,
// aro na distância do tipo, defensor ESTÁTICO entre vocês. Escolher o tipo É o arremesso
// (quality = skill × abertura, engine). A bola voa na parábola ideal e o desfecho OBEDECE
// `outcome.success`.

export const FLIGHT_MS = 900
const M = 30                      // metros → px do viewBox
const X0 = 34                     // você
const GY = 186                    // chão
const W = 300, H = 200
const px = (xm: number) => X0 + xm * M
const py = (h: number) => Math.min(GY, Math.max(2, GY - h * M))

export type Fate = 'swish' | 'bank' | 'short' | 'long' | 'rimOut' | 'blocked'
type Phase = 'pick' | 'flight' | 'done'
export const TYPE_KEY: Record<ShotType, string> = {
  layup: 'mg.type.layup', mid: 'mg.type.mid', three: 'mg.type.three', dunk: 'mg.type.dunk',
  floater: 'mg.shot.type.floater', stepback: 'mg.shot.type.stepback', fadeaway: 'mg.shot.type.fadeaway', bank: 'mg.shot.type.bank',
}
// ponto final da animação em metros relativo ao aro (x) e altura (y)
const END: Record<Fate, [number, number]> = {
  swish: [0, RIM_H - 0.2], bank: [0, RIM_H - 0.2], short: [-1.2, RIM_H - 1.0],
  long: [0.8, RIM_H - 0.35], rimOut: [0.4, RIM_H + 0.15], blocked: [0, 0],
}

export function ShotGame({ seed, context, build, age, quarter, league, number, lastName, lang, onResolve, outcome }: MinigameProps): JSX.Element {
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const mods = useMemo(() => attrMods(build, age, quarter), [build, age, quarter])
  const types = useMemo(() => availableTypes(build, age), [build, age])
  // seed local: 1 call (gap do defensor) — criado UMA vez
  const boot = useRef<{ rng: Rng; def: StaticDefender } | null>(null)
  if (!boot.current) { const rng = createRng(seed); boot.current = { rng, def: createStaticDefender(rng, five) } }
  const def = boot.current.def

  const [phase, setPhase] = useState<Phase>('pick')
  const [type, setType] = useState<ShotType | null>(null)
  const [quality, setQuality] = useState(0)
  const [, setFrame] = useState(0)
  const t0 = useRef(0)
  const now = useRef(0)
  const resolved = useRef(false)
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  const pick = (tp: ShotType) => {
    if (resolved.current) return
    resolved.current = true
    const q = shotQuality(tp, def.gap, build, age, mods)
    setType(tp); setQuality(q)
    t0.current = performance.now(); now.current = t0.current
    setPhase('flight')
    onResolveRef.current(resultFor(tp, q))
  }

  // voo: rAF até FLIGHT_MS, depois 'done' (o overlay entra quando `outcome` chega)
  useEffect(() => {
    if (phase !== 'flight') return
    let raf = 0
    const loop = (ts: number) => {
      now.current = ts
      if (ts - t0.current >= FLIGHT_MS) { setPhase('done'); return }
      setFrame(f => f + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  // teclado: 1..8 escolhe (guarda: e.key de 1 char — ''.indexOf('') é 0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { const i = e.key.length === 1 ? '12345678'.indexOf(e.key) : -1; if (i >= 0 && types[i]) pick(types[i]) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types])

  // desfecho obedece o engine; a narração fecha a conta
  const open = type ? shotOpenness(type, def.gap) : 1
  const fate: Fate | null = !type ? null : !outcome ? null
    : outcome.success ? (type === 'bank' ? 'bank' : 'swish')
    : open < 0.25 ? 'blocked' : quality >= 0.6 ? 'rimOut' : seed % 2 === 0 ? 'short' : 'long'

  const d = type ? SHOTS[type].d : SHOTS.three.d
  const hoop = px(d), rimY = py(RIM_H)
  const defX = px(def.gap + (type ? SHOTS[type].sep : 0))
  const handUp = def.gap + (type ? SHOTS[type].sep : 0) < 1.0
  const ball = ballAt(phase, type, fate, now.current - t0.current, d, def)

  return (
    <div className="mg mg-shot">
      <div className="mg-sh-stage">
        <svg className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect className="mg-sh__paper" x={0} y={0} width={W} height={H} />
          {Array.from({ length: 12 }, (_, i) => <rect key={i} className={'mg-sh__plank' + (i % 2 ? ' mg-sh__plank--b' : '')} x={i * 25} y={GY} width={25} height={H - GY} />)}
          <line className="mg-sh__floor" x1={0} y1={GY} x2={W} y2={GY} />
          <line className="mg-sh__rig" x1={hoop + 0.55 * M} y1={GY} x2={hoop + 0.55 * M} y2={rimY - 1.0 * M} />
          <line className="mg-sh__board" x1={hoop + 0.15 * M} y1={rimY - 1.05 * M} x2={hoop + 0.15 * M} y2={rimY + 0.3 * M} />
          <line className="mg-sh__rim" x1={hoop - 0.32 * M} y1={rimY} x2={hoop + 0.15 * M} y2={rimY} />
          <path className="mg-sh__net" d={`M ${hoop - 0.28 * M} ${rimY} L ${hoop - 0.08 * M} ${rimY + 0.5 * M} L ${hoop + 0.11 * M} ${rimY}`} />
          <Figure x={defX} them handUp={handUp} label={def.who.short} />
          <Figure x={X0} them={false} handUp={phase !== 'pick'} label={`${number ?? ''} ${lastName}`.trim()} />
          <circle className="mg-sh__ball" cx={px(ball.x)} cy={py(ball.y)} r={5} />
        </svg>
        <div className="mg-sh-hud">
          <div className="mg-sh-hud__row">
            <span className="mono-label mono-label--red">{t(lang, 'mg.shot.phase.' + (phase === 'done' ? 'flight' : phase))}</span>
            <span className="mg-sh-tagline">{t(lang, 'mg.shot.defender')} · {def.who.short} · {def.gap.toFixed(1)} m</span>
          </div>
          {type && <span className="mg-sh-tagline">{t(lang, TYPE_KEY[type])} · {SHOTS[type].d.toFixed(1)} m</span>}
        </div>
      </div>

      <div className="mg-sh-bar">
        {phase === 'pick' ? <>
          <span className="mg-sh-label">{t(lang, 'mg.shot.pickType')}</span>
          <div className="mg-sh-pick">
            {types.map((tp, i) => {
              const sk = skillOf(build, age, tp, mods.fatigue), op = shotOpenness(tp, def.gap)
              return (
                <button key={tp} type="button" className="mg-btn mg-sh-pickbtn" onClick={() => pick(tp)}>
                  <span className="mg-sh-pickbtn__top">
                    <span><span className="mg-sh-key">{i + 1}</span>{t(lang, TYPE_KEY[tp])}</span>
                    <span className="mg-sh-key">{SHOTS[tp].d.toFixed(1)} m</span>
                  </span>
                  <span className="mg-sh-bars">
                    <Bar label={t(lang, 'mg.shot.skill')} v={sk} />
                    <Bar label={t(lang, 'mg.shot.open')} v={op} bad={op < 0.35} />
                  </span>
                </button>
              )
            })}
          </div>
        </> : <span className="mg-sh-label">{t(lang, TYPE_KEY[type!])}</span>}
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

function Bar({ label, v, bad }: { label: string; v: number; bad?: boolean }): JSX.Element {
  return (
    <span className="mg-sh-bar__line">
      <span className="mg-sh-bar__label">{label}</span>
      <span className="bar"><span className={'bar__fill' + (bad ? ' bar__fill--bad' : '')} style={{ width: `${Math.round(v * 100)}%` }} /></span>
    </span>
  )
}

// boneco de traço: pernas, tronco, cabeça, braço (levantado = mão em cima / arremessando)
function Figure({ x, them, handUp, label }: { x: number; them: boolean; handUp: boolean; label: string }): JSX.Element {
  const hip = py(0.95), head = py(handUp ? 1.95 : 1.75)
  return (
    <g className={'mg-sh__fig' + (them ? ' mg-sh__fig--them' : '')}>
      <line x1={x} y1={GY} x2={x - 6} y2={hip} />
      <line x1={x} y1={GY} x2={x + 6} y2={hip} />
      <line x1={x} y1={hip} x2={x} y2={head + 5} />
      <line x1={x} y1={py(1.5)} x2={x + (them ? -8 : 8)} y2={py(handUp ? 2.6 : 1.15)} />
      <circle cx={x} cy={head} r={5} />
      <text x={x} y={GY + 11} textAnchor="middle" className="mg-sh__tag">{label}</text>
    </g>
  )
}

// bola: na mão até soltar; no voo segue a parábola ideal e nos últimos 20% converge
// pro ponto do desfecho (que OBEDECE `outcome`)
function ballAt(phase: Phase, type: ShotType | null, fate: Fate | null, elapsed: number, d: number, def: StaticDefender): { x: number; y: number } {
  if (phase === 'pick' || !type) return { x: 0.35, y: 1.15 }
  const s = SHOTS[type]
  const tr = trajectory(rad(REF_ANGLE[type]), refSpeed(type), s.releaseH)
  const p = Math.min(1, Math.max(0, elapsed / FLIGHT_MS))
  const pt = tr.pointAt(p * tr.tEnd)
  const mix = (a: number, b: number, k: number) => a + (b - a) * k
  if (fate === 'blocked') {
    const k = Math.min(1, p / 0.35)
    return { x: mix(pt.x, def.gap + s.sep, k), y: mix(pt.y, 2.8, k) - Math.max(0, p - 0.35) * 4 }
  }
  if (p <= 0.8 || !fate) return pt
  const [ex, ey] = END[fate]
  const k = (p - 0.8) / 0.2
  return { x: mix(pt.x, d + ex, k), y: mix(pt.y, ey, k) }
}
