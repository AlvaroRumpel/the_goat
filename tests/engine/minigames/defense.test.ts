import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { createDuel, inFront, jump, resultOf, slide, step, trySteal, type DuelInput, type DuelState } from '../../../src/engine/minigames/defense'
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
  test('termina sempre (arremesso, infiltração, passe ou relógio) em ≤ 9s, com resultado mg*', () => {
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
    let s = createDuel(input()); const rng = createRng(3)
    // política: a cada tick, deslize pro lado do atacante se saiu do cone
    for (let i = 0; i < 160 && s.phase === 'live'; i++) { if (!inFront(s)) s = slide(s, s.attX > s.defX ? 1 : -1, input()); s = step(s, 0.05, rng, input()) }
    const active = s.contain / s.live
    let p = createDuel(input()); const rng2 = createRng(3)
    for (let i = 0; i < 160 && p.phase === 'live'; i++) p = step(p, 0.05, rng2, input())
    expect(active).toBeGreaterThanOrEqual(p.contain / p.live)
    expect(active).toBeGreaterThan(0.6)
  })
  test('roubo dentro da janela da bola exposta = mgSteal quality 1; fora = passa por você; 2ª errada = falta', () => {
    let s = createDuel(input()); const rng = createRng(11)
    let stole = false
    for (let i = 0; i < 400 && s.phase === 'live'; i++) {
      if (s.exposed > 0 && s.exposed <= input().mods.stealWindow) { s = trySteal(s, rng, input()); if (s.phase === 'steal') { stole = true; break } }
      s = step(s, 0.05, rng, input())
    }
    if (stole) expect(resultOf(s)).toEqual({ optionId: 'mgSteal', quality: 1 })
    let f = createDuel(input()); const rng3 = createRng(12)
    f = trySteal(f, rng3, input()); expect(f.stealTries).toBe(1); expect(f.phase).toBe('live')
    f = trySteal(f, rng3, input()); expect(f.phase).toBe('foul'); expect(f.freeThrows).toHaveLength(2)
    const r = resultOf(f); expect(r.optionId).toBe('mgLock'); expect(r.quality).toBeCloseTo(0.35, 5)
    expect(r.turnover).toBe(f.freeThrows![0] && f.freeThrows![1])
  })
  test('salto no arremesso real com timing = toco; salto na finta = bitFake', () => {
    const inp = input({ tend: { shoot: 1, drive: 0, pass: 0, side: 'left' } })
    let s = createDuel(inp); const rng = createRng(21)
    let blocked = false, bit = false
    for (let i = 0; i < 400 && s.phase === 'live'; i++) {
      if (s.move?.kind === 'shoot' && Math.abs(s.t - (s.move.at + 0.45)) < 0.03 && s.airborne === 0) { s = jump(s, inp) }
      if (s.move?.kind === 'pumpFake' && s.airborne === 0 && !bit) { s = jump(s, inp); bit = s.bitFake }
      s = step(s, 0.05, rng, inp)
      if (s.phase === 'block') blocked = true
    }
    expect(blocked || bit).toBe(true)
    if (blocked) expect(resultOf(s)).toEqual({ optionId: 'mgContest', quality: 1 })
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
