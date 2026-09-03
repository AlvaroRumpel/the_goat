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
export const SPIN_MAX = 3.5                  // rev/s de backspin (arremessador de elite)
export const spinOf = (skill: number) => clamp(1 + (SPIN_MAX - 1) * (skill - 0.25) / 0.75, 1, SPIN_MAX)
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
export interface Launch { angle: number; speed: number; spin?: number }   // rad, m/s, rev/s de backspin
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
  return { ...l, angle: l.angle + g1 * k * rad(5), speed: l.speed * (1 + g2 * k * 0.06) }
}

// ---- física ----
export type Fate = 'in' | 'flat' | 'short' | 'long' | 'blocked'
export interface Flight { vx: number; vy: number; h0: number; tEnd: number; err: number; fate: Fate; accuracy: number; entry: number; spin: number }
export const flightPoint = (f: Flight, t: number) => ({ x: f.vx * t, y: f.h0 + f.vy * t - G * t * t / 2 })
// ângulo de entrada: a janela útil do aro é 2·RIM_R·sin φ − 2·BALL_R — raso não entra limpo.
// entrada 28° = 0 · 34° = 0.3 · 41° = 0.66 · ≥ 48° = 1 (lançamento de 6 m: 45° entra a ~34°, 50° a ~41°, 55° a ~48°)
const ENTRY_LO = Math.sin(rad(28)), ENTRY_HI = Math.sin(rad(48))
export const entryFactor = (entry: number) => clamp01((Math.sin(entry) - ENTRY_LO) / (ENTRY_HI - ENTRY_LO))
// parábola sem arrasto: bloqueio se passa por baixo da mão em x = gap; senão erro = onde cruza
// a altura do aro descendo − d, pesado pelo ângulo de entrada; backspin alarga a tolerância
// (aro amigo: TOL × (0.75 + 0.5 × spin/SPIN_MAX)). tEnd = instante do desfecho (pra animação).
export function simulateShot(scene: ShotScene, l: Launch): Flight {
  const vx = l.speed * Math.cos(l.angle), vy = l.speed * Math.sin(l.angle), h0 = scene.releaseH
  const spin = l.spin ?? 0, s = clamp01(spin / SPIN_MAX)
  const y = (t: number) => h0 + vy * t - G * t * t / 2
  const tGround = (vy + Math.sqrt(vy * vy + 2 * G * h0)) / G
  const miss = (fate: Fate, tEnd: number): Flight => ({ vx, vy, h0, tEnd, err: -Infinity, fate, accuracy: 0, entry: 0, spin })
  if (vx <= 0) return miss('short', tGround)
  const tb = scene.gap / vx
  if (tb < tGround && y(tb) < scene.who.reach) return miss('blocked', tb)
  const disc = vy * vy - 2 * G * (RIM_H - h0)
  if (disc < 0) return miss('short', tGround)
  const tc = (vy + Math.sqrt(disc)) / G
  const err = vx * tc - scene.d
  const entry = Math.atan2(G * tc - vy, vx)
  const k = entryFactor(entry)
  const accuracy = clamp01(1 - Math.abs(err) / (TOL[scene.kind] * (0.75 + 0.5 * s))) * (0.25 + 0.75 * k)
  const fate: Fate = err < -0.1 ? 'short' : err > 0.1 ? 'long' : k < 0.4 ? 'flat' : 'in'
  return { vx, vy, h0, tEnd: tc, err, fate, accuracy, entry, spin }
}
// quality = precisão geométrica × (0.6 + 0.4 skill): skill já entrou no ruído; aqui só encosta
export function shotQuality(f: Flight, skill: number): number { return f.accuracy * (0.6 + 0.4 * skill) }

// ---- desfecho físico (animação): a bola de verdade — aro, tabela, chão, mão ----
export const BALL_R = 0.12, RIM_R = 0.225, BOARD_X = 0.375   // tabela 0.15 m atrás do aro
export const BOARD_LO = RIM_H - 0.3, BOARD_HI = RIM_H + 0.75
const SIM_DT = 1 / 240, SIM_MAX = 3.5

