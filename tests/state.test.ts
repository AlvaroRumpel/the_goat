import { beforeEach, describe, expect, test, vi } from 'vitest'
import { gameReducer, initialState, loadState, saveState } from '../src/state'

// localStorage mock for node env
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
})

beforeEach(() => store.clear())

function playToBuild() {
  let s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 123 })
  for (let i = 0; i < 8; i++)
    s = gameReducer(s, { type: 'PICK_LEGEND', legend: s.matchups[i].a })
  return gameReducer(s, { type: 'CONFIRM_BUILD' })
}

describe('gameReducer', () => {
  test('NEW_GAME → attrDraft with 8 matchups', () => {
    const s = gameReducer(initialState('pt'), { type: 'NEW_GAME', seed: 1 })
    expect(s.phase).toBe('attrDraft')
    expect(s.matchups).toHaveLength(8)
  })
  test('8 picks → draftDone → CONFIRM_BUILD → nbaDraft with 3 offers + pick number', () => {
    const s = playToBuild()
    expect(s.phase).toBe('nbaDraft')
    expect(s.build).not.toBeNull()
    expect(s.offers).toHaveLength(3)
    expect(s.pickNumber).toBeGreaterThanOrEqual(1)
  })
  test('full season loop reaches seasonResult and career grows', () => {
    let s = playToBuild()
    s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    expect(s.phase).toBe('preseason')
    s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    // trade never offered in first 2 seasons
    expect(s.phase).toBe('seasonResult')
    expect(s.career.seasons).toHaveLength(1)
  })
  test('retirement decision appears at 31+', () => {
    let s = playToBuild()
    s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    while (s.phase !== 'verdict' && s.age < 32) {
      if (s.phase === 'preseason') s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'health' })
      else if (s.phase === 'seasonResult') s = gameReducer(s, { type: 'ADVANCE' })
      else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
      else if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      else if (s.phase === 'retireDecision') break
    }
    expect(s.phase).toBe('retireDecision')
    expect(gameReducer(s, { type: 'RETIRE_DECISION', retire: true }).phase).toBe('verdict')
  })
  test('can retire directly from free agency at 31+ (contract expiry year)', () => {
    // Contract expiry lands at ages 23/27/31/35 with seed 123 (see 'retirement
    // decision appears at 31+' above) — age 31 hits contractYearsLeft===0 before the
    // age>=31 retireDecision check, so freeAgency fires first. Confirms the retire
    // button on the FreeAgency screen (age >= 31) is reachable and works.
    let s = playToBuild()
    s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    let guard = 0
    while (!(s.phase === 'freeAgency' && s.age >= 31) && guard++ < 200) {
      if (s.phase === 'preseason') s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'health' })
      else if (s.phase === 'seasonResult') s = gameReducer(s, { type: 'ADVANCE' })
      else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
      else if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      else if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
      else break
    }
    expect(s.phase).toBe('freeAgency')
    expect(s.age).toBeGreaterThanOrEqual(31)
    expect(gameReducer(s, { type: 'RETIRE_DECISION', retire: true }).phase).toBe('verdict')
  })
  test('save/load roundtrip; corrupted save → null', () => {
    const s = playToBuild()
    saveState(s)
    expect(loadState()).toEqual(s)
    localStorage.setItem('thegoat:v1', '{broken')
    expect(loadState()).toBeNull()
  })
})
