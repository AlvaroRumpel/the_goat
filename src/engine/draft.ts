import { LEGENDS } from '../data/legends'
import { SLOT_ORDER, type Archetype, type Build, type Legend, type Matchup, type Rng, type SlotId } from './types'

export function drawMatchups(rng: Rng): Matchup[] {
  return SLOT_ORDER.map(slot => {
    const pool = LEGENDS.filter(l => l.slot === slot)
    const a = rng.pick(pool)
    const rest = pool.filter(l => l.id !== a.id)
    const b = rng.pick(rest)
    return { slot, a, b }
  })
}

export function computeOverall(attrs: Record<SlotId, number>): number {
  const sum = SLOT_ORDER.reduce((n, s) => n + attrs[s], 0)
  return Math.round(sum / SLOT_ORDER.length)
}

export function computeArchetype(attrs: Record<SlotId, number>): Archetype {
  const scores: [Archetype, number][] = [
    ['PG', attrs.passing * 0.5 + attrs.handles * 0.5],
    ['SG', attrs.three * 0.5 + attrs.clutch * 0.5],
    ['PF', attrs.physical * 0.5 + attrs.finishing * 0.5],
    ['C', attrs.rebounding * 0.4 + attrs.defense * 0.3 + attrs.finishing * 0.3],
  ]
  const vals = scores.map(([, v]) => v)
  if (Math.max(...vals) - Math.min(...vals) <= 6) return 'SF'
  return scores.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0]
}

export function resolveDraft(picks: Legend[]): Build {
  const attrs = {} as Record<SlotId, number>
  for (const p of picks) attrs[p.slot] = p.value
  for (const p of picks) attrs[p.malusSlot] = Math.max(40, attrs[p.malusSlot] - p.malus)
  return {
    attributes: attrs,
    picks: picks.map(p => p.id),
    archetype: computeArchetype(attrs),
    overall: computeOverall(attrs),
  }
}
