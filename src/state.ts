import { createRng } from './engine/rng'
import { autoResolve, INTERACTIVE_EVENTS, rollEvents } from './engine/events'
import { drawPlayer, resolveBuild } from './engine/draft'
import { draftPickNumber, makeOffers } from './engine/offers'
import {
  ageMultiplier, computeTitleProb, computeWinPct, effectiveOverall, finishSeason, performanceRatio,
  RETIRE_MIN_AGE, simRegularSeason,
} from './engine/season'
import { advanceOffseason, ROUND_RUN, rosterStrength, simAwards, simBracket, simNpcLines, simStandings } from './engine/league'
import {
  advancePlayer, npcRound, pGameForSeries, PLAYER_OUT_MARGIN, resolveRest, seedBracket, SERIES_SHIFT,
} from './engine/playoffs'
import type { BracketState } from './engine/playoffs'
import {
  applyMoment, autoResolveGame, finishWatchedGame, scoreOf, selectKeyGames, startWatchedGame,
} from './engine/moments'
import { buildCalendar, DEADLINE_GAME, simStretch } from './engine/schedule'
import { initLeague } from './data/league'
import { teamById } from './data/teams'
import { computeVerdict } from './engine/verdict'
import type { Lang } from './i18n'
import type {
  Award, AwardRace, Build, CalendarSlot, Career, DraftPick, EventChoice, Focus, GameEventId, GameMode, Headline,
  IconicMomentId, KeyGame, LeagueSeasonOutcome, LeagueState, NpcLine, Offer, PendingGame, PlayoffRun, RaceAward,
  RegularSeasonResult, Rng, SeasonResult, SlotId, TeamProfile, TeamStanding, TickerGame, Verdict, WatchedGameContext,
  WatchedGameResult,
} from './engine/types'

export type Phase =
  | 'home' | 'setupMode' | 'setupIdentity' | 'attrDraft' | 'draftDone' | 'nbaDraft' | 'preseason'
  | 'seasonAdvance' | 'seasonResult' | 'tradeDecision' | 'eventDecision'
  | 'keyGame' | 'playoffGame' | 'gameResult'
  | 'freeAgency' | 'retireDecision' | 'verdict'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface LeagueYear { year: number; championTeamId: string; winners: Record<RaceAward, string | null> }

// Estado do calendário da temporada regular — a verdade do walk (C2). `ticker` é o
// REGISTRO LITERAL: cada entrada (trecho simulado ou key game) conta como vitória/derrota
// real, sem efeito residual sobre winPct.
export interface SeasonCalendar {
  slots: CalendarSlot[]
  nextSlot: number            // índice do próximo key game não jogado
  deadlineDone: boolean       // deadline já pausou (ou não há tradeOffer)
  ticker: TickerGame[]        // walk acumulado — REGISTRO LITERAL da temporada
  played: number              // último gameIndex coberto
  p: number                   // taxa-alvo do segmento corrente (computeWinPct)
  effClutch: number           // do segmento corrente
  autoRun: boolean            // RUN_TO_PLAYOFFS atravessando o resto da regular
}

// Último jogo-chave resolvido — o que a tela de gameResult mostra antes de CONTINUE.
export interface LastGame {
  context: WatchedGameContext
  result: WatchedGameResult
  skipped: boolean
}

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
  rerollsLeft: number        // sorteios extras de carta restantes no draft
  draftRound: number         // 0..7
  picks: DraftPick[]
  build: Build | null
  pickNumber: number | null
  offers: Offer[]            // current 3 offers (nba draft or FA)
  currentOffer: Offer | null // accepted offer (team + profile)
  contractYearsLeft: number
  age: number
  pendingRegular: RegularSeasonResult | null  // stats brutos da temporada corrente; vive a temporada inteira (pré-keyGameEffects)
  pendingFocus: Focus | null // focus from PLAY_SEASON, needed to resolve postseason after a trade decision
  pendingEvents: GameEventId[] | null  // set when an interactive event pauses PLAY_SEASON
  pendingGame: PendingGame | null     // key/playoff game currently being watched
  pendingPlayoffs: PendingPlayoffs | null  // postseason in progress (null outside the playoffGame phase)
  keyGameResults: WatchedGameResult[] // this season's watched games; reset in startSeasonCalendar (after any eventDecision pause)
  injuryProne: boolean       // set by injuryEarly choice; consumed (and reset) by next season's roll
  career: Career
  setup: { mode: GameMode | null }
  league: LeagueState | null
  seasonOutcome: LeagueSeasonOutcome | null   // temporada corrente (UI: tabela/corridas/cerimônia)
  leagueHistory: LeagueYear[]
  headlines: Headline[]      // do último offseason (UI: preseason)
  calendar: SeasonCalendar | null   // walk da temporada regular em andamento (C2)
  lastGame: LastGame | null         // último jogo-chave resolvido, aguardando CONTINUE
  hubOpen: boolean
  timePressure: boolean      // cronômetro do clutch (§6 do spec); default true
  resumePhase: Phase | null
  verdict: Verdict | null
}

