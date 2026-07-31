import { describe, expect, test } from 'vitest'
import { revealTarget } from '../../src/ui/hooks/usePlayReveal'

describe('revealTarget', () => {
  test('para antes do momento pendente', () => {
    // log com ats 3, 6, 24.8, 43.6 e momento pendente em 28.8
    expect(revealTarget([3, 6, 24.8, 43.6], 28.8)).toBe(3)
  })
  test('sem momento pendente revela tudo', () => {
    expect(revealTarget([3, 6, 24.8, 43.6], null)).toBe(4)
  })
  test('momento antes de toda linha revela zero', () => {
    expect(revealTarget([10, 20], 5)).toBe(0)
  })
})
