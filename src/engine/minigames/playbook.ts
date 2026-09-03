import type { Rng, WatchedGameKind } from '../types'
import type { MinigameResult } from './index'
import { clamp01 } from './index'
import type { AttrMods, OppPlayer } from './common'

// Quadro tático de ataque ("JOGADA") v2 — engine puro. Metros; meia-quadra, cesta no topo
// (y = 0 é a linha de fundo). Toda aleatoriedade vem do Rng LOCAL injetado pela UI.
// Fases: read (2s, só relógio) → draw (jogador desenha rotas/esquema, sem tempo) →
// run (12s, ímãs seguem rotas, 5 esquemas de defesa) → rebound. pass/feint/callScreen/
// pumpFake/shoot/reboundTap/moveTo ficam para a Task 7 — não exportar aqui.

export const COURT = {
  w: 15.24, d: 14.0,
  basket: { x: 7.62, y: 1.575 },
  arc: 7.24, cornerX: 0.9, cornerY: 4.3,
  paintW: 4.9, paintD: 5.8,
}
const RUN_CLOCK = 12
const FLIGHT = 0.35

export interface Pos { x: number; y: number }
export interface Defender extends Pos { speed: number; man: number; target: Pos }
export type FormationId = 'fiveOut' | 'horns' | 'pnr' | 'iso'
export type Scheme = 'man' | 'zone' | 'switch' | 'trap' | 'press'
export type Phase = 'read' | 'draw' | 'run' | 'rebound' | 'shooting' | 'turnover' | 'done'
export type Template = 'pnr' | 'horns' | 'doubleScreen' | 'iso' | 'fiveOut' | 'transition'
export type ShotOption = 'layup-or-dunk' | 'mgMid' | 'mgThree' | 'mgAssist'

export interface Route { points: Pos[]; screen: boolean }

export interface PlaybookState {
  phase: Phase; t: number; clock: number; scheme: Scheme
  attackers: Pos[]; defenders: Defender[]; you: 0
  routes: Route[]; routeProgress: number[]
  ball: { holder: number; flying: { from: number; to: number; progress: number } | null }
  lastPassAt: number; passes: number; screenedUntil: number[]
  helpUntil: number; trapUntil: number; mismatch: boolean
  feintUntil: number; pumpUntil: number; pressure: number
  turnover: 'intercept' | 'strip' | 'clock' | 'charge' | null
  firstShotOpenness: number | null
  result?: MinigameResult
}

export interface PlaybookInput { kind: WatchedGameKind; five: OppPlayer[]; mods: AttrMods; difficulty: number }

// índice 0 = você, sempre com a bola no início (mantido do v1; base dos templates)
export const FORMATIONS: Record<FormationId, Pos[]> = {
  fiveOut: [{ x: 7.62, y: 9.5 }, { x: 2.5, y: 8 }, { x: 12.7, y: 8 }, { x: 1.2, y: 2 }, { x: 14, y: 2 }],
  horns: [{ x: 7.62, y: 10 }, { x: 5.2, y: 6 }, { x: 10, y: 6 }, { x: 1.2, y: 1.5 }, { x: 14, y: 1.5 }],
  pnr: [{ x: 3, y: 8.5 }, { x: 4.5, y: 6.5 }, { x: 9.5, y: 9.5 }, { x: 13, y: 7 }, { x: 14, y: 1.5 }],
  iso: [{ x: 7.62, y: 9 }, { x: 1.2, y: 2 }, { x: 14, y: 2 }, { x: 2, y: 9.5 }, { x: 13.2, y: 9.5 }],
}

export const SCHEME_SIGNAL: Record<Scheme, string> = {
  man: 'mg.pb.scheme.man', zone: 'mg.pb.scheme.zone', switch: 'mg.pb.scheme.switch',
  trap: 'mg.pb.scheme.trap', press: 'mg.pb.scheme.press',
}