export type Action =
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'START_SETUP' }
  | { type: 'SET_MODE'; mode: GameMode }
  | { type: 'BEGIN_CAREER'; seed: number; name: string; number: number }
  | { type: 'DRAFT_STEAL'; slot: SlotId }
  | { type: 'DRAFT_REROLL' }
  | { type: 'CONFIRM_BUILD' }        // draftDone → nbaDraft (computes pickNumber + offers)
  | { type: 'CHOOSE_OFFER'; offer: Offer }
  | { type: 'PLAY_SEASON'; focus: Focus }
  | { type: 'TRADE_DECISION'; accept: boolean }
  | { type: 'EVENT_DECISION'; choice: 'a' | 'b' }
  | { type: 'TAKE_NEXT_GAME' }       // seasonAdvance → keyGame (abre o próximo jogo-chave)
  | { type: 'RUN_TO_PLAYOFFS' }      // seasonAdvance → resolve o resto da regular em auto
  | { type: 'CONTINUE' }             // gameResult → segue o walk (advanceCalendar)
  | { type: 'DECIDE_MOMENT'; optionId: string }
  | { type: 'SKIP_GAME' }
  | { type: 'ADVANCE_GAME' }         // finais: da tela de série para o próximo jogo
  | { type: 'SKIP_SERIES' }          // finais: auto-resolve os jogos restantes da série
  | { type: 'ADVANCE' }              // from seasonResult → next phase (FA / retire / preseason)
  | { type: 'RETIRE_DECISION'; retire: boolean }
  | { type: 'OPEN_HUB' }
  | { type: 'CLOSE_HUB' }
  | { type: 'TOGGLE_TIME_PRESSURE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }

export const STORAGE_KEY = 'thegoat:v7'

const VALID_PHASES = new Set<Phase>([
  'home', 'setupMode', 'setupIdentity', 'attrDraft', 'draftDone', 'nbaDraft', 'preseason',
  'seasonAdvance', 'seasonResult', 'tradeDecision', 'eventDecision',
  'keyGame', 'playoffGame', 'gameResult',
  'freeAgency', 'retireDecision', 'verdict',
])

// fases anteriores ao BEGIN_CAREER — league ainda é null e career ainda não tem
// identidade; loadState não pode exigir nenhum dos dois nelas.
const PRE_CAREER_PHASES = new Set<Phase>(['home', 'setupMode', 'setupIdentity'])

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
  return { ...career, seasons: [...career.seasons, season], fame }
}

export function initialState(lang: Lang = 'pt'): GameState {
  return {
    phase: 'home',
    lang,
    seed: 0,
    rngCalls: 0,
    currentPlayerId: null,
    drawnIds: [],
    rerollsLeft: 2,
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
    pendingGame: null,
    pendingPlayoffs: null,
    keyGameResults: [],
    injuryProne: false,
    career: { seasons: [], fame: 0, mode: null, name: '', number: null, lastName: '' },
    setup: { mode: null },
    league: null,
    seasonOutcome: null,
    leagueHistory: [],
    headlines: [],
    calendar: null,
    lastGame: null,
    hubOpen: false,
    timePressure: true,
    resumePhase: null,
    verdict: null,
  }
}

