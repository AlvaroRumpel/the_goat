# UI/UX + Ads-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 18 itens triados da auditoria UI/UX (spec 2026-08-02) — infra de ad slots com zero mudança visual, P0s de novato, P1s de jogo/desktop e P2s baratos.

**Architecture:** Quase tudo CSS (`base.css`/`tokens.css`/`pages.css`) + edições pontuais de JSX em 8 telas. Nenhuma mudança de engine/state/reducer. Ad infra = CSS var `--ad-h` (default `0px`) + componente placeholder `AdSlot` + hook no-op `interstitialAt` — ciclo 3 liga tudo.

**Tech Stack:** React 19, Vite 8, vitest projeto `unit`, Playwright (e2e + recaptura de screenshots).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-uiux-ads-ready-design.md`. Decisões do dono: banner em TODAS as telas (jogo incluído), intersticial entre temporadas, tema jornal travado.
- **Zero mudança em `src/engine/`, `src/state.ts`, consumo de RNG, save key.** Calibração NÃO roda.
- Toda string nova do APP via i18n (`pt.json`+`en.json`, paridade testada). Páginas estáticas são documentos PT/EN próprios.
- Com `--ad-h: 0px` o app deve ficar **visualmente idêntico** ao atual (exceto os fixes intencionais deste plano).
- Antes de cada commit: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`. Prefixar shell com `rtk`.
- e2e (`node tests/e2e-playthrough.mjs`) roda 1× no fim (Task 8), não por task.

---

### Task 1: Infra de anúncios (`--ad-h`, AdSlot, interstitial hook)

**Files:**
- Modify: `src/styles/tokens.css` (adicionar var), `src/styles/base.css:38-54` (.screen), `base.css:418-427` (.hub), `base.css:591-592` (.game-decision)
- Create: `src/ui/components/AdSlot.tsx`, `src/ui/ads.ts`
- Modify: `src/App.tsx:36-41`, `src/ui/screens/SeasonResult.tsx:157` (CTA ADVANCE)
- Modify: `como-jogar.html`, `sobre.html`, `privacidade.html`, `en/how-to-play.html`, `en/about.html`, `en/privacy.html` (div de slot antes do `<footer>`)
- Test: `tests/pages.test.ts` (estender)

**Interfaces:**
- Produces: `AdSlot({ slot }: { slot: string })` componente; `interstitialAt(point: 'seasonEnd'): void` no-op; classes `.ad-bar`/`.ad-slot`; var `--ad-h`.

- [ ] **Step 1: Teste (falhando)** — adicionar em `tests/pages.test.ts`:

```ts
describe('ad slots nas páginas estáticas', () => {
  const PAGES = ['como-jogar.html', 'sobre.html', 'privacidade.html', 'en/how-to-play.html', 'en/about.html', 'en/privacy.html']
  it.each(PAGES)('%s tem div de ad slot', file => {
    expect(readPage(file)).toContain('class="ad-slot" data-slot="page"')
  })
})
```

Run: `npx vitest run --project unit tests/pages.test.ts` → FAIL.

- [ ] **Step 2: CSS.** Em `tokens.css`, dentro do `:root`, adicionar (com comentário):

```css
  --ad-h: 0px;           /* altura reservada pro banner fixo — ciclo 3 liga (ex.: 60px) */
```

Em `base.css`, `.screen` (linha 44): `padding: 0 22px calc(40px + var(--ad-h) + env(safe-area-inset-bottom, 0px));` e no media query 900px (linha 52): `padding: 0 32px calc(48px + var(--ad-h) + env(safe-area-inset-bottom, 0px));`. Em `.game-decision` (linha 591-592), o padding vira `padding: 16px 22px calc(16px + var(--ad-h));`. Em `.hub` (bloco na linha 418), adicionar `padding-bottom: var(--ad-h);`. Adicionar no fim do arquivo:

```css
/* --- ad slots (ciclo 2: placeholders; ciclo 3 preenche) --- */
.ad-bar { position: fixed; left: 0; right: 0; bottom: 0; height: var(--ad-h); z-index: 40; }
.ad-slot:empty { display: none; }
```

- [ ] **Step 3: Componente e hook.**

