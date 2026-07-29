import { createRng } from './engine/rng'
import { autoResolve, INTERACTIVE_EVENTS, rollEvents } from './engine/events'
import { drawPlayer, resolveBuild } from './engine/draft'
import { draftPickNumber, makeOffers } from './engine/offers'
import {
  ageMultiplier, computeTitleProb, computeWinPct, effectiveOverall, finishSeason, performanceRatio, simRegularSeason,
} from './engine/season'
import { advanceOffseason, ROUND_RUN, rosterStrength, simAwards, simBracket, simNpcLines, simStandings } from './engine/league'
import {
  advancePlayer, npcRound, pGameForSeries, PLAYER_OUT_MARGIN, resolveRest, seedBracket, SERIES_SHIFT,
} from './engine/playoffs'
import type { BracketState } from './engine/playoffs'
import {
  applyMoment, autoResolveGame, finishWatchedGame, selectKeyGames, startWatchedGame,
} from './engine/moments'
import { initLeague } from './data/league'
import { teamById } from './data/teams'
import type { Lang } from './i18n'
import type {
  Award, AwardRace, Build, Career, DraftPick, EventChoice, Focus, GameEventId, Headline, IconicMomentId, KeyGame,
  LeagueSeasonOutcome, LeagueState, NpcLine, Offer, PendingGame, PlayoffRun, RaceAward, RegularSeasonResult, Rng,
  SeasonResult, SlotId, TeamProfile, TeamStanding, WatchedGameContext, WatchedGameResult,
} from './engine/types'

export type Phase =
  | 'home' | 'attrDraft' | 'draftDone' | 'nbaDraft' | 'preseason'
  | 'seasonResult' | 'tradeDecision' | 'eventDecision' | 'keyGame' | 'playoffGame'
  | 'freeAgency' | 'retireDecision' | 'verdict'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface LeagueYear { year: number; championTeamId: string; winners: Record<RaceAward, string | null> }

interface PendingLeague { standings: TeamStanding[]; lines: NpcLine[]; winPct: number; effClutch: number }

interface SeasonAwards { races: AwardRace[]; winners: Record<RaceAward, string | null>; playerAwards: Award[] }

// Playoffs em andamento: tudo que a conclusão da temporada precisa, congelado
// enquanto o jogador decide os jogos (a temporada regular já está fechada).
export interface PendingPlayoffs {
  bracket: BracketState
  opponentTeamId: string
  seriesUs: number; seriesThem: number   // finais; 0-0 nos rounds de prob
  pGame: number                          // finais: p por jogo equivalente a seriesProb
  seriesProb: number                     // rounds 0-2 (base, sem shift)
  titleProb: number
  winPct: number
  seed: number
  playerOut: boolean                     // lesionado: jogos restantes auto-resolvem
  chokes: number
  iconics: IconicMomentId[]
  regular: RegularSeasonResult
  finalOffer: Offer
  awards: SeasonAwards
  standings: TeamStanding[]
  lines: NpcLine[]
}

export interface GameState {
  phase: Phase
  lang: Lang
  seed: number
  rngCalls: number           // replay counter — see persistence note
  currentPlayerId: string | null  // player currently up for draft
  drawnIds: string[]         // players already drawn (no repeats)
  rerollUsed: boolean        // one extra draw allowed per draft
  draftRound: number         // 0..7
  picks: DraftPick[]
  build: Build | null
  pickNumber: number | null
  offers: Offer[]            // current 3 offers (nba draft or FA)
  currentOffer: Offer | null // accepted offer (team + profile)
  contractYearsLeft: number
  age: number
  pendingRegular: RegularSeasonResult | null  // set when trade offered mid-sim
  pendingFocus: Focus | null // focus from PLAY_SEASON, needed to resolve postseason after a trade decision
  pendingEvents: GameEventId[] | null  // set when an interactive event pauses PLAY_SEASON
  pendingChoices: EventChoice[] | null  // resolved event choices, held across the keyGame pause
  pendingKeyGames: KeyGame[] | null   // remaining key-game queue (current game already popped)
  pendingGame: PendingGame | null     // key/playoff game currently being watched
  pendingPlayoffs: PendingPlayoffs | null  // postseason in progress (null outside the playoffGame phase)
  keyGameResults: WatchedGameResult[] // this season's watched games; reset at the start of PLAY_SEASON
  injuryProne: boolean       // set by injuryEarly choice; consumed (and reset) by next season's roll
  career: Career
  league: LeagueState | null
  seasonOutcome: LeagueSeasonOutcome | null   // temporada corrente (UI: tabela/corridas/cerimônia)
  leagueHistory: LeagueYear[]
  headlines: Headline[]      // do último offseason (UI: preseason)
  pendingLeague: PendingLeague | null   // liga simulada, aguardando decisão de trade
}

