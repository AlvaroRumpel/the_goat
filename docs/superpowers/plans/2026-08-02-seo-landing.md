# SEO + Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o jogo indexável e compartilhável — domínio `thegoatgame.app`, meta/OG/JSON-LD no index, 6 páginas de conteúdo estáticas PT/EN, sitemap/robots, footer de navegação e URL no texto de share.

**Architecture:** Jogo continua SPA em `/`; páginas de conteúdo são HTML estático buildado via Vite MPA (`build.rollupOptions.input`), compartilhando tokens do tema jornal por um `pages.css` novo. Zero mudança de engine/state/RNG/save — calibração NÃO roda.

**Tech Stack:** Vite 8 MPA, Playwright (gen de og-image, padrão de `scripts/gen-icons.mjs`), vitest projeto `unit`, Cloudflare Pages.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-seo-landing-design.md`.
- Domínio canônico: `https://thegoatgame.app` (comprado 2026-08-02, Cloudflare).
- Zero mudança em `src/engine/`, `src/state.ts`, consumo de RNG, save key. `npm run test:calibration` NÃO precisa rodar.
- Toda string nova visível no APP passa por i18n (`src/data/i18n/pt.json` + `en.json`, paridade testada). Páginas estáticas são documentos próprios PT/EN — não passam por i18n do app.
- Sem fotos/logos reais de NBA (nomes ok) — vale pro og-image também.
- Antes de cada commit: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`.
- Prefixar comandos shell com `rtk` (ex.: `rtk git add`, `rtk npm run build`).
- Working tree tem mudança do dono NÃO relacionada em `src/styles/base.css`/`tokens.css` (remoção do token `--canvas`) — NÃO commitá-la junto; commits deste plano adicionam só os arquivos listados na task.
- Cloudflare Pages serve `foo.html` como `/foo` (clean URLs) e mantém fallback SPA pro `index.html` quando não há `404.html` — não criar `404.html` nem `_redirects`.

---

### Task 1: og-image (script + asset)

**Files:**
- Create: `scripts/gen-og.mjs`
- Create: `public/og-image.png` (gerado pelo script, 1200×630)

**Interfaces:**
- Produces: `public/og-image.png`, referenciado pela Task 2 e Task 3/4 como `https://thegoatgame.app/og-image.png`.

- [ ] **Step 1: Escrever o script**

