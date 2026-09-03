import type { Rng } from '../types'
import { clamp01, type MinigameResult } from './index'
import { freeThrowP, timingHit, type AttrMods, type Tendencies } from './common'

// MURALHA (defesa, modo arcade) v2 — spec §4. Duelo 1x1 contínuo: a IA atacante escolhe
// movimentos por tendência, você desliza pra sombrear, toca pra roubar, sobe pra tocar.
// Puro: sem React, sem tempo real — o relógio é `dt` injetado por tick.

export type Move = 'hesi' | 'crossL' | 'crossR' | 'spin' | 'legs' | 'driveL' | 'driveR' | 'pumpFake' | 'shoot' | 'pass'
export interface DuelInput { tend: Tendencies; difficulty: number; mods: AttrMods; starOvr: number }
export interface DuelState {
  t: number; clock: number; attX: number; defX: number; attDist: number
  move: { kind: Move; at: number; dur: number } | null
  exposed: number; airborne: number; contain: number; live: number
  stealTries: number; fouled: boolean; bitFake: boolean; contestDist: number | null
  phase: 'live' | 'shot' | 'drive' | 'steal' | 'block' | 'foul' | 'clock' | 'done'
  log: Move[]; result?: MinigameResult; freeThrows?: [boolean, boolean]
}
export const CONE_HALF = 0.62
const POSSESSION = 8
const RELEASE = 0.45
const DUR: Record<Move, number> = { hesi: 0.5, crossL: 0.45, crossR: 0.45, spin: 0.7, legs: 0.5, driveL: 0.8, driveR: 0.8, pumpFake: 0.6, shoot: 0.9, pass: 0.3 }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function createDuel(_input: DuelInput): DuelState {
  return { t: 0, clock: POSSESSION, attX: 0, defX: 0, attDist: 7.5, move: null, exposed: 0, airborne: 0, contain: 0, live: 0, stealTries: 0, fouled: false, bitFake: false, contestDist: null, phase: 'live', log: [] }
}
export function inFront(s: DuelState): boolean { return Math.abs(s.attX - s.defX) < CONE_HALF }

function pickMove(s: DuelState, rng: Rng, input: DuelInput): Move {
  const { tend } = input
  const late = s.clock < 3 || s.log.length >= 2
  const w: Array<[Move, number]> = [['hesi', 0.9], ['crossL', 0.9], ['crossR', 0.9], ['spin', 0.4], ['legs', 0.8]]
  const sideR = tend.side === 'right'
  w.push(['driveR', tend.drive * 3 * (sideR ? 0.7 : 0.3)], ['driveL', tend.drive * 3 * (sideR ? 0.3 : 0.7)])
  if (late) { w.push(['shoot', tend.shoot * 4], ['pumpFake', tend.shoot * 1.6], ['pass', tend.pass * 2.5]) }
  if (s.airborne > 0) return sideR ? 'driveR' : 'driveL'          // você no ar: ele vai
  const total = w.reduce((n, [, x]) => n + x, 0)
  let r = rng.next() * total
  for (const [m, x] of w) { r -= x; if (r <= 0) return m }
  return w[w.length - 1][0]
}

function finishMove(s: DuelState, m: Move, _input: DuelInput): DuelState {
  switch (m) {
    case 'crossL': return { ...s, attX: clamp(s.attX - 0.9, -2.5, 2.5) }
    case 'crossR': return { ...s, attX: clamp(s.attX + 0.9, -2.5, 2.5) }
    case 'spin': return { ...s, attX: clamp(s.attX + (s.attX <= 0 ? 1.1 : -1.1), -2.5, 2.5) }
    case 'driveL': case 'driveR': {
      const dir = m === 'driveR' ? 1 : -1
      const beaten = !inFront(s) || s.airborne > 0
      if (beaten) return { ...s, attX: clamp(s.attX + dir * 0.6, -2.5, 2.5), attDist: 1.2, phase: 'drive' }
      return { ...s, attX: clamp(s.attX + dir * 0.3, -2.5, 2.5) }
    }
    case 'pass': return { ...s, phase: 'done' }
    case 'shoot': return { ...s, phase: 'shot' }
    default: return s
  }
}

