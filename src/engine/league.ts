import { ageMultiplier } from './season'
import { TEAMS } from '../data/teams'
import { FICTIONAL_FIRST, FICTIONAL_LAST } from '../data/league'
import type { Archetype, Award, Conf, Headline, LeaguePlayer, LeagueState, LeagueTag, NpcLine, PlayoffRun, RaceAward, RaceEntry, AwardRace, Rng, TeamStanding } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function npcEffOvr(p: LeaguePlayer): number {
  return Math.round(p.ovr * ageMultiplier(p.age, p.ovr))
}

// Constantes calibráveis (Task 10). Mapeia média ponderada de elenco para a
// escala 45..90 usada por Team.strength (contrato do computeWinPct).
export function teamStrength(ovrs: number[]): number {
  const sorted = [...ovrs].sort((a, b) => b - a)
  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)
  const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / (xs.length || 1)
  const weighted = 0.6 * avg(top3) + 0.4 * avg(rest)
  // dataset real (curadoria própria) tem weighted médio ~74, não ~83 como no
  // exemplo do brief — 68/74/1.7 recalibrados para bater as âncoras de teste.
  return clamp(Math.round(68 + (weighted - 74) * 1.7), 45, 90)
}

export function rosterStrength(league: LeagueState, teamId: string, extraOvr?: number): number {
  const ovrs = league.players.filter(p => p.teamId === teamId).map(npcEffOvr)
  if (extraOvr !== undefined) ovrs.push(extraOvr)
  return teamStrength(ovrs)
}

export function simStandings(input: {
  league: LeagueState; playerTeamId: string; playerWins: number; rng: Rng
}): TeamStanding[] {
  const { league, playerTeamId, playerWins, rng } = input
  const strengths = new Map(TEAMS.map(t => [t.id, rosterStrength(league, t.id)]))
  const mean = [...strengths.values()].reduce((n, v) => n + v, 0) / 30
  // jitter pré-computado — NUNCA rng dentro de comparator
  const rows = TEAMS.map(t => ({
    teamId: t.id,
    conf: t.conf,
    wins: t.id === playerTeamId
      ? playerWins
      : clamp(Math.round(41 + (strengths.get(t.id)! - mean) * 1.3 + rng.int(-6, 6)), 12, 68),
    jitter: rng.next(),
  }))
  const standings: TeamStanding[] = rows.map(r => ({ teamId: r.teamId, conf: r.conf, wins: r.wins, seed: null }))
  for (const conf of ['east', 'west'] as const) {
    const ranked = rows.filter(r => r.conf === conf).sort((a, b) => (b.wins - a.wins) || (b.jitter - a.jitter))
    ranked.slice(0, 8).forEach((r, i) => { standings.find(s => s.teamId === r.teamId)!.seed = i + 1 })
  }
  return standings
}

const ROUND_RUN: PlayoffRun[] = ['r1', 'semi', 'conf', 'finals']