```js
// scripts/gen-og.mjs — one-off: node scripts/gen-og.mjs
import { chromium } from 'playwright'
import { resolve } from 'node:path'

const html = `<!doctype html>
<html>
<head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #EDE6D6; color: #1C1A16; font-family: 'Archivo', sans-serif; padding: 56px 64px 0; display: flex; flex-direction: column; }
  .label { font-family: 'IBM Plex Mono', monospace; font-size: 22px; letter-spacing: 4px; color: #6B6455; }
  .rule { height: 3px; background: #A8231C; margin-top: 10px; }
  .rule + .rule { margin-top: 5px; }
  h1 { font-family: 'Archivo Black', sans-serif; font-size: 176px; line-height: 0.86; letter-spacing: -0.035em; color: #A8231C; margin-top: 44px; }
  .tagline { font-size: 34px; font-weight: 500; margin-top: 30px; max-width: 720px; }
  .foot { margin-top: auto; background: #A8231C; margin-left: -64px; margin-right: -64px; padding: 26px 64px; display: flex; justify-content: space-between; align-items: center; }
  .foot .site { font-family: 'Archivo Black', sans-serif; font-size: 30px; color: #F6F0E4; }
  .foot .hook { font-family: 'IBM Plex Mono', monospace; font-size: 22px; letter-spacing: 4px; color: #F0C4C0; }
</style>
</head>
<body>
  <div class="label">CARREIRA NBA · GRÁTIS · SEM CADASTRO · PT/EN</div>
  <div class="rule"></div><div class="rule"></div>
  <h1>THE<br>GOAT</h1>
  <div class="tagline">Roube atributos das lendas, viva uma carreira inteira e persiga o veredito final.</div>
  <div class="foot"><span class="site">THEGOATGAME.APP</span><span class="hook">CONSEGUE SER O GOAT?</span></div>
</body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.screenshot({ path: resolve('public/og-image.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } })
console.log('public/og-image.png')
await browser.close()
```

- [ ] **Step 2: Gerar e conferir**

Run: `node scripts/gen-og.mjs`
Expected: imprime `public/og-image.png`. Abrir o PNG (tool Read) e conferir: papel `#EDE6D6`, "THE GOAT" vermelho gigante, rodapé vermelho com THEGOATGAME.APP, sem corte de texto.

- [ ] **Step 3: Commit**

```bash
rtk git add scripts/gen-og.mjs public/og-image.png
rtk git commit -m "feat(seo): og-image 1080p tema jornal gerada por script Playwright"
```

---

### Task 2: head do index.html (meta/OG/Twitter/canonical/JSON-LD)

**Files:**
- Modify: `index.html:1-13` (só o `<head>`; body intocado)

**Interfaces:**
- Consumes: `public/og-image.png` (Task 1).

- [ ] **Step 1: Substituir o `<head>`**

O `<head>` atual (linhas 3-13) vira:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Jogo grátis de carreira na NBA direto no navegador: roube atributos das lendas no draft, viva temporada a temporada e persiga o veredito de GOAT. Sem cadastro, PT/EN." />
    <meta name="theme-color" content="#A8231C" />
    <title>The GOAT — jogo de carreira NBA no navegador, grátis</title>
    <link rel="canonical" href="https://thegoatgame.app/" />
    <link rel="alternate" hreflang="x-default" href="https://thegoatgame.app/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="The GOAT" />
    <meta property="og:title" content="The GOAT — jogo de carreira NBA no navegador" />
    <meta property="og:description" content="Roube atributos das lendas, viva uma carreira inteira e persiga o veredito de GOAT. Grátis, sem cadastro, PT/EN." />
    <meta property="og:url" content="https://thegoatgame.app/" />
    <meta property="og:image" content="https://thegoatgame.app/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="The GOAT — jogo de carreira NBA no navegador" />
    <meta name="twitter:description" content="Roube atributos das lendas, viva uma carreira inteira e persiga o veredito de GOAT. Grátis, sem cadastro, PT/EN." />
    <meta name="twitter:image" content="https://thegoatgame.app/og-image.png" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      "name": "The GOAT",
      "url": "https://thegoatgame.app/",
      "image": "https://thegoatgame.app/og-image.png",
      "description": "Jogo de carreira de basquete no navegador: monte seu atleta roubando atributos das lendas e persiga o legado de GOAT.",
      "genre": "Sports simulation",
      "gamePlatform": "Web browser",
      "playMode": "SinglePlayer",
      "inLanguage": ["pt-BR", "en"],
      "isAccessibleForFree": true,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    }
    </script>
  </head>
```

- [ ] **Step 2: Verificar build e app**

Run: `npx tsc -p tsconfig.app.json --noEmit && rtk npm run build`
Expected: build verde. `rtk npm run dev` + abrir `http://localhost:5173` → jogo abre normal.

- [ ] **Step 3: Commit**

```bash
rtk git add index.html
rtk git commit -m "feat(seo): meta/OG/Twitter/canonical/JSON-LD no index"
```

---

### Task 3: pages.css + páginas PT + Vite MPA + teste de contrato

**Files:**
- Create: `src/styles/pages.css`
- Create: `como-jogar.html`, `sobre.html`, `privacidade.html` (raiz do projeto)
- Modify: `vite.config.ts` (adicionar `build.rollupOptions.input`)
- Test: `tests/pages.test.ts`

**Interfaces:**
- Produces: rotas `/como-jogar`, `/sobre`, `/privacidade`; classes de `pages.css` (`.page`, `.page-label`, `.page-rule`) reutilizadas pela Task 4; `tests/pages.test.ts` com helper `readPage(file)` estendido nas Tasks 4/5.

- [ ] **Step 1: Escrever o teste (falhando)**

`tests/pages.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --project unit tests/pages.test.ts`
Expected: FAIL (arquivos não existem).

- [ ] **Step 3: Criar `src/styles/pages.css`**

```css
/* Tema jornal para as páginas estáticas de conteúdo (fora do app React). */
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700&family=Archivo+Black&family=IBM+Plex+Mono:wght@400;500&display=swap');
@import './tokens.css';

* { margin: 0; box-sizing: border-box; }
body.page {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 64px;
  line-height: 1.55;
}
.page-label { font-family: var(--mono); font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-dim); }
.page-rule { border: 0; height: 3px; background: var(--red); margin: 10px 0 0; }
.page-rule + .page-rule { margin-top: 4px; }
.page h1 { font-family: var(--black); font-size: 42px; line-height: 0.95; letter-spacing: -0.02em; color: var(--red); margin: 28px 0 18px; }
.page h2 { font-family: var(--black); font-size: 22px; margin: 32px 0 10px; }
.page p, .page li { font-size: 16px; margin-bottom: 12px; }
.page ul, .page ol { padding-left: 22px; margin-bottom: 12px; }
.page a { color: var(--red); }
.page header a, .page footer a { font-family: var(--mono); font-size: 13px; text-transform: uppercase; letter-spacing: 0.12em; }
.page header { display: flex; justify-content: space-between; align-items: baseline; }
.page footer { margin-top: 48px; border-top: 1px solid var(--ink); padding-top: 16px; display: flex; gap: 16px; flex-wrap: wrap; }
```

Nota: conferir em `src/styles/tokens.css` os nomes reais dos tokens (`--paper`, `--ink`, `--red`, `--sans`, `--black`, `--mono`, dim). Se algum diferir (ex.: `--ink-dim` não existir), usar o token equivalente que existir lá — NÃO inventar token novo em `tokens.css`.

- [ ] **Step 4: Criar `como-jogar.html`**

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Como jogar The GOAT — guia do draft ao veredito</title>
    <meta name="description" content="Guia completo do The GOAT: como funciona o draft de atributos, os 3 modos de jogo, os momentos de decisão nos jogos-chave e o que é preciso para virar GOAT." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#A8231C" />
    <link rel="canonical" href="https://thegoatgame.app/como-jogar" />
    <link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/como-jogar" />
    <link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/how-to-play" />
    <link rel="alternate" hreflang="x-default" href="https://thegoatgame.app/como-jogar" />
    <link rel="stylesheet" href="/src/styles/pages.css" />
  </head>
  <body class="page">
    <header>
      <span class="page-label">The GOAT · Guia</span>
      <a href="/">← Jogar</a>
    </header>
    <hr class="page-rule" /><hr class="page-rule" />
    <h1>Como jogar The GOAT</h1>
    <p>The GOAT é um jogo grátis de carreira de basquete que roda direto no navegador — sem cadastro, sem instalação, em português e inglês. Você monta um atleta roubando atributos das maiores lendas da NBA, atravessa uma carreira inteira temporada a temporada e recebe no fim um veredito que vai de "Peladeiro de Quadra" até THE GOAT.</p>

    <h2>1. O draft de atributos</h2>
    <p>Tudo começa no draft de atributos. A cada rodada o jogo sorteia uma lenda e você rouba <strong>um</strong> atributo dela — o arremesso de um dos maiores pontuadores da história, a visão de quadra de um armador genial, o físico de um pivô dominante. Cada roubo tem preço: você herda também um <em>malus</em>, uma penalidade derivada da maior fraqueza daquela lenda. Roubar de um gigante lento pode custar velocidade; roubar de um arremessador frágil pode custar físico. Uma vez por draft você pode pedir um novo sorteio se a lenda da vez não servir ao seu projeto de jogador.</p>
    <p>O segredo está em montar um construto coerente: um pontuador puro, um armador cerebral, um defensor implacável — ou um faz-tudo equilibrado. As fraquezas que você aceitar no draft te acompanham pela carreira inteira.</p>

    <h2>2. Os três modos de jogo</h2>
    <ul>
      <li><strong>Carreira</strong> — o modo padrão: você vê os valores de cada lenda antes de escolher o que roubar.</li>
      <li><strong>Modo GOAT</strong> — roubo às cegas: os valores da lenda e o preço ficam escondidos até o fim do draft. Para quem quer testar o instinto.</li>
      <li><strong>Modo rápido</strong> — a temporada corre sozinha, sem telas de jogo: você só toma as decisões de carreira (ofertas, trocas, aposentadoria). Uma carreira completa em poucos minutos.</li>
    </ul>

    <h2>3. A temporada, jogo a jogo</h2>
    <p>Depois do draft vem o draft da NBA de verdade: times fazem ofertas com projetos diferentes — disputar título já, reconstruir com paciência ou brilhar num mercado grande. Sua escolha define o contexto da temporada.</p>
    <p>O calendário tem 82 jogos e é vivo: a liga inteira — os outros 29 times — é simulada junto, com tabela, corrida de prêmios e trocas. Alguns jogos da temporada são <strong>jogos-chave</strong>: clássicos de rivalidade, disputas diretas de posição, jogos especiais. Neles você entra em quadra: o lance a lance corre no ritmo do relógio e o jogo pausa em 2 a 5 <strong>momentos de decisão</strong>, onde você escolhe entre a jogada segura, a ousada ou a imprudente. No lance final, um cronômetro de 8 segundos aperta a escolha (dá para desligar na tela inicial).</p>
    <p>Decisões ousadas bem-sucedidas podem virar <strong>momentos icônicos</strong> — a cesta da vitória, a enterrada que calou o ginásio — e momentos icônicos valem pontos de legado no veredito final.</p>

    <h2>4. Playoffs, prêmios e a longevidade</h2>
    <p>Chegando aos playoffs, as séries se decidem em jogos pivotais e as finais são uma série completa, jogo a jogo. Ao longo da carreira você acumula anéis, MVPs, prêmios de temporada e recordes — e envelhece: o auge chega por volta dos 26-29 anos e depois o físico cobra. Saber a hora de pendurar as chuteiras também é parte do legado.</p>

    <h2>5. O veredito</h2>
    <p>No fim, o jogo pesa tudo — pontos, anéis, MVPs, momentos icônicos, longevidade — e carimba seu tier: de Peladeiro de Quadra, passando por Titular Sólido, Estrela e Lenda, até o topo. <strong>THE GOAT</strong> exige uma carreira à altura de Jordan (5+ anéis e 4+ MVPs) ou de LeBron (38 mil+ pontos e 4+ anéis), além de pontuação de legado de elite. Pouquíssimas carreiras chegam lá.</p>

    <h2>Dicas rápidas</h2>
    <ul>
      <li>Malus pequeno em atributo que você não usa é quase de graça — leia o preço antes de roubar.</li>
      <li>Time em reconstrução dá mais minutos e estatísticas; contender dá mais chance de anel. O veredito valoriza os dois.</li>
      <li>A jogada ousada é matematicamente melhor que a imprudente na maioria dos casos — coragem sim, loucura raramente.</li>
      <li>Momentos icônicos só nascem de jogadas não-seguras bem-sucedidas. Quem só joga no seguro não vira lenda.</li>
    </ul>

    <p><a href="/">Começar uma carreira agora →</a></p>

    <footer>
      <a href="/">Jogar</a>
      <a href="/sobre">Sobre</a>
      <a href="/privacidade">Privacidade</a>
      <a href="/en/how-to-play">English</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 5: Criar `sobre.html`**

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sobre o The GOAT — jogo de carreira NBA grátis</title>
    <meta name="description" content="O que é o The GOAT: jogo gratuito de carreira de basquete no navegador, inspirado nos clássicos de simulação de carreira. Sem cadastro, sem anúncio invasivo, PT/EN." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#A8231C" />
    <link rel="canonical" href="https://thegoatgame.app/sobre" />
    <link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/sobre" />
    <link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/about" />
    <link rel="alternate" hreflang="x-default" href="https://thegoatgame.app/sobre" />
    <link rel="stylesheet" href="/src/styles/pages.css" />
  </head>
  <body class="page">
    <header>
      <span class="page-label">The GOAT · Sobre</span>
      <a href="/">← Jogar</a>
    </header>
    <hr class="page-rule" /><hr class="page-rule" />
    <h1>Sobre o jogo</h1>
    <p>The GOAT é um jogo de carreira de basquete feito para o navegador, inspirado na tradição dos simuladores de carreira em texto — em especial o clássico brasileiro The Fenomeno, de futebol. A pergunta que move o jogo é simples: <em>com pedaços das maiores lendas da quadra, que carreira você construiria?</em></p>
    <p>Você rouba atributos de lendas da NBA num draft com preço e consequência, atravessa até duas décadas de temporadas simuladas — com uma liga viva de 30 times, prêmios, trocas e playoffs — e recebe um veredito final sobre o seu legado.</p>
    <h2>Princípios</h2>
    <ul>
      <li><strong>Grátis e sem cadastro.</strong> Abriu, jogou. O save fica no seu navegador.</li>
      <li><strong>Leve.</strong> Roda em qualquer celular, offline-friendly, sem download.</li>
      <li><strong>Dois idiomas.</strong> Português e inglês, com troca a qualquer momento.</li>
      <li><strong>Sem imagens reais.</strong> Os nomes das lendas aparecem como referência histórica; toda a identidade visual é ilustração própria.</li>
    </ul>
    <h2>Contato</h2>
    <p>Sugestões e bugs: <a href="mailto:alvarorumpel@gmail.com">alvarorumpel@gmail.com</a>.</p>
    <footer>
      <a href="/">Jogar</a>
      <a href="/como-jogar">Como jogar</a>
      <a href="/privacidade">Privacidade</a>
      <a href="/en/about">English</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 6: Criar `privacidade.html`**

```html
<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacidade — The GOAT</title>
    <meta name="description" content="Política de privacidade do The GOAT: sem cadastro, save salvo apenas no seu navegador, métricas agregadas sem cookies." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" content="#A8231C" />
    <link rel="canonical" href="https://thegoatgame.app/privacidade" />
    <link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/privacidade" />
    <link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/privacy" />
    <link rel="alternate" hreflang="x-default" href="https://thegoatgame.app/privacidade" />
    <link rel="stylesheet" href="/src/styles/pages.css" />
  </head>
  <body class="page">
    <header>
      <span class="page-label">The GOAT · Privacidade</span>
      <a href="/">← Jogar</a>
    </header>
    <hr class="page-rule" /><hr class="page-rule" />
    <h1>Política de privacidade</h1>
    <p class="page-label">Atualizada em 2 de agosto de 2026</p>
    <h2>O que coletamos</h2>
    <p>O The GOAT não tem cadastro, login nem formulário. Não coletamos nome, e-mail nem qualquer dado pessoal identificável para você jogar.</p>
    <h2>Onde fica o seu save</h2>
    <p>O progresso da carreira é salvo exclusivamente no armazenamento local do seu navegador (localStorage), no seu aparelho. Ele não é enviado aos nossos servidores. Limpar os dados do navegador apaga o save.</p>
    <h2>Métricas</h2>
    <p>Usamos o Cloudflare Web Analytics para medir visitas de forma agregada. Essa ferramenta não usa cookies, não cria perfil de usuário e não rastreia você entre sites.</p>
    <h2>Publicidade</h2>
    <p>O jogo poderá exibir anúncios de parceiros (como o Google AdSense) para se manter gratuito. Redes de anúncio podem usar cookies próprios para veicular e medir anúncios; quando isso passar a valer, esta página será atualizada com os detalhes e os controles de consentimento aplicáveis conforme a LGPD e o GDPR.</p>
    <h2>Seus direitos (LGPD)</h2>
    <p>Como não mantemos dados pessoais seus em servidor, não há base de dados para solicitar acesso ou exclusão — apagar os dados do site no seu navegador remove tudo. Dúvidas: <a href="mailto:alvarorumpel@gmail.com">alvarorumpel@gmail.com</a>.</p>
    <footer>
      <a href="/">Jogar</a>
      <a href="/como-jogar">Como jogar</a>
      <a href="/sobre">Sobre</a>
      <a href="/en/privacy">English</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 7: Vite MPA em `vite.config.ts`**

Adicionar bloco `build` ao `defineConfig` existente (irmão de `plugins`/`test`):

```ts
  build: {
    rollupOptions: {
      input: [
        'index.html',
        'como-jogar.html',
        'sobre.html',
        'privacidade.html',
      ],
    },
  },
```

Nota: SÓ os 4 arquivos PT nesta task — os 3 `en/` entram no `input` na Task 4 (Step 4), senão o build desta task falharia apontando pra arquivo inexistente.

- [ ] **Step 8: Rodar teste + build**

Run: `npx vitest run --project unit tests/pages.test.ts && rtk npm run build`
Expected: teste PASS; build gera `dist/como-jogar.html`, `dist/sobre.html`, `dist/privacidade.html` com CSS hasheado linkado.

- [ ] **Step 9: Conferir visual em dev**

Run: `rtk npm run dev` → abrir `http://localhost:5173/como-jogar.html`
Expected: tema jornal (papel, headline vermelha Archivo Black, labels mono). Em dev a rota é com `.html`; sem extensão só em produção (clean URLs do Pages).

- [ ] **Step 10: Commit**

```bash
rtk git add tests/pages.test.ts src/styles/pages.css como-jogar.html sobre.html privacidade.html vite.config.ts
rtk git commit -m "feat(seo): paginas estaticas PT (como-jogar, sobre, privacidade) via Vite MPA"
```

---

### Task 4: páginas EN

**Files:**
- Create: `en/how-to-play.html`, `en/about.html`, `en/privacy.html`
- Modify: `vite.config.ts` (completar o `input` com os 3 arquivos `en/`, se Task 3 não incluiu)
- Test: `tests/pages.test.ts` (estender)

**Interfaces:**
- Consumes: `src/styles/pages.css` e classes `.page`/`.page-label`/`.page-rule` (Task 3); helper `readPage` (Task 3).

- [ ] **Step 1: Estender o teste (falhando)**

Adicionar em `tests/pages.test.ts`:

```ts
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
```

Run: `npx vitest run --project unit tests/pages.test.ts` → FAIL.

- [ ] **Step 2: Criar `en/how-to-play.html`**

Mesma estrutura do `como-jogar.html` (header/rules/footer), com: `lang="en"`, canonical `https://thegoatgame.app/en/how-to-play`, hreflang `en` → si mesmo / `pt-BR` → `/como-jogar` / `x-default` → `/como-jogar`, stylesheet `href="/src/styles/pages.css"` (o mesmo — de `en/` o caminho absoluto resolve igual). Conteúdo (tradução fiel, não resumo):

```
title: How to play The GOAT — from the draft to the verdict
description: Complete guide to The GOAT: how the attribute draft works, the 3 game modes, decision moments in key games, and what it takes to become the GOAT.
h1: How to play The GOAT
Intro: The GOAT is a free basketball career game that runs right in your browser — no sign-up, no install, in English and Portuguese. You build a player by stealing attributes from the NBA's greatest legends, live an entire career season by season, and get a final verdict ranging from "Pickup Player" to THE GOAT.
1. The attribute draft — cada rodada sorteia uma lenda, você rouba UM atributo, herda um malus derivado da maior fraqueza da lenda, 1 reroll por draft, construto coerente.
2. The three game modes — Career (padrão, valores visíveis) / GOAT Mode (roubo às cegas) / Quick Mode (temporada auto, só decisões de carreira).
3. The season, game by game — draft da NBA com ofertas (contender/rebuild/big market), calendário de 82 jogos, liga viva de 30 times, key games com play-by-play no relógio e 2-5 decision moments (safe/bold/reckless), cronômetro de 8s no lance final (desligável), momentos icônicos nascem de jogadas não-safe bem-sucedidas.
4. Playoffs, awards and longevity — séries pivotais, finais jogo a jogo, prêmios, curva de idade (auge 26-29), hora de aposentar.
5. The verdict — tiers de Pickup Player a THE GOAT; GOAT exige carreira à la Jordan (5+ rings, 4+ MVPs) ou LeBron (38k+ points, 4+ rings) mais legado de elite.
Quick tips — os 4 itens da versão PT traduzidos.
Footer: Play · About · Privacy · Português (→ /como-jogar)
```

Escrever o HTML completo (não deixar pseudo-código no arquivo final — o bloco acima define o conteúdo; a estrutura HTML é idêntica à PT).

- [ ] **Step 3: Criar `en/about.html` e `en/privacy.html`**

Tradução fiel de `sobre.html` e `privacidade.html`, com canonical/hreflang próprios (padrão do Step 2) e footers EN (`Play · How to play · Privacy · Português`). Em `en/privacy.html`, "LGPD" vira "LGPD (Brazilian data protection law) and GDPR".

- [ ] **Step 4: Completar `vite.config.ts`** (se a Task 3 deixou só os 4 PT no `input`, adicionar os 3 `en/`).

- [ ] **Step 5: Rodar teste + build**

Run: `npx vitest run --project unit tests/pages.test.ts && rtk npm run build`
Expected: PASS; `dist/en/how-to-play.html` etc. existem.

- [ ] **Step 6: Commit**

```bash
rtk git add en/ tests/pages.test.ts vite.config.ts
rtk git commit -m "feat(seo): paginas EN (how-to-play, about, privacy) com hreflang cruzado"
```

---

### Task 5: sitemap.xml + robots.txt

**Files:**
- Create: `public/sitemap.xml`, `public/robots.txt`
- Test: `tests/pages.test.ts` (estender)

**Interfaces:**
- Consumes: rotas das Tasks 3/4.

- [ ] **Step 1: Estender o teste (falhando)**

```ts
describe('sitemap e robots', () => {
  const ALL_PATHS = ['/', '/como-jogar', '/sobre', '/privacidade', '/en/how-to-play', '/en/about', '/en/privacy']

  it('sitemap.xml lista as 7 URLs canônicas', () => {
    const xml = readPage('public/sitemap.xml')
    for (const p of ALL_PATHS) expect(xml).toContain(`<loc>${ORIGIN}${p}</loc>`)
  })

  it('robots.txt libera tudo e aponta o sitemap', () => {
    const txt = readPage('public/robots.txt')
    expect(txt).toContain('Allow: /')
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
  })
})
```

Run: `npx vitest run --project unit tests/pages.test.ts` → FAIL.

- [ ] **Step 2: Criar `public/sitemap.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://thegoatgame.app/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://thegoatgame.app/como-jogar</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/how-to-play"/>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/como-jogar"/>
  </url>
  <url>
    <loc>https://thegoatgame.app/sobre</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/about"/>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/sobre"/>
  </url>
  <url>
    <loc>https://thegoatgame.app/privacidade</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/privacy"/>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/privacidade"/>
  </url>
  <url>
    <loc>https://thegoatgame.app/en/how-to-play</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/como-jogar"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/how-to-play"/>
  </url>
  <url>
    <loc>https://thegoatgame.app/en/about</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/sobre"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/about"/>
  </url>
  <url>
    <loc>https://thegoatgame.app/en/privacy</loc>
    <xhtml:link rel="alternate" hreflang="pt-BR" href="https://thegoatgame.app/privacidade"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://thegoatgame.app/en/privacy"/>
  </url>
</urlset>
```

- [ ] **Step 3: Criar `public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://thegoatgame.app/sitemap.xml
```

- [ ] **Step 4: Rodar teste**

Run: `npx vitest run --project unit tests/pages.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add public/sitemap.xml public/robots.txt tests/pages.test.ts
rtk git commit -m "feat(seo): sitemap com hreflang e robots.txt"
```

---

### Task 6: footer de navegação na Home + i18n

**Files:**
- Modify: `src/ui/screens/Home.tsx` (após o bloco `home.note`, ~linha 99-101)
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json` (3 chaves novas cada)
- Modify: `tests/e2e-playthrough.mjs` (1 assert na seção home, após a screenshot `01-home.png`, ~linha 115)

**Interfaces:**
- Consumes: rotas das Tasks 3/4.
- Produces: chaves i18n `footer.howto`, `footer.about`, `footer.privacy`; classe `home-footer` usada pelo assert do e2e.

- [ ] **Step 1: Chaves i18n**

Em `pt.json` (junto das outras chaves de home/settings):

```json
  "footer.howto": "Como jogar",
  "footer.about": "Sobre",
  "footer.privacy": "Privacidade",
```

Em `en.json`:

```json
  "footer.howto": "How to play",
  "footer.about": "About",
  "footer.privacy": "Privacy",
```

- [ ] **Step 2: Footer no `Home.tsx`**

Depois do `<div className="mono-label" ...>{t(lang, ... 'home.note')}</div>` (fecha o bloco `marginTop: 'auto'`), adicionar:

```tsx
        <nav className="home-footer" style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 14, paddingBottom: 6 }}>
          {([
            ['footer.howto', lang === 'pt' ? '/como-jogar' : '/en/how-to-play'],
            ['footer.about', lang === 'pt' ? '/sobre' : '/en/about'],
            ['footer.privacy', lang === 'pt' ? '/privacidade' : '/en/privacy'],
          ] as const).map(([key, href]) => (
            <a key={key} href={href} className="mono-label" style={{ color: 'var(--ink-dim, inherit)', textDecoration: 'none' }}>
              {t(lang, key)}
            </a>
          ))}
        </nav>
```

Nota: conferir o token dim real em `tokens.css` (mesma nota da Task 3). Links são navegação de documento (sai do SPA) — comportamento desejado; o save não se perde (localStorage).

- [ ] **Step 3: Testes + typecheck**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS — o teste de paridade i18n já cobre as chaves novas automaticamente.

- [ ] **Step 4: Assert no e2e**

Em `tests/e2e-playthrough.mjs`, logo após `await page.screenshot({ path: \`${SHOTS_DIR}/01-home.png\` })`:

```js
    const footerLinks = await page.locator('.home-footer a').count()
    console.log(`[assert] home footer nav links: ${footerLinks} (expect 3)`)
    if (footerLinks !== 3) exitCode = 1
```

- [ ] **Step 5: Rodar e2e**

Run: `node tests/e2e-playthrough.mjs`
Expected: verde, incluindo o assert novo. (Lembrete do débito conhecido: primeira run pós-install pode flakear — re-rodar antes de investigar.)

- [ ] **Step 6: Commit**

```bash
rtk git add src/ui/screens/Home.tsx src/data/i18n/pt.json src/data/i18n/en.json tests/e2e-playthrough.mjs
rtk git commit -m "feat(seo): footer de navegacao na Home (guia/sobre/privacidade)"
```

---

### Task 7: URL no share + verificação final + deploy

**Files:**
- Modify: `src/data/i18n/pt.json:111`, `src/data/i18n/en.json:111` (chave `share.text`)

**Interfaces:**
- Consumes: tudo anterior. Nenhum consumidor posterior.

- [ ] **Step 1: URL no texto de share**

Hoje `share.text` não carrega URL nenhuma (o HANDOFF dizia que o card imprimia "thegoat.game", mas o código atual não tem URL — achado do levantamento deste plano). Corrigir:

`pt.json:111`:
```json
  "share.text": "Minha carreira no The GOAT: {tier} — {rings} anéis, {mvps} MVPs, {points} pontos. Consegue ser o GOAT? https://thegoatgame.app",
```

`en.json:111`:
```json
  "share.text": "My career in The GOAT: {tier} — {rings} rings, {mvps} MVPs, {points} points. Can you become the GOAT? https://thegoatgame.app",
```

- [ ] **Step 2: Suite completa**

Run: `npm test && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (nenhuma mudança de engine/RNG no ciclo inteiro → calibração dispensada).

- [ ] **Step 3: Commit**

```bash
rtk git add src/data/i18n/pt.json src/data/i18n/en.json
rtk git commit -m "feat(seo): URL thegoatgame.app no texto de compartilhamento"
```

- [ ] **Step 4: Build + deploy**

```bash
rtk npm run build
npx wrangler pages deploy dist --project-name=the-goat --branch=master
```

- [ ] **Step 5: Checklist manual do dono (guiar via chat)**

1. Pages → `the-goat` → **Custom domains** → adicionar `thegoatgame.app` e `www.thegoatgame.app` (domínio já está na mesma conta — DNS automático).
2. Pages → `the-goat` → Settings → **Web Analytics** → Enable (injeção automática do beacon, zero código).
3. [Google Search Console](https://search.google.com/search-console) → adicionar propriedade `thegoatgame.app` (verificação DNS automática via Cloudflare) → submeter `https://thegoatgame.app/sitemap.xml`.

- [ ] **Step 6: Verificação pós-deploy (Claude)**

```bash
for p in / /como-jogar /sobre /privacidade /en/how-to-play /en/about /en/privacy /sitemap.xml /robots.txt /og-image.png; do echo "== $p"; rtk curl -s -o /dev/null -w "%{http_code}" "https://thegoatgame.app$p"; echo; done
```
Expected: 200 em todos. Depois: `rtk curl -s https://thegoatgame.app/como-jogar | grep -c canonical` → ≥1. Validar preview do share em https://www.opengraph.xyz com a URL raiz (manual, dono ou Claude via WebFetch).

- [ ] **Step 7: Atualizar HANDOFF.md**

Registrar: ciclo SEO+landing completo (spec/plano), domínio `thegoatgame.app` ativo, pendências (aplicação AdSense = ciclo 3, review UI/UX = ciclo 2), e corrigir a menção antiga a "thegoat.game" no share card. Commit `docs: HANDOFF ciclo seo-landing`.
