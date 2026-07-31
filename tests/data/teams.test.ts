import { describe, expect, test, it } from 'vitest'
import { TEAMS, teamById } from '../../src/data/teams'
import { MOTIFS } from '../../src/ui/components/Crest'

describe('TEAMS integrity', () => {
  test('30 teams, unique ids', () => {
    expect(TEAMS).toHaveLength(30)
    expect(new Set(TEAMS.map(t => t.id)).size).toBe(30)
  })
  test('strengths within 55..85', () => {
    for (const t of TEAMS) {
      expect(t.strength).toBeGreaterThanOrEqual(55)
      expect(t.strength).toBeLessThanOrEqual(85)
    }
  })
  test('has strong, weak and big-market teams', () => {
    expect(TEAMS.some(t => t.strength >= 78)).toBe(true)
    expect(TEAMS.some(t => t.strength <= 62)).toBe(true)
    expect(TEAMS.filter(t => t.bigMarket).length).toBeGreaterThanOrEqual(4)
  })
  test('teamById works and throws on unknown', () => {
    expect(teamById('lal').name).toBe('Lakers')
    expect(() => teamById('nope')).toThrow()
  })
})

describe('brasões', () => {
  it('todo time tem motivo e todo motivo do mapa é usado (30/30)', () => {
    const used = new Set(TEAMS.map(t => t.motif))
    expect(TEAMS).toHaveLength(30)
    for (const t of TEAMS) expect(MOTIFS[t.motif], `motivo de ${t.id}`).toBeTruthy()
    expect(used.size).toBe(30) // nenhum motivo repetido
    expect(Object.keys(MOTIFS)).toHaveLength(30)
  })
})