// Constantes calibráveis (Task 10): expoente 1/4 e fator 0.004 ajustam para bater
// a taxa agregada de título do jogador ≈ playerTitleProb ao longo das 4 rodadas.
export function simBracket(input: {
  standings: TeamStanding[]; league: LeagueState
  playerTeamId: string | null; playerTitleProb: number; rng: Rng
}): { championTeamId: string; playerRun: PlayoffRun; wonTitle: boolean } {
  const { standings, league, playerTeamId, playerTitleProb, rng } = input
  const strengths = new Map(standings.map(s => [s.teamId, rosterStrength(league, s.teamId)]))
  // p do jogador por série: agregado das 4 rodadas ≈ titleProb, com ajuste leve por adversário
  const baseP = Math.pow(Math.max(playerTitleProb, 0.0001), 1 / 4)
  const seriesWin = (a: string, b: string): boolean => {
    const sA = strengths.get(a)!, sB = strengths.get(b)!
    if (a === playerTeamId) return rng.chance(clamp(baseP * (1 - (sB - 70) * 0.004), 0.05, 0.95))
    if (b === playerTeamId) return !rng.chance(clamp(baseP * (1 - (sA - 70) * 0.004), 0.05, 0.95))
    return rng.chance(clamp(0.5 + (sA - sB) * 0.03, 0.10, 0.90))
  }
  const bySeed = (conf: Conf) => {
    const seeded = standings.filter(s => s.conf === conf && s.seed !== null)
    return (n: number) => seeded.find(s => s.seed === n)!.teamId
  }
  let playerRun: PlayoffRun = playerTeamId ? 'r1' : 'missed'
  const runRound = (pairs: [string, string][], round: number): string[] =>
    pairs.map(([a, b]) => {
      const winner = seriesWin(a, b) ? a : b
      if (playerTeamId && winner === playerTeamId && round < 3) playerRun = ROUND_RUN[round + 1]
      return winner
    })
  const confChampion = (conf: Conf): string => {
    const g = bySeed(conf)
    let alive = runRound([[g(1), g(8)], [g(4), g(5)], [g(3), g(6)], [g(2), g(7)]], 0)
    alive = runRound([[alive[0], alive[1]], [alive[2], alive[3]]], 1)
    return runRound([[alive[0], alive[1]]], 2)[0]
  }
  const east = confChampion('east')
  const west = confChampion('west')
  const championTeamId = seriesWin(east, west) ? east : west
  const wonTitle = playerTeamId !== null && championTeamId === playerTeamId
  if (wonTitle) playerRun = 'champion'
  return { championTeamId, playerRun, wonTitle }
}

// Constantes calibráveis (Task 10): alvo é top-10 de ppg da liga parecido com NBA real.
export function simNpcLines(league: LeagueState, rng: Rng): NpcLine[] {
  return league.players.map(p => {
    const eff = npcEffOvr(p)
    const has = (tag: LeagueTag) => p.tags.includes(tag)
    const ppg = clamp((eff - 58) * 0.70 + (has('shooter') ? 2 : 0) + (rng.next() * 8 - 4), 2, 36)
    const rpg = clamp((eff - 60) * 0.28 + (has('rebounder') ? 3 : 0) + (p.pos === 'C' ? 2 : p.pos === 'PF' ? 1 : -1) + (rng.next() * 2 - 1), 0.5, 16)
    const apg = clamp((eff - 60) * 0.22 + (has('playmaker') ? 3 : 0) + (p.pos === 'PG' ? 2.5 : 0) + (rng.next() * 2 - 1), 0.3, 12)
    return { playerId: p.id, ppg: Math.round(ppg * 10) / 10, rpg: Math.round(rpg * 10) / 10, apg: Math.round(apg * 10) / 10 }
  })
}

// npcEffOvr aplica a curva de idade do jogador ao NPC, então rookie de NPC (ovr 70,
// 20 anos) fica com eff ~57 e ppg no piso — sem isso o jogador ganharia ROY sempre,
// mesmo com 75 de overall. Constante calibrável (harness: royRate por faixa).
const ROY_NPC_BOOST = 1.8

export interface PlayerAwardInput {
  ppg: number; rpg: number; apg: number
  teamWinPct: number
  defRating: number        // build.attributes.defense * ageMultiplier
  rookie: boolean          // primeira temporada
  prevPpg: number | null
}

// Referência de calibração: no modelo antigo (pré-liga) o jogador levava MVP com
// ppg>=23 && winPct>=0.6 && chance(0.25), e DPOY com defense*m>=90 && chance(0.15).
// As constantes abaixo devem reproduzir frequências parecidas (harness Task 10).
// Compartilhado com partialMvpRace (deadline): MESMAS constantes do MVP real.
function mvpValue(ppg: number, apg: number, rpg: number, winPct: number): number {
  return ppg + 1.4 * apg + 1.1 * rpg + (winPct - 0.5) * 30
}

