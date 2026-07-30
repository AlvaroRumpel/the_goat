import { describe, expect, test } from 'vitest'
import { sortStandings } from '../../src/ui/components/LeaguePanels'
import type { TeamStanding } from '../../src/engine/types'

describe('sortStandings', () => {
  test('ordena por wins desc; empate por teamId asc, determinístico', () => {
    const input: TeamStanding[] = [
      { teamId: 'lal', conf: 'west', wins: 50, seed: null },
      { teamId: 'bos', conf: 'east', wins: 55, seed: null },
      { teamId: 'den', conf: 'west', wins: 50, seed: null },
    ]
    const sorted = sortStandings(input)
    expect(sorted.map(s => s.teamId)).toEqual(['bos', 'den', 'lal'])
  })
})