export type Action =
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'NEW_GAME'; seed: number }
  | { type: 'DRAFT_STEAL'; slot: SlotId }
  | { type: 'DRAFT_REROLL' }
  | { type: 'CONFIRM_BUILD' }        // draftDone → nbaDraft (computes pickNumber + offers)
  | { type: 'CHOOSE_OFFER'; offer: Offer }
  | { type: 'PLAY_SEASON'; focus: Focus }
  | { type: 'TRADE_DECISION'; accept: boolean }
  | { type: 'EVENT_DECISION'; choice: 'a' | 'b' }
  | { type: 'DECIDE_MOMENT'; optionId: string }
  | { type: 'SKIP_GAME' }
  | { type: 'ADVANCE_GAME' }         // finais: da tela de série para o próximo jogo
  | { type: 'SKIP_SERIES' }          // finais: auto-resolve os jogos restantes da série
  | { type: 'ADVANCE' }              // from seasonResult → next phase (FA / retire / preseason)
  | { type: 'RETIRE_DECISION'; retire: boolean }
  | { type: 'RESET' }

const STORAGE_KEY = 'thegoat:v4'

function makeCountedRng(seed: number, skip: number): { rng: Rng; calls: () => number } {
  const inner = createRng(seed)
  let n = 0
  const next = () => { n++; return inner.next() }
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  }
  for (let i = 0; i < skip; i++) next()
  return { rng, calls: () => n }
}

function applyFame(career: Career, season: SeasonResult, profile: TeamProfile): Career {
  let fame = career.fame
  if (season.events.includes('viral')) fame += 10
  if (profile === 'bigmarket') fame += 2
  return { seasons: [...career.seasons, season], fame }
}

export function initialState(lang: Lang = 'pt'): GameState {
  return {
    phase: 'home',
    lang,
    seed: 0,
    rngCalls: 0,
    currentPlayerId: null,
    drawnIds: [],
    rerollUsed: false,
    draftRound: 0,
    picks: [],
    build: null,
    pickNumber: null,
    offers: [],
    currentOffer: null,
    contractYearsLeft: 0,
    age: 0,
    pendingRegular: null,
    pendingFocus: null,
    pendingEvents: null,
    pendingChoices: null,
    pendingKeyGames: null,
    pendingGame: null,
    pendingPlayoffs: null,
    keyGameResults: [],
    injuryProne: false,
    career: { seasons: [], fame: 0 },
    league: null,
    seasonOutcome: null,
    leagueHistory: [],
    headlines: [],
    pendingLeague: null,
  }
}

// Ordem fixa de consumo de rng POR DISPATCH (replay do save depende dela; o custo de
// um jogo assistido é fixo — GAME_RNG_CALLS = 10 — decidindo ou pulando):
// PLAY_SEASON: rollEvents → selectKeyGames(3) → startWatchedGame(4) → pausa (fase keyGame).
// DECIDE_MOMENT/SKIP_GAME em keyGame: applyMoment(2×N) → [próximo jogo: startWatchedGame(4)] →
//   pausa de novo, ou (fila vazia) runSeasonSim: simRegularSeason → winPct → standings →
//   lines → [pausa tradeDecision] → concludeSeason.
// TRADE_DECISION / fim da fila: concludeSeason: [winPct do time final, só se trocou] →
//   simAwards → sem seed: simBracket → finishSeason (seasonResult);
//   com seed: enterRound (npcRound das séries NPC + startWatchedGame(4)) → pausa (playoffGame).
// DECIDE_MOMENT/SKIP_GAME em playoffGame: applyMoment(2×N) →
//   rounds 0-2: chance(shifted) → venceu: enterRound (npcRound + startWatchedGame(4)) →
//     pausa; perdeu: resolveRest → finishSeason (seasonResult).
//   finais: sem roll de série — 4ª vitória/derrota fecha (finishSeason), senão pausa na
//     tela de série sem consumir rng.
// ADVANCE_GAME: startWatchedGame(4) → pausa. SKIP_SERIES: repete [startWatchedGame(4) +
//   applyMoment(6)] por jogo até a série fechar → finishSeason.

