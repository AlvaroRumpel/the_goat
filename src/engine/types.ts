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

export type MomentRisk = 'safe' | 'bold' | 'reckless'

export interface MomentOption {
  id: string                 // 'safePass' | 'boldThree' | 'attackRim' | 'playHurt' | ...
  attr: SlotId
  attr2?: SlotId             // mix opcional (ex.: three + clutch)
  risk: MomentRisk
  injuryRisk?: number        // só em opções que ANUNCIAM risco (spec §1)
}

export interface Moment {
  id: string                 // 'q2tactic' | 'q4pressure' | 'clutch'
  situationKey: string       // chave i18n: 'moment.q2tactic.desc' etc.
  params: Record<string, string | number>   // { opp: 'BOS', diff: 4 }
  options: MomentOption[]    // 2-3
}

export type WatchedGameKind = 'rivalry' | 'seedRace' | 'special' | 'playoff' | 'finals'

export interface WatchedGameContext {
  kind: WatchedGameKind
  opponentTeamId: string
  round?: PlayoffRun         // contexto de playoffs
  seriesUs?: number          // placar da série antes deste jogo
  seriesThem?: number
  gameNumber?: number        // 1-7 nas finais
  elimination?: boolean      // derrota elimina (ou vitória fecha) — para icônicos/choke
}

export interface MomentOutcome {
  momentId: string
  optionId: string
  success: boolean
  injury: boolean
  delta: number              // contribuição ao margin
}

export type IconicMomentId =
  | 'finalsBuzzer' | 'seriesWinner' | 'closeout45' | 'fluGame'
  | 'comeback' | 'bigNight' | 'rivalWinner' | 'sweep'

export interface WatchedGameResult {
  won: boolean
  margin: number             // >0 = vitória
  playerPts: number
  outcomes: MomentOutcome[]
  injured: boolean           // lesão ocorreu neste jogo
  choke: boolean             // falhou clutch em jogo de eliminação
  iconics: IconicMomentId[]  // detectados neste jogo (sweep é detectado na série, fora daqui)
}

export interface PendingGame {
  context: WatchedGameContext
  moments: Moment[]          // 3, gerados no início do jogo
  momentIndex: number        // próximo momento a resolver (0-3)
  outcomes: MomentOutcome[]
  baseMargin: number         // rolado no início
}

export interface KeyGame { kind: WatchedGameKind; opponentTeamId: string }

export interface SeasonResult extends Omit<RegularSeasonResult, 'tradeOffer'> {
  finalTeamId: string        // differs from teamId if trade accepted
  madePlayoffs: boolean
  wonTitle: boolean
  awards: Award[]
  seed: number | null
  playoffRun: PlayoffRun
  iconicMoments: IconicMomentId[]
  chokes: number
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