// Corrida de MVP parcial (deadline, TradeDecision) — determinística, sem rng:
// mesma fórmula do MVP real (mvpValue), rodando só sobre standings/lines já
// simulados até ali (bracket/awards reais ainda não rodaram).
export function partialMvpRace(
  league: LeagueState, lines: NpcLine[], standings: TeamStanding[],
  playerPartial: { ppg: number; rpg: number; apg: number; teamWinPct: number },
): AwardRace {
  const winPctOf = new Map(standings.map(s => [s.teamId, s.wins / 82]))
  const lineOf = new Map(lines.map(l => [l.playerId, l]))
  const list: RaceEntry[] = league.players.map(p => {
    const l = lineOf.get(p.id)!
    return { id: p.id, name: p.name, value: mvpValue(l.ppg, l.apg, l.rpg, winPctOf.get(p.teamId) ?? 0.5) }
  })
  list.push({
    id: 'you', name: '',   // UI traduz id === 'you'
    value: mvpValue(playerPartial.ppg, playerPartial.apg, playerPartial.rpg, playerPartial.teamWinPct),
  })
  return { award: 'mvp', top: [...list].sort((a, b) => b.value - a.value).slice(0, 5) }
}

export function simAwards(input: {
  league: LeagueState; lines: NpcLine[]; standings: TeamStanding[]
  player: PlayerAwardInput; playerName: string; rng: Rng
}): { races: AwardRace[]; winners: Record<RaceAward, string | null>; playerAwards: Award[] } {
  const { league, lines, standings, player, playerName, rng } = input
  const winPctOf = new Map(standings.map(s => [s.teamId, s.wins / 82]))
  const lineOf = new Map(lines.map(l => [l.playerId, l]))

  const mvpScore = (l: NpcLine, teamId: string) => mvpValue(l.ppg, l.apg, l.rpg, winPctOf.get(teamId) ?? 0.5)
  const entries = (award: RaceAward, list: RaceEntry[]): AwardRace => {
    // jitter já embutido em value; sem rng no sort
    const top = [...list].sort((a, b) => b.value - a.value).slice(0, 5)
    return { award, top }
  }

  const mvpList: RaceEntry[] = league.players.map(p => ({
    id: p.id, name: p.name, value: mvpScore(lineOf.get(p.id)!, p.teamId),
  }))
  mvpList.push({ id: 'you', name: playerName, value: mvpValue(player.ppg, player.apg, player.rpg, player.teamWinPct) })

  const dpoyList: RaceEntry[] = league.players.map(p => ({
    id: p.id, name: p.name,
    value: npcEffOvr(p) * (p.tags.includes('defender') ? 1.06 : 0.86) + (rng.next() * 6 - 3),
  }))
  dpoyList.push({ id: 'you', name: playerName, value: player.defRating + (rng.next() * 6 - 3) })

  const royList: RaceEntry[] = league.players.filter(p => p.rookie).map(p => {
    const l = lineOf.get(p.id)!
    return { id: p.id, name: p.name, value: (l.ppg + l.apg + l.rpg) * ROY_NPC_BOOST }
  })
  if (player.rookie) royList.push({ id: 'you', name: playerName, value: player.ppg + player.apg + player.rpg })

  const mipList: RaceEntry[] = league.players.filter(p => !p.rookie && p.prevPpg !== null).map(p => ({
    id: p.id, name: p.name, value: lineOf.get(p.id)!.ppg - p.prevPpg!,
  }))
  if (!player.rookie && player.prevPpg !== null) {
    mipList.push({ id: 'you', name: playerName, value: player.ppg - player.prevPpg })
  }

  const races = [entries('mvp', mvpList), entries('dpoy', dpoyList), entries('roy', royList), entries('mip', mipList)]
  const winners = Object.fromEntries(
    races.map(r => [r.award, r.top[0]?.id ?? null]),
  ) as Record<RaceAward, string | null>
  const playerAwards = (['mvp', 'dpoy', 'roy', 'mip'] as const).filter(a => winners[a] === 'you')
  return { races, winners, playerAwards }
}