// Efeitos dos jogos-chave (FORA das fórmulas-contrato — deltas de state layer, não da
// forma das fórmulas de season.ts): ±0.01 de winPct por vitória/derrota, ±0.5 de ppg
// pelo saldo de momentos bem/mal-sucedidos, e desgaste de lesão (games/ppg) por jogo
// em que algum momento machucou o jogador.
function keyGameEffects(results: WatchedGameResult[]): { winPctDelta: number; ppgDelta: number; injuredCount: number } {
  const winPctDelta = results.reduce((n, r) => n + (r.won ? 0.01 : -0.01), 0)
  const injuredCount = results.filter(r => r.injured).length
  const netMoments = results.reduce(
    (n, r) => n + r.outcomes.filter(o => o.success).length - r.outcomes.filter(o => !o.success).length, 0,
  )
  const ppgDelta = clamp(netMoments * 0.1, -0.5, 0.5) - injuredCount
  return { winPctDelta, ppgDelta, injuredCount }
}

function runSeasonSim(
  state: GameState, focus: Focus, events: GameEventId[], choices: EventChoice[], rng: Rng, calls: () => number,
): GameState {
  const currentOffer = state.currentOffer!
  const build = state.build!
  const team = teamById(currentOffer.teamId)
  const canTrade = state.career.seasons.length >= 2
  const simmed = simRegularSeason({
    build, age: state.age, team, profile: currentOffer.profile, focus, rng, canTrade, events, choices,
    standings: state.seasonOutcome?.standings,   // tabela do ano anterior; ano 1 cai no estático
  })
  const { winPctDelta, ppgDelta, injuredCount } = keyGameEffects(state.keyGameResults)
  const regular: RegularSeasonResult = {
    ...simmed,
    games: Math.max(40, simmed.games - injuredCount * 10),
    ppg: clamp(Math.round((simmed.ppg + ppgDelta) * 10) / 10, 4, 38),
  }
  // força de elenco real (spec §2) — sem o jogador (a fórmula soma overallEff à parte)
  const { winPct: rawWinPct, effClutch } = computeWinPct({ build, regular, strength: rosterStrength(state.league!, team.id), focus, rng })
  const winPct = clamp(rawWinPct + winPctDelta, 0.15, 0.85)
  const playerWins = Math.round(winPct * 82)
  const standings = simStandings({ league: state.league!, playerTeamId: team.id, playerWins, rng })
  const lines = simNpcLines(state.league!, rng)
  if (regular.tradeOffer) {
    return {
      ...state, phase: 'tradeDecision', pendingRegular: regular, pendingFocus: focus, pendingEvents: null,
      pendingLeague: { standings, lines, winPct, effClutch }, rngCalls: calls(),
    }
  }
  return concludeSeason(state, regular, currentOffer, focus, { standings, lines, winPct, effClutch }, rng, calls)
}

