import type { Rng, WatchedGameKind } from '../types'
import type { MinigameResult } from './index'
import { clamp01 } from './index'

// Quadro tático de ataque ("JOGADA") — engine puro. Metros; meia-quadra, cesta no topo
// (y = 0 é a linha de fundo). Toda aleatoriedade vem do Rng LOCAL injetado pela UI.

export const COURT = {
  w: 15.24, d: 14,
  basket: { x: 7.62, y: 1.575 },
  arc: 7.24, cornerX: 0.9, cornerY: 4.3,
  paintW: 4.9, paintD: 5.8,
  clock: 12, flight: 0.35, rotationLag: 0.4, helpLinger: 0.6,
}

export interface Pos { x: number; y: number }
export interface Defender extends Pos { speed: number; man: number; target: Pos }
export type FormationId = 'fiveOut' | 'horns' | 'pnr' | 'iso'
export type Turnover = 'intercept' | 'strip' | 'clock'
export type ShotOption = 'layup-or-dunk' | 'mgMid' | 'mgThree' | 'mgAssist'

export interface PlaybookState {
  t: number
  clock: number
  attackers: Pos[]
  defenders: Defender[]
  ball: { holder: number; flying: { from: number; to: number; progress: number } | null }
  you: 0
  phase: 'live' | 'shooting' | 'turnover' | 'done'
  helpTimer: number          // segundos restantes de colapso da ajuda
  helper: number | null      // índice do defensor que ajuda
  rotationLag: number        // segundos em que os não-portadores mantêm o alvo antigo
  pressure: number           // segundos acumulados com ≥2 defensores a <1m do portador
  moveTarget: (Pos | null)[]
  formation: FormationId
  handles: number
  passing: number
  defSpeed: number           // m/s base (playoffs/finais +8%)
  turnover?: Turnover
  result?: MinigameResult
}

// índice 0 = você, sempre com a bola no início
export const FORMATIONS: Record<FormationId, Pos[]> = {
  fiveOut: [{ x: 7.62, y: 9.5 }, { x: 2.5, y: 8 }, { x: 12.7, y: 8 }, { x: 1.2, y: 2 }, { x: 14, y: 2 }],
  horns: [{ x: 7.62, y: 10 }, { x: 5.2, y: 6 }, { x: 10, y: 6 }, { x: 1.2, y: 1.5 }, { x: 14, y: 1.5 }],
  pnr: [{ x: 3, y: 8.5 }, { x: 4.5, y: 6.5 }, { x: 9.5, y: 9.5 }, { x: 13, y: 7 }, { x: 14, y: 1.5 }],
  iso: [{ x: 7.62, y: 9 }, { x: 1.2, y: 2 }, { x: 14, y: 2 }, { x: 2, y: 9.5 }, { x: 13.2, y: 9.5 }],
}
const FORMATION_IDS: FormationId[] = ['fiveOut', 'horns', 'pnr', 'iso']

const dist = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y)
export const distToBasket = (p: Pos) => dist(p, COURT.basket)
const lerp = (a: Pos, b: Pos, f: number): Pos => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
const clampCourt = (p: Pos): Pos => ({
  x: Math.min(COURT.w - 0.3, Math.max(0.3, p.x)),
  y: Math.min(COURT.d - 0.3, Math.max(0.3, p.y)),
})

export function inPaint(p: Pos): boolean {
  return Math.abs(p.x - COURT.basket.x) <= COURT.paintW / 2 && p.y <= COURT.paintD
}
export function beyondArc(p: Pos): boolean {
  if (p.y <= COURT.cornerY) return p.x < COURT.cornerX || p.x > COURT.w - COURT.cornerX
  return distToBasket(p) > COURT.arc
}

function nearestDefenderDist(s: PlaybookState, idx: number): number {
  return Math.min(...s.defenders.map(d => dist(d, s.attackers[idx])))
}

// abertura = qualidade do arremesso (spec §2.5)
export function openness(s: PlaybookState, idx: number): number {
  return clamp01((nearestDefenderDist(s, idx) - 0.5) / 1.6)
}

export function shotOptionFor(s: PlaybookState): ShotOption {
  if (s.ball.holder !== s.you) return 'mgAssist'
  const p = s.attackers[s.ball.holder]
  if (distToBasket(p) < 1.8) return 'layup-or-dunk'
  return beyondArc(p) ? 'mgThree' : 'mgMid'
}

function manTarget(s: PlaybookState, d: Defender): Pos {
  const frac = d.man === s.ball.holder ? 0.15 : 0.35
  return lerp(s.attackers[d.man], COURT.basket, frac)
}

export function createPlaybook(
  rng: Rng,
  ctx: { kind: WatchedGameKind; handles: number; passing: number },
): PlaybookState {
  const formation = rng.pick(FORMATION_IDS)
  const attackers = FORMATIONS[formation].map(p => ({ ...p }))
  const defSpeed = 3.6 * (ctx.kind === 'playoff' || ctx.kind === 'finals' ? 1.08 : 1)
  const s: PlaybookState = {
    t: 0, clock: COURT.clock, attackers, defenders: [], ball: { holder: 0, flying: null }, you: 0,
    phase: 'live', helpTimer: 0, helper: null, rotationLag: 0, pressure: 0,
    moveTarget: [null, null, null, null, null], formation,
    handles: ctx.handles, passing: ctx.passing, defSpeed,
  }
  s.defenders = attackers.map((_, i) => {
    const d: Defender = { x: 0, y: 0, speed: 0.9 + 0.2 * rng.next(), man: i, target: { x: 0, y: 0 } }
    d.target = manTarget(s, d)
    d.x = d.target.x; d.y = d.target.y
    return d
  })
  return s
}