`src/ui/components/AdSlot.tsx`:
```tsx
// Placeholder de anúncio — ciclo 3 injeta o conteúdo. Com --ad-h: 0px não ocupa nada.
export function AdSlot({ slot }: { slot: string }) {
  if (slot === 'bar') return <div className="ad-bar" data-slot="bar" />
  return <div className="ad-slot" data-slot={slot} />
}
```

`src/ui/ads.ts`:
```ts
// Ponto único de intersticial — ciclo 3 implementa (AdSense). Hoje: no-op.
export function interstitialAt(_point: 'seasonEnd'): void {}
```

Em `App.tsx`, dentro do fragment de retorno, após `{state.hubOpen && ...}`: `<AdSlot slot="bar" />` (+ import). Em `SeasonResult.tsx`, no onClick do botão ADVANCE (linha 157): `onClick={() => { interstitialAt('seasonEnd'); dispatch({ type: 'ADVANCE' }) }}` (+ import `../ads`).

- [ ] **Step 4: Slots de tela de pausa (spec §A.2).** Invisíveis com `--ad-h` 0 (`.ad-slot:empty { display: none }`): em `SeasonResult.tsx`, `<AdSlot slot="pause" />` imediatamente antes do botão ADVANCE (linha ~157); em `Verdict.tsx`, antes do botão SHARE; em `Hub.tsx`, último filho do `.hub__grid`. Importar `AdSlot` nos três.

- [ ] **Step 5: Páginas estáticas.** Em cada um dos 6 html, imediatamente antes de `<footer>`: `<div class="ad-slot" data-slot="page"></div>`.

- [ ] **Step 5: Verificar.** `npx vitest run --project unit tests/pages.test.ts` → PASS. `npm test` + `npx tsc -p tsconfig.app.json --noEmit` → verdes. Sanity visual: `rtk npm run build` ok; com `--ad-h` 0 nada muda de layout (conferir 1 screenshot da Home via script de captura se quiser, opcional).

- [ ] **Step 6: Commit** — `rtk git add -A && rtk git commit -m "feat(ads): infra de slots (--ad-h, AdSlot, interstitial hook) sem mudanca visual"`

---

### Task 2: Draft de atributos — instrução no topo, legenda da notação, malus sem eco

**Files:**
- Modify: `src/ui/screens/AttrDraft.tsx:80-82` (inserir hint acima das linhas), `:156-163` (callout), `:180` (remover hint do rodapé)
- Modify: `src/data/i18n/pt.json`, `en.json` (1 chave nova `draft.legend`)

**Interfaces:** nenhuma pra outras tasks.

- [ ] **Step 1: i18n.** `pt.json`: `"draft.legend": "VALOR DA LENDA · SEU VALOR APÓS O ROUBO",` · `en.json`: `"draft.legend": "LEGEND'S VALUE · YOURS AFTER THE STEAL",` (junto das outras chaves `draft.*`).

- [ ] **Step 2: Mover a instrução.** Em `AttrDraft.tsx`, logo APÓS o bloco do cabeçalho da lenda (fecha na linha 80, `</div>` do flex com `.mono-ring`) e ANTES do `<div>` que abre o map de `SLOT_ORDER` (linha 82), inserir:

```tsx
        <div>
          <div className="hint" style={{ fontSize: 12.5 }}>{t(lang, goat ? 'draft.goat.hint' : 'draft.hint')}</div>
          {!goat && <div className="mono-label" style={{ marginTop: 4, fontSize: 9 }}>{t(lang, 'draft.legend')}</div>}
        </div>
```

Remover a linha 180 (`<div className="hint">{t(lang, goat ? 'draft.goat.hint' : 'draft.hint')}</div>`).

- [ ] **Step 3: Malus sem eco.** No bloco das linhas 156-163, remover o primeiro `<div style={{ fontSize: 13 }}>…draft.preview…</div>` e manter só o `mono-label` do `draft.projected` (o borderLeft vermelho fica). A chave `draft.preview` NÃO sai do i18n (paridade não quebra; chave morta aceitável — remover das DUAS línguas se preferir, desde que junto).

- [ ] **Step 4: Verificar+commit.** `npm test` + typecheck verdes. `rtk git add -A && rtk git commit -m "fix(draft): instrucao no topo, legenda da notacao, malus sem eco"`

---

### Task 3: Veredito legível + alvos de toque + cartão sem eco

**Files:**
- Modify: `src/styles/base.css:77-83` (.topbar__link), fim do bloco verdict (após linha 667)
- Modify: `src/ui/screens/Verdict.tsx:124-127` (canvas)