// Temporada regular fechada: awards (não dependem do bracket) e então os playoffs —
// de uma vez quando o jogador ficou fora, jogo a jogo quando classificou.
function concludeSeason(
  state: GameState, regular: RegularSeasonResult, finalOffer: Offer, focus: Focus,
  pending: PendingLeague, rng: Rng, calls: () => number,
): GameState {
  const build = state.build!
  const { standings, lines } = pending
  // pós-trade o time final difere do simulado na tabela; recomputa winPct do time final (fórmula-contrato)
  const { winPct, effClutch } =
    finalOffer.teamId === regular.teamId
      ? { winPct: pending.winPct, effClutch: pending.effClutch }
      : computeWinPct({ build, regular, strength: rosterStrength(state.league!, finalOffer.teamId), focus, rng })
  const seed = standings.find(s => s.teamId === finalOffer.teamId)!.seed
  const clutchAdj = seed !== null && regular.events.includes('playoffspark') ? effClutch + 8 : effClutch
  const titleProb = seed !== null ? computeTitleProb(winPct, clutchAdj) : 0
  const m = ageMultiplier(state.age, build.attributes.physical)
  const prevSeason = state.career.seasons[state.career.seasons.length - 1]
  const awards = simAwards({
    league: state.league!, lines, standings, playerName: '', rng,   // UI traduz id === 'you'; name ignorado
    player: {
      ppg: regular.ppg, rpg: regular.rpg, apg: regular.apg, teamWinPct: winPct,
      defRating: build.attributes.defense * m, rookie: state.career.seasons.length === 0,
      prevPpg: prevSeason?.ppg ?? null,
    },
  })
  const base = { ...state, pendingEvents: null, pendingLeague: null }
  const common = { regular, finalOffer, winPct, awards, standings, lines, iconics: [], chokes: 0 }

  if (seed === null) {
    const bracket = simBracket({
      standings, league: state.league!, playerTeamId: null, playerTitleProb: titleProb, rng,
    })
    return finishPostseason(base, { ...common, seed }, bracket, rng, calls)
  }
  return enterRound(base, {
    ...common, bracket: seedBracket(standings), opponentTeamId: '', seriesUs: 0, seriesThem: 0,
    pGame: 0, seriesProb: 0, titleProb, seed, playerOut: false,
  }, rng, calls)
}

// Entra num round: NPCs resolvem suas séries, o oponente do jogador é definido e o
// jogo decisivo abre. seriesProb usa a MESMA fórmula do simBracket (fórmula-contrato).
function enterRound(state: GameState, pp: PendingPlayoffs, rng: Rng, calls: () => number): GameState {
  const { next, playerOpponent } = npcRound(pp.bracket, state.league!, pp.finalOffer.teamId, rng)
  const opponentTeamId = playerOpponent!
  const baseP = Math.pow(Math.max(pp.titleProb, 0.0001), 1 / 4)
  const oppStrength = rosterStrength(state.league!, opponentTeamId)
  const seriesProb = clamp(baseP * (1 - (oppStrength - 70) * 0.004), 0.05, 0.95)
  return openPlayoffGame(state, {
    ...pp, bracket: next, opponentTeamId, seriesProb, seriesUs: 0, seriesThem: 0,
    pGame: next.round === 3 ? pGameForSeries(seriesProb) : 0,
  }, rng, calls)
}

function playoffContext(pp: PendingPlayoffs): WatchedGameContext {
  const finals = pp.bracket.round === 3
  return {
    kind: finals ? 'finals' : 'playoff',
    opponentTeamId: pp.opponentTeamId,
    round: ROUND_RUN[pp.bracket.round],
    seriesUs: pp.seriesUs, seriesThem: pp.seriesThem,
    gameNumber: finals ? pp.seriesUs + pp.seriesThem + 1 : undefined,
    // rounds 0-2: jogo pivotal, sempre narrado como decisivo
    elimination: finals ? (pp.seriesThem === 3 || pp.seriesUs === 3) : true,
  }
}

// Abre o próximo jogo de playoffs. Com o jogador lesionado não há decisão: o time
// joga com PLAYER_OUT_MARGIN de penalidade e o jogo resolve na hora.
function openPlayoffGame(state: GameState, pp: PendingPlayoffs, rng: Rng, calls: () => number): GameState {
  const ourStrength = watchedGameStrength(state, pp.finalOffer.teamId) + (pp.playerOut ? PLAYER_OUT_MARGIN : 0)
  const oppStrength = rosterStrength(state.league!, pp.opponentTeamId)
  const pending = startWatchedGame({ context: playoffContext(pp), ourStrength, oppStrength, rng })
  if (!pp.playerOut) {
    return { ...state, phase: 'playoffGame', pendingPlayoffs: pp, pendingGame: pending, rngCalls: calls() }
  }
  return finishPlayoffGame(state, pp, autoResolveGame(pending, state.build!, state.age, rng), rng, calls)
}

