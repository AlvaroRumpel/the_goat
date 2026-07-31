import { describe, expect, test } from 'vitest'
import { gameReducer } from '../src/state'
import type { GameState } from '../src/state'
import { beginCareer } from './helpers/career'

function playToSeason(seed: number): GameState {
  let s = beginCareer({ seed })
  const slots = ['three', 'finishing', 'passing', 'handles', 'defense', 'rebounding', 'physical', 'clutch'] as const
  for (const slot of slots) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  s = gameReducer(s, { type: 'CONFIRM_BUILD' })
  s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  let guard = 0
  while (s.phase !== 'seasonResult' && guard++ < 200) {
    if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else if (s.phase === 'keyGame' || s.phase === 'playoffGame') {
      s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
    }
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else break
  }
  return s
}

describe('liga no reducer', () => {
  test('BEGIN_CAREER inicializa liga', () => {
    const s = beginCareer({ seed: 7 })
    expect(s.league).not.toBeNull()
    expect(s.league!.players).toHaveLength(270)
  })
  test('temporada produz outcome completo', () => {
    const s = playToSeason(11)
    expect(s.phase).toBe('seasonResult')
    expect(s.seasonOutcome).not.toBeNull()
    expect(s.seasonOutcome!.standings).toHaveLength(30)
    expect(s.seasonOutcome!.races).toHaveLength(4)
    expect(s.seasonOutcome!.championTeamId).toBeTruthy()
    const season = s.career.seasons[0]
    expect(season.playoffRun).toBeTruthy()
    expect(season.madePlayoffs).toBe(season.playoffRun !== 'missed')
  })
  test('ADVANCE evolui a liga e guarda história', () => {
    let s = playToSeason(13)
    const yearBefore = s.league!.year
    s = gameReducer(s, { type: 'ADVANCE' })
    expect(s.league!.year).toBe(yearBefore + 1)
    expect(s.leagueHistory).toHaveLength(1)
    expect(s.leagueHistory[0].championTeamId).toBeTruthy()
  })
  test('replay determinístico: mesmo seed → mesmo estado', () => {
    const a = playToSeason(21)
    const b = playToSeason(21)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
