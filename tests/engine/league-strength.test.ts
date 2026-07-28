import { describe, expect, test } from 'vitest'
import { effectiveOverall } from '../../src/engine/season'
import { npcEffOvr, rosterStrength, teamStrength } from '../../src/engine/league'
import { initLeague } from '../../src/data/league'

describe('OVR efetivo', () => {
  test('novato 19 anos rende 78% do base', () => {
    expect(effectiveOverall(90, 19, 90)).toBe(Math.round(90 * 0.78))
  })
  test('pico 26-29 rende 100%', () => {
    expect(effectiveOverall(90, 27, 90)).toBe(90)
  })
  test('declínio pós-29', () => {
    expect(effectiveOverall(90, 35, 90)).toBeLessThan(90)
  })
  test('npc usa ovr como proxy de physical', () => {
    expect(npcEffOvr({ id: 'x', name: 'X', pos: 'C', age: 27, ovr: 88, tags: [], teamId: 'okc', rookie: false, prevPpg: null })).toBe(88)
  })
})

describe('força de time', () => {
  const league = initLeague()
  test('âncoras: OKC forte, UTA/WAS fracos, média plausível', () => {
    const okc = rosterStrength(league, 'okc')
    const uta = rosterStrength(league, 'uta')
    const was = rosterStrength(league, 'was')
    expect(okc).toBeGreaterThanOrEqual(78)
    expect(uta).toBeLessThanOrEqual(64)
    expect(was).toBeLessThanOrEqual(64)
    const teams = ['atl','bos','bkn','cha','chi','cle','dal','den','det','gsw','hou','ind','lac','lal','mem','mia','mil','min','nop','nyk','okc','orl','phi','phx','por','sac','sas','tor','uta','was']
    const avg = teams.reduce((n, id) => n + rosterStrength(league, id), 0) / 30
    expect(avg).toBeGreaterThanOrEqual(60)
    expect(avg).toBeLessThanOrEqual(76)
  })
  test('extraOvr (o jogador do usuário) sobe a força', () => {
    expect(rosterStrength(league, 'uta', 95)).toBeGreaterThan(rosterStrength(league, 'uta'))
  })
})
