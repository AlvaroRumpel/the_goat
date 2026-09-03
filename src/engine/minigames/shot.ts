import type { Build, Rng, WatchedGameContext } from '../types'
import type { MinigameResult } from './index'
import { ageMultiplier } from '../season'
import { timingHit, type AttrMods, type OppPlayer } from './common'

// ARREMESSO — física 2D pura (spec §2.6). Vista lateral: x = distância horizontal (m),
// y = altura (m). Sem React, sem Math.random: o cenário sorteia por um Rng local injetado.

export const G = 9.81
export const RIM_H = 3.05

export const rad = (deg: number) => deg * Math.PI / 180

// v tal que a bola passa pelo centro do aro: v² = g d² / (2 cos²θ (d tanθ − h)). NaN se
// o ângulo é raso demais pra chegar na altura do aro.
export function idealSpeed(angleRad: number, d: number, releaseH: number): number {
  const h = RIM_H - releaseH
  const c = Math.cos(angleRad)
  const denom = 2 * c * c * (d * Math.tan(angleRad) - h)
  if (!(denom > 0)) return NaN
  const v2 = G * d * d / denom
  return Number.isFinite(v2) && v2 > 0 ? Math.sqrt(v2) : NaN
}

export interface Trajectory {
  pointAt: (t: number) => { x: number; y: number }
  tEnd: number      // instante em que cruza a altura do aro descendo (ou volta à altura de saída)
}

export function trajectory(angleRad: number, speed: number, releaseH: number): Trajectory {
  const vx = speed * Math.cos(angleRad), vy = speed * Math.sin(angleRad)
  const tCross = crossTime(vy, releaseH)
  return {
    pointAt: t => ({ x: vx * t, y: releaseH + vy * t - G * t * t / 2 }),
    tEnd: tCross ?? 2 * vy / G,
  }
}

// t da segunda raiz de releaseH + vy t − g t²/2 = RIM_H (descendo); null se não chega lá.
function crossTime(vy: number, releaseH: number): number | null {
  const disc = vy * vy - 2 * G * (RIM_H - releaseH)
  if (disc < 0) return null
  return (vy + Math.sqrt(disc)) / G
}

export function crossX(angleRad: number, speed: number, releaseH: number): number | null {
  const t = crossTime(speed * Math.sin(angleRad), releaseH)
  return t === null ? null : speed * Math.cos(angleRad) * t
}

export type ShotType = 'layup' | 'floater' | 'mid' | 'stepback' | 'fadeaway' | 'three' | 'bank' | 'dunk'
export interface ShotSpec { d: number; releaseH: number; tol: number; sep: number; optionId: string; tolKey: keyof AttrMods['tol'] }
export const SHOTS: Record<ShotType, ShotSpec> = {
  layup:    { d: 1.5,  releaseH: 2.3,  tol: 0.88, sep: 0,   optionId: 'mgLayup', tolKey: 'layup' },
  floater:  { d: 2.8,  releaseH: 2.35, tol: 0.5,  sep: 0.4, optionId: 'mgLayup', tolKey: 'floater' },
  mid:      { d: 5.0,  releaseH: 2.05, tol: 0.55, sep: 0,   optionId: 'mgMid',   tolKey: 'mid' },
  stepback: { d: 7.6,  releaseH: 2.05, tol: 0.44, sep: 1.2, optionId: 'mgThree', tolKey: 'three' },
  fadeaway: { d: 5.2,  releaseH: 2.15, tol: 0.47, sep: 0.8, optionId: 'mgMid',   tolKey: 'mid' },
  three:    { d: 7.24, releaseH: 2.05, tol: 0.55, sep: 0,   optionId: 'mgThree', tolKey: 'three' },
  bank:     { d: 4.2,  releaseH: 2.05, tol: 0.6,  sep: 0,   optionId: 'mgMid',   tolKey: 'mid' },
  dunk:     { d: 0.6,  releaseH: 2.3,  tol: 0.3,  sep: 0,   optionId: 'mgDunk',  tolKey: 'dunk' },
}
const ORDER: ShotType[] = ['layup', 'floater', 'mid', 'stepback', 'fadeaway', 'three', 'bank', 'dunk']

