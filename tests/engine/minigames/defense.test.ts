import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { contest, createDuel, inFront, resultOf, slide, step, trySteal, type DuelInput, type DuelState } from '../../../src/engine/minigames/defense'
import { attrMods } from '../../../src/engine/minigames/common'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number): Build => ({ attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>, picks: [], archetype: 'SF', overall: ovr })
const input = (over: Partial<DuelInput> = {}): DuelInput => ({
  tend: { shoot: 0.4, drive: 0.35, pass: 0.25, side: 'right' }, difficulty: 1, mods: attrMods(build(80), 27), starOvr: 85, ...over,
})
const run = (s: DuelState, secs: number, rng = createRng(1), inp = input()) => { for (let i = 0; i < secs * 20; i++) { if (s.phase !== 'live') break; s = step(s, 0.05, rng, inp) } return s }

describe('duelo', () => {
  test('determinístico por seed', () => {
    const a = run(createDuel(input()), 8, createRng(5)), b = run(createDuel(input()), 8, createRng(5))
    expect(a).toEqual(b)
  })
  test('termina sempre (arremesso, infiltração, passe ou relógio) em ≤ 9.5s, com resultado mg* — relógio deixa o arremesso em andamento terminar', () => {
    for (let seed = 0; seed < 100; seed++) {
      const s = run(createDuel(input()), 12, createRng(seed))
      expect(s.phase).not.toBe('live')
      expect(s.result?.optionId).toMatch(/^mg(Lock|Contest|Steal)$/)
      expect(s.result!.quality).toBeGreaterThanOrEqual(0); expect(s.result!.quality).toBeLessThanOrEqual(1)
      expect(s.t).toBeLessThanOrEqual(9.5)
    }
  })
  test('shooter arremessa mais que playmaker, que passa mais', () => {
    const count = (tend: DuelInput['tend']) => { let shots = 0, passes = 0; for (let seed = 0; seed < 80; seed++) { const s = run(createDuel(input({ tend })), 12, createRng(seed), input({ tend })); if (s.phase === 'shot') shots++; if (s.log.at(-1) === 'pass') passes++ } return { shots, passes } }
    const sh = count({ shoot: 0.6, drive: 0.2, pass: 0.2, side: 'left' }), pm = count({ shoot: 0.3, drive: 0.25, pass: 0.45, side: 'left' })
    expect(sh.shots).toBeGreaterThan(pm.shots); expect(pm.passes).toBeGreaterThan(sh.passes)
  })
  test('sombrear certo mantém contenção alta; parado, a cruzada tira você da frente', () => {
    // tend.drive alto + seed 0: produz cruzadas/infiltrações logo cedo (log: crossL, hesi,
    // crossL, crossL, legs, driveR) — a política passiva sai do cone e nunca mais volta,
    // a ativa sempre desliza de volta pro cone no tick seguinte.
    const inp = input({ tend: { drive: 0.6, shoot: 0.2, pass: 0.2, side: 'right' } })
    let s = createDuel(inp); const rng = createRng(0)
    // política: a cada tick, deslize pro lado do atacante se saiu do cone
    for (let i = 0; i < 160 && s.phase === 'live'; i++) { if (!inFront(s)) s = slide(s, s.attX > s.defX ? 1 : -1, inp); s = step(s, 0.05, rng, inp) }
    const active = s.contain / s.live
    let p = createDuel(inp); const rng2 = createRng(0)
    for (let i = 0; i < 160 && p.phase === 'live'; i++) p = step(p, 0.05, rng2, inp)
    expect(active).toBeGreaterThan(p.contain / p.live)
    expect(active).toBeGreaterThan(0.6)
  })
  test('roubo com a bola exposta = chance por stealP (mgSteal quality 1); sem exposição = erro; 2ª errada = falta', () => {
    const inp = input()
    let stole = false
    for (let seed = 0; seed < 40 && !stole; seed++) {
      let s = createDuel(inp); const rng = createRng(seed)
      for (let i = 0; i < 400 && s.phase === 'live'; i++) {
        if (s.exposed > 0 && s.stealTries === 0) { s = trySteal(s, rng, inp); if (s.phase === 'steal') { stole = true; break } }
        s = step(s, 0.05, rng, inp)
      }
      if (stole) expect(resultOf(s)).toEqual({ optionId: 'mgSteal', quality: 1 })
    }
    expect(stole).toBe(true)
    let f = createDuel(inp); const rng3 = createRng(12)
    f = trySteal(f, rng3, inp); expect(f.stealTries).toBe(1); expect(f.phase).toBe('live')
    f = trySteal(f, rng3, inp); expect(f.phase).toBe('foul'); expect(f.freeThrows).toHaveLength(2)
    const r = resultOf(f); expect(r.optionId).toBe('mgLock'); expect(r.quality).toBeCloseTo(0.35, 5)
    expect(r.turnover).toBe(f.freeThrows![0] && f.freeThrows![1])
  })
  test('exposição legível: entre as pernas 0.7s, cruzada 0.4s', () => {
    const inp = input({ tend: { shoot: 0, drive: 0, pass: 0, side: 'left' } })
    const seen = { legs: 0, cross: 0 }
    for (let seed = 0; seed < 30; seed++) {
      let s = createDuel(inp); const rng = createRng(seed)
      for (let i = 0; i < 200 && s.phase === 'live'; i++) {
        const before = s.move
        s = step(s, 0.05, rng, inp)
        // o decaimento (−dt) roda ANTES do sorteio do movimento no mesmo tick: exposed sai exato
        if (!before && s.move?.kind === 'legs') { expect(s.exposed).toBeCloseTo(0.7, 5); seen.legs++ }
        if (!before && (s.move?.kind === 'crossL' || s.move?.kind === 'crossR')) { expect(s.exposed).toBeCloseTo(0.4, 5); seen.cross++ }
      }
    }
    expect(seen.legs).toBeGreaterThan(0); expect(seen.cross).toBeGreaterThan(0)
  })
  test('contestar (postura armada): ele sobe pra valer = toco por blockP ou mão em cima; ele finta = caiu na finta; decai a zero após 1.2s sem re-armar', () => {
    const inp = input({ tend: { shoot: 1, drive: 0, pass: 0, side: 'left' } })
    let blocked = 0, bit = 0, handsUp = 0
    for (let seed = 0; seed < 60; seed++) {
      let s = createDuel(inp); const rng = createRng(seed)
      for (let i = 0; i < 400 && s.phase === 'live'; i++) {
        if (s.armed === 0 && s.airborne === 0) s = contest(s)
        s = step(s, 0.05, rng, inp)
      }
      if (s.phase === 'block') { blocked++; expect(resultOf(s)).toEqual({ optionId: 'mgContest', quality: 1 }) }
      if (s.bitFake) bit++
      if (s.phase === 'shot' && s.contestDist !== null && s.contestDist < 0.8) handsUp++
    }
    expect(blocked).toBeGreaterThan(0); expect(bit).toBeGreaterThan(0); expect(handsUp).toBeGreaterThan(0)
    // toggle e decaimento: arma (>0), desarma no toggle (0), re-arma e decai sozinho a 0 em 1.2s sem re-armar
    let a = createDuel(inp); a = contest(a); expect(a.armed).toBeGreaterThan(0); a = contest(a); expect(a.armed).toBe(0)
    a = contest(a); expect(a.armed).toBeGreaterThan(0)
    const rng = createRng(3)
    for (let i = 0; i < 26 && a.phase === 'live'; i++) a = step(a, 0.05, rng, inp)   // ≥ 1.3s de ticks, sem re-armar
    expect(a.armed).toBe(0)
  })
  test('CONTESTAR armado no meio do movimento sobrevive até o próximo movimento dele (sem janela de 50ms no fim do movimento)', () => {
    const inp = input({ tend: { shoot: 1, drive: 0, pass: 0, side: 'left' } })
    let hit = false
    for (let seed = 0; seed < 60 && !hit; seed++) {
      let s = createDuel(inp); const rng = createRng(seed)
      while (s.phase === 'live' && s.move === null) s = step(s, 0.05, rng, inp)
      if (s.phase !== 'live') continue
      s = contest(s)                                       // arma UMA vez, no meio do 1º movimento — sem re-armar depois
      for (let i = 0; i < 400 && s.phase === 'live'; i++) {
        s = step(s, 0.05, rng, inp)
        if (s.phase === 'block' || s.bitFake) { hit = true; break }
      }
    }
    expect(hit).toBe(true)
  })
  test('finta com você armado: falta ~30% das vezes, senão só bitFake', () => {
    const inp = input({ tend: { shoot: 1, drive: 0, pass: 0, side: 'left' } })
    let fouled = false, notFouled = false
    for (let seed = 0; seed < 60; seed++) {
      let s = contest(createDuel(inp)); const rng = createRng(seed)
      for (let i = 0; i < 400 && s.phase === 'live' && !s.bitFake; i++) { if (!s.armed && s.airborne === 0) s = contest(s); s = step(s, 0.05, rng, inp) }
      if (!s.bitFake) continue
      if (s.phase === 'foul') { fouled = true; expect(s.fouled).toBe(true); expect(s.freeThrows).toHaveLength(2) }
      else { notFouled = true; expect(s.airborne).toBeGreaterThan(0) }
    }
    expect(fouled).toBe(true); expect(notFouled).toBe(true)
  })
  test('quality do arremesso contestado > não contestado', () => {
    const inp = input({ tend: { shoot: 1, drive: 0, pass: 0, side: 'left' } })
    const near = { ...createDuel(inp), phase: 'shot' as const, contain: 6, live: 8, contestDist: 0.3 }
    const far = { ...near, contestDist: 1.6 }
    expect(resultOf(near).quality).toBeGreaterThan(resultOf(far).quality)
    expect(resultOf(near).optionId).toBe('mgContest'); expect(resultOf(far).optionId).toBe('mgLock')
  })
  test('difficulty maior = movimentos mais curtos', () => {
    const slow = run(createDuel(input()), 2, createRng(2), input({ difficulty: 0.9 })), fast = run(createDuel(input()), 2, createRng(2), input({ difficulty: 1.3 }))
    expect(fast.log.length).toBeGreaterThanOrEqual(slow.log.length)
  })
})
