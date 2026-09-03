import type { Build, Rng, SlotId } from '../types'
import type { MinigameResult } from './index'
import { clamp01 } from './index'
import { ageMultiplier } from '../season'
import { bestDefender, type AttrMods, type OppPlayer } from './common'

// ARREMESSO 2D (spec 2026-09-03 §B) — sem mira, sem salto, sem relógio. A escolha do tipo é
// o arremesso: quality = skill(tipo) × abertura contra um defensor ESTÁTICO sorteado pela
// seed local. A física abaixo (idealSpeed/trajectory) só desenha a bola. Sem React, sem
// Math.random.

export const G = 9.81
export const RIM_H = 3.05
export const rad = (deg: number) => deg * Math.PI / 180
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export type ShotType = 'layup' | 'floater' | 'mid' | 'stepback' | 'fadeaway' | 'three' | 'bank' | 'dunk'
export interface ShotSpec { d: number; sep: number; optionId: string; attr: SlotId; releaseH: number }
export const SHOTS: Record<ShotType, ShotSpec> = {
  layup:    { d: 1.5,  sep: 0,   optionId: 'mgLayup', attr: 'finishing', releaseH: 2.3 },
  floater:  { d: 2.8,  sep: 0.4, optionId: 'mgLayup', attr: 'finishing', releaseH: 2.35 },
  mid:      { d: 5.0,  sep: 0,   optionId: 'mgMid',   attr: 'handles',   releaseH: 2.05 },
  stepback: { d: 7.6,  sep: 1.2, optionId: 'mgThree', attr: 'three',     releaseH: 2.05 },
  fadeaway: { d: 5.2,  sep: 0.8, optionId: 'mgMid',   attr: 'handles',   releaseH: 2.15 },
  three:    { d: 7.24, sep: 0,   optionId: 'mgThree', attr: 'three',     releaseH: 2.05 },
  bank:     { d: 4.2,  sep: 0,   optionId: 'mgMid',   attr: 'handles',   releaseH: 2.05 },
  dunk:     { d: 0.6,  sep: 0,   optionId: 'mgDunk',  attr: 'finishing', releaseH: 2.3 },
}
const ORDER: ShotType[] = ['layup', 'floater', 'mid', 'stepback', 'fadeaway', 'three', 'bank', 'dunk']

export function availableTypes(build: Build, age: number): ShotType[] {
  const m = ageMultiplier(age, build.attributes.physical); const a = build.attributes
  return ORDER.filter(t =>
    t === 'floater' ? a.finishing * m >= 60 : t === 'stepback' ? a.handles * m >= 70 : t === 'fadeaway' ? a.clutch * m >= 70 : t === 'dunk' ? a.physical * m >= 75 : true)
}

// ---- contrato (spec B) ----
// skill = clamp((atributo efetivo − 30) / 60, 0.25, 1) × (1 − fadiga × 0.5); 60 aberto = 0.5 neutro
export function skillOf(build: Build, age: number, type: ShotType, fatigue = 0): number {
  const eff = build.attributes[SHOTS[type].attr] * ageMultiplier(age, build.attributes.physical)
  return clamp((eff - 30) / 60, 0.25, 1) * (1 - fatigue * 0.5)
}
// mesma abertura da prancheta: (distância − 0.5) / 1.6; tipos com separação somam a dela
export function shotOpenness(type: ShotType, gap: number): number {
  return clamp01((gap + SHOTS[type].sep - 0.5) / 1.6)
}
export function shotQuality(type: ShotType, gap: number, build: Build, age: number, mods: AttrMods): number {
  return skillOf(build, age, type, mods.fatigue) * shotOpenness(type, gap)
}
export interface StaticDefender { gap: number; who: OppPlayer }
// 1 rng call: gap em [0.6, 2.4)
export function createStaticDefender(rng: Rng, five: OppPlayer[]): StaticDefender {
  return { gap: 0.6 + rng.next() * 1.8, who: bestDefender(five) }
}
export function resultFor(type: ShotType, quality: number): MinigameResult { return { optionId: SHOTS[type].optionId, quality } }
export function freeThrowQuality(build: Build, age: number): number { return skillOf(build, age, 'three') }

// ---- física só pra animação ----
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
  // arcos rasos (~45°, a maioria) cruzam a altura do aro descendo (raiz maior — o alvo já
  // ficou pra trás do ápice); arcos muito íngremes de perto (enterrada, ~60°) ainda estão
  // subindo quando alcançam o aro, tão curta é a distância (raiz menor).
  const tCross = root === null ? null : angleRad > rad(50) ? (vy - root) / G : (vy + root) / G
  return { pointAt: t => ({ x: vx * t, y: releaseH + vy * t - G * t * t / 2 }), tEnd: tCross ?? 2 * vy / G }
}
// enterrada só tem solução acima de ~51°; os demais usam 45°
export const REF_ANGLE: Record<ShotType, number> = { layup: 45, floater: 45, mid: 45, stepback: 45, fadeaway: 45, three: 45, bank: 45, dunk: 60 }
export const refSpeed = (type: ShotType) => idealSpeed(rad(REF_ANGLE[type]), SHOTS[type].d, SHOTS[type].releaseH)