// Jogador eliminado: sai do bracket e o oponente segue (npcRound deixa o par do
// jogador como [player, opp] adjacentes, ambos vivos até esta decisão).
function eliminated(bs: BracketState, playerTeamId: string): BracketState {
  return {
    round: bs.round + 1,
    aliveEast: bs.aliveEast.filter(id => id !== playerTeamId),
    aliveWest: bs.aliveWest.filter(id => id !== playerTeamId),
  }
}

// Jogo de playoffs fechado (3 momentos resolvidos).
function finishPlayoffGame(
  state: GameState, pp: PendingPlayoffs, pending: PendingGame, rng: Rng, calls: () => number,
): GameState {
  const result = finishWatchedGame(pending, state.build!, state.age)
  const next: PendingPlayoffs = {
    ...pp,
    iconics: [...pp.iconics, ...result.iconics],
    chokes: pp.chokes + (result.choke ? 1 : 0),
    playerOut: pp.playerOut || result.injured,
  }
  // lesão nos playoffs corta o resto da pós-temporada E entra na próxima temporada
  const base = { ...state, pendingGame: null, injuryProne: state.injuryProne || result.injured }
  const teamId = pp.finalOffer.teamId

  if (pp.bracket.round < 3) {
    const shifted = clamp(pp.seriesProb + (result.won ? SERIES_SHIFT : -SERIES_SHIFT), 0.05, 0.95)
    if (rng.chance(shifted)) {
      return enterRound(base, { ...next, bracket: advancePlayer(pp.bracket, teamId, rng) }, rng, calls)
    }
    const championTeamId = resolveRest(eliminated(pp.bracket, teamId), state.league!, rng)
    return finishPostseason(base, next, { championTeamId, playerRun: ROUND_RUN[pp.bracket.round], wonTitle: false }, rng, calls)
  }

  const seriesUs = pp.seriesUs + (result.won ? 1 : 0)
  const seriesThem = pp.seriesThem + (result.won ? 0 : 1)
  const series = { ...next, seriesUs, seriesThem }
  if (seriesUs === 4) {
    const iconics: IconicMomentId[] = seriesThem === 0 ? [...series.iconics, 'sweep'] : series.iconics
    return finishPostseason(base, { ...series, iconics },
      { championTeamId: teamId, playerRun: 'champion', wonTitle: true }, rng, calls)
  }
  if (seriesThem === 4) {
    return finishPostseason(base, series,
      { championTeamId: pp.opponentTeamId, playerRun: 'finals', wonTitle: false }, rng, calls)
  }
  // série aberta: tela de placar (ADVANCE_GAME abre o próximo jogo, SKIP_SERIES fecha a série)
  return { ...base, phase: 'playoffGame', pendingPlayoffs: series, rngCalls: calls() }
}

// Fecha a temporada: agrega icônicos/chokes dos jogos-chave + playoffs e monta o resultado.
function finishPostseason(
  state: GameState,
  p: {
    regular: RegularSeasonResult; finalOffer: Offer; winPct: number; seed: number | null
    awards: SeasonAwards; standings: TeamStanding[]; lines: NpcLine[]
    iconics: IconicMomentId[]; chokes: number
  },
  outcome: { championTeamId: string; playerRun: PlayoffRun; wonTitle: boolean },
  rng: Rng, calls: () => number,
): GameState {
  const iconicMoments = [...state.keyGameResults.flatMap(r => r.iconics), ...p.iconics]
  const chokes = state.keyGameResults.filter(r => r.choke).length + p.chokes
  const season = finishSeason({
    regular: p.regular, finalTeamId: p.finalOffer.teamId, build: state.build!, rng, winPct: p.winPct,
    seed: p.seed, playoffRun: outcome.playerRun, wonTitle: outcome.wonTitle,
    extraAwards: p.awards.playerAwards, iconicMoments, chokes,
  })
  const career = applyFame(state.career, season, p.finalOffer.profile)
  const seasonOutcome: LeagueSeasonOutcome = {
    standings: p.standings, lines: p.lines, races: p.awards.races, winners: p.awards.winners,
    championTeamId: outcome.championTeamId, playerRun: outcome.playerRun,
  }
  return {
    ...state, phase: 'seasonResult', career, seasonOutcome,
    pendingGame: null, pendingPlayoffs: null, pendingEvents: null, pendingLeague: null, rngCalls: calls(),
  }
}