**Interfaces:** nenhuma.

- [ ] **Step 1: Contraste no vermelho.** Em `base.css`, após `.verdict-screen .btn--outline` (linha 667), adicionar:

```css
.verdict-screen .topbar { border-bottom-color: var(--on-red-dim); }
.verdict-screen .topbar__meta { color: var(--on-red-dim); }
.verdict-screen .topbar__link { color: var(--on-red); }
```

- [ ] **Step 2: Alvo de toque 44px sem mudar o visual.** `.topbar__link` (linha 77) ganha: `padding: 14px; margin: -14px; position: relative; z-index: 1;`. Isso cobre o "CARREIRA ↗" (CareerBar) e o "FECHAR ×" do Hub (`Hub.tsx:39` usa a mesma classe) e o "digitar outro" do Setup. Conferir visualmente que nada desloca (padding e margin se anulam).

- [ ] **Step 3: Canvas oculto.** Em `Verdict.tsx`, o `<canvas>` (linhas 124-127) troca o style por `style={{ display: 'none' }}` — o Share continua funcionando (`drawShareCard` seta width/height do bitmap; `toBlob` não depende de layout).

- [ ] **Step 4: Verificar+commit.** `npm test` + typecheck. Sanity manual rápido: `rtk npm run dev`, veredito não precisa ser alcançado — basta conferir Home/topbar sem deslocamento. Commit: `fix(verdict): careerbar legivel no fundo vermelho, alvos 44px, cartao sem eco`

---

### Task 4: Setup compara os 3 modos

**Files:**
- Modify: `src/ui/screens/Setup.tsx:178-227` (map do ModeStep)

**Interfaces:** nenhuma.

- [ ] **Step 1: Reescrever o map.** Todos os cartões mostram SEMPRE as 3 linhas de "como funciona"; o selecionado mantém o tratamento `strip strip--ink` + tag ESCOLHIDO, os não-selecionados são botões com as mesmas linhas em papel:

```tsx
        {MODE_ORDER.map((id, i) => {
          const isSel = id === sel
          const isLast = i === MODE_ORDER.length - 1
          const lines = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {LINE_KEYS.map((lineKey, li) => (
                <div key={lineKey} style={{ display: 'flex' }}>
                  <span className="mono" style={{ fontSize: 11, color: isSel ? 'var(--accent-warm)' : 'var(--red)', width: 14 }}>
                    {String(li + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.45 }}>{t(lang, `mode.${id}.${lineKey}`)}</span>
                </div>
              ))}
            </div>
          )
          if (isSel) {
            return (
              <div key={id}>
                <div className="strip strip--ink" style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="headline" style={{ fontSize: 15 }}>{t(lang, `mode.${id}.name`)}</div>
                    <span className="mono-label" style={{ color: 'var(--accent-warm)' }}>{t(lang, 'setup.chosen')}</span>
                  </div>
                  {lines}
                </div>
                {!isLast && <hr className="rule" />}
              </div>
            )
          }
          return (
            <div key={id}>
              <button
                type="button"
                onClick={() => setSel(id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '15px 0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase' }}>{t(lang, `mode.${id}.name`)}</div>
                  <span className="mono" style={{ fontSize: 10 }}>{t(lang, `mode.${id}.meta`)}</span>
                </div>
                {lines}
              </button>
              {!isLast && <hr className="rule" />}
            </div>
          )
        })}
```

Nota: as chaves `mode.<id>.desc` deixam de aparecer no ModeStep (linhas completas as substituem); não remover do i18n sem checar outros usos (`rtk grep "mode\." src/ui`).

- [ ] **Step 2: Verificar+commit.** `npm test` + typecheck; sanity visual em dev (os 3 cartões com 3 linhas cada, tela não estoura em 390px — se estourar, reduzir gap/padding, nunca cortar texto). Commit: `fix(setup): 3 modos comparaveis lado a lado`

---

### Task 5: Jogo — placeholder do feed, escada de cores de risco, desktop equilibrado

**Files:**
- Modify: `src/ui/screens/Game.tsx:125-126` (feed), `:211` (className das opções), `:216-219` (cores das tags)
- Modify: `src/styles/base.css:599` (bold), adicionar reckless; `:624` (.game-side .game-decision)
- Modify: `src/data/i18n/pt.json`, `en.json` (chave `game.warmup`)

