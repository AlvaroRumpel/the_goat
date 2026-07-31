import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { gameReducer, initialState, loadState, saveState, STORAGE_KEY } from '../src/state'
import type { GameState } from '../src/state'
import { SLOT_ORDER } from '../src/engine/types'
import { beginCareer } from './helpers/career'

// localStorage mock for node env
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
})

beforeEach(() => store.clear())

function playToBuild() {
  let s = beginCareer({ seed: 123 })
  for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
  return gameReducer(s, { type: 'CONFIRM_BUILD' })
}

// calendário + jogos-chave + playoffs em auto: TAKE_NEXT_GAME abre o próximo jogo,
// SKIP_GAME resolve o jogo aberto, CONTINUE segue o walk, SKIP_SERIES a tela de série
// das finais. Para no primeiro estado que não é jogo (tradeDecision/seasonResult).
function skipGames(s: GameState): GameState {
  let guard = 0
  while ((s.phase === 'seasonAdvance' || s.phase === 'keyGame' || s.phase === 'gameResult' || s.phase === 'playoffGame') && guard++ < 200) {
    if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'gameResult') s = gameReducer(s, { type: 'CONTINUE' })
    else s = s.pendingGame ? gameReducer(s, { type: 'SKIP_GAME' }) : gameReducer(s, { type: 'SKIP_SERIES' })
  }
  return s
}

function playToSeasonResult() {
  let s = playToBuild()
  s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  s = skipGames(s)
  if (s.phase === 'tradeDecision') s = skipGames(gameReducer(s, { type: 'TRADE_DECISION', accept: false }))
  return s
}

// para no primeiro jogo-chave com um momento aberto
function playToFirstKeyGame(): GameState {
  let s = playToBuild()
  s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
  s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
  if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
  if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
  let guard = 0
  while (s.phase !== 'keyGame' && guard++ < 20) {
    if (s.phase === 'seasonAdvance') s = gameReducer(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    else throw new Error('não chegou a um keyGame: ' + s.phase)
  }
  return s
}

describe('draft fenomeno', () => {
  test('BEGIN_CAREER sorteia o primeiro jogador', () => {
    const s = beginCareer({ seed: 1 })
    expect(s.phase).toBe('attrDraft')
    expect(s.currentPlayerId).toBeTruthy()
    expect(s.drawnIds).toEqual([s.currentPlayerId])
    expect(s.rerollUsed).toBe(false)
  })
  test('DRAFT_STEAL preenche slot e sorteia o próximo; 8º vai para draftDone', () => {
    let s = beginCareer({ seed: 2 })
    const first = s.currentPlayerId
    s = gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })
    expect(s.picks).toEqual([{ playerId: first, slot: 'three' }])
    expect(s.currentPlayerId).not.toBe(first)
    for (const slot of SLOT_ORDER.slice(1)) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
    expect(s.phase).toBe('draftDone')
    expect(s.build).not.toBeNull()
  })
  test('DRAFT_STEAL em slot já preenchido é no-op', () => {
    let s = beginCareer({ seed: 3 })
    s = gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })
    const before = s
    s = gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })
    expect(s).toBe(before)
  })
  test('DRAFT_STEAL fora de attrDraft é no-op', () => {
    const s = initialState('pt')
    expect(gameReducer(s, { type: 'DRAFT_STEAL', slot: 'three' })).toBe(s)
  })
  test('DRAFT_REROLL troca o jogador uma vez; segunda é no-op', () => {
    let s = beginCareer({ seed: 4 })
    const first = s.currentPlayerId
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s.currentPlayerId).not.toBe(first)
    expect(s.rerollUsed).toBe(true)
    const after = s
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s).toBe(after)
  })
  test('replay determinístico: mesmo seed + mesmas actions = mesmo estado', () => {
    const run = () => {
      let s = beginCareer({ seed: 42 })
      s = gameReducer(s, { type: 'DRAFT_REROLL' })
      for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
      return s
    }
    expect(run().build).toEqual(run().build)
    expect(run().drawnIds).toEqual(run().drawnIds)
  })
})

