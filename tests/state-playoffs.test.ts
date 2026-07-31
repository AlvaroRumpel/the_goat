import { describe, expect, test } from 'vitest'
import { gameReducer } from '../src/state'
import type { GameState } from '../src/state'
import { teamById } from '../src/data/teams'
import { beginCareer } from './helpers/career'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

function newCareer(seed: number): GameState {
  let s = beginCareer({ seed })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  return gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
}

function playSeasonAuto(s: GameState): GameState {
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 200) {
    if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'playoffGame') {
      s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
    }
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else break
  }
  return s
}

// atravessa a temporada regular decidindo tudo pelo caminho seguro (mesmo padrão do
// runRegular de tests/state-calendar.test.ts) e para assim que os playoffs abrirem.
function walkToStop(s: GameState, stop: (x: GameState) => boolean): GameState {
  let guard = 0
  while (!stop(s) && s.phase !== 'seasonResult' && guard++ < 200) {
    if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else break
  }
  return s
}

// varre os anos de UMA carreira até classificar pros playoffs (1º jogo pronto para decidir).
function reachPlayoffs(seed: number): GameState {
  let s = newCareer(seed)
  for (let y = 0; y < 8; y++) {
    s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
    s = walkToStop(s, x => x.phase === 'playoffGame')
    if (s.phase === 'playoffGame') return s
    s = gameReducer(s, { type: 'ADVANCE' })
    if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
    if (s.phase === 'verdict') break
  }
  throw new Error(`reachPlayoffs: seed ${seed} não classificou em 8 anos`)
}

// varre seeds a partir de startSeed até achar uma carreira que chegue ao 1º jogo das
// finais (round 3, pendingGame pronto para SKIP_GAME) — mesmo padrão de busca do teste
// "finais: série fecha entre 4 e 7 jogos" logo abaixo.
function reachFinals(startSeed: number): GameState {
  for (let seed = startSeed; seed < startSeed + 60; seed++) {
    let s = newCareer(seed)
    for (let y = 0; y < 8; y++) {
      s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
      let guard = 0
      while (s.phase !== 'seasonResult' && guard++ < 200) {
        if (s.phase === 'playoffGame' && s.pendingPlayoffs?.bracket.round === 3 && s.pendingGame) return s
        if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
        else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
        else if (s.phase === 'keyGame' || (s.phase === 'playoffGame' && s.pendingGame)) s = gameReducer(s, { type: 'SKIP_GAME' })
        else if (s.phase === 'playoffGame') s = gameReducer(s, { type: 'ADVANCE_GAME' })
        else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
        else break
      }
      s = gameReducer(s, { type: 'ADVANCE' })
      if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
      if (s.phase === 'verdict') break
    }
  }
  throw new Error(`reachFinals: nenhuma final em ${startSeed}..${startSeed + 60}`)
}

// como reachFinals, mas já resolveu o 1º jogo (SKIP_GAME + CONTINUE): tela de série,
// round 3, sem pendingGame — ponto de partida do SKIP_SERIES.
function reachFinalsSeriesScreen(startSeed: number): GameState {
  let s = reachFinals(startSeed)
  s = gameReducer(s, { type: 'SKIP_GAME' })
  return gameReducer(s, { type: 'CONTINUE' })
}