// Ordem fixa de consumo de rng POR DISPATCH (replay do save depende dela; o custo de
// um jogo assistido é variável — gameRngCalls(n) = 6n + 4, n = momentos sorteados (2-5) —
// decidindo ou pulando):
// PLAY_SEASON: rollEvents → [interativo: pausa eventDecision sem mais calls] →
//   startSeasonCalendar: simRegularSeason → computeWinPct (segmento 1) → selectKeyGames(3)
//   → buildCalendar(4) → advanceCalendar: simStretch (4/jogo) até a 1ª parada → pausa
//   (seasonAdvance, tradeDecision no 55, ou fecha direto se não houver jogos-chave/deadline).
// EVENT_DECISION: mesma cauda de startSeasonCalendar acima.
// TAKE_NEXT_GAME: startWatchedGame(3n+4) → pausa (keyGame).
// DECIDE_MOMENT/SKIP_GAME em keyGame: applyMoment(3 por momento) → jogo fecha (finishKeyGame) →
//   pausa (gameResult), sem mais rng.
// DECIDE_MOMENT/SKIP_GAME em playoffGame: applyMoment(3 por momento) → jogo fecha (pausePlayoffGame)
//   → pausa (gameResult), sem mais rng — o roll de série/rounds fica todo para o CONTINUE.
// CONTINUE (de gameResult): sem pendingPlayoffs → advanceCalendar — simStretch do próximo
//   trecho → pausa (seasonAdvance/tradeDecision) ou, no fim da regular, closeRegularSeason:
//   simStandings → simNpcLines → simAwards → sem seed: simBracket → finishPostseason
//   (seasonResult); com seed: enterRound (npcRound + startWatchedGame(3n+4)) → pausa
//   (playoffGame). Com pendingPlayoffs → continuePlayoffs: rounds 0-2: chance(shifted) →
//   venceu: enterRound (npcRound + startWatchedGame(3n+4)) → pausa; perdeu: resolveRest →
//   finishPostseason (seasonResult). Finais: 4ª vitória/derrota fecha (finishPostseason),
//   senão pausa na tela de série sem consumir mais rng.
// TRADE_DECISION: [aceitou: computeWinPct do time novo] → advanceCalendar (como acima).
// ADVANCE_GAME: startWatchedGame(3n+4) → pausa (playoffGame com jogo aberto). SKIP_SERIES:
//   repete, por jogo, [startWatchedGame(3n+4) + applyMoment(3 por momento)] com pausa (pausePlayoffGame)
//   e avanço (continuePlayoffs) fundidos no mesmo dispatch, sem tela por jogo, até a série
//   fechar → finishPostseason.

// Efeito residual dos jogos-chave: ppg centrado na expectativa e desgaste de lesão.
// O efeito em winPct morreu no C2 — o resultado do jogo entra LITERAL no registro
// (calendar.ticker), então não há mais deriva a corrigir com winPctDelta.
//
// O delta de ppg é CENTRADO NA EXPECTATIVA — o que conta é superar a própria
// expectativa, não existir. Um 99 acertar 73% dos momentos é o esperado dele. Medido
// pelo saldo bruto, toda build forte levava +0.5 ppg fixo por temporada, o que
// empurrava a corrida de MVP (decidida por ~3 pontos de margem contra 270 NPCs).
// E[ppgDelta] ≈ 0 na política auto, por construção, em qualquer faixa — e a política
// ousada é que gera o desvio.
function keyGameEffects(results: WatchedGameResult[]): { ppgDelta: number; injuredCount: number } {
  const injuredCount = results.filter(r => r.injured).length
  const swing = results.reduce((n, r) => n + r.outcomes.reduce((s, o) => s + o.delta, 0) - r.expectedDelta, 0)
  return { ppgDelta: clamp(swing * 0.03, -0.5, 0.5) - injuredCount, injuredCount }
}

// PLAY_SEASON/EVENT_DECISION desembocam aqui: sim bruta + p do segmento 1 + calendário.
function startSeasonCalendar(
  state: GameState, focus: Focus, events: GameEventId[], choices: EventChoice[], rng: Rng, calls: () => number,
): GameState {
  const currentOffer = state.currentOffer!
  const build = state.build!
  const team = teamById(currentOffer.teamId)
  const canTrade = state.career.seasons.length >= 2
  const regular = simRegularSeason({
    build, age: state.age, team, profile: currentOffer.profile, focus, rng, canTrade, events, choices,
    standings: state.seasonOutcome?.standings,
  })
  const { winPct: p, effClutch } = computeWinPct({
    build, regular, strength: rosterStrength(state.league!, team.id), focus, rng,
  })
  const games = selectKeyGames({
    league: state.league!,
    playerTeamId: team.id,
    prevStandings: state.seasonOutcome?.standings ?? null,
    prevChampionTeamId: state.leagueHistory.at(-1)?.championTeamId ?? null,
    hasRivalryEvent: events.includes('rivalry'),
    rng,
  })
  const { slots } = buildCalendar(games, rng)
  const calendar: SeasonCalendar = {
    slots, nextSlot: 0, deadlineDone: !regular.tradeOffer, ticker: [], played: 0,
    p, effClutch, autoRun: state.career.mode === 'rapido',
  }
  return advanceCalendar({
    ...state, calendar, keyGameResults: [],
    pendingRegular: regular, pendingFocus: focus, pendingEvents: events,
  }, rng, calls)
}

