import { ageMultiplier } from './season'
import type { LeaguePlayer, LeagueState } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function npcEffOvr(p: LeaguePlayer): number {
  return Math.round(p.ovr * ageMultiplier(p.age, p.ovr))
}

// Constantes calibráveis (Task 10). Mapeia média ponderada de elenco para a
// escala 45..90 usada por Team.strength (contrato do computeWinPct).
export function teamStrength(ovrs: number[]): number {
  const sorted = [...ovrs].sort((a, b) => b - a)
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / (xs.length || 1)
  const weighted = 0.6 * avg(top3) + 0.4 * avg(rest)
  // dataset real (curadoria própria) tem weighted médio ~74, não ~83 como no
  // exemplo do brief — 68/74/1.7 recalibrados para bater as âncoras de teste.
  return clamp(Math.round(68 + (weighted - 74) * 1.7), 45, 90)
}

export function rosterStrength(league: LeagueState, teamId: string, extraOvr?: number): number {
  const ovrs = league.players.filter(p => p.teamId === teamId).map(npcEffOvr)
  if (extraOvr !== undefined) ovrs.push(extraOvr)
  return teamStrength(ovrs)
}
