import { describe, expect, test } from 'vitest'
import { PLAYERS, playerById } from '../../src/data/players'
import { SLOT_ORDER } from '../../src/engine/types'

describe('PLAYERS dataset', () => {
  test('pool grande o suficiente', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(150)
  })
  test('ids únicos', () => {
    expect(new Set(PLAYERS.map(p => p.id)).size).toBe(PLAYERS.length)
  })
  test('todos os 8 atributos presentes, na faixa 40..99', () => {
    for (const p of PLAYERS) {
      for (const s of SLOT_ORDER) {
        expect(p.attrs[s], `${p.id}.${s}`).toBeGreaterThanOrEqual(40)
        expect(p.attrs[s], `${p.id}.${s}`).toBeLessThanOrEqual(99)
      }
    }
  })
  test('cada atributo tem >= 8 jogadores fortes (>=90) — draft viável em qualquer seed', () => {
    for (const s of SLOT_ORDER) {
      const strong = PLAYERS.filter(p => p.attrs[s] >= 90).length
      expect(strong, s).toBeGreaterThanOrEqual(8)
    }
  })
  test('ícones presentes', () => {
    for (const id of ['jordan', 'lebron', 'curry', 'magic', 'kareem', 'wilt', 'shaq', 'duncan'])
      expect(playerById(id).name).toBeTruthy()
  })
  test('playerById lança em id desconhecido', () => {
    expect(() => playerById('nope')).toThrow()
  })
})
