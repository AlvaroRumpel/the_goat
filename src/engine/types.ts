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

export type Conf = 'east' | 'west'

export interface Team {
  id: string          // 'lal'
  name: string        // 'Lakers'
  city: string        // 'Los Angeles'
  strength: number    // 55..85 base roster strength
  bigMarket: boolean
  conf: Conf
}

export interface Offer { teamId: string; profile: TeamProfile }

export type Focus = 'scoring' | 'defense' | 'leadership' | 'health'

export type Award = 'allstar' | 'mvp' | 'dpoy' | 'scoring' | 'fmvp' | 'ring' | 'roy' | 'mip'

export type LeagueTag = 'shooter' | 'defender' | 'playmaker' | 'rebounder'

export interface LeaguePlayer {
  id: string          // 'lg-jokic'
  name: string        // 'Nikola Jokic'
  pos: Archetype
  age: number         // idade em 2026 (ano 1 do jogo)
  ovr: number         // 40..99, régua base (pico)
  tags: LeagueTag[]
  teamId: string
  rookie: boolean
  prevPpg: number | null   // ppg da temporada anterior (MIP); null no ano 1
}

export interface LeagueState { players: LeaguePlayer[]; year: number }

export interface NpcLine { playerId: string; ppg: number; rpg: number; apg: number }

export interface TeamStanding { teamId: string; wins: number; conf: Conf; seed: number | null }

export type PlayoffRun = 'missed' | 'r1' | 'semi' | 'conf' | 'finals' | 'champion'

export type RaceAward = 'mvp' | 'dpoy' | 'roy' | 'mip'

// id === 'you' representa o jogador do usuário
export interface RaceEntry { id: string; name: string; value: number }
export interface AwardRace { award: RaceAward; top: RaceEntry[] }

export type Headline =
  | { kind: 'trade'; playerName: string; fromTeamId: string; toTeamId: string }
  | { kind: 'retire'; playerName: string; teamId: string }
  | { kind: 'draft'; playerName: string; teamId: string }

export interface LeagueSeasonOutcome {
  standings: TeamStanding[]
  lines: NpcLine[]
  races: AwardRace[]
  winners: Record<RaceAward, string | null>   // 'you' | LeaguePlayer.id | null
  championTeamId: string
  playerRun: PlayoffRun
}

export type GameEventId =
  | 'injury' | 'rivalry' | 'viral' | 'coldstreak'
  | 'hotstreak' | 'coachchange' | 'playoffspark' | 'lockerroom'

export type EventChoice = 'injuryEarly' | 'injuryFull' | 'lockerFight' | 'lockerCalm'

export interface RegularSeasonResult {
  age: number
  teamId: string
  games: number       // out of 82
  ppg: number
  rpg: number
  apg: number
  events: GameEventId[]
  choices: EventChoice[]
  tradeOffer: Offer | null   // deadline trade; decided before postseason
}

export interface SeasonResult extends Omit<RegularSeasonResult, 'tradeOffer'> {
  finalTeamId: string        // differs from teamId if trade accepted
  madePlayoffs: boolean
  wonTitle: boolean
  awards: Award[]
  seed: number | null
  playoffRun: PlayoffRun
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
