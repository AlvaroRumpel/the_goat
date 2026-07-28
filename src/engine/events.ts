import type { Focus, GameEventId, Rng } from './types'

const RATES: [GameEventId, number][] = [
  ['injury', 0.18],
  ['rivalry', 0.12],
  ['viral', 0.10],
  ['coldstreak', 0.12],
]

export function rollEvents(rng: Rng, focus: Focus): GameEventId[] {
  const out: GameEventId[] = []
  for (const [id, rate] of RATES) {
    const p = id === 'injury' && focus === 'health' ? rate / 2 : rate
    if (rng.chance(p)) out.push(id)
    if (out.length === 2) break
  }
  return out
}
