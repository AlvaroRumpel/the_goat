# SEO + Landing — Design (Ciclo 1 de 3)

**Data:** 2026-08-02 · **Status:** aprovado pelo dono
**Contexto:** primeira de três frentes decididas com o dono — (1) SEO + conteúdo indexável, (2) review UI/UX, (3) banners de anúncio (AdSense). Ordem escolhida: SEO → UI/UX → Ads, porque o AdSense rejeita site sem conteúdo textual ("low value content") e a aprovação leva dias–semanas; este ciclo cria o conteúdo que destrava o ciclo 3. Ciclos 2 e 3 terão brainstorm/spec próprios.

## Decisões travadas neste brainstorm

- **Domínio: `thegoatgame.app`** — comprado pelo dono na Cloudflare em 2026-08-02 (~US$14/ano). `thegoat.game` estava livre mas era premium (US$300/ano — recusado); `thegoat.app`, `thegoatgame.com`, `playthegoat.com`, `thegoat.com.br` tomados. `thegoatnba.com` livre mas descartado por risco de marca (UDRP).
- **Jogo continua em `/`** — links compartilhados seguem funcionando; páginas de conteúdo estáticas ao lado. Rejeitado: landing em `/` com jogo em `/play` (um clique a mais pra todo recorrente).
- **PT + EN com hreflang** — PT na raiz, EN sob `/en/`.
- **Uma URL só pro jogo** — o toggle de idioma é in-app; sem `/en/` pro jogo, só pras páginas de conteúdo.

## 1. Domínio e infra (ação manual do dono, documentada aqui)

- Cloudflare Pages → projeto `the-goat` → Custom domains → adicionar `thegoatgame.app` e `www.thegoatgame.app`.
- `the-goat-3xw.pages.dev` continua viva; canonical em todas as páginas aponta pro domínio novo (mata conteúdo duplicado).
- **Critério de aceite:** `https://thegoatgame.app` serve o jogo com HTTPS válido.

## 2. `index.html` do jogo (`/`)

- `<title>` e `<meta name="description">` reais em PT (idioma default do jogo).
- Open Graph + Twitter Card (`summary_large_image`) com `og-image.png` 1200×630 nova, gerada pelo mesmo padrão Playwright de `scripts/gen-icons.mjs` (tema jornal, sem fotos/logos reais de NBA — regra do projeto).
- JSON-LD `VideoGame`: grátis, browser, PT/EN, sem cadastro.
- `<link rel="canonical" href="https://thegoatgame.app/">` + `hreflang x-default` apontando pra si.
- Snippet do Cloudflare Web Analytics (ver §5).

## 3. Páginas de conteúdo estáticas (Vite MPA)

**Rotas** (Cloudflare Pages serve `foo.html` como `/foo` — clean URLs automático):

| PT | EN | Conteúdo |
|---|---|---|
| `/como-jogar` | `/en/how-to-play` | Guia real ~600+ palavras: draft de atributos (roubo de lenda + malus), 3 modos (carreira/GOAT/rápido), momentos de decisão nos jogos-chave, tiers do veredito até THE GOAT. Alvo de long-tail ("jogo de carreira NBA no navegador"). |
| `/sobre` | `/en/about` | O que é o jogo, inspiração (The Fenomeno), grátis/sem cadastro/PT-EN, autor. |
| `/privacidade` | `/en/privacy` | LGPD-ready; já menciona cookies de terceiros e publicidade (preparada pro ciclo 3/AdSense — atualização fina fica pra lá). |

- **Mecanismo:** Vite multi-page (`build.rollupOptions.input` com os 6 html na raiz do projeto), importando um `pages.css` novo que puxa `tokens.css` — tema jornal (Archivo Black + IBM Plex Mono, radius 0) sem duplicar tokens. Rejeitado: HTML solto em `public/` (duplicaria o tema); framework SSG (overkill pra 6 páginas).
- Cada página: header com link "← Jogar" pra `/`, hreflang cruzado PT↔EN, canonical própria, meta description própria.
- **Conteúdo escrito por Claude, revisado pelo dono** (pode ser no review final do ciclo).

## 4. Footer na Home do jogo

- Footer discreto na tela Home (só na Home, não durante a carreira) linkando: Como jogar · Sobre · Privacidade (respeitando `state.lang` — PT aponta rotas PT, EN rotas EN).
- Crawlability + requisito de navegação do AdSense. ~6 chaves i18n novas (paridade PT/EN testada, como sempre).

## 5. Infra SEO e medição

- `public/sitemap.xml` — 7 URLs (jogo + 6 páginas), hreflang annotations.
- `public/robots.txt` — allow all + link do sitemap.
- **Cloudflare Web Analytics** (grátis, sem cookies → sem banner de consentimento) no index e nas 6 páginas. Sem medição não dá pra saber se "conseguir usuário" funciona. Setup do token é manual no dashboard (dono), snippet entra no código.
- `src/ui/share.ts`: texto do cartão "thegoat.game" → "thegoatgame.app" (1 linha).

## 6. Fora de escopo (deferido)

- Banners/AdSense → ciclo 3 (depende de aprovação; aplicar após este ciclo no ar).
- Review UI/UX → ciclo 2.
- Prerender/SSG do app em si (Google renderiza JS; custo não paga agora).
- Blog/conteúdo contínuo, Search Console submissão (ação manual do dono pós-deploy, instruída no handoff).

## 7. Testes e critérios de aceite

- Zero mudança de engine/state/RNG/save → **calibração não roda**; `npm test` + typecheck como sempre.
- e2e existente ganha 1 assert: footer da Home tem os 3 links PT.
- Teste de paridade i18n cobre as chaves novas do footer automaticamente.
- Manual: Lighthouse SEO ≥ 95 no index e em `/como-jogar`; `curl` das 6 rotas no domínio novo retorna 200 com canonical/hreflang certos; og-image renderiza no preview de share (ex.: opengraph.xyz).

## Riscos

- **Build MPA:** rota nova no Vite pode colidir com fallback SPA do Pages (`_redirects`/404). Mitigação: Pages serve estáticos antes do fallback; verificar no deploy de preview.
- **AdSense ainda pode recusar** mesmo com guia (jogo é o conteúdo principal). Mitigação barata se acontecer: engordar `/como-jogar` com seção de dicas/FAQ antes de reaplicar.