// ourStrength inclui o overall efetivo do jogador (extraOvr) — diferente de
// runSeasonSim/computeWinPct, aqui não há termo separado somando overallEff.
function watchedGameStrength(state: GameState, teamId: string): number {
  const build = state.build!
  return rosterStrength(
    state.league!, teamId, effectiveOverall(build.overall, state.age, build.attributes.physical),
  )
}

function startWatchedKeyGame(state: GameState, game: KeyGame, rng: Rng): PendingGame {
  const oppStrength = rosterStrength(state.league!, game.opponentTeamId)
  return startWatchedGame({
    context: { kind: game.kind, opponentTeamId: game.opponentTeamId },
    ourStrength: watchedGameStrength(state, state.currentOffer!.teamId), oppStrength, rng,
  })
}

function startKeyGames(
  state: GameState, focus: Focus, events: GameEventId[], choices: EventChoice[], rng: Rng, calls: () => number,
): GameState {
  const games = selectKeyGames({
    league: state.league!,
    playerTeamId: state.currentOffer!.teamId,
    prevStandings: state.seasonOutcome?.standings ?? null,
    prevChampionTeamId: state.leagueHistory.at(-1)?.championTeamId ?? null,
    hasRivalryEvent: events.includes('rivalry'),
    rng,
  })
  const [first, ...rest] = games
  const pendingGame = startWatchedKeyGame(state, first, rng)
  return {
    ...state, phase: 'keyGame', pendingKeyGames: rest, pendingGame, keyGameResults: [],
    pendingFocus: focus, pendingEvents: events, pendingChoices: choices, rngCalls: calls(),
  }
}

