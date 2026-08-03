import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ORIGIN = 'https://thegoatgame.app'

export function readPage(file: string): string {
  return readFileSync(resolve(file), 'utf8')
}

// [pt-file, canonical-path, en-alternate-path]
const PT_PAGES: Array<[string, string, string]> = [
  ['como-jogar.html', '/como-jogar', '/en/how-to-play'],
  ['sobre.html', '/sobre', '/en/about'],
  ['privacidade.html', '/privacidade', '/en/privacy'],
]

describe('páginas estáticas PT', () => {
  it.each(PT_PAGES)('%s existe com canonical e hreflang', (file, path, enPath) => {
    expect(existsSync(resolve(file))).toBe(true)
    const html = readPage(file)
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${path}" />`)
    expect(html).toContain(`hreflang="pt-BR" href="${ORIGIN}${path}"`)
    expect(html).toContain(`hreflang="en" href="${ORIGIN}${enPath}"`)
    expect(html).toContain('lang="pt"')
    expect(html).toContain('<meta name="description"')
    expect(html).toContain('href="/"') // link de volta pro jogo
  })

  it('como-jogar tem conteúdo de verdade (>500 palavras)', () => {
    const text = readPage('como-jogar.html').replace(/<[^>]+>/g, ' ')
    expect(text.split(/\s+/).filter(Boolean).length).toBeGreaterThan(500)
  })
})

const EN_PAGES: Array<[string, string, string]> = [
  ['en/how-to-play.html', '/en/how-to-play', '/como-jogar'],
  ['en/about.html', '/en/about', '/sobre'],
  ['en/privacy.html', '/en/privacy', '/privacidade'],
]

describe('páginas estáticas EN', () => {
  it.each(EN_PAGES)('%s existe com canonical e hreflang cruzado', (file, path, ptPath) => {
    expect(existsSync(resolve(file))).toBe(true)
    const html = readPage(file)
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${path}" />`)
    expect(html).toContain(`hreflang="en" href="${ORIGIN}${path}"`)
    expect(html).toContain(`hreflang="pt-BR" href="${ORIGIN}${ptPath}"`)
    expect(html).toContain('lang="en"')
  })
})
