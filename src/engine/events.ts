import type { EventChoice, Focus, GameEventId, Rng } from './types'

const RATES: [GameEventId, number][] = [
  ['injury', 0.18],
  ['rivalry', 0.12],
  ['viral', 0.10],
  ['coldstreak', 0.12],
  ['hotstreak', 0.10],
  ['coachchange', 0.08],
  ['playoffspark', 0.08],
  ['lockerroom', 0.10],
]

export const INTERACTIVE_EVENTS: GameEventId[] = ['injury', 'lockerroom']

export function rollEvents(rng: Rng, focus: Focus, injuryProne = false): GameEventId[] {
  const out: GameEventId[] = []
  for (const [id, rate] of RATES) {
    let p = rate
    if (id === 'injury') {
      if (focus === 'health') p /= 2
      if (injuryProne) p *= 1.5
    }
    if (id === 'hotstreak' && out.includes('coldstreak')) continue
    if (rng.chance(p)) out.push(id)
    if (out.length === 2) break
  }
  return out
}

export function autoResolve(events: GameEventId[]): EventChoice[] {
  const out: EventChoice[] = []
  if (events.includes('injury')) out.push('injuryFull')
  if (events.includes('lockerroom')) out.push('lockerCalm')
  return out
}