const TEMPLATES: Record<Template, { formation: keyof typeof FORMATIONS; routes: Array<{ to: Pos[]; screen: boolean }> }> = {
  pnr: { formation: 'pnr', routes: [{ to: [{ x: 6.2, y: 6.0 }], screen: false }, { to: [], screen: false }, { to: [], screen: false }, { to: [], screen: false }, { to: [{ x: 8.4, y: 8.6 }], screen: true }] },
  horns: { formation: 'horns', routes: [{ to: [{ x: 7.62, y: 7.0 }], screen: false }, { to: [{ x: 3.0, y: 5.0 }], screen: false }, { to: [{ x: 12.2, y: 5.0 }], screen: false }, { to: [{ x: 6.4, y: 8.2 }], screen: true }, { to: [{ x: 8.8, y: 8.2 }], screen: true }] },
  doubleScreen: { formation: 'fiveOut', routes: [{ to: [], screen: false }, { to: [{ x: 5.4, y: 4.0 }], screen: true }, { to: [{ x: 9.8, y: 4.0 }], screen: true }, { to: [{ x: 7.62, y: 3.2 }], screen: false }, { to: [], screen: false }] },
  iso: { formation: 'iso', routes: [{ to: [], screen: false }, { to: [{ x: 1.2, y: 4.3 }], screen: false }, { to: [{ x: 14.0, y: 4.3 }], screen: false }, { to: [{ x: 2.0, y: 9.0 }], screen: false }, { to: [{ x: 13.2, y: 9.0 }], screen: false }] },
  fiveOut: { formation: 'fiveOut', routes: [{ to: [], screen: false }, { to: [{ x: 4.0, y: 2.6 }], screen: false }, { to: [], screen: false }, { to: [], screen: false }, { to: [{ x: 11.2, y: 2.6 }], screen: false }] },
  transition: { formation: 'fiveOut', routes: [{ to: [{ x: 7.62, y: 4.0 }], screen: false }, { to: [{ x: 1.0, y: 4.3 }], screen: false }, { to: [{ x: 14.2, y: 4.3 }], screen: false }, { to: [{ x: 5.0, y: 2.0 }], screen: false }, { to: [{ x: 10.2, y: 2.0 }], screen: false }] },
}
// 5 áreas fixas: 2 nas asas do arco (topo), 3 embaixo (cantos + meio do garrafão) — índices 2..4 colapsam com o portador no garrafão
const ZONES: Pos[] = [{ x: 4.6, y: 8.2 }, { x: 10.6, y: 8.2 }, { x: 2.4, y: 3.2 }, { x: 7.62, y: 3.6 }, { x: 12.8, y: 3.2 }]

const dist = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y)
export const distToBasket = (p: Pos) => dist(p, COURT.basket)
const lerp = (a: Pos, b: Pos, f: number): Pos => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
const clampCourt = (p: Pos): Pos => ({
  x: Math.min(COURT.w - 0.3, Math.max(0.3, p.x)),
  y: Math.min(COURT.d - 0.3, Math.max(0.3, p.y)),
})
function moveToward(p: Pos, target: Pos, maxStep: number): Pos {
  const d = dist(p, target)
  if (d <= maxStep) return { ...target }
  return lerp(p, target, maxStep / d)
}

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
function snapDefendersManToMan(s: PlaybookState): void {
  s.defenders.forEach(d => {
    const target = manTarget(s, d)
    d.target = target; d.x = target.x; d.y = target.y
  })
}

