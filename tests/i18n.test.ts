import { describe, expect, test } from 'vitest'
import { t } from '../src/i18n'
import pt from '../src/data/i18n/pt.json'
import en from '../src/data/i18n/en.json'
import { SITUATIONS, SLOT_SEQUENCE, ALL_OPTION_IDS, MINIGAME_OPTION_IDS, PBP_COUNT } from '../src/engine/moments'

describe('i18n', () => {
  test('pt and en have identical key sets', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort())
  })
  test('interpolates vars', () => {
    expect(t('pt', 'season.age', { age: 3 })).toContain('3')
  })
  test('missing key returns key itself', () => {
    expect(t('pt', 'nope.missing')).toBe('nope.missing')
  })
})

describe('i18n do catálogo de momentos', () => {
  const required = [
    ...SLOT_SEQUENCE.map(s => `moment.${s}.label`),
    ...SLOT_SEQUENCE.flatMap(s => SITUATIONS[s].map((_, i) => `moment.${s}.s${i}`)),
    ...[...ALL_OPTION_IDS, ...MINIGAME_OPTION_IDS].map(id => `option.${id}`),
    ...[...ALL_OPTION_IDS, ...MINIGAME_OPTION_IDS].flatMap(id => [
      `play.${id}.hit.v0`, `play.${id}.hit.v1`, `play.${id}.miss.v0`, `play.${id}.miss.v1`,
    ]),
    ...Array.from({ length: PBP_COUNT }, (_, i) => `play.pbp.v${i}`),
    ...[0, 1, 2].flatMap(v => [`play.ambient.open.v${v}`, ...[1, 2, 3].map(q => `play.ambient.${q}.v${v}`)]),
  ]
  test.each(['pt', 'en'] as const)('%s cobre todas as chaves do catálogo', lang => {
    const dict: Record<string, string> = lang === 'pt' ? pt : en
    const missing = required.filter(k => !(k in dict))
    expect(missing).toEqual([])
  })
})
