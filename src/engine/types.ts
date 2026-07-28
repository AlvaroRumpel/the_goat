export type SlotId =
  | 'three' | 'finishing' | 'passing' | 'handles'
  | 'defense' | 'rebounding' | 'physical' | 'clutch'

export const SLOT_ORDER: SlotId[] = [
  'three', 'finishing', 'passing', 'handles',
  'defense', 'rebounding', 'physical', 'clutch',
]

export type Era = '50s' | '60s' | '70s' | '80s' | '90s' | '2000s' | '2010s' | '2020s'

export interface Player {
  id: string
  name: string
  era: Era
  attrs: Record<SlotId, number>   // 40..99
}

export interface DraftPick { playerId: string; slot: SlotId }

export type Archetype = 'PG' | 'SG' | 'SF' | 'PF' | 'C'

export interface Build {
  attributes: Record<SlotId, number>
  picks: DraftPick[]           // player picks with slots
  archetype: Archetype
  overall: number              // 0..99
}

export type TeamProfile = 'contender' | 'rebuild' | 'bigmarket'

export interface Team {
  id: string          // 'lal'
  name: string        // 'Lakers'
  city: string        // 'Los Angeles'
  strength: number    // 55..85 base roster strength
  bigMarket: boolean
}

export interface Offer { teamId: string; profile: TeamProfile }

export type Focus = 'scoring' | 'defense' | 'leadership' | 'health'

export type Award = 'allstar' | 'mvp' | 'dpoy' | 'scoring' | 'fmvp' | 'ring'

export type GameEventId = 'injury' | 'rivalry' | 'viral' | 'coldstreak'

export interface RegularSeasonResult {
  age: number
  teamId: string
  games: number       // out of 82
  ppg: number
  rpg: number
  apg: number
  events: GameEventId[]
  tradeOffer: Offer | null   // deadline trade; decided before postseason
}

export interface SeasonResult extends Omit<RegularSeasonResult, 'tradeOffer'> {
  finalTeamId: string        // differs from teamId if trade accepted
  madePlayoffs: boolean
  wonTitle: boolean
  awards: Award[]
}

export interface Career {
  seasons: SeasonResult[]
  fame: number               // accumulated from bigmarket seasons + viral events
}

export type Tier =
  | 'peladeiro' | 'rolePlayer' | 'starter' | 'allstar'
  | 'superstar' | 'legend' | 'goat'

export interface Verdict {
  score: number
  tier: Tier
  totals: { points: number; rebounds: number; assists: number; seasons: number }
  counts: Record<Award, number>
}

export interface Rng {
  next(): number                      // [0,1)
  int(min: number, max: number): number  // inclusive
  pick<T>(arr: T[]): T
  chance(p: number): boolean
}