// A animação OBEDECE o outcome mexendo só em vx (a quality já foi calculada): acerto → cruza o aro
// no centro; erro com geometria "in" → ±0.16 m = bate no aro. Acerto sem arco até o aro (toco,
// bola curta demais — p mínimo de 5 %) vira arco ideal limpo, sem a mão no caminho.
export function stageFlight(scene: ShotScene, f: Flight, success: boolean): Flight {
  if (!success) {
    if (f.fate !== 'in' && f.fate !== 'flat') return f
    const err = f.err >= 0 ? 0.16 : -0.16
    return { ...f, vx: (scene.d + err) / f.tEnd, err }
  }
  if (f.fate === 'blocked' || !Number.isFinite(f.err)) {
    const clear = { ...scene, who: { ...scene.who, reach: -1 } }
    const ang = rad(scene.d < 3 ? 65 : 55)          // arco limpo (ápice antes do aro em qualquer d/altura)
    return simulateShot(clear, { angle: ang, speed: idealSpeed(ang, scene.d, f.h0) })
  }
  return { ...f, vx: scene.d / f.tEnd, err: 0 }
}

// Sim 240 Hz amostrada a `hz`: gravidade, tabela (parede), aro (dois pontos, círculo × ponto,
// e = 0.5), chão (e = 0.5, atrito), mão dele (parede em x = gap, só quando o engine disse toco).
// Backspin: no contato com aro/tabela a bola "morre" (mata vx/vy proporcional ao giro) e o giro
// decai; `r` = rotação acumulada (rad) pro desenho. Passa pelo aro só no acerto (a rede freia);
// no erro o aro "cospe" — nunca cai dentro.
// ponytail: no acerto ignora o aro (arco raso pode raspar a frente visualmente); bola sempre passa limpa.
export interface PathPoint { x: number; y: number; r: number }
export function ballPath(scene: ShotScene, f: Flight, success: boolean, hz = 60): PathPoint[] {
  let x = 0, y = f.h0, vx = f.vx, vy = f.vy, t = 0, through = false, handHit = false
  let w = f.spin, r = 0
  const s = () => clamp01(w / SPIN_MAX)
  const out: PathPoint[] = [{ x, y, r }]
  const bx = scene.d + BOARD_X
  const rimPts = [scene.d - RIM_R, scene.d + RIM_R]
  const every = Math.max(1, Math.round(1 / hz / SIM_DT))
  for (let i = 1; t < SIM_MAX; i++) {
    const py = y
    vy -= G * SIM_DT; x += vx * SIM_DT; y += vy * SIM_DT; t += SIM_DT; r += w * 2 * Math.PI * SIM_DT
    if (f.fate === 'blocked' && !handHit && x + BALL_R >= scene.gap) { handHit = true; x = scene.gap - BALL_R; vx = -Math.abs(vx) * 0.25; vy = Math.min(vy, 0); w *= 0.3 }
    if (vx > 0 && x + BALL_R > bx && y > BOARD_LO && y < BOARD_HI) { x = bx - BALL_R; vx = -vx * 0.6 * (1 - 0.4 * s()); w *= 0.5 }
    if (!success && !through) {
      for (const rx of rimPts) {
        const dx = x - rx, dy = y - RIM_H, dist = Math.hypot(dx, dy)
        if (dist < BALL_R && dist > 1e-9) {
          const nx = dx / dist, ny = dy / dist, vn = vx * nx + vy * ny
          if (vn < 0) { vx -= 1.5 * vn * nx; vy -= 1.5 * vn * ny; const k = s(); vx *= 1 - 0.45 * k; vy *= 1 - 0.25 * k; w *= 0.6 }
          x = rx + nx * BALL_R; y = RIM_H + ny * BALL_R
        }
      }
    }
    if (!through && py >= RIM_H && y < RIM_H && Math.abs(x - scene.d) < RIM_R - BALL_R) {
      if (success) { through = true; vx *= 0.3; vy *= 0.6 }
      else { y = RIM_H; vy = Math.max(-vy * 0.4, 1); vx += (x >= scene.d ? 1 : -1) * 1.2 }
    }
    if (y < BALL_R) {
      y = BALL_R
      if (Math.abs(vy) < 0.4) { vy = 0; vx *= 0.985; w *= 0.985 } else { vy = -vy * 0.5; vx *= 0.7; w *= 0.5 }
    }
    if (i % every === 0) out.push({ x, y, r })
    if (y <= BALL_R + 1e-9 && vy === 0 && Math.abs(vx) < 0.05) break
  }
  return out
}

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
