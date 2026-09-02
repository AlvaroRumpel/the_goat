import type { Build, Rng, WatchedGameContext } from '../types'
import { clamp01, type MinigameResult } from './index'

// ARREMESSO — física 2D pura (spec §2.6). Vista lateral: x = distância horizontal (m),
// y = altura (m). Sem React, sem Math.random: o cenário sorteia por um Rng local injetado.

export const G = 9.81
export const RIM_H = 3.05
export const RIM_R = 0.225
export const RELEASE_H = 2.05
export const RELEASE_H_CLOSE = 2.30   // bandeja/enterrada
export const TOL = 0.55               // metros de erro que zeram a qualidade

export type ShotType = 'layup' | 'mid' | 'three' | 'dunk'
export type ShotVerdict = 'swish' | 'bank' | 'short' | 'long' | 'rimOut'

export const SHOT_TYPES: readonly ShotType[] = ['layup', 'mid', 'three', 'dunk']
export const DIST: Record<ShotType, number> = { layup: 1.5, mid: 5.0, three: 7.24, dunk: 0.6 }
export const OPTION_ID: Record<ShotType, string> = { layup: 'mgLayup', mid: 'mgMid', three: 'mgThree', dunk: 'mgDunk' }
// ângulo de referência da força "1.0" na UI (a enterrada só tem solução acima de ~51°)
export const REF_ANGLE: Record<ShotType, number> = { layup: 45, mid: 45, three: 45, dunk: 60 }

export const rad = (deg: number) => deg * Math.PI / 180
export const releaseHeight = (type: ShotType) => type === 'layup' || type === 'dunk' ? RELEASE_H_CLOSE : RELEASE_H

export function availableTypes(build: Build): ShotType[] {
  return SHOT_TYPES.filter(t => t !== 'dunk' || build.attributes.physical >= 75)
}

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

export const refSpeed = (type: ShotType) => idealSpeed(rad(REF_ANGLE[type]), DIST[type], releaseHeight(type))

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

export interface ShotEval {
  quality: number
  err: number          // |crossX − d| em metros (Infinity se nunca chega no aro)
  entryAngle: number   // graus, 0 quando nunca chega
  verdict: ShotVerdict // previsão pela física — só sabor da animação; o engine decide o acerto
}

export function evaluate(type: ShotType, angleRad: number, speed: number, _build: Build): ShotEval {
  const d = DIST[type], h0 = releaseHeight(type)
  if (type === 'dunk') {
    // enterrada: só a força importa — até 30% do ideal é perfeita, cai linear até 100%
    const rel = Math.abs(speed - refSpeed(type)) / refSpeed(type)
    const quality = rel <= 0.3 ? 1 : 1 - clamp01((rel - 0.3) / 0.7)
    return { quality, err: rel, entryAngle: 90, verdict: quality > 0.5 ? 'rimOut' : speed < refSpeed(type) ? 'short' : 'long' }
  }
  const x = crossX(angleRad, speed, h0)
  if (x === null) return { quality: 0, err: Infinity, entryAngle: 0, verdict: 'short' }
  const vy = Math.sqrt(speed * speed * Math.sin(angleRad) ** 2 - 2 * G * (RIM_H - h0))
  const entryAngle = Math.atan2(vy, speed * Math.cos(angleRad)) * 180 / Math.PI
  const err = Math.abs(x - d)
  let tol = TOL * (type === 'layup' ? 1.6 : 1)
  if (entryAngle < 32) tol /= 2
  const quality = 1 - clamp01(err / tol)
  const verdict: ShotVerdict = err < RIM_R ? 'rimOut' : x < d ? 'short' : 'long'
  return { quality, err, entryAngle, verdict }
}

export function resultFor(type: ShotType, quality: number): MinigameResult {
  return { optionId: OPTION_ID[type], quality: clamp01(quality) }
}

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
