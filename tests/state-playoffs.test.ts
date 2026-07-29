import { describe, expect, test } from 'vitest'
import { gameReducer, initialState } from '../src/state'
import type { GameState } from '../src/state'
import { teamById } from '../src/data/teams'

const SLOTS = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const

function newCareer(seed: number): GameState {
  let s = gameReducer(initialState(), { type: 'NEW_GAME', seed })
  for (const slot of SLOTS) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  return gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
}

function playSeasonAuto(s: GameState): GameState {
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 80) {
    if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'playoffGame') {
      s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
    }
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else break
  }
  return s
}

describe('playoffs pausáveis', () => {
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
        while (s.phase !== 'seasonResult' && guard++ < 100) {
          if (s.phase === 'playoffGame' && s.pendingPlayoffs?.bracket.round === 3 && s.pendingGame) {
            games++
            const pp = s.pendingPlayoffs
            // advancePlayer respeitou o bracket: finais são sempre cross-conferência
            if (teamById(pp.opponentTeamId).conf === teamById(pp.finalOffer.teamId).conf) crossConf = false
          }
          if (s.phase === 'keyGame' || (s.phase === 'playoffGame' && s.pendingGame)) s = gameReducer(s, { type: 'SKIP_GAME' })
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
        while (s.phase !== 'seasonResult' && guard++ < 80) {
          // pausa assim que os playoffs estiverem em andamento com um jogo aberto
          if (s.phase === 'playoffGame' && s.pendingGame && s.pendingPlayoffs) {
            const reloaded = JSON.parse(JSON.stringify(s)) as GameState
            expect(reloaded).toEqual(s)
            const rest = (from: GameState) => {
              let x = from
              let g = 0
              while (x.phase !== 'seasonResult' && g++ < 80) {
                if (x.phase === 'keyGame' || (x.phase === 'playoffGame' && x.pendingGame)) x = gameReducer(x, { type: 'SKIP_GAME' })
                else if (x.phase === 'playoffGame') x = gameReducer(x, { type: 'ADVANCE_GAME' })
                else if (x.phase === 'tradeDecision') x = gameReducer(x, { type: 'TRADE_DECISION', accept: false })
                else break
              }
              return JSON.stringify(x)
            }
            expect(rest(reloaded)).toBe(rest(s))
            return
          }
          if (s.phase === 'keyGame') s = gameReducer(s, { type: 'SKIP_GAME' })
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
})
