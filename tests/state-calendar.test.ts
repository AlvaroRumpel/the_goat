import { describe, expect, test } from 'vitest'
import { gameReducer, initialState } from '../src/state'
import type { Action, GameState } from '../src/state'
import { makeOffers } from '../src/engine/offers'
import { createRng } from '../src/engine/rng'
import { initLeague } from '../src/data/league'
import { SLOT_ORDER, type Build, type Rng, type SeasonResult, type SlotId } from '../src/engine/types'
import { DEADLINE_GAME, simStretch } from '../src/engine/schedule'

// Nota: os testes abaixo são ancorados na seed 42 e conferem o registro literal do
// walk (soma de trechos + key games) byte a byte. Isso é uma trava de SNAPSHOT
// (depende da ordem/contagem exata de chamadas de rng), não uma trava de
// COMPORTAMENTO — se um teste aqui quebrar depois de uma mudança em qualquer engine
// upstream (schedule/moments/season), o primeiro suspeito é drift de ordem de rng,
// não necessariamente uma regressão real. Ver HANDOFF.md § Débitos.

function flatBuild(overall: number): Build {
  const attrs = Object.fromEntries(SLOT_ORDER.map(s => [s, overall])) as Record<SlotId, number>
  return { attributes: attrs, picks: [], archetype: 'SF', overall }
}
function countedRng(seed: number): { rng: Rng; calls: () => number } {
  const inner = createRng(seed)
  let n = 0
  const next = () => { n++; return inner.next() }
  return {
    rng: { next, int: (a, b) => a + Math.floor(next() * (b - a + 1)), pick: arr => arr[Math.floor(next() * arr.length)], chance: p => next() < p },
    calls: () => n,
  }
}
function startState(seed: number): GameState {
  const { rng, calls } = countedRng(seed)
  const offers = makeOffers(rng)
  return {
    ...initialState(), seed, rngCalls: calls(), build: flatBuild(88), league: initLeague(),
    age: 25, offers, currentOffer: offers[0], contractYearsLeft: 4, phase: 'preseason',
    career: { seasons: [], fame: 0 },
  }
}
function step(s: GameState, a: Action): GameState { return gameReducer(s, a) }

// mesma reconstrução de makeCountedRng em state.ts: recria o rng do seed e avança (skip)
// calls — usado para replicar, no teste, exatamente o que advanceCalendar consumiria a
// seguir a partir de um snapshot pausado.
function rngAt(seed: number, skip: number): Rng {
  const rng = createRng(seed)
  for (let i = 0; i < skip; i++) rng.next()
  return rng
}

// SeasonResult mínimo válido — usado para forçar career.seasons.length >= 2 (canTrade)
function fakeSeason(): SeasonResult {
  return {
    age: 23, teamId: 'okc', finalTeamId: 'okc', games: 78, ppg: 18, rpg: 5, apg: 5,
    events: [], choices: [], madePlayoffs: false, wonTitle: false, awards: [], seed: null,
    playoffRun: 'missed', iconicMoments: [], chokes: 0,
  }
}

// atravessa a temporada regular decidindo tudo pelo caminho seguro
function runRegular(s: GameState, onPhase?: (s: GameState) => void): GameState {
  let guard = 0
  while (s.phase !== 'playoffGame' && s.phase !== 'seasonResult' && guard++ < 100) {
    onPhase?.(s)
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    else if (s.phase === 'tradeDecision') s = step(s, { type: 'TRADE_DECISION', accept: false })
    else if (s.phase === 'seasonAdvance') s = step(s, { type: 'TAKE_NEXT_GAME' })
    else if (s.phase === 'keyGame') s = step(s, { type: 'SKIP_GAME' })
    else if (s.phase === 'gameResult') s = step(s, { type: 'CONTINUE' })
    else break
  }
  return s
}