function routeLength(points: Pos[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  return total
}
function pointAlongRoute(points: Pos[], progress: number): Pos {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return { ...points[0] }
  let remaining = progress
  for (let i = 1; i < points.length; i++) {
    const segLen = dist(points[i - 1], points[i])
    if (remaining <= segLen || i === points.length - 1) {
      const f = segLen === 0 ? 1 : clamp01(remaining / segLen)
      return lerp(points[i - 1], points[i], f)
    }
    remaining -= segLen
  }
  return { ...points[points.length - 1] }
}

// pesos do sorteio (spec §2): man 3, zone 2, switch/trap 1+(força−70)/10, press 1 — 1 rng call
function weightedScheme(rng: Rng, five: OppPlayer[]): Scheme {
  const strength = five.reduce((sum, p) => sum + p.ovr, 0) / five.length
  const bonus = (strength - 70) / 10
  const weights: Array<[Scheme, number]> = [
    ['man', 3], ['zone', 2], ['switch', Math.max(0.1, 1 + bonus)], ['trap', Math.max(0.1, 1 + bonus)], ['press', 1],
  ]
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng.next() * total
  for (const [scheme, w] of weights) { if (roll < w) return scheme; roll -= w }
  return weights[weights.length - 1][0]
}

export function createPlaybook(rng: Rng, input: PlaybookInput): PlaybookState {
  const scheme = weightedScheme(rng, input.five)
  const formation: FormationId = 'horns'
  const attackers = FORMATIONS[formation].map(p => ({ ...p }))
  const defenders: Defender[] = input.five.map((p, i) => ({ x: 0, y: 0, speed: p.speed * input.difficulty, man: i, target: { x: 0, y: 0 } }))
  const s: PlaybookState = {
    phase: 'read', t: 0, clock: RUN_CLOCK, scheme,
    attackers, defenders, you: 0,
    routes: attackers.map(() => ({ points: [], screen: false })),
    routeProgress: [0, 0, 0, 0, 0],
    ball: { holder: 0, flying: null },
    lastPassAt: 0, passes: 0, screenedUntil: [0, 0, 0, 0, 0],
    helpUntil: 0, trapUntil: 0, mismatch: false,
    feintUntil: 0, pumpUntil: 0, pressure: 0,
    turnover: null, firstShotOpenness: null,
  }
  snapDefendersManToMan(s)
  return s
}

function clone(s: PlaybookState): PlaybookState {
  return {
    ...s,
    attackers: s.attackers.map(p => ({ ...p })),
    defenders: s.defenders.map(d => ({ ...d, target: { ...d.target } })),
    routes: s.routes.map(r => ({ points: r.points.map(p => ({ ...p })), screen: r.screen })),
    routeProgress: [...s.routeProgress],
    ball: { ...s.ball, flying: s.ball.flying ? { ...s.ball.flying } : null },
    screenedUntil: [...s.screenedUntil],
  }
}

function endTurnover(s: PlaybookState, kind: NonNullable<PlaybookState['turnover']>, optionId: string): PlaybookState {
  s.phase = 'turnover'
  s.turnover = kind
  s.result = { optionId, quality: 0, turnover: true }
  return s
}

export function applyTemplate(s: PlaybookState, tpl: Template): PlaybookState {
  const spec = TEMPLATES[tpl]
  const positions = FORMATIONS[spec.formation].map(p => ({ ...p }))
  const next = clone(s)
  next.attackers = positions
  next.routes = spec.routes.map((r, i) => ({ points: [{ ...positions[i] }, ...r.to.map(p => ({ ...p }))], screen: r.screen }))
  next.routeProgress = [0, 0, 0, 0, 0]
  snapDefendersManToMan(next)
  return next
}

export function setRoute(s: PlaybookState, idx: number, points: Pos[]): PlaybookState {
  const next = clone(s)
  next.routes[idx] = { points: points.slice(0, 6).map(clampCourt), screen: s.routes[idx].screen }
  next.routeProgress[idx] = 0
  return next
}

export function toggleScreen(s: PlaybookState, idx: number): PlaybookState {
  const next = clone(s)
  next.routes[idx] = { ...next.routes[idx], screen: !next.routes[idx].screen }
  return next
}

export function startRun(s: PlaybookState): PlaybookState {
  if (s.phase !== 'read' && s.phase !== 'draw') return s
  const next = clone(s)
  next.phase = 'run'
  next.clock = RUN_CLOCK
  next.t = 0
  return next
}

// alvo do defensor de zona: centro da área, puxado pro atacante mais perto dela; os 3 de
// baixo (índices 2..4) colapsam pro portador quando ele entra no garrafão.
function zoneTarget(s: PlaybookState, defIdx: number, holderPos: Pos): Pos {
  const zone = ZONES[defIdx]
  if (inPaint(holderPos) && defIdx >= 2) return lerp(zone, holderPos, 0.5)
  let nearestAtt = -1, nd = Infinity
  s.attackers.forEach((p, i) => { const d2 = dist(p, zone); if (d2 < nd) { nd = d2; nearestAtt = i } })
  if (nearestAtt >= 0 && nd < 3.0) return lerp(zone, s.attackers[nearestAtt], 0.4)
  return { ...zone }
}
// pressão total-quadra: marcador cola a 0.5m do portador (linha até a cesta)
function pressTarget(holderPos: Pos): Pos {
  const toBasket = distToBasket(holderPos)
  if (toBasket <= 0.5) return { ...holderPos }
  return lerp(holderPos, COURT.basket, 0.5 / toBasket)
}

export function step(state: PlaybookState, dt: number, rng: Rng, input: PlaybookInput): PlaybookState {
  if (state.phase === 'read') {
    const s = clone(state)
    s.t += dt
    if (s.t >= 2) s.phase = 'draw'
    return s
  }
  if (state.phase !== 'run') return state
  const s = clone(state)
  s.t += dt
  s.clock -= dt
  if (s.clock <= 0) { s.clock = 0; return endTurnover(s, 'clock', 'mgMid') }

  // ímãs seguem as rotas desenhadas; rota vazia/de 1 ponto = parado
  const runSpeed = 4.2 * input.mods.speed
  s.routes.forEach((route, i) => {
    if (route.points.length < 2) return
    const mult = s.mismatch && i === 0 ? 1.15 : 1
    s.routeProgress[i] = Math.min(routeLength(route.points), s.routeProgress[i] + runSpeed * mult * dt)
    s.attackers[i] = clampCourt(pointAlongRoute(route.points, s.routeProgress[i]))
  })

  // bola em voo (fica pronto para pass/shoot da Task 7; não é acionado aqui ainda)
  if (s.ball.flying) {
    s.ball.flying.progress += dt / FLIGHT
    if (s.ball.flying.progress >= 1) { s.ball.holder = s.ball.flying.to; s.ball.flying = null }
  }

  const holder = s.ball.holder
  const holderPos = s.attackers[holder]

  // bloqueios: atacante com screen que chegou no fim da rota ou está perto do defensor do
  // portador prende esse defensor por 0.8s; switch troca de homem; trap dobra no portador
  const defHolderIdx = s.defenders.findIndex(d => d.man === holder)
  if (defHolderIdx >= 0) {
    s.routes.forEach((route, i) => {
      if (!route.screen || i === holder) return
      const total = routeLength(route.points)
      const reachedEnd = s.routeProgress[i] >= total
      const near = dist(s.attackers[i], s.defenders[defHolderIdx]) < 1.45
      if (!reachedEnd && !near) return
      s.screenedUntil[defHolderIdx] = s.t + 0.8
      if (s.scheme === 'switch') {
        const defScreenerIdx = s.defenders.findIndex(d => d.man === i)
        if (defScreenerIdx >= 0 && defScreenerIdx !== defHolderIdx) {
          const tmp = s.defenders[defHolderIdx].man
          s.defenders[defHolderIdx].man = s.defenders[defScreenerIdx].man
          s.defenders[defScreenerIdx].man = tmp
          const bigManIdx = input.five.reduce((best, p, idx, arr) => (p.reach > arr[best].reach ? idx : best), 0)
          if (s.defenders[bigManIdx].man === 0) s.mismatch = true
        }
      }
      if (s.scheme === 'trap') s.trapUntil = s.t + 1.5
    })
  }

  // ajuda (só man): portador no garrafão puxa o defensor do companheiro mais perto da cesta
  let helperDefIdx = -1
  if (s.scheme === 'man' && (inPaint(holderPos) || s.helpUntil > s.t)) {
    let bestAtt = -1, bestD = Infinity
    s.attackers.forEach((p, i) => { if (i === holder) return; const d2 = distToBasket(p); if (d2 < bestD) { bestD = d2; bestAtt = i } })
    if (bestAtt >= 0) {
      helperDefIdx = s.defenders.findIndex(d => d.man === bestAtt)
      if (inPaint(holderPos)) s.helpUntil = s.t + 0.6
    }
  }

  // alvos + movimento dos defensores por esquema
  s.defenders.forEach((d, i) => {
    if (s.scheme === 'press' && d.man === holder) {
      // marcador batido no drible (>1.2m atrás) fica pra trás 1s
      if (distToBasket(holderPos) < distToBasket(d) - 1.2) s.screenedUntil[i] = Math.max(s.screenedUntil[i], s.t + 1.0)
    }
    if (s.screenedUntil[i] > s.t) return
    let target: Pos
    if (s.scheme === 'zone') target = zoneTarget(s, i, holderPos)
    else if (i === helperDefIdx) target = lerp(holderPos, COURT.basket, 0.15)
    else if (s.scheme === 'press' && d.man === holder) target = pressTarget(holderPos)
    else if (s.scheme === 'trap' && s.trapUntil > s.t && s.routes[d.man]?.screen) target = lerp(holderPos, COURT.basket, 0.15)
    else target = manTarget(s, d)
    target = clampCourt(target)
    d.target = target
    const moved = moveToward(d, target, d.speed * dt)
    d.x = moved.x; d.y = moved.y
  })

  // desarme: ≥2 defensores a <1m do portador por >0.5s acumulado (×1.5 em press, ÷ stripResist)
  const closeCount = s.defenders.filter(d => dist(d, holderPos) < 1).length
  s.pressure = closeCount >= 2 ? s.pressure + dt : 0
  if (!s.ball.flying && s.pressure > 0.5) {
    const chance = 0.06 * (s.scheme === 'press' ? 1.5 : 1) / input.mods.stripResist
    if (rng.chance(chance)) return endTurnover(s, 'strip', 'mgMid')
  }

  return s
}
