import { TEAMS } from '../data/teams'
import type { Offer, Rng, Team, TeamStanding } from './types'

export function draftPickNumber(overall: number, rng: Rng): number {
  const base = 31 - Math.round((overall - 55) * 0.75)
  const jitter = rng.int(-2, 2)
  return Math.min(30, Math.max(1, base + jitter))
}

// standings (opcional): contender/rebuild saem do top-8 / bottom-8 de vitórias da
// temporada anterior. Sem standings (draft inicial, testes antigos) usa Team.strength.
export function makeOffers(rng: Rng, excludeTeamId?: string, standings?: TeamStanding[]): Offer[] {
  const pool = TEAMS.filter(t => t.id !== excludeTeamId)
  const used = new Set<string>()
  const pickFrom = (candidates: Team[]) => {
    const avail = candidates.filter(t => !used.has(t.id))
    const team = rng.pick(avail)
    used.add(team.id)
    return team
  }
  let strong = pool.filter(t => t.strength >= 74)
  let weak = pool.filter(t => t.strength <= 64)
  if (standings) {
    const wins = new Map(standings.map(s => [s.teamId, s.wins]))
    const ranked = pool.map(t => ({ t, w: wins.get(t.id) ?? 41 })).sort((a, b) => b.w - a.w).map(r => r.t)
    strong = ranked.slice(0, 8)
    weak = ranked.slice(-8)
  }
  const contender = pickFrom(strong)
  const rebuild = pickFrom(weak)
  const big = pickFrom(pool.filter(t => t.bigMarket))
  return [
    { teamId: contender.id, profile: 'contender' },
    { teamId: rebuild.id, profile: 'rebuild' },
    { teamId: big.id, profile: 'bigmarket' },
  ]
}