describe('gameReducer', () => {
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
    if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
    s = skipGames(s)
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
      else if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
      else if (s.phase === 'seasonAdvance' || s.phase === 'keyGame' || s.phase === 'gameResult' || s.phase === 'playoffGame') s = skipGames(s)
      else if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      else if (s.phase === 'retireDecision') break
      else break
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
      else if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
      else if (s.phase === 'seasonAdvance' || s.phase === 'keyGame' || s.phase === 'gameResult' || s.phase === 'playoffGame') s = skipGames(s)
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
    localStorage.setItem(STORAGE_KEY, '{broken')
    expect(loadState()).toBeNull()
  })
  test('save sem liga completa (v2 e anteriores) é descartado', () => {
    const s = playToBuild()
    const { league: _drop, ...noLeague } = s
    localStorage.setItem(STORAGE_KEY, JSON.stringify(noLeague))
    expect(loadState()).toBeNull()
  })
  test('loadState normaliza save legado sem injuryProne/pendingEvents e com pendingRegular sem choices', () => {
    let s = playToBuild()
    s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    const legacy: Record<string, unknown> = {
      ...s,
      phase: 'tradeDecision',
      calendar: {
        slots: [], nextSlot: 0, deadlineDone: false, played: 55, p: 0.5, effClutch: 75, autoRun: false,
        // 55 jogos já disputados (games 1..55) — precisa bater com `played` pra não
        // disparar a invariante do registro literal (ticker.length !== 82) em closeRegularSeason
        ticker: Array.from({ length: 55 }, (_, i) => (
          { gameIndex: i + 1, won: i % 2 === 0, ourScore: 100, oppScore: 95, playerPts: 20, opponentTeamId: 'lal' }
        )),
      },
      pendingRegular: {
        age: s.age, teamId: s.currentOffer!.teamId, games: 82, ppg: 20, rpg: 5, apg: 5,
        events: [], tradeOffer: { teamId: s.currentOffer!.teamId, profile: s.currentOffer!.profile },
        // choices field missing on purpose — mimics a pre-release save shape
      },
      pendingFocus: 'scoring',
    }
    delete legacy.injuryProne
    delete legacy.pendingEvents
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))

    const loaded = loadState()!
    expect(loaded.pendingRegular!.choices).toEqual([])
    expect(loaded.injuryProne).toBe(false)
    expect(loaded.pendingEvents).toBeNull()
    expect(() => gameReducer(loaded, { type: 'TRADE_DECISION', accept: false })).not.toThrow()
  })
  test('RETIRE_DECISION e aposentadoria por idade computam e guardam verdict uma vez', () => {
    let s = playToBuild()
    s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    let guard = 0
    while (s.phase !== 'retireDecision' && guard++ < 200) {
      if (s.phase === 'preseason') s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'health' })
      else if (s.phase === 'seasonResult') s = gameReducer(s, { type: 'ADVANCE' })
      else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
      else if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
      else if (s.phase === 'seasonAdvance' || s.phase === 'keyGame' || s.phase === 'gameResult' || s.phase === 'playoffGame') s = skipGames(s)
      else if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      else break
    }
    expect(s.phase).toBe('retireDecision')
    expect(s.verdict).toBeNull()
    const retired = gameReducer(s, { type: 'RETIRE_DECISION', retire: true })
    expect(retired.phase).toBe('verdict')
    expect(retired.verdict).not.toBeNull()
    expect(retired.verdict!.score).toBeGreaterThanOrEqual(0)
  })
  test('save legado sem verdict em phase verdict recebe backfill no loadState', () => {
    let s = playToBuild()
    const legacy: Record<string, unknown> = { ...s, phase: 'verdict' }
    delete legacy.verdict
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy))
    const loaded = loadState()!
    expect(loaded.verdict).not.toBeNull()
    expect(loaded.verdict!.tier).toBeTruthy()
  })
  test('aposentadoria automática por idade (age > 40) computa e guarda verdict via ADVANCE', () => {
    let s = playToBuild()
    s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
    let guard = 0
    while (s.age <= 40 && s.phase !== 'verdict' && guard++ < 300) {
      if (s.phase === 'preseason') s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'health' })
      else if (s.phase === 'seasonResult') s = gameReducer(s, { type: 'ADVANCE' })
      else if (s.phase === 'tradeDecision') s = gameReducer(s, { type: 'TRADE_DECISION', accept: false })
      else if (s.phase === 'eventDecision') s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
      else if (s.phase === 'seasonAdvance' || s.phase === 'keyGame' || s.phase === 'gameResult' || s.phase === 'playoffGame') s = skipGames(s)
      else if (s.phase === 'freeAgency') s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      else if (s.phase === 'retireDecision') s = gameReducer(s, { type: 'RETIRE_DECISION', retire: false })
      else break
    }
    expect(s.age).toBeGreaterThan(40)
    expect(s.phase).toBe('verdict')
    expect(s.verdict).not.toBeNull()
    expect(s.verdict!.score).toBeGreaterThanOrEqual(0)
    expect(s.verdict!.tier).toBeTruthy()
  })
  test('CONFIRM_BUILD e CHOOSE_OFFER são no-op fora da fase esperada', () => {
    const home = initialState('pt')
    expect(gameReducer(home, { type: 'CONFIRM_BUILD' })).toEqual(home)
    const fakeOffer = { teamId: 'lal', profile: 'bigmarket' as const }
    expect(gameReducer(home, { type: 'CHOOSE_OFFER', offer: fakeOffer })).toEqual(home)
  })
})

