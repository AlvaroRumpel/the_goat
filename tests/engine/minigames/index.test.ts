import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { makeMoments, resolveMoment, SKILL_W, minigameOption, MINIGAME_OPTION_IDS } from '../../../src/engine/moments'
import { minigameFor, minigameSeed } from '../../../src/engine/minigames'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number): Build => ({
  attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})

function counted(seed: number) {
  const inner = createRng(seed)
  let n = 0
  const rng = {
    next: () => { n++; return inner.next() },
    int: (a: number, b: number) => a + Math.floor((n++, inner.next()) * (b - a + 1)),
    pick: <T,>(arr: T[]) => arr[Math.floor((n++, inner.next()) * arr.length)],
    chance: (p: number) => (n++, inner.next()) < p,
  }
  return { rng, calls: () => n }
}

describe('minigameFor', () => {
  test('clutch = arremesso; opção defensiva = muralha; resto = quadro (200 jogos)', () => {
    let shot = 0, def = 0, pb = 0
    for (let s = 0; s < 200; s++) {
      const ms = makeMoments({ kind: s % 2 ? 'finals' : 'rivalry', opponentTeamId: 'bos' }, createRng(s))
      for (const m of ms) {
        const k = minigameFor(m)
        if (m.id === 'clutch') { expect(k).toBe('shot'); shot++ }
        else if (m.options.some(o => o.attr === 'defense')) { expect(k).toBe('defense'); def++ }
        else { expect(k).toBe('playbook'); pb++ }
      }
    }
    expect(shot).toBeGreaterThan(0); expect(def).toBeGreaterThan(0); expect(pb).toBeGreaterThan(0)
  })
})

describe('minigameSeed', () => {
  test('determinístico, muda com rngCalls e com seed', () => {
    expect(minigameSeed(7, 100)).toBe(minigameSeed(7, 100))
    expect(minigameSeed(7, 100)).not.toBe(minigameSeed(7, 103))
    expect(minigameSeed(7, 100)).not.toBe(minigameSeed(8, 100))
  })
})

describe('resolveMoment com exec (execução do minigame)', () => {
  const opt = minigameOption('mgThree')!
  test('catálogo mg* tem 8 ids e cada um resolve', () => {
    expect(MINIGAME_OPTION_IDS).toHaveLength(8)
    for (const id of MINIGAME_OPTION_IDS) expect(minigameOption(id)?.id).toBe(id)
    expect(minigameOption('nope')).toBeUndefined()
  })
  test('sempre 2 calls, com ou sem exec, com ou sem turnover', () => {
    for (const exec of [undefined, { quality: 1 }, { quality: 0, turnover: true }]) {
      const c = counted(3)
      resolveMoment(build(80), 27, opt, 1, c.rng, exec)
      expect(c.calls()).toBe(2)
    }
  })
  test('sem exec = resultado byte a byte igual ao de antes (mesma seed)', () => {
    for (let s = 0; s < 50; s++) {
      const a = resolveMoment(build(80), 27, opt, 1, createRng(s))
      const b = resolveMoment(build(80), 27, opt, 1, createRng(s), undefined)
      expect(a).toEqual(b)
    }
  })
  test('quality 1 acerta mais que 0.5 que acerta mais que 0 (≈ ±SKILL_W/2)', () => {
    const N = 4000
    const rate = (q: number) => {
      let hit = 0
      for (let s = 0; s < N; s++) if (resolveMoment(build(80), 27, opt, 1, createRng(s), { quality: q }).success) hit++
      return hit / N
    }
    const r1 = rate(1), r5 = rate(0.5), r0 = rate(0)
    expect(r1).toBeGreaterThan(r5 + 0.15)
    expect(r5).toBeGreaterThan(r0 + 0.15)
    expect(Math.abs((r1 - r0) - SKILL_W)).toBeLessThan(0.06)
  })
  test('turnover força erro mesmo com quality 1', () => {
    for (let s = 0; s < 200; s++) {
      expect(resolveMoment(build(99), 27, opt, 1, createRng(s), { quality: 1, turnover: true }).success).toBe(false)
    }
  })
  test('probabilidade clampa em [0.05, 0.95]', () => {
    let hi = 0, lo = 0
    for (let s = 0; s < 4000; s++) {
      if (resolveMoment(build(99), 27, minigameOption('mgMid')!, 1, createRng(s), { quality: 1 }).success) hi++
      if (resolveMoment(build(40), 40, minigameOption('mgDunk')!, 1, createRng(s), { quality: 0 }).success) lo++
    }
    expect(hi / 4000).toBeLessThan(0.97)
    expect(lo / 4000).toBeGreaterThan(0.03)
  })
})
