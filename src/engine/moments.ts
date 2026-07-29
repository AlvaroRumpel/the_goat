import { ageMultiplier } from './season'
import type {
  Build, IconicMomentId, Moment, MomentOption, MomentOutcome, MomentRisk,
  PendingGame, Rng, WatchedGameContext, WatchedGameResult,
} from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const GAME_RNG_CALLS = 10   // contrato: 1 baseMargin + 3 makeMoments + 3×2 resolveMoment

// Catálogo fixo de opções por momento (constantes calibráveis).
const MOMENT_OPTIONS: Record<string, MomentOption[]> = {
  q2tactic: [
    { id: 'feedHot', attr: 'passing', risk: 'safe' },
    { id: 'takeOver', attr: 'finishing', attr2: 'handles', risk: 'bold' },
  ],
  q4pressure: [
    { id: 'lockDefense', attr: 'defense', risk: 'safe' },
    { id: 'pushPace', attr: 'physical', attr2: 'finishing', risk: 'bold' },
    { id: 'playHurt', attr: 'physical', risk: 'reckless', injuryRisk: 0.08 },
  ],
  clutch: [
    { id: 'safePass', attr: 'passing', attr2: 'clutch', risk: 'safe' },
    { id: 'clutchThree', attr: 'three', attr2: 'clutch', risk: 'bold' },
    { id: 'attackRim', attr: 'finishing', attr2: 'clutch', risk: 'reckless' },
  ],
}

// prob base por risco + impacto por risco (constantes calibráveis)
const RISK = {
  safe: { base: 0.42, attrW: 0.008, hit: 4, miss: -2 },
  bold: { base: 0.28, attrW: 0.008, hit: 7, miss: -4 },
  reckless: { base: 0.16, attrW: 0.008, hit: 10, miss: -6 },
} as const satisfies Record<MomentRisk, { base: number; attrW: number; hit: number; miss: number }>

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

export function resolveMoment(
  build: Build, age: number, option: MomentOption, rng: Rng,
): { success: boolean; injury: boolean; delta: number } {
  const m = ageMultiplier(age, build.attributes.physical)
  const a1 = build.attributes[option.attr] * m
  const attr = option.attr2 ? 0.6 * a1 + 0.4 * build.attributes[option.attr2] * m : a1
  const cfg = RISK[option.risk]
  const p = clamp(cfg.base + (attr - 60) * cfg.attrW, 0.05, 0.95)
  const success = rng.chance(p)                          // call 1
  const injuryRoll = rng.next()                          // call 2 — SEMPRE consumido (contrato)
  const injury = option.injuryRisk !== undefined && injuryRoll < option.injuryRisk
  return { success, injury, delta: success ? cfg.hit : cfg.miss }
}

export function startWatchedGame(input: {
  context: WatchedGameContext; ourStrength: number; oppStrength: number; rng: Rng
}): PendingGame {
  const { context, ourStrength, oppStrength, rng } = input
  // 1 call: ruído do jogo; margem base = diferença de força + ruído
  const baseMargin = (ourStrength - oppStrength) * 0.45 + (rng.next() * 16 - 8)
  return { context, moments: makeMoments(context, rng), momentIndex: 0, outcomes: [], baseMargin }
}

export function applyMoment(
  pending: PendingGame, option: MomentOption, build: Build, age: number, rng: Rng,
): PendingGame {
  const moment = pending.moments[pending.momentIndex]
  const r = resolveMoment(build, age, option, rng)
  const outcome: MomentOutcome = {
    momentId: moment.id, optionId: option.id, success: r.success, injury: r.injury, delta: r.delta,
  }
  return { ...pending, momentIndex: pending.momentIndex + 1, outcomes: [...pending.outcomes, outcome] }
}

export function autoResolveGame(pending: PendingGame, build: Build, age: number, rng: Rng): PendingGame {
  let g = pending
  while (g.momentIndex < 3) g = applyMoment(g, defaultOption(g.moments[g.momentIndex]), build, age, rng)
  return g
}

export function finishWatchedGame(pending: PendingGame, build: Build, age: number): WatchedGameResult {
  const { context, outcomes, baseMargin } = pending
  const margin = Math.round(baseMargin + outcomes.reduce((n, o) => n + o.delta, 0))
  const won = margin > 0
  const m = ageMultiplier(age, build.attributes.physical)
  const expPts = clamp((build.overall * m - 50) * 0.6, 6, 34)
  const playerPts = Math.round(clamp(
    expPts + outcomes.filter(o => o.success).length * 7 - outcomes.filter(o => !o.success).length * 2
      + baseMargin / 8,
    6, 65,
  ))
  const injured = outcomes.some(o => o.injury)
  const clutchOutcome = outcomes[2]
  const choke = context.elimination === true && clutchOutcome !== undefined && !clutchOutcome.success && !won

  const iconics: IconicMomentId[] = []
  const clutchWinner = clutchOutcome?.success === true && won && margin <= 4
  if (clutchWinner && context.kind === 'finals') iconics.push('finalsBuzzer')
  else if (clutchWinner && context.kind === 'playoff' && context.elimination) iconics.push('seriesWinner')
  else if (clutchWinner && context.kind === 'rivalry') iconics.push('rivalWinner')
  if (won && context.elimination && playerPts >= 45 && (context.kind === 'playoff' || context.kind === 'finals')) iconics.push('closeout45')
  if (won && outcomes.some(o => o.optionId === 'playHurt') && !injured) iconics.push('fluGame')
  if (won && baseMargin <= -15) iconics.push('comeback')
  if (playerPts >= 55 && (context.kind === 'rivalry' || context.kind === 'seedRace' || context.kind === 'special')) iconics.push('bigNight')

  return { won, margin, playerPts, outcomes, injured, choke, iconics }
}
