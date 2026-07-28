import { describe, expect, test } from 'vitest'
import { t } from '../src/i18n'
import pt from '../src/data/i18n/pt.json'
import en from '../src/data/i18n/en.json'

describe('i18n', () => {
  test('pt and en have identical key sets', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort())
  })
  test('interpolates vars', () => {
    expect(t('pt', 'season.title', { year: 3 })).toContain('3')
  })
  test('missing key returns key itself', () => {
    expect(t('pt', 'nope.missing')).toBe('nope.missing')
  })
})
