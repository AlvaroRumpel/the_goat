import { ageMultiplier } from './season'
import { rosterStrength } from './league'
import { TEAMS, teamById } from '../data/teams'
import type {
  Build, IconicMomentId, KeyGame, LeagueState, Moment, MomentOption, MomentOutcome, MomentRisk,
  PendingGame, PlayEntry, Rng, SlotKey, TeamStanding, WatchedGameContext, WatchedGameResult,
} from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const GAME_RNG_CALLS = 21   // contrato: 1 baseMargin + 3 makeMoments + 4×2 ambientação + 3×(2 resolveMoment + 1 variante do lance)

// placar sintético: 100 de base ± metade da margem — puramente visual (UI, ticker, 6a).
export function scoreOf(margin: number): { us: number; them: number } {
  return { us: Math.round(100 + margin / 2), them: Math.round(100 - margin / 2) }
}

function clockOf(at: number): string {
  const q = Math.min(4, Math.floor(at / 12) + 1)
  const rem = Math.max(0, 12 * q - at)
  const mm = Math.floor(rem)
  const ss = Math.round((rem - mm) * 60)
  return `${q}Q ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

// placar do walk no minuto `at`: o jogo caminha para baseMargin + Σ deltas
function logScore(baseMargin: number, deltas: number, at: number, jitter = 0): { us: number; them: number } {
  const frac = at / 48
  const margin = baseMargin * frac + deltas + jitter
  const base = 100 * frac
  return { us: Math.max(0, Math.round(base + margin / 2)), them: Math.max(0, Math.round(base - margin / 2)) }
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

export function makeMoments(context: WatchedGameContext, rng: Rng): Moment[] {
  // 1 call por momento: variação leve do texto (index da variante 0-2)
  return (['q2tactic', 'q4pressure', 'clutch'] as const).map(id => ({
    id,
    situationKey: `moment.${id}.v${rng.int(0, 2)}`,
    params: { opp: context.opponentTeamId.toUpperCase() },
    options: MOMENT_OPTIONS[id],
  }))
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

// E[Σ deltas do jogo] jogando SEMPRE a opção padrão (safe). Determinístico, sem rng.
// Serve de correção para jogos com probabilidade-alvo (playoffs): sem ela os momentos
// injetariam um viés positivo na margem (build forte acerta mais) e a taxa de título
// realizada estouraria o titleProb — foi exatamente o bug medido na Task 7 (2.02×).
export function expectedAutoDelta(build: Build, age: number): number {
  return Object.values(MOMENT_OPTIONS).reduce((n, opts) => {
    const o = opts.find(x => x.risk === 'safe') ?? opts[0]
    const cfg = RISK[o.risk]
    const p = momentProb(build, age, o)
    return n + p * cfg.hit + (1 - p) * cfg.miss
  }, 0)
}

export function resolveMoment(
  build: Build, age: number, option: MomentOption, rng: Rng,
): { success: boolean; injury: boolean; delta: number } {
  const cfg = RISK[option.risk]
  const p = momentProb(build, age, option)
  const success = rng.chance(p)                          // call 1
  const injuryRoll = rng.next()                          // call 2 — SEMPRE consumido (contrato)
  const injury = option.injuryRisk !== undefined && injuryRoll < option.injuryRisk
  return { success, injury, delta: success ? cfg.hit : cfg.miss }
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
export function startWatchedGame(input: {
  context: WatchedGameContext; ourStrength: number; oppStrength: number; rng: Rng
  targetWinP?: number      // playoffs: P(vencer este jogo) desejada
  expectedDelta?: number   // E[Σ deltas] da política padrão (expectedAutoDelta)
  marginBias?: number      // penalidade fixa de margem (ex.: PLAYER_OUT_MARGIN)
}): PendingGame {
  const { context, ourStrength, oppStrength, rng, targetWinP, expectedDelta = 0, marginBias = 0 } = input
  const center = (targetWinP === undefined
    ? (ourStrength - oppStrength) * 0.45
    : 2 * MARGIN_NOISE * targetWinP - MARGIN_NOISE + 0.5 - expectedDelta) + marginBias
  // Mesma equação resolvida ao contrário: a P(vitória) que este centro implica com a
  // política padrão. No modo alvo devolve targetWinP de volta (a menos do marginBias);
  // no jogo comum é o que a diferença de força vale. Determinístico, sem rng.
  const winP = clamp((center + expectedDelta + MARGIN_NOISE - 0.5) / (2 * MARGIN_NOISE), 0, 1)
  // 1 call: ruído do jogo
  const baseMargin = center + (rng.next() * 2 * MARGIN_NOISE - MARGIN_NOISE)
  const moments = makeMoments(context, rng)
  const log: PlayEntry[] = AMBIENT_AT.map((at, i) => {
    const variant = rng.int(0, 2)                       // call 1 da linha
    const jitter = Math.round(rng.next() * 8 - 4)       // call 2 da linha
    return {
      at, clock: clockOf(at),
      textKey: `play.ambient.${i}.v${variant}`,
      params: { opp: context.opponentTeamId.toUpperCase() },
      score: logScore(baseMargin, 0, at, jitter),
    }
  })
  return { context, moments, momentIndex: 0, outcomes: [], baseMargin, winP, log }
}

export function applyMoment(
  pending: PendingGame, option: MomentOption, build: Build, age: number, rng: Rng,
): PendingGame {
  const moment = pending.moments[pending.momentIndex]
  const r = resolveMoment(build, age, option, rng)
  const outcome: MomentOutcome = {
    momentId: moment.id, optionId: option.id, success: r.success, injury: r.injury, delta: r.delta,
  }
  const variant = rng.int(0, 1)                          // call 3 do momento (contrato)
  const at = MOMENT_AT[moment.id]
  const deltas = [...pending.outcomes, outcome].reduce((n, o) => n + o.delta, 0)
  const entry: PlayEntry = {
    at, clock: clockOf(at), fromDecision: true,
    textKey: `play.${option.id}.${r.success ? 'hit' : 'miss'}.v${variant}`,
    params: { opp: pending.context.opponentTeamId.toUpperCase() },
    score: logScore(pending.baseMargin, deltas, at),
  }
  return {
    ...pending, momentIndex: pending.momentIndex + 1,
    outcomes: [...pending.outcomes, outcome],
    log: [...pending.log, entry].sort((a, b) => a.at - b.at),
  }
}

export function autoResolveGame(pending: PendingGame, build: Build, age: number, rng: Rng): PendingGame {
  let g = pending
  while (g.momentIndex < 3) g = applyMoment(g, defaultOption(g.moments[g.momentIndex]), build, age, rng)
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
  const clutch = r.outcomes[2]
  return clutch?.success === true && (RISK_OF.get(clutch.optionId) ?? 'safe') !== 'safe'
}

export function finishWatchedGame(pending: PendingGame, build: Build, age: number): WatchedGameResult {
  const { context, outcomes, baseMargin, winP } = pending
  const margin = Math.round(baseMargin + outcomes.reduce((n, o) => n + o.delta, 0))
  const won = margin > 0
  const m = ageMultiplier(age, build.attributes.physical)
  const expPts = clamp((build.overall * m - 50) * 0.6, 6, 34)
  // pontos por acerto = impacto do RISCO daquela jogada (safe 4 / bold 7 / reckless 10):
  // três passes seguros não fazem um jogo de 45. Com bônus fixo de 7 o 99 fechava 3/3
  // em ~39% dos jogos e carimbava closeout45 (18 pts) ~8× por carreira, batendo o cap
  // de icônicos sozinho — era o que jogava o goatRate do 99 para 0.075.
  const playerPts = Math.round(clamp(
    expPts + outcomes.reduce((n, o) => n + (o.success ? RISK[RISK_OF.get(o.optionId) ?? 'safe'].hit : -2), 0)
      + baseMargin / 8,
    6, 65,
  ))
  const injured = outcomes.some(o => o.injury)
  const clutchOutcome = outcomes[2]
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
  return { won, margin, playerPts, reb, ast, outcomes, injured, choke, iconics, winP }
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
