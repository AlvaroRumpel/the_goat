import type { Build, Rng, SlotId } from '../types'
import { clamp01 } from './index'
import { ageMultiplier } from '../season'
import { bestDefender, type OppPlayer } from './common'

// ARREMESSO estilingue (spec 2026-09-03 arcade-ajustes §2). A cena é sorteada pela seed local
// (distância, altura de saída, defensor-obstáculo parado); o jogador puxa e solta (vetor →
// velocidade); o ruído de mira cresce com (1 − skill); a física decide onde a bola cruza o
// aro. Sem React, sem Math.random — só o Rng injetado.

export const G = 9.81
export const RIM_H = 3.05
export const ARC = 7.24
export const FINISH_D = 1.8
export const PULL_GAIN = 4.0                 // m/s por metro de puxada
export const SPEED_MIN = 2, SPEED_MAX = 14
export const rad = (deg: number) => deg * Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type ShotKind = 'layup' | 'mid' | 'three' | 'dunk'
const ATTR: Record<ShotKind, SlotId> = { layup: 'finishing', dunk: 'finishing', mid: 'handles', three: 'three' }
const OPTION: Record<ShotKind, string> = { layup: 'mgLayup', dunk: 'mgDunk', mid: 'mgMid', three: 'mgThree' }
const TOL: Record<ShotKind, number> = { layup: 0.8, dunk: 0.8, mid: 0.45, three: 0.45 }   // metros de erro até quality 0

// skill = clamp((atributo efetivo − 30) / 60, 0.25, 1) × (1 − fadiga × 0.5); 60 = 0.5 neutro
export function skillOf(build: Build, age: number, kind: ShotKind, fatigue = 0): number {
  const eff = build.attributes[ATTR[kind]] * ageMultiplier(age, build.attributes.physical)
  return clamp((eff - 30) / 60, 0.25, 1) * (1 - fatigue * 0.5)
}
export function freeThrowQuality(build: Build, age: number): number { return skillOf(build, age, 'three') }

// ---- cena (3 rng calls: d, releaseH, gap) ----
export interface ShotScene { d: number; releaseH: number; gap: number; who: OppPlayer; kind: ShotKind; optionId: string }
export function createScene(rng: Rng, five: OppPlayer[], build: Build, age: number): ShotScene {
  const d = 1.2 + rng.next() * 7.3
  const releaseH = 1.9 + rng.next() * 0.7
  const gap = Math.min(d - 0.4, 0.8 + rng.next() * 1.6)
  const phys = build.attributes.physical * ageMultiplier(age, build.attributes.physical)
  const kind: ShotKind = d < FINISH_D ? (phys >= 75 && d < 1.0 ? 'dunk' : 'layup') : d < ARC ? 'mid' : 'three'
  return { d, releaseH, gap, who: bestDefender(five), kind, optionId: OPTION[kind] }
}

// ---- lançamento ----
export interface Launch { angle: number; speed: number }            // rad, m/s
// (dx, dy) = ponto atual − ponto inicial da puxada, em metros, y pra cima; o lançamento é o oposto
export function launchFromPull(dx: number, dy: number): Launch | null {
  const len = Math.hypot(dx, dy)
  if (len < 0.15) return null
  return { angle: Math.atan2(-dy, -dx), speed: clamp(len * PULL_GAIN, SPEED_MIN, SPEED_MAX) }
}
// ruído de mira (2 calls, Box-Muller): σ ângulo = (1 − skill) × 5°, σ velocidade = (1 − skill) × 6 %
export function aimNoise(rng: Rng, skill: number, l: Launch): Launch {
  const u1 = Math.max(1e-9, rng.next()), u2 = rng.next()
  const r = Math.sqrt(-2 * Math.log(u1))
  const g1 = r * Math.cos(2 * Math.PI * u2), g2 = r * Math.sin(2 * Math.PI * u2)
  const k = 1 - skill
  return { angle: l.angle + g1 * k * rad(5), speed: l.speed * (1 + g2 * k * 0.06) }
}

// ---- física ----
export type Fate = 'in' | 'short' | 'long' | 'blocked'
export interface Flight { vx: number; vy: number; h0: number; tEnd: number; err: number; fate: Fate; accuracy: number }
export const flightPoint = (f: Flight, t: number) => ({ x: f.vx * t, y: f.h0 + f.vy * t - G * t * t / 2 })
// parábola sem arrasto: bloqueio se passa por baixo da mão em x = gap; senão erro = onde cruza
// a altura do aro descendo − d. tEnd = instante do desfecho (pra animação).
export function simulateShot(scene: ShotScene, l: Launch): Flight {
  const vx = l.speed * Math.cos(l.angle), vy = l.speed * Math.sin(l.angle), h0 = scene.releaseH
  const y = (t: number) => h0 + vy * t - G * t * t / 2
  const tGround = (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G
  const miss = (fate: Fate, tEnd: number): Flight => ({ vx, vy, h0, tEnd, err: -Infinity, fate, accuracy: 0 })
  if (vx <= 0) return miss('short', tGround)
  const tb = scene.gap / vx
  if (tb < tGround && y(tb) < scene.who.reach) return miss('blocked', tb)
  const disc = vy * vy - 2 * G * (RIM_H - h0)
  if (disc < 0) return miss('short', tGround)
  const tc = (vy + Math.sqrt(disc)) / G
  const err = vx * tc - scene.d
  const accuracy = clamp01(1 - Math.abs(err) / TOL[scene.kind])
  const fate: Fate = err < -0.1 ? 'short' : err > 0.1 ? 'long' : 'in'
  return { vx, vy, h0, tEnd: tc, err, fate, accuracy }
}
// quality = precisão geométrica × (0.6 + 0.4 skill): skill já entrou no ruído; aqui só encosta
export function shotQuality(f: Flight, skill: number): number { return f.accuracy * (0.6 + 0.4 * skill) }

// ---- parábola automática (lance livre) ----
// v tal que a bola passa pelo centro do aro: v² = g d² / (2 cos²θ (d tanθ − h)). NaN se raso demais.
export function idealSpeed(angleRad: number, d: number, releaseH: number): number {
  const h = RIM_H - releaseH
  const c = Math.cos(angleRad)
  const denom = 2 * c * c * (d * Math.tan(angleRad) - h)
  if (!(denom > 0)) return NaN
  const v2 = G * d * d / denom
  return Number.isFinite(v2) && v2 > 0 ? Math.sqrt(v2) : NaN
}
export interface Trajectory { pointAt: (t: number) => { x: number; y: number }; tEnd: number }
export function trajectory(angleRad: number, speed: number, releaseH: number): Trajectory {
  const vx = speed * Math.cos(angleRad), vy = speed * Math.sin(angleRad)
  const disc = vy * vy - 2 * G * (RIM_H - releaseH)
  const root = disc < -1e-9 ? null : Math.sqrt(Math.max(0, disc))
  // arcos rasos (~45°) cruzam a altura do aro descendo (raiz maior); muito íngremes de perto ainda sobem (raiz menor)
  const tCross = root === null ? null : angleRad > rad(50) ? (vy - root) / G : (vy + root) / G
  return { pointAt: t => ({ x: vx * t, y: releaseH + vy * t - G * t * t / 2 }), tEnd: tCross ?? 2 * vy / G }
}