// ângulo de referência usado pra calibrar a "força 1.0" da UI por tipo (enterrada só tem
// solução acima de ~51°, os demais usam um arco confortável de 45°).
const REF_ANGLE: Record<ShotType, number> = { layup: 45, floater: 45, mid: 45, stepback: 45, fadeaway: 45, three: 45, bank: 45, dunk: 60 }
export const refSpeed = (type: ShotType) => idealSpeed(rad(REF_ANGLE[type]), SHOTS[type].d, SHOTS[type].releaseH)

export function availableTypes(build: Build, age: number): ShotType[] {
  const m = ageMultiplier(age, build.attributes.physical); const a = build.attributes
  return ORDER.filter(t =>
    t === 'floater' ? a.finishing * m >= 60 : t === 'stepback' ? a.handles * m >= 70 : t === 'fadeaway' ? a.clutch * m >= 70 : t === 'dunk' ? a.physical * m >= 75 : true)
}

export interface Closeout { x: number; speed: number; handUp: boolean; arrived: boolean; handX: number; handH: number }
export function createCloseout(rng: Rng, opts: { difficulty: number; defender: OppPlayer; sep: number }): Closeout {
  const x = 2.5 + rng.next() * 1.5 + opts.sep
  return { x, speed: opts.defender.speed * opts.difficulty, handUp: false, arrived: false, handX: x, handH: opts.defender.reach }
}
export function stepCloseout(c: Closeout, dt: number): Closeout {
  const x = Math.max(0.3, c.x - c.speed * dt)
  return { ...c, x, handX: x, handUp: x <= 1.2, arrived: x <= 0.5 }
}

export type Jump = 'perfect' | 'hit' | 'miss' | null
export interface EvalOpts { closeout: Closeout | null; jump: Jump; mods: AttrMods; bankAim?: boolean }
export interface ShotEval { quality: number; err: number; entryAngle: number; verdict: 'swish' | 'bank' | 'short' | 'long' | 'rimOut' | 'blocked'; blocked: boolean; contested: boolean }

// altura da bola quando passa por x (subindo ou descendo) — null se nunca chega (vx ≤ 0)
function heightAtX(angle: number, speed: number, releaseH: number, x: number): number | null {
  const vx = speed * Math.cos(angle); if (vx <= 0) return null
  const t = x / vx
  return releaseH + speed * Math.sin(angle) * t - 0.5 * G * t * t
}

// ângulo de entrada no aro (graus) no cruzamento descendente, por conservação de energia:
// vy_cross² = vy_lançamento² − 2g(RIM_H − releaseH). 0 se a parábola nunca alcança a altura do aro.
function entryAngleOf(angle: number, speed: number, releaseH: number): number {
  const vy2 = speed * speed * Math.sin(angle) ** 2 - 2 * G * (RIM_H - releaseH)
  if (!(vy2 >= 0)) return 0
  return Math.atan2(Math.sqrt(vy2), speed * Math.cos(angle)) * 180 / Math.PI
}

// tabela: reflete a bola num plano vertical em d+0.15 (restituição 0.7) e devolve o x onde
// a trajetória refletida cruza a altura do aro descendo; null se não bate na tabela ou não volta.
export function bankCrossX(angle: number, speed: number, releaseH: number, d: number): number | null {
  const board = d + 0.15, vx = speed * Math.cos(angle), vy = speed * Math.sin(angle)
  if (vx <= 0) return null
  const tb = board / vx; const yb = releaseH + vy * tb - 0.5 * G * tb * tb
  if (yb < RIM_H - 0.1 || yb > RIM_H + 1.1) return null       // não acerta a tabela na zona útil
  const vyb = vy - G * tb; const vxr = -vx * 0.7                // reflexão: x inverte com restituição 0.7
  // após refletir: y(t) = yb + vyb t − ½g t², x(t) = board + vxr t; cruza RIM_H descendo
  const a = -0.5 * G, b = vyb, c = yb - RIM_H
  const disc = b * b - 4 * a * c; if (disc < 0) return null
  const t1 = (-b - Math.sqrt(disc)) / (2 * a), t2 = (-b + Math.sqrt(disc)) / (2 * a)
  const t = Math.max(t1, t2); if (t <= 0) return null
  return board + vxr * t
}

