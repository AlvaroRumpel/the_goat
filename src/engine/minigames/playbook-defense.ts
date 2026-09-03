import { clamp01 } from './index'
import type { Defender, PlaybookInput, PlaybookState, Pos } from './playbook'

// Geometria pura (ímãs/rotas) + alvos por esquema da JOGADA — sem estado próprio, sem React,
// sem Math.random. Só tipos são importados de ./playbook (apagados na compilação, sem ciclo
// em runtime); playbook.ts é quem importa as funções daqui.

export const dist = (a: Pos, b: Pos) => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp = (a: Pos, b: Pos, f: number): Pos => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })

export function clampCourt(p: Pos, court: { w: number; d: number }): Pos {
  return { x: Math.min(court.w - 0.3, Math.max(0.3, p.x)), y: Math.min(court.d - 0.3, Math.max(0.3, p.y)) }
}

export function moveToward(p: Pos, target: Pos, maxStep: number): Pos {
  const d = dist(p, target)
  if (d <= maxStep) return { ...target }
  return lerp(p, target, maxStep / d)
}

export function routeLength(points: Pos[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  return total
}

export function pointAlongRoute(points: Pos[], progress: number): Pos {
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

// alvo man-to-man: entre seu homem e a cesta, 0.35 (0.15 no portador)
export function manTarget(attackers: Pos[], basket: Pos, holder: number, d: Defender): Pos {
  const frac = d.man === holder ? 0.15 : 0.35
  return lerp(attackers[d.man], basket, frac)
}

// alvo de zona: centro da área, puxado pro atacante mais perto dela; os 3 de baixo
// (índices 2..4) colapsam pro portador quando ele entra no garrafão.
export function zoneTarget(attackers: Pos[], holderPos: Pos, holderInPaint: boolean, zones: Pos[], defIdx: number): Pos {
  const zone = zones[defIdx]
  if (holderInPaint && defIdx >= 2) return lerp(zone, holderPos, 0.5)
  let nearestAtt = -1, nd = Infinity
  attackers.forEach((p, i) => { const d2 = dist(p, zone); if (d2 < nd) { nd = d2; nearestAtt = i } })
  if (nearestAtt >= 0 && nd < 3.0) return lerp(zone, attackers[nearestAtt], 0.4)
  return { ...zone }
}

// pressão total-quadra: marcador cola a 0.5m do portador (linha até a cesta)
export function pressTarget(basket: Pos, holderPos: Pos): Pos {
  const toBasket = dist(holderPos, basket)
  if (toBasket <= 0.5) return { ...holderPos }
  return lerp(holderPos, basket, 0.5 / toBasket)
}

// Bloqueios: atacante com screen a <1.0m do defensor do portador o prende por 0.8s. One-shot
// por aproximação — screenArmed[i] trava a re-detecção até o atacante se afastar >1.6m, senão
// reachedEnd/near reprendiam o mesmo defensor a cada tick (bug do round 1). switch troca de
// homem uma vez (fixado pelo latch); trap dobra no portador só com o defensor do bloqueador
// (trapDef), até trapUntil expirar. Não roda em zone (onde "man" é vestigial).
export function applyScreens(s: PlaybookState, input: PlaybookInput): void {
  if (s.scheme !== 'zone') {
    const holder = s.ball.holder
    const defHolderIdx = s.defenders.findIndex(d => d.man === holder)
    if (defHolderIdx >= 0) {
      s.routes.forEach((route, i) => {
        if (!route.screen || i === holder) return
        const d = dist(s.attackers[i], s.defenders[defHolderIdx])
        if (s.screenArmed[i]) { if (d > 1.6) s.screenArmed[i] = false; return }
        if (d >= 1.0) return
        s.screenArmed[i] = true
        s.screenedUntil[defHolderIdx] = s.t + 0.8
        const defScreenerIdx = s.defenders.findIndex(d2 => d2.man === i)
        if (s.scheme === 'switch' && defScreenerIdx >= 0 && defScreenerIdx !== defHolderIdx) {
          const tmp = s.defenders[defHolderIdx].man
          s.defenders[defHolderIdx].man = s.defenders[defScreenerIdx].man
          s.defenders[defScreenerIdx].man = tmp
          const bigManIdx = input.five.reduce((best, p, idx, arr) => (p.reach > arr[best].reach ? idx : best), 0)
          if (s.defenders[bigManIdx].man === 0) s.mismatch = true
        }
        if (s.scheme === 'trap') {
          s.trapUntil = s.t + 1.5
          s.trapDef = defScreenerIdx >= 0 ? defScreenerIdx : null
        }
      })
    }
  }
  if (s.trapDef !== null && s.trapUntil <= s.t) s.trapDef = null
}
