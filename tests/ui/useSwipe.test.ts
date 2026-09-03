import { describe, expect, test } from 'vitest'
import { classifySwipe } from '../../src/ui/minigames/useSwipe'
describe('classifySwipe', () => {
  test('tap curto e parado', () => { expect(classifySwipe(3, -4, 120)).toBe('tap') })
  test('esquerda/direita pelo eixo dominante', () => { expect(classifySwipe(-40, 5, 200)).toBe('left'); expect(classifySwipe(60, -20, 200)).toBe('right') })
  test('cima', () => { expect(classifySwipe(4, -50, 200)).toBe('up') })
  test('baixo ou pequeno lento = null', () => { expect(classifySwipe(0, 50, 200)).toBeNull(); expect(classifySwipe(5, 5, 800)).toBeNull() })
})
