import { describe, expect, test } from 'vitest'
import { draftPickNumber, makeOffers } from '../../src/engine/offers'
import { createRng } from '../../src/engine/rng'
import { teamById } from '../../src/data/teams'

describe('draftPickNumber', () => {
  test('strong build drafts top-5', () => {
    expect(draftPickNumber(95, createRng(1))).toBeLessThanOrEqual(5)
  })
  test('weak build drafts late', () => {
    expect(draftPickNumber(58, createRng(1))).toBeGreaterThanOrEqual(20)
  })
  test('always within 1..30', () => {
    for (let seed = 0; seed < 50; seed++) {
      const n = draftPickNumber(75, createRng(seed))
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(30)
    }
  })
})

describe('makeOffers', () => {
  test('3 offers: contender, rebuild, bigmarket; no dup teams', () => {
    const offers = makeOffers(createRng(3))
    expect(offers.map(o => o.profile).sort()).toEqual(['bigmarket', 'contender', 'rebuild'])
    expect(new Set(offers.map(o => o.teamId)).size).toBe(3)
    const c = offers.find(o => o.profile === 'contender')!
    expect(teamById(c.teamId).strength).toBeGreaterThanOrEqual(74)
    const r = offers.find(o => o.profile === 'rebuild')!
    expect(teamById(r.teamId).strength).toBeLessThanOrEqual(64)
    expect(teamById(offers.find(o => o.profile === 'bigmarket')!.teamId).bigMarket).toBe(true)
  })
  test('excludes current team', () => {
    for (let seed = 0; seed < 30; seed++)
      for (const o of makeOffers(createRng(seed), 'okc'))
        expect(o.teamId).not.toBe('okc')
  })
})