export function evaluate(type: ShotType, angle: number, speed0: number, opts: EvalOpts): ShotEval {
  const s = SHOTS[type]; const speed = speed0 * (1 - opts.mods.fatigue * 0.5)
  const co = opts.closeout
  if (co?.handUp) {
    const h = heightAtX(angle, speed, s.releaseH, co.handX)
    if (h !== null && co.handX < s.d && h < co.handH) return { quality: 0, err: Infinity, entryAngle: 0, verdict: 'blocked', blocked: true, contested: true }
  }
  if (type === 'dunk') {
    const ref = refSpeed('dunk'); const q = Math.max(0, 1 - Math.max(0, Math.abs(speed - ref) / ref - 0.3) / 0.7)
    return { quality: q, err: Math.abs(speed - ref), entryAngle: 90, verdict: q > 0.5 ? 'swish' : 'rimOut', blocked: false, contested: !!co?.arrived }
  }
  const cross = opts.bankAim ? bankCrossX(angle, speed, s.releaseH, s.d) : crossX(angle, speed, s.releaseH)
  let tol = s.tol * opts.mods.tol[s.tolKey] * (opts.jump === 'perfect' ? 1.15 : opts.jump === 'miss' ? 0.7 : 1.0) * (opts.bankAim ? 1.1 : 1)
  const contested = !!co?.arrived; if (contested) tol *= 0.6
  if (cross === null) return { quality: 0, err: Infinity, entryAngle: 0, verdict: 'short', blocked: false, contested }
  const err = Math.abs(cross - s.d)
  const entry = entryAngleOf(angle, speed, s.releaseH)
  if (entry < 32) tol *= 0.5
  const quality = Math.max(0, 1 - err / tol)
  const verdict = quality > 0.7 ? (opts.bankAim ? 'bank' : 'swish') : err < 0.12 ? 'rimOut' : cross < s.d ? 'short' : 'long'
  return { quality, err, entryAngle: entry, verdict, blocked: false, contested }
}

export function resultFor(type: ShotType, ev: ShotEval): MinigameResult { return { optionId: SHOTS[type].optionId, quality: ev.quality } }
export function freeThrowQuality(q: [number, number]): number { return (q[0] + q[1]) / 2 }
export function jumpTiming(t: number, apex: number, mods: AttrMods): Jump { return timingHit(t, apex, mods.jumpWindow) }

export type Backdrop = 'regular' | 'rivalry' | 'playoff' | 'finals'
export interface ShotScenario { backdrop: Backdrop; home: boolean; crowd: number; meterSpeed: 1 | 1.25 }

export function scenarioFor(ctx: WatchedGameContext, rng: Rng): ShotScenario {
  const backdrop: Backdrop = ctx.kind === 'rivalry' || ctx.kind === 'playoff' || ctx.kind === 'finals' ? ctx.kind : 'regular'
  return { backdrop, home: rng.chance(0.5), crowd: rng.next(), meterSpeed: ctx.kind === 'finals' ? 1.25 : 1 }
}

// medidor: onda triangular 0..1 (sobe e desce em `periodMs`)
export function meterValue(tMs: number, periodMs: number): number {
  const p = ((tMs % periodMs) + periodMs) % periodMs / periodMs
  return p < 0.5 ? p * 2 : 2 - p * 2
}

export const ANGLE_MIN = 25, ANGLE_MAX = 70
// ponteiro de ângulo: varre 25°..70° e volta
export function angleValue(tMs: number, periodMs: number): number {
  return ANGLE_MIN + (ANGLE_MAX - ANGLE_MIN) * meterValue(tMs, periodMs)
}
