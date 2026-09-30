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
  ['guia-draft.html', '/guia-draft', '/en/draft-guide'],
  ['guia-atributos.html', '/guia-atributos', '/en/attributes-guide'],
  ['guia-modos.html', '/guia-modos', '/en/game-modes'],
  ['guia-veredito.html', '/guia-veredito', '/en/goat-verdict'],
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
  ['en/draft-guide.html', '/en/draft-guide', '/guia-draft'],
  ['en/attributes-guide.html', '/en/attributes-guide', '/guia-atributos'],
  ['en/game-modes.html', '/en/game-modes', '/guia-modos'],
  ['en/goat-verdict.html', '/en/goat-verdict', '/guia-veredito'],
]

describe('páginas estáticas EN', () => {
  it.each(EN_PAGES)('%s existe com canonical e hreflang cruzado', (file, path, ptPath) => {
    expect(existsSync(resolve(file))).toBe(true)
    const html = readPage(file)
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${path}" />`)
    expect(html).toContain(`hreflang="en" href="${ORIGIN}${path}"`)
    expect(html).toContain(`hreflang="pt-BR" href="${ORIGIN}${ptPath}"`)
    expect(html).toContain('lang="en"')
    expect(html).toContain('<meta name="description"')
    expect(html).toContain('href="/?lang=en"') // link de volta pro jogo em EN
  })
})

describe('sitemap e robots', () => {
  const ALL_PATHS = ['/', ...PT_PAGES.map(p => p[1]), ...EN_PAGES.map(p => p[1])]

  it('sitemap.xml lista exatamente as 15 URLs canônicas', () => {
    const xml = readPage('public/sitemap.xml')
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
    expect(locs.sort()).toEqual(ALL_PATHS.map(p => ORIGIN + p).sort())
  })

  it('robots.txt libera tudo e aponta o sitemap', () => {
    const txt = readPage('public/robots.txt')
    expect(txt).toContain('Allow: /')
    expect(txt).toMatch(/^Disallow: \/lab\.html$/m)
    expect(txt).toMatch(/^Disallow: \/lab$/m)
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
  })
})

describe('CTA de bloco nas páginas de guia', () => {
  it('guia PT e EN têm CTA de bloco', () => {
    expect(readPage('como-jogar.html')).toContain('class="page-cta"')
    expect(readPage('en/how-to-play.html')).toContain('class="page-cta"')
  })
})

describe('ad slots nas páginas estáticas', () => {
  const PAGES = ['como-jogar.html', 'sobre.html', 'privacidade.html', 'en/how-to-play.html', 'en/about.html', 'en/privacy.html']
  it.each(PAGES)('%s tem div de ad slot', file => {
    expect(readPage(file)).toContain('class="ad-slot" data-slot="page"')
  })
})

describe('AdSense (verificação do site)', () => {
  const ALL_HTML = ['index.html', 'como-jogar.html', 'sobre.html', 'privacidade.html', 'en/how-to-play.html', 'en/about.html', 'en/privacy.html']
  it.each(ALL_HTML)('%s carrega o script adsbygoogle com o pub id', file => {
    expect(readPage(file)).toContain('adsbygoogle.js?client=ca-pub-3920668331202711')
  })
  it('ads.txt declara o publisher', () => {
    expect(readPage('public/ads.txt')).toContain('google.com, pub-3920668331202711, DIRECT, f08c47fec0942fa0')
  })
})
