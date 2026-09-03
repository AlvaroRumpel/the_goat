import { TEAMS, teamById } from '../data/teams'
import { rosterStrength } from './league'
import type { CalendarSlot, KeyGame, LeagueState, Rng, TickerGame } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const DEADLINE_GAME = 55        // pausa da encruzilhada de trade (spec §2, decisão 3)
export const CALENDAR_RNG_CALLS = 4    // 1 jitter por posição, folga fixa com 3 jogos
export const STRETCH_CALLS_PER_GAME = 4   // vitória, margem, pontos, adversário

// Âncoras POR PAPEL (keyGame.kind), não por posição: [rivalry, seedRace, special, rivalry extra].
// No arcade a lista é [rivalry, special] — special fica no índice 1, mas ainda usa a âncora 2.
// seedRace clampado a [49, 54] para nunca colidir com o deadline (55).
const ANCHORS = [12, 52, 30, 66]

// i===0 é sempre a primeira rivalidade (âncora 0); a segunda rivalry (evento) só aparece
// depois de seedRace/special, então cai na âncora 3 (extra) por eliminação.
const anchorOf = (g: KeyGame, i: number) =>
  g.kind === 'seedRace' ? 1 : g.kind === 'special' ? 2 : i === 0 ? 0 : 3

export function buildCalendar(keyGames: KeyGame[], rng: Rng): { slots: CalendarSlot[]; deadlineIndex: number } {
  const slots: CalendarSlot[] = []
  for (let i = 0; i < 4; i++) {
    const jitter = rng.int(-3, 3)                       // contrato: 4 calls SEMPRE
    if (i >= keyGames.length) continue
    const a = anchorOf(keyGames[i], i)
    const raw = ANCHORS[a] + jitter
    const gameIndex = a === 1 ? clamp(raw, 49, 54) : clamp(raw, 2, 81)
    slots.push({ gameIndex, keyGame: keyGames[i] })
  }
  slots.sort((a, b) => a.gameIndex - b.gameIndex)
  return { slots, deadlineIndex: DEADLINE_GAME }
}

// Walk do trecho [from, to] (1-based, inclusivo). `p` = taxa-alvo do segmento
// (computeWinPct — fórmula-contrato intocada, aqui ela vira alvo do Bernoulli).
// Placares e pontos são cosméticos; o `won` é o que conta no registro.
export function simStretch(input: {
  from: number; to: number; p: number; ppg: number; playerTeamId: string; rng: Rng
}): TickerGame[] {
  const { from, to, p, ppg, playerTeamId, rng } = input
  const others = TEAMS.filter(t => t.id !== playerTeamId)
  const out: TickerGame[] = []
  for (let g = from; g <= to; g++) {
    const won = rng.chance(p)                                        // call 1
    const margin = 1 + Math.floor(rng.next() * 17)                   // call 2: 1..17
    const playerPts = Math.max(2, Math.round(ppg + (rng.next() * 12 - 6)))  // call 3
    const opp = rng.pick(others)                                     // call 4
    const base = 98 + ((g * 7) % 13)                                 // variedade sem call
    out.push({
      gameIndex: g, won,
      ourScore: base + (won ? margin : 0),
      oppScore: base + (won ? 0 : margin),
      playerPts, opponentTeamId: opp.id,
    })
  }
  return out
}

// Posição projetada na conferência para o 6b — espelha a expectativa determinística de
// simStandings (41 + (strength − mean) × 1.3), SEM o jitter (sem rng, é só display).
export function projectedSeed(league: LeagueState, playerTeamId: string, playerWinPct: number): number {
  const strengths = new Map(TEAMS.map(t => [t.id, rosterStrength(league, t.id)]))
  const mean = [...strengths.values()].reduce((n, v) => n + v, 0) / 30
  const conf = teamById(playerTeamId).conf
  const playerWins = playerWinPct * 82
  const better = TEAMS.filter(t =>
    t.conf === conf && t.id !== playerTeamId
    && 41 + (strengths.get(t.id)! - mean) * 1.3 > playerWins,
  ).length
  return better + 1
}