// Simula o walk até a próxima parada: slot de key game (seasonAdvance — ou joga direto
// no autoRun), deadline 55 (tradeDecision) ou fim da regular (closeRegularSeason).
// Ordem de rng POR DISPATCH: simStretch (4 calls/jogo) na ordem dos jogos; key game em
// autoRun consome o contrato normal (gameRngCalls(n)).
function advanceCalendar(state: GameState, rng: Rng, calls: () => number): GameState {
  let s = state
  let guard = 0
  while (guard++ < 12) {
    const cal = s.calendar!
    const nextKeyIndex = cal.nextSlot < cal.slots.length ? cal.slots[cal.nextSlot].gameIndex : null
    const deadlineAt = cal.deadlineDone ? null : DEADLINE_GAME
    const stopAt = Math.min(nextKeyIndex !== null ? nextKeyIndex - 1 : 82, deadlineAt ?? 82)
    if (stopAt > cal.played) {
      const ticker = [...cal.ticker, ...simStretch({
        from: cal.played + 1, to: stopAt, p: cal.p, ppg: s.pendingRegular!.ppg,
        playerTeamId: s.currentOffer!.teamId, rng,
      })]
      s = { ...s, calendar: { ...cal, ticker, played: stopAt } }
    }
    const c = s.calendar!
    if (deadlineAt !== null && c.played === deadlineAt && (nextKeyIndex === null || deadlineAt < nextKeyIndex)) {
      return { ...s, phase: 'tradeDecision', lastGame: null, rngCalls: calls() }
    }
    if (nextKeyIndex !== null && c.played === nextKeyIndex - 1) {
      if (!c.autoRun) return { ...s, phase: 'seasonAdvance', pendingGame: null, lastGame: null, rngCalls: calls() }
      s = playKeyGameAuto(s, rng)
      continue
    }
    return closeRegularSeason(s, rng, calls)
  }
  throw new Error('advanceCalendar: guard estourou')
}

// key game resolvido pela política padrão sem telas (RUN_TO_PLAYOFFS) — mesmo contrato
// de calls do jogo assistido; replay não distingue.
function playKeyGameAuto(state: GameState, rng: Rng): GameState {
  const cal = state.calendar!
  const slot = cal.slots[cal.nextSlot]
  const pending = autoResolveGame(startWatchedKeyGame(state, slot.keyGame, rng), state.build!, state.age, rng)
  const result = finishWatchedGame(pending, state.build!, state.age)
  return {
    ...state,
    keyGameResults: [...state.keyGameResults, result],
    calendar: { ...cal, ticker: [...cal.ticker, tickerEntry(slot, result)], played: slot.gameIndex, nextSlot: cal.nextSlot + 1 },
  }
}

function tickerEntry(slot: CalendarSlot, result: WatchedGameResult): TickerGame {
  const { us, them } = scoreOf(result.margin)
  return {
    gameIndex: slot.gameIndex, won: result.won, ourScore: us, oppScore: them,
    playerPts: result.playerPts, opponentTeamId: slot.keyGame.opponentTeamId, keyGame: slot.keyGame.kind,
  }
}

// key game assistido fechou (moments.length decisões, 2-5): registra literal e pausa em gameResult.
function finishKeyGame(state: GameState, pending: PendingGame, skipped: boolean, calls: () => number): GameState {
  const result = finishWatchedGame(pending, state.build!, state.age)
  const cal = state.calendar!
  const slot = cal.slots[cal.nextSlot]
  return {
    ...state,
    phase: 'gameResult',
    pendingGame: null,
    keyGameResults: [...state.keyGameResults, result],
    lastGame: { context: pending.context, result, skipped },
    calendar: { ...cal, ticker: [...cal.ticker, tickerEntry(slot, result)], played: slot.gameIndex, nextSlot: cal.nextSlot + 1 },
    rngCalls: calls(),
  }
}

// Modo rápido: resolve a pós-temporada inteira sem telas — mesma sequência de calls
// de um jogador dando SKIP em todos os jogos (contrato da decisão-chave 11).
function fastForwardPostseason(state: GameState, rng: Rng, calls: () => number): GameState {
  let s = state
  let guard = 0
  while (guard++ < 120) {
    if (s.phase === 'gameResult' && s.pendingPlayoffs) { s = continuePlayoffs(s, rng, calls); continue }
    if (s.phase === 'playoffGame' && s.pendingGame) {
      s = pausePlayoffGame(s, s.pendingPlayoffs!, autoResolveGame(s.pendingGame, s.build!, s.age, rng), true, calls)
      continue
    }
    if (s.phase === 'playoffGame' && s.pendingPlayoffs) { s = openPlayoffGame(s, s.pendingPlayoffs, rng, calls); continue }
    return s
  }
  throw new Error('fastForwardPostseason: guard estourou')
}

