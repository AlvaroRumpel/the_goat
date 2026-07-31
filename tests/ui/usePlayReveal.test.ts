import { describe, expect, test } from 'vitest'
import { visibleCount } from '../../src/ui/hooks/usePlayReveal'

describe('visibleCount', () => {
  test('relógio antes de toda linha revela zero', () => {
    expect(visibleCount([3, 6, 24.8], 1)).toBe(0)
  })
  test('revela as linhas que o relógio já passou', () => {
    expect(visibleCount([3, 6, 24.8, 43.6], 10)).toBe(2)
  })
  test('linha exatamente no minuto atual é visível', () => {
    expect(visibleCount([3, 6, 10], 10)).toBe(3)
  })
  test('relógio no fim revela tudo', () => {
    expect(visibleCount([3, 6, 24.8, 43.6], 48)).toBe(4)
  })
})
