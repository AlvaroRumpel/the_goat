import { npcSeriesProb, rosterStrength } from './league'
import type { Conf, LeagueState, Rng, TeamStanding } from './types'

// Deslocamento da prob de série pelo resultado do jogo pivotal (rounds 0-2), aplicado
// CENTRADO em state.ts: seriesProb + 2×SHIFT×(venceu − seriesProb). Em seriesProb = 0.5
// isso é o ±0.20 clássico, e E[prob deslocada] = seriesProb para qualquer seriesProb —
// sem isso a série ganhava ~+0.04 de graça (P(vencer o pivotal) ≈ 0.6, medido na Task 7).
export const SERIES_SHIFT = 0.20
// Penalidade fixa de baseMargin com o jogador lesionado, aplicada NO baseMargin (era
// aplicada em ourStrength, valendo só ×0.45). Na janela de ruído de 16 pontos, −5 de
// margem ≈ −31 p.p. de chance no jogo: derrota provável, não certa.
export const PLAYER_OUT_MARGIN = -5

// P(vencer best-of-7 | p de vencer um jogo) — forma fechada:
// Σ_{k=0..3} C(3+k, k) × p^4 × (1−p)^k
export function bo7WinProb(pGame: number): number {
  const C = [1, 4, 10, 20] // C(3,0), C(4,1), C(5,2), C(6,3)
  const q = 1 - pGame
  let sum = 0
  for (let k = 0; k <= 3; k++) sum += C[k] * Math.pow(q, k)
  return Math.pow(pGame, 4) * sum
}

// Inverso numérico de bo7WinProb via bisseção. Puro, sem rng.
export function pGameForSeries(pSeries: number): number {
  let lo = 0.01, hi = 0.99
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (bo7WinProb(mid) < pSeries) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export interface BracketState {
  round: number              // 0=r1, 1=semi, 2=conf, 3=finals
  aliveEast: string[]        // ordenados por seed
  aliveWest: string[]
}

export function seedBracket(standings: TeamStanding[]): BracketState {
  const bySeed = (conf: Conf) => standings
    .filter(s => s.conf === conf && s.seed !== null)
    .sort((a, b) => a.seed! - b.seed!)
    .map(s => s.teamId)
  return { round: 0, aliveEast: bySeed('east'), aliveWest: bySeed('west') }
}

// Pares por posição no array vivo, ordem fixa. round0 (8 vivos): seeds (1v8)(4v5)(3v6)(2v7).
// Rodadas seguintes pareiam por posição do array já reordenado pelos vencedores anteriores.
function confPairs(alive: string[]): [string, string][] {
  switch (alive.length) {
    case 8: return [[alive[0], alive[7]], [alive[3], alive[4]], [alive[2], alive[5]], [alive[1], alive[6]]]
    case 4: return [[alive[0], alive[1]], [alive[2], alive[3]]]
    case 2: return [[alive[0], alive[1]]]
    default: return [] // 1 vivo (finals): sem par intra-conferência
  }
}

function resolveSeries(league: LeagueState, a: string, b: string, rng: Rng): string {
  const sA = rosterStrength(league, a), sB = rosterStrength(league, b)
  return rng.chance(npcSeriesProb(sA, sB)) ? a : b
}

// Resolve TODOS os pares NPC do round atual em ordem fixa (east na ordem de pares
// (1v8)(4v5)(3v6)(2v7), depois west), PULANDO o par do jogador (ambos permanecem,
// nessa ordem: [playerTeamId, oponente]) — o chamador decide esse jogo depois.
// round não avança aqui: só via advancePlayer ou o loop de resolveRest.
export function npcRound(
  bs: BracketState, league: LeagueState, playerTeamId: string | null, rng: Rng,
): { next: BracketState; playerOpponent: string | null } {
  if (bs.round === 3) {
    const [a, b] = [bs.aliveEast[0], bs.aliveWest[0]]
    if (a === playerTeamId || b === playerTeamId) {
      return { next: bs, playerOpponent: a === playerTeamId ? b : a }
    }
    const winner = resolveSeries(league, a, b, rng)
    return { next: { round: bs.round, aliveEast: [winner], aliveWest: [winner] }, playerOpponent: null }
  }

  const resolveConf = (alive: string[]): { winners: string[]; opponent: string | null } => {
    const winners: string[] = []
    let opponent: string | null = null
    for (const [a, b] of confPairs(alive)) {
      if (a === playerTeamId || b === playerTeamId) {
        const opp = a === playerTeamId ? b : a
        winners.push(playerTeamId!, opp)
        opponent = opp
      } else {
        winners.push(resolveSeries(league, a, b, rng))
      }
    }
    return { winners, opponent }
  }

  const east = resolveConf(bs.aliveEast)
  const west = resolveConf(bs.aliveWest)
  const playerOpponent = bs.aliveEast.includes(playerTeamId ?? '') ? east.opponent : west.opponent
  return { next: { round: bs.round, aliveEast: east.winners, aliveWest: west.winners }, playerOpponent }
}

// Move o jogador para o próximo round removendo o oponente pendente. npcRound sempre
// empurra o par do jogador como [playerTeamId, oponente] consecutivos — o oponente é
// sempre o elemento seguinte ao jogador no array.
export function advancePlayer(bs: BracketState, playerTeamId: string, _rng: Rng): BracketState {
  const advance = (arr: string[]): string[] => {
    const i = arr.indexOf(playerTeamId)
    if (i === -1) return arr
    return arr.filter((_, idx) => idx !== i + 1)
  }
  return { round: bs.round + 1, aliveEast: advance(bs.aliveEast), aliveWest: advance(bs.aliveWest) }
}

// Jogador já eliminado/ausente: resolve o resto do bracket NPC-only (incl. final
// cross-conference) e retorna o championTeamId.
export function resolveRest(bs: BracketState, league: LeagueState, rng: Rng): string {
  let cur = bs
  while (cur.round < 3) {
    const { next } = npcRound(cur, league, null, rng)
    cur = { round: cur.round + 1, aliveEast: next.aliveEast, aliveWest: next.aliveWest }
  }
  const { next } = npcRound(cur, league, null, rng)
  return next.aliveEast[0]
}