// Chamado após DECIDE_MOMENT/SKIP_GAME resolverem o jogo corrente até momentIndex 3.
// Mesmo caminho para keyGame e playoffGame; só o branch de conclusão difere por fase.
function advanceGame(state: GameState, pending: PendingGame, rng: Rng, calls: () => number): GameState {
  if (pending.momentIndex < 3) return { ...state, pendingGame: pending, rngCalls: calls() }
  if (state.phase === 'playoffGame') return finishPlayoffGame(state, state.pendingPlayoffs!, pending, rng, calls)
  const result = finishWatchedGame(pending, state.build!, state.age)
  const keyGameResults = [...state.keyGameResults, result]
  const queue = state.pendingKeyGames!
  if (queue.length === 0) {
    return runSeasonSim(
      { ...state, keyGameResults, pendingGame: null, pendingKeyGames: null },
      state.pendingFocus!, state.pendingEvents!, state.pendingChoices!, rng, calls,
    )
  }
  const [next, ...rest] = queue
  const pendingGame = startWatchedKeyGame(state, next, rng)
  return { ...state, phase: 'keyGame', pendingKeyGames: rest, pendingGame, keyGameResults, rngCalls: calls() }
}

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang }

    case 'NEW_GAME': {
      const { rng, calls } = makeCountedRng(action.seed, 0)
      const first = drawPlayer(rng, [])
      return {
        ...initialState(state.lang),
        seed: action.seed,
        rngCalls: calls(),
        currentPlayerId: first.id,
        drawnIds: [first.id],
        league: initLeague(),
        phase: 'attrDraft',
      }
    }

    case 'DRAFT_STEAL': {
      if (state.phase !== 'attrDraft' || state.picks.some(pk => pk.slot === action.slot)) return state
      const picks = [...state.picks, { playerId: state.currentPlayerId!, slot: action.slot }]
      if (picks.length >= 8) {
        // DraftDone lê state.build assim que a fase vira, então computa aqui.
        return { ...state, picks, draftRound: 8, build: resolveBuild(picks), phase: 'draftDone' }
      }
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = drawPlayer(rng, state.drawnIds)
      return {
        ...state, picks, draftRound: picks.length,
        currentPlayerId: next.id, drawnIds: [...state.drawnIds, next.id], rngCalls: calls(),
      }
    }

    case 'DRAFT_REROLL': {
      if (state.rerollUsed || state.phase !== 'attrDraft') return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = drawPlayer(rng, state.drawnIds)
      return {
        ...state, rerollUsed: true,
        currentPlayerId: next.id, drawnIds: [...state.drawnIds, next.id], rngCalls: calls(),
      }
    }

    case 'CONFIRM_BUILD': {
      const build = resolveBuild(state.picks)
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const pickNumber = draftPickNumber(build.overall, rng)
      const offers = makeOffers(rng)
      return { ...state, build, pickNumber, offers, age: 19, phase: 'nbaDraft', rngCalls: calls() }
    }

    case 'CHOOSE_OFFER':
      return { ...state, currentOffer: action.offer, contractYearsLeft: 4, phase: 'preseason' }

    case 'PLAY_SEASON': {
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const events = rollEvents(rng, action.focus, state.injuryProne)
      const consumed = { ...state, injuryProne: false }
      const interactive = events.find(e => INTERACTIVE_EVENTS.includes(e))
      if (interactive) {
        return { ...consumed, phase: 'eventDecision', pendingEvents: events, pendingFocus: action.focus, rngCalls: calls() }
      }
      return startKeyGames(consumed, action.focus, events, autoResolve(events), rng, calls)
    }

    case 'EVENT_DECISION': {
      if (state.phase !== 'eventDecision') return state
      const events = state.pendingEvents!
      const focus = state.pendingFocus!
      const interactive = events.find(e => INTERACTIVE_EVENTS.includes(e))!
      // evento interativo primário recebe a escolha do usuário; um segundo interativo (raro) resolve seguro
      const choices = autoResolve(events.filter(e => e !== interactive))
      let injuryProne = state.injuryProne
      if (interactive === 'injury') {
        choices.push(action.choice === 'a' ? 'injuryEarly' : 'injuryFull')
        if (action.choice === 'a') injuryProne = true
      } else {
        choices.push(action.choice === 'a' ? 'lockerFight' : 'lockerCalm')
      }
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      return startKeyGames({ ...state, injuryProne }, focus, events, choices, rng, calls)
    }

    case 'DECIDE_MOMENT': {
      if (state.phase !== 'keyGame' && state.phase !== 'playoffGame') return state
      const pending = state.pendingGame
      if (!pending) return state   // tela de série das finais: sem jogo aberto
      const option = pending.moments[pending.momentIndex].options.find(o => o.id === action.optionId)
      if (!option) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = applyMoment(pending, option, state.build!, state.age, rng)
      return advanceGame(state, next, rng, calls)
    }

    case 'SKIP_GAME': {
      if (state.phase !== 'keyGame' && state.phase !== 'playoffGame') return state
      if (!state.pendingGame) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = autoResolveGame(state.pendingGame, state.build!, state.age, rng)
      return advanceGame(state, next, rng, calls)
    }

    case 'ADVANCE_GAME': {
      if (state.phase !== 'playoffGame' || state.pendingGame || !state.pendingPlayoffs) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      return openPlayoffGame(state, state.pendingPlayoffs, rng, calls)
    }

    case 'SKIP_SERIES': {
      // só nas finais: auto-resolve até a série fechar (rounds 0-2 têm 1 jogo por série)
      if (state.phase !== 'playoffGame' || state.pendingPlayoffs?.bracket.round !== 3) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      let s = state
      let guard = 0
      while (s.phase === 'playoffGame' && s.pendingPlayoffs?.bracket.round === 3 && guard++ < 16) {
        s = s.pendingGame
          ? advanceGame(s, autoResolveGame(s.pendingGame, s.build!, s.age, rng), rng, calls)
          : openPlayoffGame(s, s.pendingPlayoffs, rng, calls)
      }
      return s
    }

    case 'TRADE_DECISION': {
      const pendingRegular = state.pendingRegular!
      const pendingFocus = state.pendingFocus!
      const tradeOffer = pendingRegular.tradeOffer!
      const finalOffer = action.accept ? tradeOffer : state.currentOffer!
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      // contrato aplicado ANTES dos playoffs: o estado pausado em playoffGame já é o final
      const base: GameState = {
        ...state,
        currentOffer: finalOffer,
        contractYearsLeft: action.accept ? 4 : state.contractYearsLeft,
        pendingRegular: null,
        pendingFocus: null,
      }
      return concludeSeason(base, pendingRegular, finalOffer, pendingFocus, state.pendingLeague!, rng, calls)
    }

    case 'ADVANCE': {
      if (state.phase !== 'seasonResult') return state
      const age = state.age + 1
      const contractYearsLeft = state.contractYearsLeft - 1
      // offseason roda em TODOS os branches (inclusive verdict): a liga sempre avança um ano
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const outcome = state.seasonOutcome!
      const { league, headlines } = advanceOffseason({
        league: state.league!, standings: outcome.standings, lines: outcome.lines, rng,
      })
      const leagueHistory = [
        ...state.leagueHistory,
        { year: state.league!.year, championTeamId: outcome.championTeamId, winners: outcome.winners },
      ]
      const base = { ...state, age, contractYearsLeft, league, headlines, leagueHistory, rngCalls: calls() }

      if (age > 40) return { ...base, phase: 'verdict' }

      if (contractYearsLeft === 0) {
        const offers = makeOffers(rng, state.currentOffer?.teamId, outcome.standings)
        return { ...base, phase: 'freeAgency', offers, rngCalls: calls() }
      }

      const ratio = performanceRatio(state.career.seasons)
      const declining = ratio !== null && ratio < 0.75
      if (age >= 31 || declining) return { ...base, phase: 'retireDecision' }

      return { ...base, phase: 'preseason' }
    }

    case 'RETIRE_DECISION': {
      // Reachable from 'retireDecision' (continue/stop) and 'freeAgency' (stop only,
      // when a contract-expiry year lands at age 31+ — see FreeAgency screen).
      if (!action.retire && state.phase === 'freeAgency') return state
      return { ...state, phase: action.retire ? 'verdict' : 'preseason' }
    }

    case 'RESET':
      throw new Error('RESET handled in gameReducer')
  }
}