**Interfaces:** nenhuma.

- [ ] **Step 1: i18n.** `pt.json`: `"game.warmup": "BOLA AO ALTO · O JOGO VAI COMEÇAR",` · `en.json`: `"game.warmup": "TIP-OFF · GAME ABOUT TO START",`

- [ ] **Step 2: Placeholder do feed.** Em `Game.tsx`, dentro de `.game-plays` (linha 125), antes do map, renderizar quando nada foi revelado:

```tsx
          {reveal.shown === 0 && (
            <div className="game-play game-play--pending">
              <span className="mono-label">{t(lang, 'game.warmup')}</span>
            </div>
          )}
```

CSS em `base.css` junto dos `.game-play`:

```css
.game-play--pending { opacity: 0.55; animation: pending-pulse 1.6s ease-in-out infinite; }
@keyframes pending-pulse { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .game-play--pending { animation: none; } }
```

- [ ] **Step 3: Escada de cores.** `base.css:599` substituir `.game-option--bold { background: var(--paper); color: var(--ink); }` por:

```css
.game-option--bold { border-left: 3px solid var(--accent-warm); }
.game-option--reckless { border-left: 3px solid var(--red); background: var(--red); color: var(--on-red); }
```

`Game.tsx:211` vira:

```tsx
                    className={`game-option${option.risk === 'bold' ? ' game-option--bold' : option.risk === 'reckless' ? ' game-option--reckless' : ''}`}
```

Linha 216 (tag de risco): cor `var(--red)` não funciona sobre fundo vermelho — trocar por `color: option.risk === 'reckless' ? 'var(--on-red)' : 'var(--red)'`. Linha 218 (attr/injury): remover o condicional de bold — `color: 'var(--on-ink-dim)'` para todos, exceto reckless que usa `'var(--on-red-dim)'`: `color: option.risk === 'reckless' ? 'var(--on-red-dim)' : 'var(--on-ink-dim)'`.

- [ ] **Step 4: Desktop.** `base.css:624`: `.game-side .game-decision { margin: 0; }` (painel alinha pelo topo sob a tira de momentos, mata os ~550px mortos).

- [ ] **Step 5: Verificar+commit.** `npm test` + typecheck. Sanity dev: jogar até um key game, ver placeholder pulsando antes da 1ª linha, opções com escada segura(quieta)/ousada(âmbar)/imprudente(vermelha). Commit: `fix(game): placeholder no feed, escada visual de risco, desktop sem vao morto`

---

### Task 6: Desktop — telas de coluna centralizadas

**Files:**
- Modify: `src/styles/base.css:49-54` (media query do .screen)
- Modify: `src/ui/screens/Game.tsx` (root div), `src/ui/screens/SeasonResult.tsx` (root div)

**Interfaces:**
- Produces: classe `.screen--wide` (Game e SeasonResult a usam; Hub usa `.hub__inner` que também recebe).

- [ ] **Step 1: CSS.** Substituir o media query (linhas 49-54) por:

```css
@media (min-width: 900px) {
  .screen {
    max-width: 560px;
    padding: 0 32px calc(48px + var(--ad-h) + env(safe-area-inset-bottom, 0px));
  }
  .screen--wide,
  .hub .screen {
    max-width: 1280px;
  }
}
```

(`.hub .screen` cobre o `hub__inner` sem tocar no Hub.tsx.)

- [ ] **Step 2: Marcar as telas largas.** Root do `Game.tsx` (`<div className="screen">`) vira `className="screen screen--wide"`; mesmo no root do `SeasonResult.tsx` (o balanço tem grid desktop próprio, `base.css:375+`). TODAS as outras telas ficam narrow (Home, Setup, AttrDraft, NbaDraft, Season/FA/preseason, SeasonAdvance, GameResult, Verdict).

- [ ] **Step 3: Verificar.** Dev em janela ≥1280px: Home centrada (~560px), draft com label↔valor a distância de leitura, jogo e balanço iguais a antes. `npm test` + typecheck.

- [ ] **Step 4: Commit** — `fix(desktop): coluna centralizada 560px, telas de grid mantem 1280px`

---

### Task 7: Miscelânea — toggle com contexto, corrida sem "— —", nota do impacto, CTA das estáticas