describe('temporada regular no calendário', () => {
  test('PLAY_SEASON → seasonAdvance com trecho simulado até antes do 1º key game', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    expect(s.phase).toBe('seasonAdvance')
    const cal = s.calendar!
    expect(cal.slots.length).toBeGreaterThanOrEqual(3)
    expect(cal.played).toBe(cal.slots[0].gameIndex - 1)
    expect(cal.ticker).toHaveLength(cal.played)
  })

  test('keyGame → gameResult com lastGame; resultado entra literal no ticker', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    const slot = s.calendar!.slots[0]
    s = step(s, { type: 'TAKE_NEXT_GAME' })
    expect(s.phase).toBe('keyGame')
    expect(s.pendingGame!.log).toHaveLength(4)
    s = step(s, { type: 'SKIP_GAME' })
    expect(s.phase).toBe('gameResult')
    expect(s.lastGame!.skipped).toBe(true)
    const entry = s.calendar!.ticker[s.calendar!.ticker.length - 1]
    expect(entry.gameIndex).toBe(slot.gameIndex)
    expect(entry.keyGame).toBe(slot.keyGame.kind)
    expect(entry.won).toBe(s.lastGame!.result.won)
  })

  test('registro literal: wins do fim da regular = ticker wins; ticker cobre 82 jogos', () => {
    // calendar.played === 82 nunca é um estado pausado observável: o trecho final
    // (do último key game até o jogo 82) e o fechamento da temporada acontecem dentro
    // do MESMO dispatch (advanceCalendar → closeRegularSeason), sem devolver o
    // intermediário. Por isso capturamos o ÚLTIMO snapshot pausado com calendar (o
    // gameResult do último key game) e reconstruímos a cauda com o MESMO simStretch
    // exportado, a partir do mesmo (seed, rngCalls) — replay determinístico, não
    // reimplementação da lógica de controle.
    let s = startState(42)
    let lastWithCalendar: GameState | null = null
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    s = runRegular(s, cur => { if (cur.calendar) lastWithCalendar = cur })
    expect(s.phase === 'playoffGame' || s.phase === 'seasonResult').toBe(true)
    expect(s.calendar).toBeNull()
    expect(lastWithCalendar).not.toBeNull()
    const cal = lastWithCalendar!.calendar!
    // no snapshot capturado não sobra key game nem deadline pendente — só falta a
    // cauda até o jogo 82, exatamente o que advanceCalendar roda antes de fechar
    expect(cal.nextSlot).toBe(cal.slots.length)
    expect(cal.deadlineDone).toBe(true)
    const tail = simStretch({
      from: cal.played + 1, to: 82, p: cal.p, ppg: lastWithCalendar!.pendingRegular!.ppg,
      playerTeamId: lastWithCalendar!.currentOffer!.teamId,
      rng: rngAt(lastWithCalendar!.seed, lastWithCalendar!.rngCalls),
    })
    expect(cal.ticker.length + tail.length).toBe(82)
    const literalWins = cal.ticker.filter(g => g.won).length + tail.filter(g => g.won).length

    // segue até seasonResult (via playoffs, se houver) pra expor seasonOutcome.standings —
    // closeRegularSeason usa exatamente esse `wins` como playerWins do simStandings
    let guard = 0
    while (s.phase !== 'seasonResult' && guard++ < 60) {
      if (s.phase === 'gameResult') s = step(s, { type: 'CONTINUE' })
      else s = s.pendingGame ? step(s, { type: 'SKIP_GAME' }) : step(s, { type: 'SKIP_SERIES' })
    }
    expect(s.phase).toBe('seasonResult')
    const finalTeamId = s.career.seasons.at(-1)!.finalTeamId
    const row = s.seasonOutcome!.standings.find(st => st.teamId === finalTeamId)!
    expect(row.wins).toBe(literalWins)
  })

  test('deadline: com tradeOffer, pausa em tradeDecision com played = 55', () => {
    // varre seeds até achar uma temporada com tradeOffer (career precisa de 2+ temporadas
    // para canTrade; injete: career com 2 seasons falsas mínimas)
    for (let seed = 1; seed < 200; seed++) {
      let s = startState(seed)
      s.career = { seasons: [fakeSeason(), fakeSeason()], fame: 0 } // helper: SeasonResult mínimo válido
      s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      let paused: GameState | null = null
      s = runRegular(s, cur => { if (cur.phase === 'tradeDecision') paused = paused ?? cur })
      if (paused) {
        expect(paused.calendar!.played).toBe(DEADLINE_GAME)
        expect(paused.pendingRegular!.tradeOffer).not.toBeNull()
        return
      }
    }
    throw new Error('nenhuma seed gerou tradeOffer em 200 tentativas')
  })

  test('trade aceito muda o time e o segmento (p) do calendário', () => {
    for (let seed = 1; seed < 200; seed++) {
      let s = startState(seed)
      s.career = { seasons: [fakeSeason(), fakeSeason()], fame: 0 }
      s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      let guard = 0
      while (s.phase !== 'tradeDecision' && s.phase !== 'playoffGame' && s.phase !== 'seasonResult' && guard++ < 100) {
        if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
        else if (s.phase === 'seasonAdvance') s = step(s, { type: 'TAKE_NEXT_GAME' })
        else if (s.phase === 'keyGame') s = step(s, { type: 'SKIP_GAME' })
        else if (s.phase === 'gameResult') s = step(s, { type: 'CONTINUE' })
        else break
      }
      if (s.phase !== 'tradeDecision') continue
      const before = s.currentOffer!.teamId
      const offered = s.pendingRegular!.tradeOffer!.teamId
      s = step(s, { type: 'TRADE_DECISION', accept: true })
      expect(s.currentOffer!.teamId).toBe(offered)
      expect(s.currentOffer!.teamId).not.toBe(before)
      expect(s.contractYearsLeft).toBe(4)
      return
    }
    throw new Error('nenhuma seed gerou tradeOffer em 200 tentativas')
  })

  test('replay: save no meio de seasonAdvance/gameResult reproduz o estado', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    s = step(s, { type: 'TAKE_NEXT_GAME' })
    s = step(s, { type: 'SKIP_GAME' })
    // continuar do snapshot (mesma seed + rngCalls) tem de dar o mesmo resultado
    const a = step(s, { type: 'CONTINUE' })
    const b = step(structuredClone(s), { type: 'CONTINUE' })
    expect(b.calendar).toEqual(a.calendar)
    expect(b.rngCalls).toBe(a.rngCalls)
  })

  // structuredClone é mais fiel que o storage real — round-trip via JSON.stringify/parse
  // (o que o localStorage de fato faz) precisa dar o mesmo replay nas duas pausas novas.
  test('round-trip JSON (localStorage real) na pausa de seasonAdvance reproduz o estado', () => {
    let s = startState(44)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    expect(s.phase).toBe('seasonAdvance')
    const revived = JSON.parse(JSON.stringify(s)) as GameState
    expect(revived).toEqual(s)
    const a = step(s, { type: 'TAKE_NEXT_GAME' })
    const b = step(revived, { type: 'TAKE_NEXT_GAME' })
    expect(b).toEqual(a)
  })

  test('round-trip JSON (localStorage real) na pausa de gameResult reproduz o estado', () => {
    let s = startState(44)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    s = step(s, { type: 'TAKE_NEXT_GAME' })
    s = step(s, { type: 'SKIP_GAME' })
    expect(s.phase).toBe('gameResult')
    const revived = JSON.parse(JSON.stringify(s)) as GameState
    expect(revived).toEqual(s)
    const a = step(s, { type: 'CONTINUE' })
    const b = step(revived, { type: 'CONTINUE' })
    expect(b).toEqual(a)
  })
})