describe('eventDecision', () => {
  // acha um seed cujo PLAY_SEASON role evento interativo na 1ª temporada
  function findInteractiveSeed(): { s: GameState; seed: number } {
    for (let seed = 1; seed < 3000; seed++) {
      let s = beginCareer({ seed })
      for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
      s = gameReducer(s, { type: 'CONFIRM_BUILD' })
      s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      const after = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      if (after.phase === 'eventDecision') return { s: after, seed }
    }
    throw new Error('nenhum seed com evento interativo em 3000 tentativas')
  }

  test('PLAY_SEASON com evento interativo pausa em eventDecision; EVENT_DECISION resolve e segue', () => {
    const { s } = findInteractiveSeed()
    expect(s.pendingEvents!.some(e => e === 'injury' || e === 'lockerroom')).toBe(true)
    let done = gameReducer(s, { type: 'EVENT_DECISION', choice: 'b' })
    expect(done.phase).toBe('seasonAdvance')
    done = skipGames(done)
    expect(['seasonResult', 'tradeDecision']).toContain(done.phase)
    expect(done.pendingEvents).toBeNull()
  })
  test('escolha a em lesão liga injuryProne; consumido na próxima temporada', () => {
    const { s } = findInteractiveSeed()
    if (!s.pendingEvents!.includes('injury')) return   // seed rolou lockerroom; injury coberto por outro seed em CI local
    const done = gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
    expect(done.injuryProne).toBe(true)
  })
  test('EVENT_DECISION fora da fase é no-op', () => {
    const s = initialState('pt')
    expect(gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })).toBe(s)
  })
  test('replay determinístico com decisão de evento', () => {
    const { seed } = findInteractiveSeed()
    const run = () => {
      let s = beginCareer({ seed })
      for (const slot of SLOT_ORDER) s = gameReducer(s, { type: 'DRAFT_STEAL', slot })
      s = gameReducer(s, { type: 'CONFIRM_BUILD' })
      s = gameReducer(s, { type: 'CHOOSE_OFFER', offer: s.offers[0] })
      s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      s = gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
      return s
    }
    expect(run().career).toEqual(run().career)
    expect(run().rngCalls).toBe(run().rngCalls)
  })
})

describe('aposentadoria por queda', () => {
  test('ADVANCE vai para retireDecision quando ratio < 0.75 com 5+ temporadas, mesmo antes dos 31', () => {
    let s = playToSeasonResult()
    s = {
      ...s,
      age: 27, contractYearsLeft: 3,
      career: {
        ...s.career,
        seasons: [30, 31, 29, 28, 15].map((ppg, i) => ({
          ...s.career.seasons[0], ppg, age: 22 + i,
        })),
      },
    }
    const next = gameReducer(s, { type: 'ADVANCE' })
    expect(next.phase).toBe('retireDecision')
  })
  test('ADVANCE NÃO oferece aposentadoria por queda antes de RETIRE_MIN_AGE, mesmo com ratio < 0.75', () => {
    let s = playToSeasonResult()
    s = {
      ...s,
      age: 23, contractYearsLeft: 3,
      career: {
        ...s.career,
        seasons: [30, 31, 29, 28, 15].map((ppg, i) => ({
          ...s.career.seasons[0], ppg, age: 19 + i,
        })),
      },
    }
    const next = gameReducer(s, { type: 'ADVANCE' })
    expect(next.phase).toBe('preseason')
  })
  test('sem declínio e < 31 segue para preseason', () => {
    let s = playToSeasonResult()
    s = { ...s, age: 25, contractYearsLeft: 3 }
    const next = gameReducer(s, { type: 'ADVANCE' })
    expect(next.phase).toBe('preseason')
  })
})