// Regular fechada: registro literal vira o winPct realizado. Awards ANTES dos playoffs
// (contrato do item 11 do handoff). O calendário morre aqui.
function closeRegularSeason(state: GameState, rng: Rng, calls: () => number): GameState {
  const build = state.build!
  const cal = state.calendar!
  const regular0 = state.pendingRegular!
  const finalOffer = state.currentOffer!
  const { ppgDelta, injuredCount } = keyGameEffects(state.keyGameResults)
  const regular: RegularSeasonResult = {
    ...regular0,
    games: Math.max(40, regular0.games - injuredCount * 10),
    ppg: clamp(Math.round((regular0.ppg + ppgDelta) * 10) / 10, 4, 38),
  }
  // invariante do registro literal — ticker curto = bug de calendário, nunca prosseguir calado
  if (cal.ticker.length !== 82) throw new Error('calendário incompleto: ' + cal.ticker.length)
  const wins = cal.ticker.filter(g => g.won).length
  const winPct = wins / 82
  const standings = simStandings({ league: state.league!, playerTeamId: finalOffer.teamId, playerWins: wins, rng })
  const lines = simNpcLines(state.league!, rng)
  const seed = standings.find(s => s.teamId === finalOffer.teamId)!.seed
  const clutchAdj = seed !== null && regular.events.includes('playoffspark') ? cal.effClutch + 8 : cal.effClutch
  const titleProb = seed !== null ? computeTitleProb(winPct, clutchAdj) : 0
  const m = ageMultiplier(state.age, build.attributes.physical)
  const prevSeason = state.career.seasons[state.career.seasons.length - 1]
  const awards = simAwards({
    league: state.league!, lines, standings, playerName: '', rng,
    player: {
      ppg: regular.ppg, rpg: regular.rpg, apg: regular.apg, teamWinPct: winPct,
      defRating: build.attributes.defense * m, rookie: state.career.seasons.length === 0,
      prevPpg: prevSeason?.ppg ?? null,
    },
  })
  const base = { ...state, calendar: null, lastGame: null, pendingEvents: null, pendingRegular: null, pendingFocus: null }
  const common = { regular, finalOffer, winPct, awards, standings, lines, iconics: [], chokes: 0 }
  const result = seed === null
    ? finishPostseason(
        base, { ...common, seed },
        simBracket({ standings, league: state.league!, playerTeamId: null, playerTitleProb: titleProb, rng }),
        rng, calls,
      )
    : enterRound(base, {
        ...common, bracket: seedBracket(standings), opponentTeamId: '', seriesUs: 0, seriesThem: 0,
        pGame: 0, seriesProb: 0, titleProb, seed, playerOut: false,
      }, rng, calls)
  return state.career.mode === 'rapido' ? fastForwardPostseason(result, rng, calls) : result
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
// O jogo tem probabilidade-alvo (startWatchedGame resolve a margem para bater nela):
// finais = pGame (bo7(pGame) = seriesProb por construção); rounds 0-2 = seriesProb,
// que junto com o shift centrado deixa E[prob da série] = seriesProb. Assim a taxa de
// título agregada volta a ≈ computeTitleProb, como no simBracket.
function openPlayoffGame(state: GameState, pp: PendingPlayoffs, rng: Rng, calls: () => number): GameState {
  const finals = pp.bracket.round === 3
  const pending = startWatchedGame({
    context: playoffContext(pp),
    ourStrength: watchedGameStrength(state, pp.finalOffer.teamId),
    oppStrength: rosterStrength(state.league!, pp.opponentTeamId),
    targetWinP: finals ? pp.pGame : pp.seriesProb,
    build: state.build!, age: state.age,
    marginBias: pp.playerOut ? PLAYER_OUT_MARGIN : 0,
    rng,
  })
  if (!pp.playerOut) {
    return { ...state, phase: 'playoffGame', pendingPlayoffs: pp, pendingGame: pending, rngCalls: calls() }
  }
  return pausePlayoffGame(state, pp, autoResolveGame(pending, state.build!, state.age, rng), true, calls)
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

// Metade 1 — o jogo fechou: resultado vai para a tela; NENHUM rng de avanço aqui.
// Contadores das finais já atualizam para a tela de série/resultado mostrar o placar.
function pausePlayoffGame(
  state: GameState, pp: PendingPlayoffs, pending: PendingGame, skipped: boolean, calls: () => number,
): GameState {
  const result = finishWatchedGame(pending, state.build!, state.age)
  const finals = pp.bracket.round === 3
  const next: PendingPlayoffs = {
    ...pp,
    iconics: [...pp.iconics, ...result.iconics],
    chokes: pp.chokes + (result.choke ? 1 : 0),
    playerOut: pp.playerOut || result.injured,
    seriesUs: pp.seriesUs + (finals && result.won ? 1 : 0),
    seriesThem: pp.seriesThem + (finals && !result.won ? 1 : 0),
  }
  return {
    ...state,
    phase: 'gameResult',
    pendingGame: null,
    pendingPlayoffs: next,
    lastGame: { context: pending.context, result, skipped },
    injuryProne: state.injuryProne || result.injured,
    rngCalls: calls(),
  }
}

// Metade 2 — CONTINUE: consome o rng do avanço (roll de série, advancePlayer avança o
// bracket, npcRound resolve o resto do round, próximo jogo).
function continuePlayoffs(state: GameState, rng: Rng, calls: () => number): GameState {
  const pp = state.pendingPlayoffs!
  const won = state.lastGame!.result.won
  const base = { ...state, lastGame: null }
  const teamId = pp.finalOffer.teamId

  if (pp.bracket.round < 3) {
    // shift CENTRADO: E[shifted] = seriesProb (P(vencer o pivotal) = seriesProb por
    // construção da margem-alvo). Vencer o pivotal continua valendo +0.20 em 0.5.
    const shifted = clamp(pp.seriesProb + 2 * SERIES_SHIFT * ((won ? 1 : 0) - pp.seriesProb), 0.05, 0.95)
    if (rng.chance(shifted)) {
      return enterRound(base, { ...pp, bracket: advancePlayer(pp.bracket, teamId, rng) }, rng, calls)
    }
    const championTeamId = resolveRest(eliminated(pp.bracket, teamId), state.league!, rng)
    return finishPostseason(base, pp, { championTeamId, playerRun: ROUND_RUN[pp.bracket.round], wonTitle: false }, rng, calls)
  }

  if (pp.seriesUs === 4) {
    // sweep é o ÚNICO icônico que não exige jogada ousada: é resultado de série, não de
    // arremate (decisão do dono). Vale para qualquer política.
    const iconics: IconicMomentId[] = pp.seriesThem === 0 ? [...pp.iconics, 'sweep'] : pp.iconics
    return finishPostseason(base, { ...pp, iconics }, { championTeamId: teamId, playerRun: 'champion', wonTitle: true }, rng, calls)
  }
  if (pp.seriesThem === 4) {
    return finishPostseason(base, pp, { championTeamId: pp.opponentTeamId, playerRun: 'finals', wonTitle: false }, rng, calls)
  }
  // série aberta: tela de placar (ADVANCE_GAME abre o próximo jogo, SKIP_SERIES fecha a série)
  return { ...base, phase: 'playoffGame', rngCalls: calls() }
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
    pendingGame: null, pendingPlayoffs: null, pendingEvents: null, calendar: null, lastGame: null, rngCalls: calls(),
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
    ourStrength: watchedGameStrength(state, state.currentOffer!.teamId), oppStrength,
    build: state.build!, age: state.age, rng,
    // sem targetWinP (a margem sai da força); expectedDelta é calculado dentro, sobre os
    // momentos sorteados, e é o que centra o ppgDelta em keyGameEffects
  })
}

