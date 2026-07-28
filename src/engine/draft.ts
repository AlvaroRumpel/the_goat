import { PLAYERS, playerById } from '../data/players'
import { SLOT_ORDER, type Archetype, type Build, type DraftPick, type Player, type Rng, type SlotId } from './types'

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

export function drawPlayer(rng: Rng, drawnIds: string[]): Player {
  const pool = PLAYERS.filter(pl => !drawnIds.includes(pl.id))
  return rng.pick(pool)
}

export function weakestSlot(player: Player, excluding: SlotId): SlotId {
  const slots = SLOT_ORDER.filter(s => s !== excluding)
  return slots.reduce((worst, s) => player.attrs[s] < player.attrs[worst] ? s : worst, slots[0])
}

export function malusAmount(value: number): number {
  return Math.min(5, Math.max(1, Math.round((value - 71) / 6)))
}

export function resolveBuild(picks: DraftPick[]): Build {
  const attrs = {} as Record<SlotId, number>
  for (const pk of picks) attrs[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
  for (const pk of picks) {
    const player = playerById(pk.playerId)
    const target = weakestSlot(player, pk.slot)
    attrs[target] = Math.max(40, attrs[target] - malusAmount(player.attrs[pk.slot]))
  }
  return {
    attributes: attrs,
    picks,
    archetype: computeArchetype(attrs),
    overall: computeOverall(attrs),
  }
}
