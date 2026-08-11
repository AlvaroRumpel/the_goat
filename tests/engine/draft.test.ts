import { describe, expect, test } from 'vitest'
import { computeArchetype, draftAttrs, drawPlayer, malusAmount, resolveBuild, weakestSlot } from '../../src/engine/draft'
import { createRng } from '../../src/engine/rng'
import { PLAYERS, playerById } from '../../src/data/players'
import { SLOT_ORDER, type SlotId, type DraftPick } from '../../src/engine/types'

describe('computeArchetype', () => {
  const flat = Object.fromEntries(SLOT_ORDER.map(s => [s, 80])) as Record<SlotId, number>
  test('balanced build → SF', () => {
    expect(computeArchetype(flat)).toBe('SF')
  })
  test('pass+handles heavy → PG', () => {
    expect(computeArchetype({ ...flat, passing: 99, handles: 99, rebounding: 55, finishing: 55 })).toBe('PG')
  })
  test('rebound+defense heavy → C', () => {
    expect(computeArchetype({ ...flat, rebounding: 99, defense: 99, finishing: 95, passing: 50, handles: 50, three: 50 })).toBe('C')
  })
})

describe('drawPlayer', () => {
  test('não repete jogador já sorteado', () => {
    const rng = createRng(7)
    const drawn: string[] = []
    for (let i = 0; i < 30; i++) {
      const pl = drawPlayer(rng, drawn)
      expect(drawn).not.toContain(pl.id)
      drawn.push(pl.id)
    }
  })
  test('determinístico por seed', () => {
    expect(drawPlayer(createRng(3), []).id).toBe(drawPlayer(createRng(3), []).id)
  })
})

describe('malusAmount', () => {
  test('escala leve, clamp 1..5', () => {
    expect(malusAmount(99)).toBe(5)
    expect(malusAmount(95)).toBe(4)
    expect(malusAmount(93)).toBe(4)
    expect(malusAmount(83)).toBe(2)
    expect(malusAmount(77)).toBe(1)
    expect(malusAmount(50)).toBe(1)   // piso 1
  })
})

describe('weakestSlot', () => {
  test('menor atributo excluindo o roubado', () => {
    const curry = playerById('curry')   // rebounding 55 é o mais fraco
    expect(weakestSlot(curry, 'three')).toBe('rebounding')
    // roubando o próprio ponto fraco, cai no segundo mais fraco
    expect(weakestSlot(curry, 'rebounding')).not.toBe('rebounding')
  })
})

describe('resolveBuild', () => {
  test('bases + maluses na fraqueza, piso 40', () => {
    // 8 picks: um slot de cada, jogadores distintos quaisquer
    const rng = createRng(11)
    const drawn: string[] = []
    const picks: DraftPick[] = SLOT_ORDER.map(slot => {
      const pl = drawPlayer(rng, drawn)
      drawn.push(pl.id)
      return { playerId: pl.id, slot }
    })
    const build = resolveBuild(picks)
    // recomputa na mão
    const expected = {} as Record<string, number>
    for (const pk of picks) expected[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
    for (const pk of picks) {
      const pl = playerById(pk.playerId)
      const target = weakestSlot(pl, pk.slot)
      expected[target] = Math.max(40, expected[target] - malusAmount(pl.attrs[pk.slot]))
    }
    for (const s of SLOT_ORDER) expect(build.attributes[s]).toBe(expected[s])
    expect(build.picks).toEqual(picks)
    expect(build.overall).toBeGreaterThan(0)
  })
})

describe('draftAttrs', () => {
  test('slot roubado entra em owned com o valor do doador', () => {
    const picks: DraftPick[] = [{ playerId: 'curry', slot: 'three' }]
    const { owned } = draftAttrs(picks)
    expect(owned.three).toBe(playerById('curry').attrs.three)
  })

  test('malus de um pick cai como pending no slot ainda vazio', () => {
    const picks: DraftPick[] = [{ playerId: 'curry', slot: 'three' }]
    const curry = playerById('curry')
    const target = weakestSlot(curry, 'three')
    const { owned, pending } = draftAttrs(picks)
    expect(owned[target]).toBeUndefined()
    expect(pending[target]).toBe(malusAmount(curry.attrs.three))
  })

  test('malus direcionado a slot já roubado é descontado em owned, não em pending', () => {
    const curry = playerById('curry')
    const target = weakestSlot(curry, 'three')
    const donor = PLAYERS.find(p => p.id !== 'curry' && weakestSlot(p, target) !== target)!
    const picks: DraftPick[] = [
      { playerId: donor.id, slot: target },
      { playerId: 'curry', slot: 'three' },
    ]
    const { owned, pending } = draftAttrs(picks)
    expect(owned[target]).toBe(Math.max(40, donor.attrs[target] - malusAmount(curry.attrs.three)))
    expect(pending[target]).toBe(0)
  })

  test('owned nunca fica abaixo de 40', () => {
    const picks: DraftPick[] = []
    const weak = PLAYERS.find(p => p.attrs.three === 40)!
    picks.push({ playerId: weak.id, slot: 'three' })
    for (const p of PLAYERS) {
      if (picks.length >= 8) break
      if (p.id === weak.id) continue
      const free = SLOT_ORDER.filter(s => !picks.some(pk => pk.slot === s))
      const slot = free.find(s => weakestSlot(p, s) === 'three')
      if (slot) picks.push({ playerId: p.id, slot })
    }
    const { owned } = draftAttrs(picks)
    expect(owned.three).toBeGreaterThanOrEqual(40)
  })

  test('com 8 picks, owned bate com a fórmula sequencial antiga', () => {
    // referência: o loop original de resolveBuild (clamp a cada subtração)
    const reference = (picks: DraftPick[]) => {
      const attrs = {} as Record<SlotId, number>
      for (const pk of picks) attrs[pk.slot] = playerById(pk.playerId).attrs[pk.slot]
      for (const pk of picks) {
        const player = playerById(pk.playerId)
        const target = weakestSlot(player, pk.slot)
        attrs[target] = Math.max(40, attrs[target] - malusAmount(player.attrs[pk.slot]))
      }
      return attrs
    }
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed)
      const drawn: string[] = []
      const picks: DraftPick[] = []
      for (const slot of SLOT_ORDER) {
        const pl = drawPlayer(rng, drawn)
        drawn.push(pl.id)
        picks.push({ playerId: pl.id, slot })
      }
      expect(draftAttrs(picks).owned).toEqual(reference(picks))
    }
  })
})