export function step(s0: DuelState, dt: number, rng: Rng, input: DuelInput): DuelState {
  if (s0.phase !== 'live') return s0
  let s: DuelState = { ...s0, t: s0.t + dt, clock: s0.clock - dt, live: s0.live + dt }
  s.exposed = Math.max(0, s.exposed - dt); s.airborne = Math.max(0, s.airborne - dt)
  if (inFront(s) && s.airborne === 0) s.contain += dt
  if (s.clock <= 0) return finalize({ ...s, phase: 'clock' })
  if (!s.move) {
    const kind = pickMove(s, rng, input)
    s.move = { kind, at: s.t, dur: DUR[kind] / input.difficulty }
    s.log = [...s.log, kind]
    if (kind === 'legs') s.exposed = 0.35
    if (kind === 'crossL' || kind === 'crossR') s.exposed = 0.2
  }
  const m = s.move!
  if (m.kind === 'shoot' && s.contestDist === null && s.t - m.at >= RELEASE) {
    s.contestDist = Math.abs(s.attX - s.defX) + (s.airborne > 0 ? 0 : 0.8)
  }
  if (s.t - m.at >= m.dur) {
    s = finishMove(s, m.kind, input)
    s.move = null
    if (s.phase !== 'live') return finalize(s)
  }
  return s
}

export function slide(s: DuelState, dir: -1 | 1, input: DuelInput): DuelState {
  if (s.phase !== 'live' || s.airborne > 0) return s
  return { ...s, defX: clamp(s.defX + dir * 0.9 * input.mods.speed, -2.5, 2.5) }
}
export function trySteal(s: DuelState, rng: Rng, input: DuelInput): DuelState {
  if (s.phase !== 'live') return s
  if (s.exposed > 0 && s.exposed <= input.mods.stealWindow) return finalize({ ...s, phase: 'steal' })
  const tries = s.stealTries + 1
  if (tries >= 2) {
    const p = freeThrowP(input.starOvr)
    return finalize({ ...s, stealTries: tries, fouled: true, phase: 'foul', freeThrows: [rng.chance(p), rng.chance(p)] })
  }
  return { ...s, stealTries: tries, airborne: 1.2, attX: clamp(s.attX + (s.attX >= s.defX ? 1.2 : -1.2), -2.5, 2.5) }
}
export function jump(s: DuelState, input: DuelInput): DuelState {
  if (s.phase !== 'live' || s.airborne > 0) return s
  const m = s.move
  if (m?.kind === 'shoot' && s.t - m.at < RELEASE + 0.05 && Math.abs(s.attX - s.defX) <= 0.9) {
    const hit = timingHit(s.t - m.at, RELEASE, input.mods.jumpWindow * 2)
    if (hit !== 'miss') return finalize({ ...s, phase: 'block' })
    return { ...s, airborne: 0.7 }
  }
  if (m?.kind === 'pumpFake') return { ...s, airborne: 1.5, bitFake: true }
  return { ...s, airborne: 0.7 }
}

export function resultOf(s: DuelState): MinigameResult {
  const c = s.live > 0 ? clamp01(s.contain / s.live) : 0
  switch (s.phase) {
    case 'steal': return { optionId: 'mgSteal', quality: 1 }
    case 'block': return { optionId: 'mgContest', quality: 1 }
    case 'foul': return { optionId: 'mgLock', quality: 0.35, turnover: !!(s.freeThrows && s.freeThrows[0] && s.freeThrows[1]) }
    case 'drive': return { optionId: 'mgLock', quality: 0.15 }
    case 'shot': {
      const k = s.contestDist === null ? 0 : clamp01(1 - s.contestDist / 1.5)
      return { optionId: k >= 0.6 ? 'mgContest' : 'mgLock', quality: clamp01(0.5 * c + 0.3 * k + 0.2 * (s.bitFake ? 0 : 1)) }
    }
    default: return { optionId: 'mgLock', quality: c }
  }
}
function finalize(s: DuelState): DuelState { return { ...s, result: resultOf(s) } }