function clone(s: PlaybookState): PlaybookState {
  return {
    ...s,
    attackers: s.attackers.map(p => ({ ...p })),
    defenders: s.defenders.map(d => ({ ...d, target: { ...d.target } })),
    ball: { ...s.ball, flying: s.ball.flying ? { ...s.ball.flying } : null },
    moveTarget: [...s.moveTarget],
  }
}

function endTurnover(s: PlaybookState, kind: Turnover, optionId: string): PlaybookState {
  s.phase = 'turnover'
  s.turnover = kind
  s.result = { optionId, quality: 0, turnover: true }
  return s
}

function moveToward(p: Pos, target: Pos, maxStep: number): Pos {
  const d = dist(p, target)
  if (d <= maxStep) return { ...target }
  return lerp(p, target, maxStep / d)
}

export function step(state: PlaybookState, dt: number, rng: Rng): PlaybookState {
  if (state.phase !== 'live') return state
  const s = clone(state)
  s.t += dt
  s.clock -= dt
  if (s.clock <= 0) { s.clock = 0; return endTurnover(s, 'clock', 'mgMid') }

  // bola em voo
  if (s.ball.flying) {
    s.ball.flying.progress += dt / COURT.flight
    if (s.ball.flying.progress >= 1) {
      s.ball.holder = s.ball.flying.to
      s.ball.flying = null
      s.rotationLag = COURT.rotationLag
      s.pressure = 0
    }
  } else {
    // portador anda até o alvo
    const h = s.ball.holder
    const tgt = s.moveTarget[h]
    if (tgt) {
      const speed = 4.2 * Math.min(1.15, Math.max(0.8, s.handles / 85))
      s.attackers[h] = moveToward(s.attackers[h], tgt, speed * dt)
      if (dist(s.attackers[h], tgt) < 1e-6) s.moveTarget[h] = null
    }
  }

  const holder = s.ball.holder
  const holderPos = s.attackers[holder]

  // ajuda: portador no garrafão → defensor do companheiro mais perto da cesta colapsa
  if (!s.ball.flying && inPaint(holderPos)) {
    let best = -1, bestD = Infinity
    s.attackers.forEach((p, i) => {
      if (i === holder) return
      const d = distToBasket(p)
      if (d < bestD) { bestD = d; best = i }
    })
    s.helper = s.defenders.findIndex(d => d.man === best)
    s.helpTimer = COURT.helpLinger
  } else if (s.helpTimer > 0) {
    s.helpTimer = Math.max(0, s.helpTimer - dt)
    if (s.helpTimer === 0) s.helper = null
  }

  // alvos dos defensores (rotação com atraso após o passe)
  const lagging = s.rotationLag > 0
  if (lagging) s.rotationLag = Math.max(0, s.rotationLag - dt)
  s.defenders.forEach((d, i) => {
    if (i === s.helper) d.target = { ...holderPos }
    else if (s.ball.flying) return                 // ninguém reage enquanto a bola voa
    else if (d.man === holder || !lagging) d.target = manTarget(s, d)
    d.target = clampCourt(d.target)
    const moved = moveToward(d, d.target, s.defSpeed * d.speed * dt)
    d.x = moved.x; d.y = moved.y
  })

  // desarme: ≥2 defensores a <1m por >0.5s acumulado
  if (!s.ball.flying) {
    const close = s.defenders.filter(d => dist(d, holderPos) < 1).length
    s.pressure = close >= 2 ? s.pressure + dt : 0
    if (s.pressure > 0.5 && rng.chance(0.06 * (1 - s.handles / 150))) {
      return endTurnover(s, 'strip', 'mgMid')
    }
  }
  return s
}

// menor distância do ponto p ao segmento a→b
function distToSegment(p: Pos, a: Pos, b: Pos): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const f = len2 === 0 ? 0 : clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)
  return dist(p, { x: a.x + dx * f, y: a.y + dy * f })
}

export function pass(state: PlaybookState, to: number, rng: Rng): PlaybookState {
  if (state.phase !== 'live' || state.ball.flying || to === state.ball.holder) return state
  if (to < 0 || to >= state.attackers.length) return state
  const s = clone(state)
  const from = s.attackers[s.ball.holder], dest = s.attackers[to]
  const lane = Math.min(...s.defenders.map(d => distToSegment(d, from, dest)))
  if (lane < 0.9) {
    const laneRisk = 1 - lane / 0.9
    if (rng.chance(laneRisk * (1 - s.passing / 140))) return endTurnover(s, 'intercept', 'mgAssist')
  }
  s.moveTarget[s.ball.holder] = null
  s.ball.flying = { from: s.ball.holder, to, progress: 0 }
  return s
}

export function moveTo(state: PlaybookState, x: number, y: number): PlaybookState {
  if (state.phase !== 'live' || state.ball.flying) return state
  const s = clone(state)
  s.moveTarget[s.ball.holder] = clampCourt({ x, y })
  return s
}

export function shoot(state: PlaybookState, finish?: 'layup' | 'dunk'): PlaybookState {
  if (state.phase !== 'live' || state.ball.flying) return state
  const opt = shotOptionFor(state)
  let optionId: string
  if (opt === 'layup-or-dunk') {
    if (!finish) return state                    // a UI precisa escolher
    optionId = finish === 'dunk' ? 'mgDunk' : 'mgLayup'
  } else optionId = opt
  const s = clone(state)
  const quality = openness(s, s.ball.holder) * (s.clock < 2 ? 0.85 : 1)
  s.phase = 'shooting'
  s.result = { optionId, quality }
  return s
}
