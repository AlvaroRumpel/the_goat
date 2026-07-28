import { ageMultiplier } from './season'
import { TEAMS } from '../data/teams'
import type { LeaguePlayer, LeagueState, LeagueTag, NpcLine, Rng, TeamStanding } from './types'

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

export function simStandings(input: {
  league: LeagueState; playerTeamId: string; playerWins: number; rng: Rng
}): TeamStanding[] {
  const { league, playerTeamId, playerWins, rng } = input
  const strengths = new Map(TEAMS.map(t => [t.id, rosterStrength(league, t.id)]))
  const mean = [...strengths.values()].reduce((n, v) => n + v, 0) / 30
  // jitter pré-computado — NUNCA rng dentro de comparator
  const rows = TEAMS.map(t => ({
    teamId: t.id,
    conf: t.conf,
    wins: t.id === playerTeamId
      ? playerWins
      : clamp(Math.round(41 + (strengths.get(t.id)! - mean) * 1.3 + rng.int(-6, 6)), 12, 68),
    jitter: rng.next(),
  }))
  const standings: TeamStanding[] = rows.map(r => ({ teamId: r.teamId, conf: r.conf, wins: r.wins, seed: null }))
  for (const conf of ['east', 'west'] as const) {
    const ranked = rows.filter(r => r.conf === conf).sort((a, b) => (b.wins - a.wins) || (b.jitter - a.jitter))
    ranked.slice(0, 8).forEach((r, i) => { standings.find(s => s.teamId === r.teamId)!.seed = i + 1 })
  }
  return standings
}

// Constantes calibráveis (Task 10): alvo é top-10 de ppg da liga parecido com NBA real.
export function simNpcLines(league: LeagueState, rng: Rng): NpcLine[] {
  return league.players.map(p => {
    const eff = npcEffOvr(p)
    const has = (tag: LeagueTag) => p.tags.includes(tag)
    const ppg = clamp((eff - 58) * 0.55 + (has('shooter') ? 2 : 0) + (rng.next() * 4 - 2), 2, 36)
    const rpg = clamp((eff - 60) * 0.28 + (has('rebounder') ? 3 : 0) + (p.pos === 'C' ? 2 : p.pos === 'PF' ? 1 : -1) + (rng.next() * 2 - 1), 0.5, 16)
    const apg = clamp((eff - 60) * 0.22 + (has('playmaker') ? 3 : 0) + (p.pos === 'PG' ? 2.5 : 0) + (rng.next() * 2 - 1), 0.3, 12)
    return { playerId: p.id, ppg: Math.round(ppg * 10) / 10, rpg: Math.round(rpg * 10) / 10, apg: Math.round(apg * 10) / 10 }
  })
}