describe('playoffs pausáveis', () => {
  test('jogo de playoff fecha em gameResult; CONTINUE avança (round seguinte, série ou seasonResult)', () => {
    let s = reachPlayoffs(42)
    expect(s.phase).toBe('playoffGame')
    expect(s.pendingGame).not.toBeNull()
    s = gameReducer(s, { type: 'SKIP_GAME' })
    expect(s.phase).toBe('gameResult')
    expect(s.lastGame!.skipped).toBe(true)
    expect(s.pendingPlayoffs).not.toBeNull()
    const before = s.rngCalls
    s = gameReducer(s, { type: 'CONTINUE' })
    expect(s.rngCalls).toBeGreaterThan(before)   // o roll da série é consumido AQUI
    expect(['playoffGame', 'seasonResult']).toContain(s.phase)
  })
  // 30000ms (era o default de 5s): reachFinals(100) varre até 60 seeds procurando uma
  // final — a recalibração da Task 11 (variância do walk) desloca esse ponto e a busca
  // pode passar do timeout padrão em máquinas mais lentas. Robustez de teste, não trava.
  test('finais: contadores da série já atualizados na tela de resultado', () => {
    let s = reachFinals(100)
    s = gameReducer(s, { type: 'SKIP_GAME' })
    expect(s.phase).toBe('gameResult')
    const pp = s.pendingPlayoffs!
    expect(pp.seriesUs + pp.seriesThem).toBe(1)
  }, 30000)
  test('SKIP_SERIES não pausa em gameResult (direto ao desfecho da série)', () => {
    let s = reachFinalsSeriesScreen(100)
    expect(s.phase).toBe('playoffGame')
    expect(s.pendingGame).toBeNull()
    s = gameReducer(s, { type: 'SKIP_SERIES' })
    expect(['playoffGame', 'seasonResult']).toContain(s.phase)
    expect(s.phase === 'seasonResult' || s.pendingPlayoffs!.bracket.round === 3).toBe(true)
  }, 30000)

  test('temporada completa em auto chega em seasonResult com outcome coerente', () => {
    let found = false
    for (let seed = 60; seed < 75; seed++) {
      let s = newCareer(seed)
      for (let y = 0; y < 8 && !found; y++) {
        s = playSeasonAuto(s)
        expect(s.phase).toBe('seasonResult')
        const season = s.career.seasons[s.career.seasons.length - 1]
        expect(season.madePlayoffs).toBe(season.seed !== null)
        expect(s.seasonOutcome!.championTeamId).toBeTruthy()
        if (season.playoffRun === 'finals' || season.playoffRun === 'champion') found = true
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
        if (s.phase === 'verdict') break
      }
      if (found) break
    }
    expect(found).toBe(true)   // em 15 seeds × 8 anos alguém chega às finais
  }, 30000)
  test('finais: série fecha entre 4 e 7 jogos, contra time da outra conferência', () => {
    // dirigir até finais com seeds variados; quando chegar, contar jogos
    for (let seed = 100; seed < 140; seed++) {
      let s = newCareer(seed)
      for (let y = 0; y < 6; y++) {
        s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
        if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
        let games = 0, guard = 0
        let crossConf = true
        while (s.phase !== 'seasonResult' && guard++ < 200) {
          if (s.phase === 'playoffGame' && s.pendingPlayoffs?.bracket.round === 3 && s.pendingGame) {
            games++
            const pp = s.pendingPlayoffs
            // advancePlayer respeitou o bracket: finais são sempre cross-conferência
            if (teamById(pp.opponentTeamId).conf === teamById(pp.finalOffer.teamId).conf) crossConf = false
          }
          if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
          else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
          else if (s.phase === 'keyGame' || (s.phase === 'playoffGame' && s.pendingGame)) s = gameReducer(s, { type: 'SKIP_GAME' })
          else if (s.phase === 'playoffGame') s = gameReducer(s, { type: 'ADVANCE_GAME' })
          else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
          else break
        }
        const season = s.career.seasons[s.career.seasons.length - 1]
        if (games > 0) {
          expect(games).toBeGreaterThanOrEqual(4)
          expect(games).toBeLessThanOrEqual(7)
          expect(crossConf).toBe(true)
          expect(['finals', 'champion']).toContain(season.playoffRun)
          return
        }
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
        if (s.phase === 'verdict') break
      }
    }
    throw new Error('nenhuma final em 40 seeds × 6 anos — calibração ou fluxo quebrado')
  }, 60000)
  test('round-trip save/load NO MEIO dos playoffs continua idêntico', () => {
    // pureza do reducer não cobre isso: o save serializa pendingPlayoffs/pendingGame e
    // o replay recria o rng a partir de (seed, rngCalls). Se algo do estado pausado não
    // sobreviver ao JSON, a continuação diverge.
    for (let seed = 300; seed < 340; seed++) {
      let s = newCareer(seed)
      for (let y = 0; y < 6; y++) {
        s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
        if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
        let guard = 0
        while (s.phase !== 'seasonResult' && guard++ < 200) {
          // pausa assim que os playoffs estiverem em andamento com um jogo aberto
          if (s.phase === 'playoffGame' && s.pendingGame && s.pendingPlayoffs) {
            const reloaded = JSON.parse(JSON.stringify(s)) as GameState
            expect(reloaded).toEqual(s)
            const rest = (from: GameState) => {
              let x = from
              let g = 0
              while (x.phase !== 'seasonResult' && g++ < 200) {
                if (x.phase === 'seasonAdvance') x = gameReducer(x, { type: 'TAKE_NEXT_GAME' })
                else if (x.phase === 'gameResult') x = gameReducer(x, { type: 'CONTINUE' })
                else if (x.phase === 'keyGame' || (x.phase === 'playoffGame' && x.pendingGame)) x = gameReducer(x, { type: 'SKIP_GAME' })
                else if (x.phase === 'playoffGame') x = gameReducer(x, { type: 'ADVANCE_GAME' })
                else if (x.phase === 'tradeDecision') x = gameReducer(x, { type: 'TRADE_DECISION', accept: false })
                else break
              }
              return JSON.stringify(x)
            }
            expect(rest(reloaded)).toBe(rest(s))
            return
          }
          if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
          else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
          else if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
          else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
          else break
        }
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
        if (s.phase === 'verdict') break
      }
    }
    throw new Error('nenhum jogo de playoffs em 40 seeds × 6 anos')
  }, 60000)
  test('replay determinístico com playoffs', () => {
    const run = () => {
      let s = newCareer(200)
      for (let y = 0; y < 3; y++) {
        s = playSeasonAuto(s)
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
      }
      return JSON.stringify(s)
    }
    expect(run()).toBe(run())
  }, 30000)
  test('trade aceito (accept: true) entra em playoffs sem crash', () => {
    // canTrade só liga a partir da 3ª temporada (state.ts: seasons.length >= 2);
    // varre seeds/anos até achar uma temporada com tradeOffer que também classifica.
    const finishToSeasonResult = (x: GameState): GameState => {
      let guard = 0
      while (x.phase !== 'seasonResult' && guard++ < 200) {
        if (x.phase === 'seasonAdvance') x = gameReducer(x, { type: 'TAKE_NEXT_GAME' })
        else if (x.phase === 'gameResult') x = gameReducer(x, { type: 'CONTINUE' })
        else if (x.phase === 'keyGame' || x.phase === 'playoffGame') {
          x = x.pendingGame ? gameReducer(x, { type: 'SKIP_GAME' }) : gameReducer(x, { type: 'SKIP_SERIES' })
        } else break
      }
      return x
    }
    for (let seed = 500; seed < 560; seed++) {
      let s = newCareer(seed)
      for (let y = 0; y < 8; y++) {
        s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
        if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
        let guard = 0
        while ((s.phase === 'seasonAdvance' || s.phase === 'keyGame' || s.phase === 'gameResult') && guard++ < 200) {
          if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
          else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
          else s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
        }
        if (s.phase === 'tradeDecision') {
          const tradeTeamId = s.pendingRegular!.tradeOffer!.teamId
          s = finishToSeasonResult(gameReducer(s, { type: 'TRADE_DECISION', accept: true }))
          expect(s.phase).toBe('seasonResult')
          expect(s.pendingPlayoffs).toBeNull()
          const season = s.career.seasons[s.career.seasons.length - 1]
          if (season.seed !== null) {   // classificou pros playoffs com o time novo
            expect(season.finalTeamId).toBe(tradeTeamId)
            return
          }
        }
        s = gameReducer(s, { type: 'ADVANCE' })
        if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
        if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
        if (s.phase === 'verdict') break
      }
    }
    throw new Error('nenhuma temporada com trade aceita + classificação pros playoffs em 60 seeds × 8 anos')
  }, 60000)
})