// Constantes calibráveis (Task 10): bandas de delta por idade, gates de aposentadoria
// (38+, ovr<58, 35+ chance 0.35) e curva de ovr do rookie (55 + 30r²) ajustam a
// distribuição de ovr da liga ao longo de temporadas (âncoras: teste de 20 temporadas).
function ovrDelta(age: number, rng: Rng): number {
  if (age <= 24) return rng.int(0, 3)
  if (age <= 28) return rng.int(-1, 1)
  if (age <= 32) return -rng.int(0, 2)
  return -rng.int(1, 4)
}

export function advanceOffseason(input: {
  league: LeagueState; standings: TeamStanding[]; lines: NpcLine[]; rng: Rng
}): { league: LeagueState; headlines: Headline[] } {
  const { league, standings, lines, rng } = input
  const lineOf = new Map(lines.map(l => [l.playerId, l]))
  const headlines: Headline[] = []
  const POS: Archetype[] = ['PG', 'SG', 'SF', 'PF', 'C']
  const TAGS: LeagueTag[] = ['shooter', 'defender', 'playmaker', 'rebounder']
  let draftCount = 0

  const makeRookie = (teamId: string): LeaguePlayer => {
    draftCount++
    const name = `${rng.pick(FICTIONAL_FIRST)} ${rng.pick(FICTIONAL_LAST)}`
    const r = rng.next()
    const rookie: LeaguePlayer = {
      id: `f-${league.year}-${draftCount}`,       // fictício: id único por ano+ordem
      name, pos: rng.pick(POS), age: rng.int(19, 22),
      ovr: 55 + Math.round(42 * r * r),           // skew: maioria 55-70, raros 90+
      tags: rng.chance(0.5) ? [rng.pick(TAGS)] : [],
      teamId, rookie: true, prevPpg: null,
    }
    headlines.push({ kind: 'draft', playerName: name, teamId })
    return rookie
  }

  const players = league.players.map(p => {
    const aged: LeaguePlayer = {
      ...p, age: p.age + 1, rookie: false,
      ovr: clamp(p.ovr + ovrDelta(p.age + 1, rng), 40, 99),
      prevPpg: lineOf.get(p.id)?.ppg ?? null,
    }
    const retires = aged.age >= 38 || aged.ovr < 58 || (aged.age >= 35 && rng.chance(0.35))
    if (!retires) return aged
    if (p.ovr >= 80) headlines.push({ kind: 'retire', playerName: p.name, teamId: p.teamId })
    return makeRookie(p.teamId)
  })

  // trades: contender (top-10 wins) busca veterano forte de lanterna (bottom-10); troca por jovem
  const next: LeagueState = { players, year: league.year + 1 }
  const byWins = [...standings].sort((a, b) => b.wins - a.wins)
  const contenders = byWins.slice(0, 10).map(s => s.teamId)
  const sellers = byWins.slice(-10).map(s => s.teamId)
  const nTrades = rng.int(2, 4)
  for (let i = 0; i < nTrades; i++) {
    const buyer = rng.pick(contenders)
    const seller = rng.pick(sellers.filter(id => id !== buyer))
    const star = next.players.filter(p => p.teamId === seller && p.age >= 27 && p.ovr >= 74)
      .sort((a, b) => b.ovr - a.ovr)[0]
    const young = next.players.filter(p => p.teamId === buyer && p.age <= 25 && Math.abs(p.ovr - (star?.ovr ?? 99)) <= 10)
      .sort((a, b) => b.ovr - a.ovr)[0]
    if (!star || !young) continue
    star.teamId = buyer
    young.teamId = seller
    headlines.push({ kind: 'trade', playerName: star.name, fromTeamId: seller, toTeamId: buyer })
  }
  return { league: next, headlines }
}