**Files:**
- Modify: `src/ui/screens/Home.tsx:79-88` (toggle), `src/ui/components/LeaguePanels.tsx:123` (RaceBars), `src/ui/screens/GameResult.tsx:50-52` (nota)
- Modify: `src/data/i18n/pt.json`, `en.json` (chaves `races.none`, `result.impactNote`)
- Modify: `src/styles/pages.css` (.page-cta), `como-jogar.html`, `en/how-to-play.html` (CTA)
- Test: `tests/pages.test.ts` (assert do CTA)

**Interfaces:** nenhuma.

- [ ] **Step 1: i18n.**

pt: `"races.none": "AINDA NÃO DECIDIDO",` · `"result.impactNote": "Seus lances decidem uma parte; o elenco e a noite do adversário decidem o resto.",`
en: `"races.none": "NOT DECIDED YET",` · `"result.impactNote": "Your calls decide part of it; the roster and the opponent's night decide the rest.",`

- [ ] **Step 2: Toggle só com save.** Em `Home.tsx`, envolver o bloco do toggle (linhas 79-88) em `{resumePhase !== null && ( ... )}` — novato não vê configuração sem contexto; default `true` segue no estado.

- [ ] **Step 3: RaceBars.** `LeaguePanels.tsx:123`: trocar o `'—'` final por `t(lang, 'races.none')`:

```tsx
              {t(lang, 'award.' + race.award)} — {leader ? (leader.id === 'you' ? t(lang, 'races.you') : leader.name) : t(lang, 'races.none')}
```

- [ ] **Step 4: Nota do impacto.** Em `GameResult.tsx`, logo abaixo do hint existente (linha 52), adicionar: `<div className="hint" style={{ textAlign: 'center', opacity: 0.8 }}>{t(lang, 'result.impactNote')}</div>`

- [ ] **Step 5: CTA das estáticas.** Em `pages.css`:

```css
.page-cta { display: block; background: var(--red); color: var(--paper); font-family: var(--black); text-transform: uppercase; letter-spacing: 0.06em; text-align: center; padding: 16px 20px; margin: 28px 0 8px; text-decoration: none; font-size: 16px; }
```

Em `como-jogar.html`, trocar `<p><a href="/">Começar uma carreira agora →</a></p>` por `<a class="page-cta" href="/">Começar uma carreira agora →</a>`. Em `en/how-to-play.html`, idem com "Start a career now →". Teste em `tests/pages.test.ts`:

```ts
  it('guia PT e EN têm CTA de bloco', () => {
    expect(readPage('como-jogar.html')).toContain('class="page-cta"')
    expect(readPage('en/how-to-play.html')).toContain('class="page-cta"')
  })
```

- [ ] **Step 6: Verificar+commit.** `npx vitest run --project unit tests/pages.test.ts` + `npm test` + typecheck. Commit: `fix(ui): toggle com contexto, corrida sem travessao, nota de impacto, CTA nas estaticas`

---

### Task 8: Verificação final — e2e, recaptura, deploy

**Files:** nenhum novo (só execução).

- [ ] **Step 1: e2e.** `node tests/e2e-playthrough.mjs` → exit 0 (flake conhecido: re-rodar 1× antes de investigar). O assert do footer (3 links) e o fluxo do jogo devem seguir verdes com as mudanças.

- [ ] **Step 2: Sanity do banner.** Teste manual do `--ad-h`: em dev, no console, `document.documentElement.style.setProperty('--ad-h', '90px')` — CTA final da Home, painel de decisão do jogo e botão do balanço devem continuar 100% visíveis acima da faixa. Voltar a 0.

- [ ] **Step 3: Recaptura.** Rodar o script de captura da auditoria (scratchpad `audit-capture.mjs`) OU recapturar manualmente as telas alteradas (home, setup-mode, attr-draft, keygame-decision, verdict, como-jogar) e conferir visualmente cada fix.

- [ ] **Step 4: Deploy.** `rtk npm run build && npx wrangler pages deploy dist --project-name=the-goat --branch=master` (pós-merge). Verificar `https://thegoatgame.app/` e `/como-jogar` (CTA novo).

- [ ] **Step 5: HANDOFF.** Registrar decisão 21 (ciclo 2 completo: itens, infra `--ad-h`, pendência ciclo 3) e commitar `docs: HANDOFF ciclo uiux-ads-ready`.