// Chamado após DECIDE_MOMENT/SKIP_GAME resolverem o momento corrente do jogo, até
// momentIndex alcançar pending.moments.length (2-5, sorteado por jogo — Task 1-6).
// Mesmo caminho para keyGame e playoffGame; só o branch de conclusão difere por fase.
function advanceGame(state: GameState, pending: PendingGame, skipped: boolean, calls: () => number): GameState {
  if (pending.momentIndex < pending.moments.length) return { ...state, pendingGame: pending, rngCalls: calls() }
  if (state.phase === 'playoffGame') return pausePlayoffGame(state, state.pendingPlayoffs!, pending, skipped, calls)
  return finishKeyGame(state, pending, skipped, calls)
}

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_LANG':
      return { ...state, lang: action.lang }

    case 'START_SETUP':
      if (state.phase !== 'home') return state
      return { ...state, phase: 'setupMode', setup: { mode: null } }

    case 'SET_MODE':
      if (state.phase !== 'setupMode') return state
      return { ...state, phase: 'setupIdentity', setup: { mode: action.mode } }

    case 'BEGIN_CAREER': {
      if (state.phase !== 'setupIdentity' || !state.setup.mode) return state
      const name = action.name.trim()
      if (name.length < 2 || name.length > 22) return state
      if (!Number.isInteger(action.number) || action.number < 0 || action.number > 99) return state
      const lastName = name.split(/\s+/).at(-1)!
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
        timePressure: state.timePressure, // preserva o toggle escolhido na Home antes de "Nova carreira" (10)
        setup: { mode: state.setup.mode },
        career: { seasons: [], fame: 0, mode: state.setup.mode, name, number: action.number, lastName },
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
      if (state.career.mode === 'goat') return state
      if (state.rerollsLeft <= 0 || state.phase !== 'attrDraft') return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = drawPlayer(rng, state.drawnIds)
      return {
        ...state, rerollsLeft: state.rerollsLeft - 1,
        currentPlayerId: next.id, drawnIds: [...state.drawnIds, next.id], rngCalls: calls(),
      }
    }

    case 'CONFIRM_BUILD': {
      if (state.phase !== 'draftDone') return state
      const build = resolveBuild(state.picks)
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const pickNumber = draftPickNumber(build.overall, rng)
      const offers = makeOffers(rng)
      return { ...state, build, pickNumber, offers, age: 19, phase: 'nbaDraft', rngCalls: calls() }
    }

    case 'CHOOSE_OFFER':
      if (state.phase !== 'nbaDraft' && state.phase !== 'freeAgency') return state
      return { ...state, currentOffer: action.offer, contractYearsLeft: 4, phase: 'preseason' }

    case 'PLAY_SEASON': {
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const events = rollEvents(rng, action.focus, state.injuryProne)
      const consumed = { ...state, injuryProne: false }
      const interactive = events.find(e => INTERACTIVE_EVENTS.includes(e))
      if (interactive) {
        return { ...consumed, phase: 'eventDecision', pendingEvents: events, pendingFocus: action.focus, rngCalls: calls() }
      }
      return startSeasonCalendar(consumed, action.focus, events, autoResolve(events), rng, calls)
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
      return startSeasonCalendar({ ...state, injuryProne }, focus, events, choices, rng, calls)
    }

    case 'TAKE_NEXT_GAME': {
      if (state.phase !== 'seasonAdvance') return state
      const cal = state.calendar!
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const pendingGame = startWatchedKeyGame(state, cal.slots[cal.nextSlot].keyGame, rng)
      return { ...state, phase: 'keyGame', pendingGame, rngCalls: calls() }
    }

    case 'RUN_TO_PLAYOFFS': {
      if (state.phase !== 'seasonAdvance') return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      return advanceCalendar({ ...state, calendar: { ...state.calendar!, autoRun: true } }, rng, calls)
    }

    case 'CONTINUE': {
      if (state.phase !== 'gameResult') return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      if (state.pendingPlayoffs) return continuePlayoffs(state, rng, calls)
      return advanceCalendar({ ...state, lastGame: null }, rng, calls)
    }

    case 'DECIDE_MOMENT': {
      if (state.phase !== 'keyGame' && state.phase !== 'playoffGame') return state
      const pending = state.pendingGame
      if (!pending) return state   // tela de série das finais: sem jogo aberto
      const option = pending.moments[pending.momentIndex].options.find(o => o.id === action.optionId)
      if (!option) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = applyMoment(pending, option, state.build!, state.age, rng)
      return advanceGame(state, next, false, calls)
    }

    case 'SKIP_GAME': {
      if (state.phase !== 'keyGame' && state.phase !== 'playoffGame') return state
      if (!state.pendingGame) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const next = autoResolveGame(state.pendingGame, state.build!, state.age, rng)
      return advanceGame(state, next, true, calls)
    }

    case 'ADVANCE_GAME': {
      if (state.phase !== 'playoffGame' || state.pendingGame || !state.pendingPlayoffs) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      return openPlayoffGame(state, state.pendingPlayoffs, rng, calls)
    }

    case 'SKIP_SERIES': {
      // só nas finais: auto-resolve até a série fechar. pausa (gameResult) e avanço
      // (continuePlayoffs) fundidos no mesmo dispatch — sem tela por jogo.
      if (state.phase !== 'playoffGame' || state.pendingPlayoffs?.bracket.round !== 3) return state
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      let s = state
      let guard = 0
      while (guard++ < 24) {
        if (s.phase === 'gameResult') { s = continuePlayoffs(s, rng, calls); continue }
        if (s.phase !== 'playoffGame' || s.pendingPlayoffs?.bracket.round !== 3) break
        s = s.pendingGame
          ? pausePlayoffGame(s, s.pendingPlayoffs, autoResolveGame(s.pendingGame, s.build!, s.age, rng), true, calls)
          : openPlayoffGame(s, s.pendingPlayoffs, rng, calls)
      }
      return s
    }

    case 'TRADE_DECISION': {
      if (state.phase !== 'tradeDecision' || !state.calendar) return state
      const tradeOffer = state.pendingRegular!.tradeOffer!
      const { rng, calls } = makeCountedRng(state.seed, state.rngCalls)
      const cal = state.calendar
      if (!action.accept) {
        return advanceCalendar({ ...state, calendar: { ...cal, deadlineDone: true } }, rng, calls)
      }
      // segmento 2: mesma fórmula-contrato, força do time novo (spec §1, dois segmentos)
      const { winPct: p, effClutch } = computeWinPct({
        build: state.build!, regular: state.pendingRegular!,
        strength: rosterStrength(state.league!, tradeOffer.teamId), focus: state.pendingFocus!, rng,
      })
      return advanceCalendar({
        ...state, currentOffer: tradeOffer, contractYearsLeft: 4,
        calendar: { ...cal, deadlineDone: true, p, effClutch },
      }, rng, calls)
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

      if (age > 40) return { ...base, phase: 'verdict', verdict: computeVerdict(base.career) }

      if (contractYearsLeft === 0) {
        const offers = makeOffers(rng, state.currentOffer?.teamId, outcome.standings)
        return { ...base, phase: 'freeAgency', offers, rngCalls: calls() }
      }

      const ratio = performanceRatio(state.career.seasons)
      const declining = ratio !== null && ratio < 0.75 && age >= RETIRE_MIN_AGE
      if (age >= 31 || declining) return { ...base, phase: 'retireDecision' }

      return { ...base, phase: 'preseason' }
    }

    case 'RETIRE_DECISION': {
      // Reachable from 'retireDecision' (continue/stop) and 'freeAgency' (stop only,
      // when a contract-expiry year lands at age 31+ — see FreeAgency screen).
      if (!action.retire && state.phase === 'freeAgency') return state
      if (!action.retire) return { ...state, phase: 'preseason' }
      return { ...state, phase: 'verdict', verdict: computeVerdict(state.career) }
    }

    case 'OPEN_HUB':
      return { ...state, hubOpen: true }

    case 'CLOSE_HUB':
      return { ...state, hubOpen: false }

    case 'TOGGLE_TIME_PRESSURE':
      return { ...state, timePressure: !state.timePressure }

    case 'RESUME':
      if (!state.resumePhase) return state
      return { ...state, phase: state.resumePhase, resumePhase: null }

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
    localStorage.removeItem('thegoat:v4')
    localStorage.removeItem('thegoat:v5')
    localStorage.removeItem('thegoat:v6')
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.seed !== 'number' || !VALID_PHASES.has(parsed.phase)) return null
    if (parsed.resumePhase != null && !VALID_PHASES.has(parsed.resumePhase)) return null
    // save sem liga completa é incompatível com o replay — descarta.
    // usa a fase efetiva (resumePhase, se houver hub aberto sobre ela) — parsed.resumePhase
    // ainda não tem o default aplicado aqui, mas undefined/null caem no `?? parsed.phase` igual.
    const effectivePhase = parsed.resumePhase ?? parsed.phase
    if (!PRE_CAREER_PHASES.has(effectivePhase) && parsed.league?.players?.length !== 270) return null
    // fases de jogo sem identidade de carreira = save incompatível (pré-v7) — descarta;
    // save em home/setupMode/setupIdentity sem carreira iniciada é válido
    if (!PRE_CAREER_PHASES.has(effectivePhase) && typeof parsed.career?.name !== 'string') return null
    parsed.setup = parsed.setup ?? { mode: null }
    if (parsed.pendingRegular && !parsed.pendingRegular.choices) parsed.pendingRegular.choices = []
    parsed.injuryProne = parsed.injuryProne ?? false
    parsed.rerollsLeft = parsed.rerollsLeft ?? (parsed.rerollUsed ? 1 : 2)
    delete parsed.rerollUsed
    parsed.pendingEvents = parsed.pendingEvents ?? null
    parsed.pendingGame = parsed.pendingGame ?? null
    parsed.pendingPlayoffs = parsed.pendingPlayoffs ?? null
    parsed.keyGameResults = parsed.keyGameResults ?? []
    parsed.calendar = parsed.calendar ?? null
    parsed.lastGame = parsed.lastGame ?? null
    parsed.hubOpen = parsed.hubOpen ?? false
    parsed.timePressure = parsed.timePressure ?? true
    parsed.resumePhase = parsed.resumePhase ?? null
    const effectiveVerdictPhase = (parsed.resumePhase ?? parsed.phase) === 'verdict'
    parsed.verdict = parsed.verdict ?? (effectiveVerdictPhase ? computeVerdict(parsed.career) : null)
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