export function gameReducer(state: GameState, action: Action): GameState {
  if (action.type === 'RESET') {
    clearStorage()
    return initialState(state.lang)
  }
  const next = reduce(state, action)
  saveState(next)
  return next
}

export function saveState(s: GameState): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // storage unavailable/full — best-effort persistence only
  }
}

export function loadState(): GameState | null {
  try {
    if (typeof localStorage === 'undefined') return null
    localStorage.removeItem('thegoat:v1')
    localStorage.removeItem('thegoat:v2')
    localStorage.removeItem('thegoat:v3')
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.phase !== 'string' || typeof parsed.seed !== 'number') return null
    // save sem liga completa é incompatível com o replay — descarta
    if (parsed.phase !== 'home' && parsed.league?.players?.length !== 270) return null
    if (parsed.pendingRegular && !parsed.pendingRegular.choices) parsed.pendingRegular.choices = []
    parsed.injuryProne = parsed.injuryProne ?? false
    parsed.pendingEvents = parsed.pendingEvents ?? null
    parsed.pendingChoices = parsed.pendingChoices ?? null
    parsed.pendingKeyGames = parsed.pendingKeyGames ?? null
    parsed.pendingGame = parsed.pendingGame ?? null
    parsed.pendingPlayoffs = parsed.pendingPlayoffs ?? null
    parsed.keyGameResults = parsed.keyGameResults ?? []
    return parsed as GameState
  } catch {
    return null
  }
}

function clearStorage(): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