describe('RUN_TO_PLAYOFFS', () => {
  test('fecha a regular sem passar por keyGame/gameResult; key games contam no registro', () => {
    let s = startState(42)
    s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
    expect(s.phase).toBe('seasonAdvance')
    const totalSlots = s.calendar!.slots.length
    s = step(s, { type: 'RUN_TO_PLAYOFFS' })
    // pode pausar no deadline; resolve e segue
    if (s.phase === 'tradeDecision') s = step(s, { type: 'TRADE_DECISION', accept: false })
    expect(s.phase === 'playoffGame' || s.phase === 'seasonResult').toBe(true)
    expect(s.keyGameResults).toHaveLength(totalSlots)
  })

  test('autoRun sobrevive à pausa do deadline', () => {
    for (let seed = 1; seed < 300; seed++) {
      let s = startState(seed)
      s.career = { seasons: [fakeSeason(), fakeSeason()], fame: 0 }
      s = step(s, { type: 'PLAY_SEASON', focus: 'scoring' })
      if (s.phase === 'eventDecision') s = step(s, { type: 'EVENT_DECISION', choice: 'b' })
      if (s.phase !== 'seasonAdvance') continue
      s = step(s, { type: 'RUN_TO_PLAYOFFS' })
      if (s.phase !== 'tradeDecision') continue      // seed sem tradeOffer — tenta outra
      expect(s.calendar!.autoRun).toBe(true)
      s = step(s, { type: 'TRADE_DECISION', accept: true })
      // depois do trade o autoRun continua até o fim — sem parar em seasonAdvance
      expect(s.phase === 'playoffGame' || s.phase === 'seasonResult').toBe(true)
      return
    }
    throw new Error('nenhuma seed pausou o autoRun no deadline em 300 tentativas')
  })
})
