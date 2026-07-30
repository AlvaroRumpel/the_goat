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

export type SlotKey = 'openTone' | 'q2tactic' | 'q3swing' | 'q4pressure' | 'clutch'

export interface MomentOption {
  id: string                 // 'safePass' | 'boldThree' | 'attackRim' | 'playHurt' | ...
  attr: SlotId
  attr2?: SlotId             // mix opcional (ex.: three + clutch)
  risk: MomentRisk
  injuryRisk?: number        // só em opções que ANUNCIAM risco (spec §1)
}

export interface Moment {
  id: SlotKey
  situationKey: string       // 'moment.q2tactic.s3'
  at: number                 // minuto do jogo (0-48)
  clock: string              // '2Q 01:30'
  params: Record<string, string | number>
  options: MomentOption[]    // 2-3, exatamente uma safe
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
  momentId: SlotKey
  optionId: string
  success: boolean
  injury: boolean
  delta: number              // JÁ PONDERADO por 3/n — some direto, nunca reponderar
  clock: string              // '4Q 00:21' — a GameResult só recebe outcomes
}

export type IconicMomentId =
  | 'finalsBuzzer' | 'seriesWinner' | 'closeout45' | 'fluGame'
  | 'comeback' | 'bigNight' | 'rivalWinner' | 'sweep'

export interface WatchedGameResult {
  won: boolean
  margin: number             // >0 = vitória
  playerPts: number
  reb: number
  ast: number
  outcomes: MomentOutcome[]
  injured: boolean           // lesão ocorreu neste jogo
  choke: boolean             // falhou clutch em jogo de eliminação
  iconics: IconicMomentId[]  // detectados neste jogo (sweep é detectado na série, fora daqui)
  winP: number               // P(vitória) do jogo ANTES dos momentos, na política padrão
  expectedDelta: number      // E[Σ deltas] deste jogo (keyGameEffects centra nele)
}

export interface PendingGame {
  context: WatchedGameContext
  moments: Moment[]          // 2-5, sorteados no início do jogo
  momentIndex: number        // próximo momento a resolver (0..moments.length)
  outcomes: MomentOutcome[]
  baseMargin: number
  winP: number
  expectedDelta: number      // E[Σ deltas] da política padrão PARA ESTES momentos
  log: PlayEntry[]
}

export interface KeyGame { kind: WatchedGameKind; opponentTeamId: string }

export interface CalendarSlot { gameIndex: number; keyGame: KeyGame }

// entrada do walk da temporada (ticker do 6b); keyGame presente quando o jogo foi um
// jogo-chave real (resultado literal no registro)
export interface TickerGame {
  gameIndex: number          // 1..82
  won: boolean
  ourScore: number
  oppScore: number
  playerPts: number
  opponentTeamId: string
  keyGame?: WatchedGameKind
}

// linha da coluna de lances (8a); `at` = minuto do jogo (0-48), ordena a coluna
export interface PlayEntry {
  at: number
  clock: string              // '3Q 08:22'
  textKey: string            // 'play.ambient.2.v1' | 'play.clutchThree.hit.v0' ...
  params: Record<string, string | number>
  score: { us: number; them: number }
  jitter: number             // ruído visual da linha; preservado para reescorar o log
  fromDecision?: true
}

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
  iconicPoints: number
  chokes: number
}

export interface Rng {
  next(): number                      // [0,1)
  int(min: number, max: number): number  // inclusive
  pick<T>(arr: T[]): T
  chance(p: number): boolean
}