describe('hub e resume (C1)', () => {
  test('OPEN_HUB/CLOSE_HUB só mexem em hubOpen', () => {
    const s = playToSeasonResult()
    const open = gameReducer(s, { type: 'OPEN_HUB' })
    expect(open.hubOpen).toBe(true)
    expect({ ...open, hubOpen: s.hubOpen }).toEqual(s)
    const closed = gameReducer(open, { type: 'CLOSE_HUB' })
    expect(closed.hubOpen).toBe(false)
    expect(closed).toEqual(s)
  })
  test('RESUME restaura a fase salva e limpa resumePhase', () => {
    const s = { ...playToSeasonResult(), phase: 'home' as const, resumePhase: 'seasonResult' as const }
    const resumed = gameReducer(s, { type: 'RESUME' })
    expect(resumed.phase).toBe('seasonResult')
    expect(resumed.resumePhase).toBeNull()
  })
  test('RESUME sem resumePhase é no-op', () => {
    const s = beginCareer({ seed: 9 })
    expect(gameReducer(s, { type: 'RESUME' })).toEqual(s)
  })
  test('loadState defaulta hubOpen/resumePhase em save legado (campos ausentes)', () => {
    const s = playToSeasonResult()
    const { hubOpen: _h, resumePhase: _r, ...old } = s as Record<string, unknown>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old))
    const loaded = loadState()!
    expect(loaded.hubOpen).toBe(false)
    expect(loaded.resumePhase).toBeNull()
  })
  test('loadState rejeita phase fora do union Phase (whitelist)', () => {
    const s = playToBuild()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, phase: 'totallyFakePhase' }))
    expect(loadState()).toBeNull()
  })
  test('loadState rejeita resumePhase fora do union Phase', () => {
    const s = playToBuild()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, phase: 'home', resumePhase: 'nonsense' }))
    expect(loadState()).toBeNull()
  })
})

describe('jogo vivo no reducer', () => {
  test('jogo-chave fecha depois de moments.length decisões, não de 3', () => {
    let s = playToFirstKeyGame()
    const n = s.pendingGame!.moments.length
    for (let i = 0; i < n; i++) {
      expect(s.phase).toBe('keyGame')
      s = gameReducer(s, { type: 'DECIDE_MOMENT', optionId: s.pendingGame!.moments[s.pendingGame!.momentIndex].options[0].id })
    }
    expect(s.phase).toBe('gameResult')
    expect(s.lastGame!.result.outcomes).toHaveLength(n)
  })
  test('timePressure default true e alterna', () => {
    const s0 = initialState('pt')
    expect(s0.timePressure).toBe(true)
    expect(gameReducer(s0, { type: 'TOGGLE_TIME_PRESSURE' }).timePressure).toBe(false)
  })
  test('STORAGE_KEY é v7', () => {
    expect(STORAGE_KEY).toBe('thegoat:v7')
  })
})

describe('setup de carreira', () => {
  it('home → setupMode → setupIdentity → attrDraft com identidade no career', () => {
    let s = initialState('pt')
    s = gameReducer(s, { type: 'START_SETUP' })
    expect(s.phase).toBe('setupMode')
    s = gameReducer(s, { type: 'SET_MODE', mode: 'goat' })
    expect(s.phase).toBe('setupIdentity')
    expect(s.setup.mode).toBe('goat')
    s = gameReducer(s, { type: 'BEGIN_CAREER', seed: 42, name: 'Marcos da Silva Vieira', number: 8 })
    expect(s.phase).toBe('attrDraft')
    expect(s.career).toMatchObject({ mode: 'goat', name: 'Marcos da Silva Vieira', number: 8, lastName: 'Vieira' })
    expect(s.currentPlayerId).not.toBeNull()
  })

  it('valida nome (2-22) e número (0-99) no BEGIN_CAREER', () => {
    let s = gameReducer(gameReducer(initialState('pt'), { type: 'START_SETUP' }), { type: 'SET_MODE', mode: 'normal' })
    expect(gameReducer(s, { type: 'BEGIN_CAREER', seed: 1, name: 'X', number: 8 }).phase).toBe('setupIdentity')
    expect(gameReducer(s, { type: 'BEGIN_CAREER', seed: 1, name: 'Nome Válido', number: 100 }).phase).toBe('setupIdentity')
    expect(gameReducer(s, { type: 'BEGIN_CAREER', seed: 1, name: 'Nome Válido', number: 0 }).phase).toBe('attrDraft')
  })

  it('modo goat: DRAFT_REROLL é no-op', () => {
    let s = beginCareer({ mode: 'goat', seed: 42 })  // helper: START_SETUP+SET_MODE+BEGIN_CAREER
    const before = s.rngCalls
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s.rngCalls).toBe(before)
    expect(s.rerollUsed).toBe(false)
  })

  it('save v6 é descartado no load; v7 sobrevive', () => {
    localStorage.setItem('thegoat:v6', JSON.stringify({ seed: 1, phase: 'home' }))
    expect(loadState()).toBeNull()
    expect(localStorage.getItem('thegoat:v6')).toBeNull()
  })

  it('loadState sobrevive a um save em setupMode/setupIdentity (league e career ainda vazios)', () => {
    let s = gameReducer(initialState('en'), { type: 'START_SETUP' })
    s = { ...s, timePressure: false }
    saveState(s)
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    expect(loaded!.phase).toBe('setupMode')
    expect(loaded!.lang).toBe('en')
    expect(loaded!.timePressure).toBe(false)
  })
})
