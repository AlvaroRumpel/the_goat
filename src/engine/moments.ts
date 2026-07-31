import { ageMultiplier } from './season'
import { rosterStrength } from './league'
import { TEAMS, teamById } from '../data/teams'
import type {
  Build, IconicMomentId, KeyGame, LeagueState, Moment, MomentOption, MomentOutcome, MomentRisk,
  PendingGame, PlayEntry, Rng, SlotKey, TeamStanding, WatchedGameContext, WatchedGameKind, WatchedGameResult,
} from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// placar sintético: 100 de base ± metade da margem — puramente visual (UI, ticker, 6a).
export function scoreOf(margin: number): { us: number; them: number } {
  return { us: Math.round(100 + margin / 2), them: Math.round(100 - margin / 2) }
}

export function clockOf(at: number): string {
  const q = Math.min(4, Math.floor(at / 12) + 1)
  const rem = Math.max(0, 12 * q - at)
  const mm = Math.floor(rem)
  const ss = Math.round((rem - mm) * 60)
  return `${q}Q ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export const SLOT_SEQUENCE: SlotKey[] = ['openTone', 'q2tactic', 'q3swing', 'q4pressure', 'clutch']

// Opções canônicas. Um id aparece em várias situações, sempre com o MESMO risco e
// atributo — é o que permite reaproveitar as falas de i18n (play.<id>.hit/miss).
const O = {
  // openTone
  setTempo:    { id: 'setTempo',    attr: 'passing',   risk: 'safe' },
  bodyUp:      { id: 'bodyUp',      attr: 'defense',   risk: 'safe' },
  firstStrike: { id: 'firstStrike', attr: 'finishing', attr2: 'three',     risk: 'bold' },
  earlyIso:    { id: 'earlyIso',    attr: 'handles',   attr2: 'finishing', risk: 'bold' },
  // q2tactic
  feedHot:     { id: 'feedHot',     attr: 'passing',   risk: 'safe' },
  spaceFloor:  { id: 'spaceFloor',  attr: 'three',     risk: 'safe' },
  takeOver:    { id: 'takeOver',    attr: 'finishing', attr2: 'handles',   risk: 'bold' },
  // q3swing
  steadyShip:  { id: 'steadyShip',  attr: 'clutch',    risk: 'safe' },
  answerRun:   { id: 'answerRun',   attr: 'three',     attr2: 'finishing', risk: 'bold' },
  gambleSteal: { id: 'gambleSteal', attr: 'defense',   risk: 'reckless' },
  // q4pressure
  lockDefense: { id: 'lockDefense', attr: 'defense',   risk: 'safe' },
  drawFoul:    { id: 'drawFoul',    attr: 'finishing', risk: 'safe' },
  pushPace:    { id: 'pushPace',    attr: 'physical',  attr2: 'finishing', risk: 'bold' },
  isoClosing:  { id: 'isoClosing',  attr: 'handles',   attr2: 'clutch',    risk: 'bold' },
  playHurt:    { id: 'playHurt',    attr: 'physical',  risk: 'reckless', injuryRisk: 0.08 },
  // clutch
  safePass:    { id: 'safePass',    attr: 'passing',   attr2: 'clutch',    risk: 'safe' },
  postSeal:    { id: 'postSeal',    attr: 'physical',  attr2: 'clutch',    risk: 'safe' },
  clutchThree: { id: 'clutchThree', attr: 'three',     attr2: 'clutch',    risk: 'bold' },
  attackRim:   { id: 'attackRim',   attr: 'finishing', attr2: 'clutch',    risk: 'reckless' },
  stepBack:    { id: 'stepBack',    attr: 'handles',   attr2: 'clutch',    risk: 'reckless' },
} as const satisfies Record<string, MomentOption>

// 5 situações por slot. O índice da situação vira a chave i18n: moment.<slot>.s<i>.
export const SITUATIONS: Record<SlotKey, MomentOption[][]> = {
  openTone: [
    [O.setTempo, O.firstStrike],
    [O.bodyUp, O.earlyIso],
    [O.setTempo, O.earlyIso, O.firstStrike],
    [O.bodyUp, O.firstStrike],
    [O.setTempo, O.earlyIso],
  ],
  q2tactic: [
    [O.feedHot, O.takeOver],
    [O.spaceFloor, O.earlyIso],
    [O.feedHot, O.takeOver, O.earlyIso],
    [O.spaceFloor, O.takeOver],
    [O.feedHot, O.firstStrike],
  ],
  q3swing: [
    [O.steadyShip, O.answerRun],
    [O.bodyUp, O.answerRun, O.gambleSteal],
    [O.spaceFloor, O.answerRun],
    [O.steadyShip, O.takeOver, O.gambleSteal],
    [O.bodyUp, O.answerRun],
  ],
  q4pressure: [
    [O.lockDefense, O.pushPace, O.playHurt],
    [O.drawFoul, O.isoClosing],
    [O.lockDefense, O.isoClosing, O.gambleSteal],
    [O.steadyShip, O.pushPace, O.playHurt],
    [O.drawFoul, O.pushPace],
  ],
  clutch: [
    [O.safePass, O.clutchThree, O.attackRim],
    [O.postSeal, O.clutchThree, O.stepBack],
    [O.safePass, O.isoClosing, O.stepBack],
    [O.drawFoul, O.clutchThree, O.attackRim],
    [O.postSeal, O.isoClosing, O.attackRim],
  ],
}

export const ALL_OPTION_IDS: string[] = Object.values(O).map(o => o.id)

// ids de opção são únicos no catálogo inteiro — o outcome guarda só o optionId
const RISK_OF = new Map<string, MomentRisk>(Object.values(O).map(o => [o.id, o.risk]))

// prob base por risco + impacto por risco (constantes calibráveis).
// bold tem attrW MAIOR que safe: é aposta ruim para build fraca e boa para build de
// elite (E[delta] safe = 0.52 + 0.048x, bold = −0.92 + 0.121x com x = atributo − 60;
// cruzam em x ≈ 19.7, ou seja ~80 de atributo efetivo) — é isso que dá "edge" ao jogo
// ousado.
const RISK = {
  safe: { base: 0.42, attrW: 0.008, hit: 4, miss: -2 },
  bold: { base: 0.28, attrW: 0.011, hit: 7, miss: -4 },
  reckless: { base: 0.16, attrW: 0.008, hit: 10, miss: -6 },
} as const satisfies Record<MomentRisk, { base: number; attrW: number; hit: number; miss: number }>

// Meia-largura do ruído do jogo: baseMargin carrega U(−MARGIN_NOISE, +MARGIN_NOISE).
// Precisa ser larga o bastante para engolir Σ deltas dos momentos: no modo de
// probabilidade-alvo, quando (centro + S) sai da janela a probabilidade satura, e a
// saturação é assimétrica (só a cauda ruim bate no 0) — com ±8 as finais realizavam
// 0.555/jogo contra alvo 0.543 e com ±12 ainda sobrava resíduo. Com ±16 o alvo é exato
// (medido: as 4 rodadas caem a menos de 0.4 p.p. do alvo).
export const MARGIN_NOISE = 16

const CLUTCH_AT = 47.65
const FIRST_AT = 10

// Base pelo peso do jogo. `elimination` NÃO entra: playoffContext o marca true em todo
// jogo de rounds 0-2, então a distinção útil é kind (playoff = rounds 0-2, finals).
function baseCount(kind: WatchedGameKind): number {
  if (kind === 'finals') return 5
  if (kind === 'playoff') return 4
  return 3
}

export function momentCount(context: WatchedGameContext, rng: Rng): number {
  return clamp(baseCount(context.kind) + rng.int(-1, 1), 2, 5)   // 1 call
}

// n posições no relógio: a primeira em 10', a última sempre em 47.65' (4Q 00:21).
export function momentAts(n: number): number[] {
  return Array.from({ length: n }, (_, i) => FIRST_AT + (CLUTCH_AT - FIRST_AT) * (i / (n - 1)))
}

// Slots: os últimos n-1 de [openTone, q2tactic, q3swing, q4pressure], depois clutch.
function slotsFor(n: number): SlotKey[] {
  return [...SLOT_SEQUENCE.slice(0, 4).slice(-(n - 1)), 'clutch']
}

export function makeMoments(context: WatchedGameContext, rng: Rng): Moment[] {
  const n = momentCount(context, rng)                    // 1 call
  const ats = momentAts(n)
  return slotsFor(n).map((id, i) => {
    const s = rng.int(0, SITUATIONS[id].length - 1)       // 1 call por momento
    return {
      id,
      situationKey: `moment.${id}.s${s}`,
      at: ats[i],
      clock: clockOf(ats[i]),
      params: { opp: context.opponentTeamId.toUpperCase() },
      options: SITUATIONS[id][s],
    }
  })
}

export function defaultOption(m: Moment): MomentOption {
  return m.options.find(o => o.risk === 'safe') ?? m.options[0]
}

function momentProb(build: Build, age: number, option: MomentOption): number {
  const m = ageMultiplier(age, build.attributes.physical)
  const a1 = build.attributes[option.attr] * m
  const attr = option.attr2 ? 0.6 * a1 + 0.4 * build.attributes[option.attr2] * m : a1
  const cfg = RISK[option.risk]
  return clamp(cfg.base + (attr - 60) * cfg.attrW, 0.05, 0.95)
}

// Cada momento pesa 3/n: um jogo de 5 momentos tem o MESMO peso total de decisão que um
// de 3. Sem isto, mais momentos = mais Σ deltas = jogo-chave mais fácil, playerPts maior
// e mais icônicos bigNight/closeout45 — foi esse mecanismo que estourou o goatRate(99)
// na Task 7 do ciclo motor-momentos. Com o peso, E[Σ deltas] é invariante em n e todas
// as travas de calibração continuam válidas por construção.
export function momentWeight(n: number): number {
  return 3 / n
}

export function resolveMoment(
  build: Build, age: number, option: MomentOption, weight: number, rng: Rng,
): { success: boolean; injury: boolean; delta: number } {
  const cfg = RISK[option.risk]
  const p = momentProb(build, age, option)
  const success = rng.chance(p)                          // call 1
  const injuryRoll = rng.next()                          // call 2 — SEMPRE consumido (contrato)
  const injury = option.injuryRisk !== undefined && injuryRoll < option.injuryRisk
  return { success, injury, delta: (success ? cfg.hit : cfg.miss) * weight }
}

// E[Σ deltas do jogo] jogando SEMPRE a safe de cada momento sorteado, já com o peso.
// Determinístico, sem rng. Serve de correção para jogos com probabilidade-alvo
// (playoffs): sem ela os momentos injetariam viés positivo na margem e a taxa de
// título estouraria o titleProb.
export function expectedAutoDelta(build: Build, age: number, moments: Moment[]): number {
  const w = momentWeight(moments.length)
  return moments.reduce((n, m) => {
    const o = defaultOption(m)
    const cfg = RISK[o.risk]
    const p = momentProb(build, age, o)
    return n + (p * cfg.hit + (1 - p) * cfg.miss) * w
  }, 0)
}

// Dois modos de margem base (sempre 1 call de rng — contrato de replay intacto):
//
// 1) jogo comum (temporada regular): margem = diferença de força × 0.45 + ruído.
//
// 2) jogo com probabilidade-alvo (playoffs, targetWinP definido): a força já foi
//    consumida antes — seriesProb/pGame vêm de computeTitleProb + rosterStrength do
//    adversário —, então usá-la de novo aqui seria contar duas vezes. Em vez disso a
//    margem é resolvida ANALITICAMENTE para que P(vitória) = targetWinP:
//      margin = c + U + S,  U ~ U(−N, +N),  S = Σ deltas dos momentos
//      won ⟺ round(margin) > 0 ⟺ c + U + S ≥ 0.5
//      P(won) = (c + E[S] + N − 0.5) / 2N  ⇒  c = 2N·p − N + 0.5 − E[S]
//    com E[S] = expectedAutoDelta (política padrão). Uma política mais agressiva
//    desloca S para longe de E[S] — é aí que mora o "edge" do jogo ousado.
//    A variância de S borra a igualdade só nos extremos (quando c + S sai da janela
//    de ruído); no miolo P(won) = targetWinP exatamente.
// Contrato de rng por jogo, agora função da contagem de momentos:
//   1 (jitter da contagem) + n (situação de cada momento) + 1 (baseMargin)
//   + 2×(n+1) (ambientação: variante + jitter do placar) + 3n (resolveMoment ×2 + variante da fala)
export function gameRngCalls(n: number): number {
  return 6 * n + 4
}

// quarto do jogo (0-3) — escolhe o balde de chaves play.ambient.<q>.v<0-2>
function quarterOf(at: number): number {
  return Math.min(3, Math.floor(at / 12))
}

// n+1 posições de ambientação: uma de abertura e uma antes de cada momento.
function ambientAts(momentAtsList: number[]): number[] {
  return [3, ...momentAtsList.map(at => at - 4)]
}

// placar do walk no minuto `at`: o jogo caminha para baseMargin + Σ deltas JÁ ocorridos
function logScore(baseMargin: number, deltas: number, at: number, jitter: number): { us: number; them: number } {
  const frac = at / 48
  const margin = baseMargin * frac + deltas + jitter
  const base = 100 * frac
  return { us: Math.max(0, Math.round(base + margin / 2)), them: Math.max(0, Math.round(base - margin / 2)) }
}

// Reescreve o placar de TODAS as linhas com os deltas acumulados até o `at` de cada uma.
// Sem isto o placar anda pra trás depois de um momento vencedor (bug 3 do spec): as
// linhas de ambientação nascem antes de qualquer decisão e ficariam congeladas em
// deltas = 0. Invisível na tela estática de hoje, escancarado com o reveal animado.
function rescoreLog(pending: PendingGame): PlayEntry[] {
  return pending.log.map(e => {
    const deltas = pending.outcomes
      .filter((_, i) => pending.moments[i].at <= e.at)
      .reduce((n, o) => n + o.delta, 0)
    return { ...e, score: logScore(pending.baseMargin, deltas, e.at, e.jitter) }
  })
}

export function startWatchedGame(input: {
  context: WatchedGameContext; ourStrength: number; oppStrength: number
  build: Build; age: number; rng: Rng
  targetWinP?: number      // playoffs: P(vencer este jogo) desejada
  marginBias?: number      // penalidade fixa de margem (ex.: PLAYER_OUT_MARGIN)
}): PendingGame {
  const { context, ourStrength, oppStrength, build, age, rng, targetWinP, marginBias = 0 } = input
  // Ordem obrigatória: os momentos vêm ANTES da margem porque expectedDelta depende
  // de quais momentos caíram — é o que mantém P(vitória) = targetWinP nos playoffs.
  const moments = makeMoments(context, rng)              // 1 + n calls
  const expectedDelta = expectedAutoDelta(build, age, moments)
  const center = (targetWinP === undefined
    ? (ourStrength - oppStrength) * 0.45
    : 2 * MARGIN_NOISE * targetWinP - MARGIN_NOISE + 0.5 - expectedDelta) + marginBias
  const winP = clamp((center + expectedDelta + MARGIN_NOISE - 0.5) / (2 * MARGIN_NOISE), 0, 1)
  const baseMargin = center + (rng.next() * 2 * MARGIN_NOISE - MARGIN_NOISE)   // 1 call
  const log: PlayEntry[] = ambientAts(moments.map(m => m.at)).map((at, i) => {
    const variant = rng.int(0, 2)                        // call 1 da linha
    const jitter = Math.round(rng.next() * 8 - 4)        // call 2 da linha
    // linha 0 é sempre a abertura (at=3): chave própria pra não colidir com a linha
    // do quarto 0, que cai perto (at=firstMoment-4, ex. 6) — mesmo balde de 3 variantes.
    const bucket = i === 0 ? 'open' : quarterOf(at)
    return {
      at, clock: clockOf(at),
      textKey: `play.ambient.${bucket}.v${variant}`,
      params: { opp: context.opponentTeamId.toUpperCase() },
      jitter,
      score: logScore(baseMargin, 0, at, jitter),
    }
  })
  return { context, moments, momentIndex: 0, outcomes: [], baseMargin, winP, expectedDelta, log }
}

export function applyMoment(
  pending: PendingGame, option: MomentOption, build: Build, age: number, rng: Rng,
): PendingGame {
  const moment = pending.moments[pending.momentIndex]
  const w = momentWeight(pending.moments.length)
  const r = resolveMoment(build, age, option, w, rng)     // calls 1-2
  const outcome: MomentOutcome = {
    momentId: moment.id, optionId: option.id, success: r.success, injury: r.injury,
    delta: r.delta, clock: moment.clock,
  }
  const variant = rng.int(0, 1)                          // call 3 do momento (contrato)
  const outcomes = [...pending.outcomes, outcome]
  const deltas = outcomes.reduce((n, o) => n + o.delta, 0)
  const entry: PlayEntry = {
    at: moment.at, clock: moment.clock, fromDecision: true,
    textKey: `play.${option.id}.${r.success ? 'hit' : 'miss'}.v${variant}`,
    params: { opp: pending.context.opponentTeamId.toUpperCase() },
    jitter: 0,
    score: logScore(pending.baseMargin, deltas, moment.at, 0),
  }
  const next: PendingGame = {
    ...pending, momentIndex: pending.momentIndex + 1, outcomes,
    log: [...pending.log, entry].sort((a, b) => a.at - b.at),
  }
  // BUG 3: as linhas de ambientação nasceram com deltas = 0; reescora todas agora.
  return { ...next, log: rescoreLog(next) }
}

export function autoResolveGame(pending: PendingGame, build: Build, age: number, rng: Rng): PendingGame {
  let g = pending
  while (g.momentIndex < g.moments.length) {
    g = applyMoment(g, defaultOption(g.moments[g.momentIndex]), build, age, rng)
  }
  return g
}

// REGRA DO CATÁLOGO DE ICÔNICOS: jogar seguro nunca vira lenda. Um passe seguro que
// fecha o jogo por 3 é bom basquete, não um momento eterno — todo icônico DE JOGADA
// exige um arremate ousado/temerário bem-sucedido (ou, no caso de comeback/closeout45,
// o impacto que só o risco entrega). Sem essa regra a política auto carimbava ~12
// icônicos por carreira e batia o cap de 100 pontos em TODA carreira, dando +100 de
// score grátis em todas as faixas e estourando o goatRate do 99.
// Exceção ratificada pelo dono: `sweep` é resultado de SÉRIE, não de jogada — vale para
// qualquer política (ver state.ts).
// Id desconhecido (save de versão anterior do catálogo) conta como safe: não vira icônico.
export function dagger(r: Pick<WatchedGameResult, 'outcomes'>): boolean {
  const clutch = r.outcomes[r.outcomes.length - 1]        // o slot clutch é SEMPRE o último
  return clutch?.success === true && (RISK_OF.get(clutch.optionId) ?? 'safe') !== 'safe'
}

export function finishWatchedGame(pending: PendingGame, build: Build, age: number): WatchedGameResult {
  const { context, outcomes, baseMargin, winP, expectedDelta } = pending
  const w = momentWeight(pending.moments.length)
  const margin = Math.round(baseMargin + outcomes.reduce((n, o) => n + o.delta, 0))
  const won = margin > 0
  const m = ageMultiplier(age, build.attributes.physical)
  const expPts = clamp((build.overall * m - 50) * 0.6, 6, 34)
  // pontos por acerto = impacto do RISCO daquela jogada, ponderado por 3/n: cinco
  // momentos não podem valer mais pontos que três (era o que carimbava closeout45).
  const playerPts = Math.round(clamp(
    expPts + outcomes.reduce((n, o) => n + (o.success ? RISK[RISK_OF.get(o.optionId) ?? 'safe'].hit : -2) * w, 0)
      + baseMargin / 8,
    6, 65,
  ))
  const injured = outcomes.some(o => o.injury)
  const clutchOutcome = outcomes[outcomes.length - 1]
  const choke = context.elimination === true && clutchOutcome !== undefined && !clutchOutcome.success && !won

  const iconics: IconicMomentId[] = []
  const clutchWinner = dagger({ outcomes }) && won && margin <= 4
  if (clutchWinner && context.kind === 'finals') iconics.push('finalsBuzzer')
  else if (clutchWinner && context.kind === 'playoff' && context.elimination) iconics.push('seriesWinner')
  else if (clutchWinner && context.kind === 'rivalry') iconics.push('rivalWinner')
  if (won && context.elimination && playerPts >= 45 && (context.kind === 'playoff' || context.kind === 'finals')) iconics.push('closeout45')
  if (won && outcomes.some(o => o.optionId === 'playHurt') && !injured) iconics.push('fluGame')
  if (won && baseMargin <= -15) iconics.push('comeback')
  if (playerPts >= 55 && (context.kind === 'rivalry' || context.kind === 'seedRace' || context.kind === 'special')) iconics.push('bigNight')

  const reb = Math.round(clamp((build.attributes.rebounding * m - 40) * 0.18 + margin / 12, 1, 22))
  const ast = Math.round(clamp((build.attributes.passing * m - 45) * 0.16 + margin / 15, 1, 18))
  return { won, margin, playerPts, reb, ast, outcomes, injured, choke, iconics, winP, expectedDelta }
}

// menor índice em TEAMS = desempate vencedor (nunca rng em comparator)
function bestBy(ids: string[], score: (id: string) => number, order: Map<string, number>, higherIsBetter: boolean): string {
  let best = ids[0]
  let bestScore = score(best)
  for (const id of ids.slice(1)) {
    const s = score(id)
    const better = higherIsBetter ? s > bestScore : s < bestScore
    const tie = s === bestScore && order.get(id)! < order.get(best)!
    if (better || tie) { best = id; bestScore = s }
  }
  return best
}

export function selectKeyGames(input: {
  league: LeagueState
  playerTeamId: string
  prevStandings: TeamStanding[] | null
  prevChampionTeamId: string | null
  hasRivalryEvent: boolean
  rng: Rng
}): KeyGame[] {
  const { league, playerTeamId, prevStandings, prevChampionTeamId, hasRivalryEvent, rng } = input
  const strengths = new Map(TEAMS.map(t => [t.id, rosterStrength(league, t.id)]))
  const order = new Map(TEAMS.map((t, i) => [t.id, i]))
  const playerConf = teamById(playerTeamId).conf
  const sameConf = TEAMS.filter(t => t.conf === playerConf && t.id !== playerTeamId).map(t => t.id)
  const otherConf = TEAMS.filter(t => t.conf !== playerConf).map(t => t.id)
  const allExceptPlayer = TEAMS.filter(t => t.id !== playerTeamId).map(t => t.id)

  const rivalryId = bestBy(sameConf, id => strengths.get(id)!, order, true)

  const seedRacePool = sameConf.filter(id => id !== rivalryId)
  const seedRaceId = prevStandings
    ? (() => {
        const winsOf = new Map(prevStandings.map(s => [s.teamId, s.wins]))
        const playerWins = winsOf.get(playerTeamId) ?? 0
        return bestBy(seedRacePool, id => Math.abs((winsOf.get(id) ?? 0) - playerWins), order, false)
      })()
    : bestBy(seedRacePool, id => Math.abs(strengths.get(id)! - strengths.get(playerTeamId)!), order, false)

  const chosen = new Set([playerTeamId, rivalryId, seedRaceId])
  const nextStrongest = (): string =>
    bestBy(allExceptPlayer.filter(id => !chosen.has(id)), id => strengths.get(id)!, order, true)

  const christmasId = (): string => {
    const bigMarket = TEAMS.filter(t => t.bigMarket && !chosen.has(t.id)).map(t => t.id)
    return bigMarket.length ? bestBy(bigMarket, id => strengths.get(id)!, order, true) : nextStrongest()
  }
  const revengeId = (): string =>
    prevChampionTeamId && prevChampionTeamId !== playerTeamId && !chosen.has(prevChampionTeamId)
      ? prevChampionTeamId
      : christmasId()
  const showcaseId = (): string => {
    const pool = otherConf.filter(id => !chosen.has(id))
    return pool.length ? bestBy(pool, id => strengths.get(id)!, order, true) : nextStrongest()
  }

  const specialRoll = rng.int(0, 2)                       // call 1/3
  const specialId = specialRoll === 0 ? christmasId() : specialRoll === 1 ? revengeId() : showcaseId()

  rng.next(); rng.next()                                  // calls 2-3/3 — folga fixa (contrato)

  const games: KeyGame[] = [
    { kind: 'rivalry', opponentTeamId: rivalryId },
    { kind: 'seedRace', opponentTeamId: seedRaceId },
    { kind: 'special', opponentTeamId: specialId },
  ]
  if (hasRivalryEvent) games.push({ kind: 'rivalry', opponentTeamId: rivalryId })
  return games
}
