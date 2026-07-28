import { describe, expect, test } from 'vitest'
import { TEAMS } from '../../src/data/teams'

describe('conferências', () => {
  test('15 times por conferência', () => {
    expect(TEAMS.filter(t => t.conf === 'east')).toHaveLength(15)
    expect(TEAMS.filter(t => t.conf === 'west')).toHaveLength(15)
  })
})
