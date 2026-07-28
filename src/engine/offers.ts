import { TEAMS } from '../data/teams'
import type { Offer, Rng } from './types'

export function draftPickNumber(overall: number, rng: Rng): number {
  const base = 31 - Math.round((overall - 55) * 0.75)
  const jitter = rng.int(-2, 2)
  return Math.min(30, Math.max(1, base + jitter))
}

export function makeOffers(rng: Rng, excludeTeamId?: string): Offer[] {
  const pool = TEAMS.filter(t => t.id !== excludeTeamId)
  const used = new Set<string>()
  const pickFrom = (candidates: typeof pool) => {
    const avail = candidates.filter(t => !used.has(t.id))
    const team = rng.pick(avail)
    used.add(team.id)
    return team
  }
  const contender = pickFrom(pool.filter(t => t.strength >= 74))
  const rebuild = pickFrom(pool.filter(t => t.strength <= 64))
  const big = pickFrom(pool.filter(t => t.bigMarket))
  return [
    { teamId: contender.id, profile: 'contender' },
    { teamId: rebuild.id, profile: 'rebuild' },
    { teamId: big.id, profile: 'bigmarket' },
  ]
}
