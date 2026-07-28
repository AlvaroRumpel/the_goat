import { createRng } from './engine/rng'
import { autoResolve, INTERACTIVE_EVENTS, rollEvents } from './engine/events'
import { drawPlayer, resolveBuild } from './engine/draft'
import { draftPickNumber, makeOffers } from './engine/offers'
import {
  ageMultiplier, computeTitleProb, computeWinPct, finishSeason, performanceRatio, simRegularSeason,
} from './engine/season'
import { advanceOffseason, rosterStrength, simAwards, simBracket, simNpcLines, simStandings } from './engine/league'
import { initLeague } from './data/league'
import { teamById } from './data/teams'
import type { Lang } from './i18n'
import type {
  Build, Career, DraftPick, EventChoice, Focus, GameEventId, Headline, LeagueSeasonOutcome, LeagueState, NpcLine,
  Offer, RaceAward, RegularSeasonResult, Rng, SeasonResult, SlotId, TeamProfile, TeamStanding,
} from './engine/types'

export type Phase =
  | 'home' | 'attrDraft' | 'draftDone' | 'nbaDraft' | 'preseason'
  | 'seasonResult' | 'tradeDecision' | 'eventDecision' | 'freeAgency' | 'retireDecision' | 'verdict'

export interface LeagueYear { year: number; championTeamId: string; winners: Record<RaceAward, string | null> }

interface PendingLeague { standings: TeamStanding[]; lines: NpcLine[]; winPct: number; effClutch: number }

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
  | { type: 'ADVANCE' }              // from seasonResult → next phase (FA / retire / preseason)
  | { type: 'RETIRE_DECISION'; retire: boolean }
  | { type: 'RESET' }

const STORAGE_KEY = 'thegoat:v3'

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
    injuryProne: false,
    career: { seasons: [], fame: 0 },
    league: null,
    seasonOutcome: null,
    leagueHistory: [],
    headlines: [],
    pendingLeague: null,
  }
}

// Ordem fixa de consumo de rng (replay do save depende dela):
// simRegularSeason → winPct → standings → lines → [pausa tradeDecision] →
// concludeSeason: [winPct do time final, só se trocou] → bracket → awards → finishSeason.
function runSeasonSim(
  state: GameState, focus: Focus, events: GameEventId[], choices: EventChoice[], rng: Rng, calls: () => number,
): GameState {
  const currentOffer = state.currentOffer!
  const build = state.build!
  const team = teamById(currentOffer.teamId)
  const canTrade = state.career.seasons.length >= 2
  const regular = simRegularSeason({
    build, age: state.age, team, profile: currentOffer.profile, focus, rng, canTrade, events, choices,
  })
  // força de elenco real (spec §2) — sem o jogador (a fórmula soma overallEff à parte)
  const { winPct, effClutch } = computeWinPct({ build, regular, strength: rosterStrength(state.league!, team.id), focus, rng })
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
  const bracket = simBracket({
    standings, league: state.league!, playerTeamId: seed !== null ? finalOffer.teamId : null,
    playerTitleProb: titleProb, rng,
  })
  const m = ageMultiplier(state.age, build.attributes.physical)
  const prevSeason = state.career.seasons[state.career.seasons.length - 1]
  const { races, winners, playerAwards } = simAwards({
    league: state.league!, lines, standings, playerName: '', rng,   // UI traduz id === 'you'; name ignorado
    player: {
      ppg: regular.ppg, rpg: regular.rpg, apg: regular.apg, teamWinPct: winPct,
      defRating: build.attributes.defense * m, rookie: state.career.seasons.length === 0,
      prevPpg: prevSeason?.ppg ?? null,
    },
  })
  const season = finishSeason({
    regular, finalTeamId: finalOffer.teamId, build, rng, winPct,
    seed, playoffRun: bracket.playerRun, wonTitle: bracket.wonTitle, extraAwards: playerAwards,
  })
  const career = applyFame(state.career, season, finalOffer.profile)
  const seasonOutcome: LeagueSeasonOutcome = {
    standings, lines, races, winners, championTeamId: bracket.championTeamId, playerRun: bracket.playerRun,
  }
  return { ...state, phase: 'seasonResult', career, seasonOutcome, pendingEvents: null, pendingLeague: null, rngCalls: calls() }
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
      return runSeasonSim(consumed, action.focus, events, autoResolve(events), rng, calls)
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
      return runSeasonSim({ ...state, injuryProne, pendingFocus: null }, focus, events, choices, rng, calls)
    }

    case 'TRADE_DECISION': {
      const pendingRegular = state.pendingRegular!
      const pendingFocus = state.pendingFocus!
      const tradeOffer = pendingRegular.tradeOffer!
      const finalOffer = action.accept ? tradeOffer : state.currentOffer!
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const concluded = concludeSeason(state, pendingRegular, finalOffer, pendingFocus, state.pendingLeague!, rng, calls)
      return {
        ...concluded,
        currentOffer: finalOffer,
        contractYearsLeft: action.accept ? 4 : state.contractYearsLeft,
        pendingRegular: null,
        pendingFocus: null,
      }
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
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.phase !== 'string' || typeof parsed.seed !== 'number') return null
    // save sem liga completa é incompatível com o replay — descarta
    if (parsed.phase !== 'home' && parsed.league?.players?.length !== 270) return null
    if (parsed.pendingRegular && !parsed.pendingRegular.choices) parsed.pendingRegular.choices = []
    parsed.injuryProne = parsed.injuryProne ?? false
    parsed.pendingEvents = parsed.pendingEvents ?? null
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
