import { expect, test } from 'vitest'
import { percentileOf, shareText } from '../src/ui/share'
import type { Verdict } from '../src/engine/types'

const v: Verdict = {
  score: 1500, tier: 'goat',
  totals: { points: 30000, rebounds: 8000, assists: 7000, seasons: 18 },
  counts: { allstar: 15, mvp: 4, dpoy: 0, scoring: 2, fmvp: 3, ring: 5 },
}

test('shareText fills template', () => {
  const s = shareText('pt', v)
  expect(s).toContain('5')      // rings
  expect(s).toContain('30000')  // points
  expect(s).toContain('🐐')
})

test('percentil é monotônico e bate as faixas', () => {
  expect(percentileOf(2000)).toBe(99)
  expect(percentileOf(1500)).toBe(96)
  expect(percentileOf(100)).toBe(10)
  let prev = -1
  for (const s of [0, 200, 400, 600, 900, 1200, 1600, 2000]) {
    expect(percentileOf(s)).toBeGreaterThanOrEqual(prev); prev = percentileOf(s)
  }
})
