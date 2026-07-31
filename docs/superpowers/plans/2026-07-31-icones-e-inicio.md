# Ícones + Tela de Início — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar (Fase 1) o sistema de ícones/brasões do quadro 12a + favicon/PWA do 13a e (Fase 2) a abertura nova com setup de carreira em 2 etapas, 3 modos de jogo e o cartão 10d, com save `thegoat:v7`.

**Architecture:** Fase 1 é 100% apresentação — dois componentes novos (`Icon`, `Crest`) com SVGs copiados verbatim do canvas, campo `motif` em `teams.ts`, e assets estáticos de favicon/manifest. Fase 2 adiciona 2 fases ao reducer (`setupMode`/`setupIdentity`), identidade+modo em `Career`, auto-resolve de pós-temporada para o modo rápido (generalização do padrão `SKIP_SERIES`) e reescreve o card de compartilhar. Nenhuma fórmula travada muda; nenhum consumo de RNG muda de ordem/contagem (skip = mesmas calls, contrato da decisão-chave 11).

**Tech Stack:** React 18 + TS + Vite, CSS puro (`tokens.css`/`base.css`), vitest (projetos `unit`/`calibration`), Playwright (e2e manual + geração de PNG).

**Spec:** `docs/superpowers/specs/2026-07-31-icones-e-inicio-design.md`
**Fonte SVG verbatim:** `docs/superpowers/plans/assets/2026-07-31-icones-canvas.html` (canvas 12a/13a decodificado, committado neste repo)

## Global Constraints

- `src/engine/` é TS puro: sem React, sem localStorage, sem `Math.random` — RNG via `Rng` injetado.
- Toda string visível passa por i18n (`pt.json` + `en.json`, paridade testada). Ícones são `aria-hidden` (decorativos, sem i18n).
- Fórmulas de `season.ts`/pesos de `verdict.ts` são contrato — este plano NÃO toca em nenhuma.
- Sem fotos/logos reais da NBA; sem biblioteca de ícones; sem PNG em ícone de UI; sem emoji.
- `border-radius: 0` em tudo (exceto monograma circular); cores só pelos tokens (`--ink #1C1A16`, `--red #A8231C`, `--paper #EDE6D6`, `--dim #6B6455`, `--accent-warm #E8B24A` só dentro de faixa preta).
- Ícone em linha de texto: sempre `flex: none`. Vermelho **só quando a coisa é sua**.
- Antes de todo commit: `npm test` (~30s) + `npx tsc -p tsconfig.app.json --noEmit`. Calibração NÃO precisa rodar (zero mudança de RNG); se alguma task desviar e mexer em ordem/contagem de RNG, rodar `npm run test:calibration` (regra do CLAUDE.md).
- Vitest só em engine/state/data — componentes React não ganham teste de unidade; verificação de UI = typecheck + build + e2e/sanity manual.
- Trabalhar em branch (`feat/icones` na Fase 1, `feat/inicio` na Fase 2); merge em `master` + deploy no fim de cada fase.

---

# FASE 1 — ÍCONES (deploy independente)

### Task 1: Componente `Icon` (33 ícones do quadro 12a)

**Files:**
- Create: `src/ui/components/Icon.tsx`
- Read (fonte verbatim): `docs/superpowers/plans/assets/2026-07-31-icones-canvas.html` (seção "Rodada 12 · quadro 12A")

**Interfaces:**
- Produces: `export type IconName` (33 nomes), `export function Icon({ name, size = 24, tone = 'ink' }: { name: IconName; size?: number; tone?: 'ink' | 'red' | 'dim' })`

- [ ] **Step 1: Extrair os 33 SVGs do asset**

Abrir o asset e localizar o grid de ícones do quadro 12A (cada célula tem um rótulo tipo `BOLA · JOGO` e um `<svg width="38" height="38" viewBox="0 0 32 32" fill="none">`). Mapear rótulo → slug em inglês, nesta ordem do grid:

`ball, goat, ring, trophy, basket, jersey, training, clock, clutch, contract, trade, injury, tactics, press, season, evolution, streak, verdict, retire, steal, price, crossroads, playoffs, podium, age, physical, strength, crowd, seed, restart, career, language, sound`

(BOLA·JOGO=ball · O GOAT=goat · ANEL=ring · TÍTULO=trophy · CESTA=basket · CAMISA=jersey · TREINO=training · RELÓGIO=clock · CLUTCH=clutch · CONTRATO=contract · TROCA=trade · LESÃO=injury · TÁTICA=tactics · IMPRENSA=press · TEMPORADA=season · EVOLUÇÃO=evolution · EMBALO=streak · VEREDITO=verdict · APOSENTAR=retire · ROUBO=steal · PREÇO·PERDA=price · ENCRUZILHADA=crossroads · PLAYOFFS=playoffs · PÓDIO·LEGADO=podium · IDADE=age · FÍSICO=physical · TREINO DE FORÇA=strength · TORCIDA=crowd · SEMENTE=seed · RECOMEÇAR=restart · CARREIRA·HUB=career · IDIOMA=language · SOM=sound)

- [ ] **Step 2: Escrever `Icon.tsx`**

Copiar o conteúdo interno de cada `<svg>` verbatim, com **substituição de cor mecânica**: `#1C1A16` → `currentColor`; `#A8231C` → `currentColor` (a cor "principal" do ícone vem do tone — no canvas os ícones "seus" já estão desenhados em vermelho, aqui o vermelho vira responsabilidade do chamador via `tone="red"`); `#EDE6D6` (vazados) → `var(--paper)`. Atributos `stroke` seguem a mesma regra. O ícone `jersey` usa `<text>` com Archivo Black — manter (fonte já carregada), com `fill="currentColor"`.

```tsx
import type { ReactNode } from 'react'

export type IconName =
  | 'ball' | 'goat' | 'ring' | 'trophy' | 'basket' | 'jersey' | 'training' | 'clock'
  | 'clutch' | 'contract' | 'trade' | 'injury' | 'tactics' | 'press' | 'season' | 'evolution'
  | 'streak' | 'verdict' | 'retire' | 'steal' | 'price' | 'crossroads' | 'playoffs' | 'podium'
  | 'age' | 'physical' | 'strength' | 'crowd' | 'seed' | 'restart' | 'career' | 'language' | 'sound'

// Conteúdo interno dos <svg> do quadro 12a, verbatim (cores parametrizadas).
const ICONS: Record<IconName, ReactNode> = {
  ball: (
    <>
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <g stroke="var(--paper)" strokeWidth="2.2">
        <path d="M16 2v28M2.5 16h27M6 6c5 5 5 15 0 20M26 6c-5 5-5 15 0 20" />
      </g>
    </>
  ),
  clutch: <path d="M18.5 2 7 18h6.5L11.5 30 25 12h-7.5L18.5 2Z" fill="currentColor" />,
  ring: (
    <>
      <path d="M16 4.5 21 10h-10l5-5.5Z" fill="currentColor" />
      <circle cx="16" cy="20" r="8.5" stroke="currentColor" strokeWidth="3.4" />
    </>
  ),
  // ... os outros 30, extraídos do asset no mesmo formato
}

// Variantes <24px que o canvas desenhou (faixa "Tamanhos reais"): só as existentes — não inventar.
const SMALL: Partial<Record<IconName, ReactNode>> = {
  ball: (
    <>
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <path d="M16 2v28M2.5 16h27" stroke="var(--paper)" strokeWidth="3" />
    </>
  ),
}

const TONE = { ink: 'var(--ink)', red: 'var(--red)', dim: 'var(--dim)' } as const

interface Props { name: IconName; size?: number; tone?: keyof typeof TONE }

export function Icon({ name, size = 24, tone = 'ink' }: Props) {
  const content = size < 24 ? (SMALL[name] ?? ICONS[name]) : ICONS[name]
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"
      style={{ color: TONE[tone], flex: 'none' }}
    >
      {content}
    </svg>
  )
}
```

Atenção JSX: atributos SVG viram camelCase (`stroke-width` → `strokeWidth`, `stroke-linecap` → `strokeLinecap`, `text-anchor` → `textAnchor`, `font-family` → `fontFamily`).

- [ ] **Step 3: Typecheck + suite**

Run: `npx tsc -p tsconfig.app.json --noEmit` e `npm test`
Expected: verdes (nada consome o componente ainda).

- [ ] **Step 4: Commit**

```bash
rtk git add src/ui/components/Icon.tsx
rtk git commit -m "feat(icones): componente Icon com os 33 icones do quadro 12a"
```

---

### Task 2: Componente `Crest` + `motif` em `teams.ts` (TDD no data)

**Files:**
- Create: `src/ui/components/Crest.tsx`
- Modify: `src/data/teams.ts` (campo novo em cada linha), `src/engine/types.ts` (interface `Team`)
- Test: `tests/data/teams.test.ts` (novo)
- Read (fonte verbatim): `docs/superpowers/plans/assets/2026-07-31-icones-canvas.html` (grid de 30 brasões do 12A)

**Interfaces:**
- Consumes: `teamById(id)` de `src/data/teams.ts`
- Produces: `export type Motif` (30 slugs), `Team.motif: Motif`, `export function Crest({ teamId, size = 32 }: { teamId: string; size?: number })`

- [ ] **Step 1: Teste falhando (paridade time ↔ motivo)**

```ts
// tests/data/teams.test.ts
import { describe, expect, it } from 'vitest'
import { TEAMS } from '../../src/data/teams'
import { MOTIFS } from '../../src/ui/components/Crest'

describe('brasões', () => {
  it('todo time tem motivo e todo motivo do mapa é usado (30/30)', () => {
    const used = new Set(TEAMS.map(t => t.motif))
    expect(TEAMS).toHaveLength(30)
    for (const t of TEAMS) expect(MOTIFS[t.motif], `motivo de ${t.id}`).toBeTruthy()
    expect(used.size).toBe(30) // nenhum motivo repetido
    expect(Object.keys(MOTIFS)).toHaveLength(30)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/data/teams.test.ts`
Expected: FAIL (`motif` não existe em `Team`, `Crest` não existe).

- [ ] **Step 3: Implementar**

Em `src/engine/types.ts`, interface `Team` ganha `motif: Motif` (importar o type de... **não** — engine não importa de ui. Definir `Motif` no próprio `types.ts` e `Crest.tsx` importa de lá):

```ts
// src/engine/types.ts
export type Motif =
  | 'bolt' | 'bull' | 'anchor' | 'rocket' | 'flame' | 'crown' | 'pine' | 'bridge'
  | 'leprechaun' | 'claw' | 'pickaxe' | 'deer' | 'gear' | 'cactus' | 'sun' | 'mountain'
  | 'net' | 'star' | 'pelican' | 'horseshoe' | 'wolf' | 'dino' | 'bee' | 'bell'
  | 'spear' | 'wheel' | 'lighthouse' | 'wing' | 'wand' | 'palm'

export interface Team { id: string; city: string; name: string; strength: number; bigMarket: boolean; conf: 'east' | 'west'; motif: Motif }
```

Em `teams.ts`, associação aprovada (spec): okc=bolt · chi=bull · lac=anchor · hou=rocket · mia=flame · sac=crown · por=pine · gsw=bridge · bos=leprechaun · mem=claw · den=pickaxe · mil=deer · det=gear · sas=cactus · phx=sun · uta=mountain · bkn=net · orl=star · nop=pelican · dal=horseshoe · min=wolf · tor=dino · cha=bee · phi=bell · cle=spear · ind=wheel · nyk=lighthouse · atl=wing · was=wand · lal=palm.

```tsx
// src/ui/components/Crest.tsx
import type { ReactNode } from 'react'
import type { Motif } from '../../engine/types'
import { teamById } from '../../data/teams'

// Escudo constante do canvas 12a. Motivos verbatim do asset, no espaço 32×32 próprio,
// cor principal parametrizada: #EDE6D6 → currentColor; detalhes internos em #1C1A16 → var(--ink).
const SHIELD = 'M4 3h24v15c0 6-5 10.5-12 12.5C9 28.5 4 24 4 18V3Z'

export const MOTIFS: Record<Motif, ReactNode> = {
  bolt: <path d="M18.5 2 7 18h6.5L11.5 30 25 12h-7.5Z" fill="currentColor" />,
  crown: <path d="M4 26 6.4 8.4l6.4 6.2L16 4l3.2 10.6 6.4-6.2L28 26Z" fill="currentColor" />,
  // ... os outros 28, extraídos do asset (Pistons e Suns têm rotate(45 16 16) aninhado — copiar como está)
}

export function Crest({ teamId, size = 32 }: { teamId: string; size?: number }) {
  const motif = teamById(teamId).motif
  if (size <= 24) {
    // ≤24px: só o motivo, sem escudo (variante "em contexto" do canvas), na cor do texto corrente
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
        {MOTIFS[motif]}
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flex: 'none', color: 'var(--paper)' }}>
      <path d={SHIELD} fill="var(--ink)" />
      <g transform="translate(6.7,5.4) scale(0.58)">{MOTIFS[motif]}</g>
    </svg>
  )
}
```

Nota: `data/league.ts` constrói o dataset a partir de `TEAMS` — checar se algum literal de `Team` é criado fora de `teams.ts` (grep `conf:`) e adicionar `motif` onde o type exigir.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/data/teams.test.ts` → PASS. Depois `npm test` + `npx tsc -p tsconfig.app.json --noEmit` → verdes.

- [ ] **Step 5: Commit**

```bash
rtk git add src/ui/components/Crest.tsx src/data/teams.ts src/engine/types.ts tests/data/teams.test.ts
rtk git commit -m "feat(icones): Crest com 30 brasoes; motif como campo de teams.ts"
```

---

### Task 3: Substituições nas telas

**Files:**
- Modify: `src/ui/components/OfferCard.tsx` (morre `TeamSymbol`), `src/ui/screens/Season.tsx`, `src/ui/screens/Hub.tsx`, `src/ui/screens/SeasonResult.tsx`, `src/ui/screens/Game.tsx`, `src/ui/screens/GameResult.tsx`, `src/ui/screens/Verdict.tsx`, `src/styles/base.css`

**Interfaces:**
- Consumes: `<Icon name size tone />` (Task 1), `<Crest teamId size />` (Task 2)

- [ ] **Step 1: Brasões de franquia**

- `OfferCard.tsx`: substituir `<TeamSymbol profile ... />` por `<Crest teamId={team.id} size={34} />`; deletar a função `TeamSymbol` e (em `base.css`) as classes `.symbol`, `.symbol__diamond`, `.symbol__circle`, `.symbol--bars`, `.symbol__bar`, `.symbol--on-red` (confirmar zero hits com grep antes de apagar). No card `featured` (faixa vermelha) o escudo `var(--ink)` sobre vermelho funciona — manter.
- `Season.tsx` (preseason): brasão do time ao lado do nome (`<Crest teamId={currentOffer.teamId} size={34} />`); (freeAgency) já usa `OfferCard` — vem de graça.
- `Hub.tsx`: na tabela de temporadas, célula TIME ganha `<Crest teamId={...} size={16} />` antes da sigla (16px = variante sem escudo, herda cor do texto).

- [ ] **Step 2: Ícones de jogo**

Regra de tom: vermelho só quando é do jogador; `dim` quando de terceiro.

- Anéis em série: `Hub.tsx` (bloco de status) e `SeasonResult.tsx` (cerimônia, quando `wonTitle`): um `<Icon name="ring" tone="red" size={16} />` por anel conquistado, substituindo os círculos de 13px atuais do Hub.
- `Game.tsx`: na tira de momentos, o cartão do momento atual de slot `clutch` ganha `<Icon name="clutch" tone="red" size={16} />` ao lado do rótulo.
- `GameResult.tsx`: faixa "MOMENTO ICÔNICO GRAVADO" ganha `<Icon name="clutch" tone="red" size={24} />` (sobre fundo vermelho usar `tone="ink"`? Não — sobre a faixa vermelha o ícone vai em `--on-red`: usar `style`/cor herdada; se o tom não casar, envolver com `color: var(--on-red)` via a própria faixa e `tone` herdando — o componente aceita só 3 tons; nesse caso específico renderizar `<span style={{ color: 'var(--on-red)' }}>` em volta e usar tone padrão? Não complicar: adicionar quarto tom `paper` (`var(--on-red)` ≈ creme) NÃO — usar o wrapper com `color` e trocar `style={{ color: TONE[tone] }}` por `style={{ color: tone ? TONE[tone] : 'currentColor' }}`... **Decisão simples e final**: `Icon` aceita `tone?: 'ink' | 'red' | 'dim' | 'inherit'`; `inherit` não seta `color` (herda do pai). Usar `inherit` dentro de faixas escuras/vermelhas.)
- `Season.tsx` (encruzilhada `tradeDecision`/`eventDecision`): rótulo "ENCRUZILHADA" ganha `<Icon name="trade" size={16} tone="red" />` na troca e `<Icon name="injury" size={16} tone="red" />` no evento de lesão (evento não-lesão: `<Icon name="crossroads" size={16} tone="red" />`).
- `Verdict.tsx`: `<Icon name="verdict" size={32} tone="inherit" />` no cabeçalho (página vermelha — herda `--on-red`).

- [ ] **Step 3: Verificar**

Run: `npm test` + `npx tsc -p tsconfig.app.json --noEmit` + `npm run build`
Expected: verdes. Sanity visual: `npm run dev` e conferir draft (brasões nas ofertas), hub (anéis + crests 16px), veredito (coroa).

- [ ] **Step 4: Commit**

```bash
rtk git add -A
rtk git commit -m "feat(icones): brasoes e icones nas telas; TeamSymbol removido"
```

---

### Task 4: Favicon + PWA (quadro 13a)

**Files:**
- Create: `public/icon-master.svg` (detalhado, ≥60px), `scripts/gen-icons.mjs`, `public/manifest.webmanifest`
- Replace: `public/favicon.svg` (hoje é o raio roxo do template Vite — substituir pela versão simplificada da cabra)
- Delete: `public/icons.svg` (sprite social do template Vite — confirmar zero referências com `rtk grep "icons.svg"` antes)
- Modify: `index.html`
- Read (fonte verbatim): asset, quadro 13A

- [ ] **Step 1: SVGs mestre e simplificado**

`public/icon-master.svg` — `viewBox="0 0 100 100"`, sem cantos arredondados, camadas na ordem do canvas 13A (copiar paths verbatim do asset): campo `#A8231C` full; chifre de trás `#F6F0E4`; chifre da frente `#F6F0E4` com `stroke="#A8231C" stroke-width="1.3"`; estrias (`stroke-width 1.7`); orelha vazada; cabeça `#F6F0E4`; barba `#1C1A16`; olho/narina/boca `#1C1A16`.

`public/favicon.svg` — mesma arte SEM estrias, orelha vazada e boca (regra <60px do canvas); fio dos chifres com `stroke-width="1.8"`; mantém cabeça, chifres, olho, narina e barba.

- [ ] **Step 2: Script de rasterização**

```js
// scripts/gen-icons.mjs — one-off: node scripts/gen-icons.mjs
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const jobs = [
  { src: 'public/icon-master.svg', out: 'public/icon-512.png', size: 512 },
  { src: 'public/icon-master.svg', out: 'public/icon-192.png', size: 192 },
  { src: 'public/favicon.svg', out: 'public/favicon-32.png', size: 32 },
  { src: 'public/favicon.svg', out: 'public/favicon-16.png', size: 16 },
]
const browser = await chromium.launch()
for (const { src, out, size } of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const svg = readFileSync(resolve(src), 'utf8')
  await page.setContent(`<!doctype html><body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`)
  await page.screenshot({ path: resolve(out), clip: { x: 0, y: 0, width: size, height: size } })
  console.log(out)
  await page.close()
}
await browser.close()
```

Run: `node scripts/gen-icons.mjs` → 4 PNGs em `public/`.

- [ ] **Step 3: Manifest + index.html**

```json
{
  "name": "The GOAT",
  "short_name": "The GOAT",
  "description": "Viva uma carreira inteira na NBA e persiga o legado de GOAT.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#A8231C",
  "theme_color": "#A8231C",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`index.html`: manter `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`; adicionar `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />`, `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />`, `<link rel="manifest" href="/manifest.webmanifest" />`; trocar `<meta name="theme-color" content="#0d0b08" />` por `#A8231C` (o `#0d0b08` é resto do tema dourado morto).

- [ ] **Step 4: Verificar + commit**

Run: `npm run build` e conferir que `dist/` contém favicon/manifest/PNGs; `npm run preview` e olhar a aba.

```bash
rtk git add public scripts/gen-icons.mjs index.html
rtk git commit -m "feat(icones): favicon e PWA com o icone do app (13a)"
```

---

### Task 5: Fechamento da Fase 1 — review, merge, deploy

- [ ] **Step 1:** Review de branch (superpowers:requesting-code-review) sobre `feat/icones`; aplicar fixes.
- [ ] **Step 2:** `npm test` + `npx tsc -p tsconfig.app.json --noEmit` + `node tests/e2e-playthrough.mjs` (nada de setup mudou ainda — deve passar como está).
- [ ] **Step 3:** Merge em `master`, push.
- [ ] **Step 4:** Deploy: `npm run build && npx wrangler pages deploy dist --project-name=the-goat --branch=master`.
- [ ] **Step 5:** Atualizar `HANDOFF.md` (decisão nova: sistema de ícones; arquitetura: `Icon.tsx`/`Crest.tsx`/`motif`) e commitar.

---

# FASE 2 — INÍCIO (setup, modos, cartão, save v7)

### Task 6: Estado — fases de setup, identidade, modos, save v7 (TDD)

**Files:**
- Modify: `src/state.ts`, `src/engine/types.ts` (interface `Career`), `src/App.tsx`
- Test: `tests/state.test.ts` (casos novos)

**Interfaces:**
- Produces:
  - `export type GameMode = 'normal' | 'goat' | 'rapido'` (em `src/engine/types.ts`)
  - `Career` ganha `mode: GameMode | null; name: string; number: number | null; lastName: string`
  - `Phase` ganha `'setupMode' | 'setupIdentity'` (15 → 17)
  - `GameState.setup: { mode: GameMode | null }`
  - Ações: `{ type: 'START_SETUP' }`, `{ type: 'SET_MODE'; mode: GameMode }`, `{ type: 'BEGIN_CAREER'; seed: number; name: string; number: number }`
  - **`NEW_GAME` morre** — `BEGIN_CAREER` assume o papel (ajuste aprovado vs spec: `SET_IDENTITY` fundido no payload do `BEGIN_CAREER`; nome/número são estado local da tela até o dispatch)
  - `STORAGE_KEY = 'thegoat:v7'`

- [ ] **Step 1: Testes falhando**

```ts
// tests/state.test.ts — adicionar (seguir helpers existentes do arquivo)
describe('setup de carreira', () => {
  it('home → setupMode → setupIdentity → attrDraft com identidade no career', () => {
    let s = initialState('pt')
    s = gameReducer(s, { type: 'START_SETUP' })
    expect(s.phase).toBe('setupMode')
    s = gameReducer(s, { type: 'SET_MODE', mode: 'goat' })
    expect(s.phase).toBe('setupIdentity')
    expect(s.setup.mode).toBe('goat')
    s = gameReducer(s, { type: 'BEGIN_CAREER', seed: 42, name: 'Marcos da Silva Vieira', number: 8 })
    expect(s.phase).toBe('attrDraft')
    expect(s.career).toMatchObject({ mode: 'goat', name: 'Marcos da Silva Vieira', number: 8, lastName: 'Vieira' })
    expect(s.currentPlayerId).not.toBeNull()
  })

  it('valida nome (2-22) e número (0-99) no BEGIN_CAREER', () => {
    let s = gameReducer(gameReducer(initialState('pt'), { type: 'START_SETUP' }), { type: 'SET_MODE', mode: 'normal' })
    expect(gameReducer(s, { type: 'BEGIN_CAREER', seed: 1, name: 'X', number: 8 }).phase).toBe('setupIdentity')
    expect(gameReducer(s, { type: 'BEGIN_CAREER', seed: 1, name: 'Nome Válido', number: 100 }).phase).toBe('setupIdentity')
    expect(gameReducer(s, { type: 'BEGIN_CAREER', seed: 1, name: 'Nome Válido', number: 0 }).phase).toBe('attrDraft')
  })

  it('modo goat: DRAFT_REROLL é no-op', () => {
    let s = beginCareer({ mode: 'goat', seed: 42 })  // helper: START_SETUP+SET_MODE+BEGIN_CAREER
    const before = s.rngCalls
    s = gameReducer(s, { type: 'DRAFT_REROLL' })
    expect(s.rngCalls).toBe(before)
    expect(s.rerollUsed).toBe(false)
  })

  it('save v6 é descartado no load; v7 sobrevive', () => {
    localStorage.setItem('thegoat:v6', JSON.stringify({ seed: 1, phase: 'home' }))
    expect(loadState()).toBeNull()
    expect(localStorage.getItem('thegoat:v6')).toBeNull()
  })
})
```

O restante de `tests/state.test.ts` (e `state-*.test.ts`) usa `NEW_GAME` — criar helper `beginCareer({ mode = 'normal', seed, name = 'Test Player', number = 1 })` num util do teste e trocar mecanicamente os `dispatch NEW_GAME` por ele.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/state.test.ts` → FAIL.

- [ ] **Step 3: Implementar em `state.ts`**

```ts
// Phase e VALID_PHASES: + 'setupMode' | 'setupIdentity'
// GameState: + setup: { mode: GameMode | null }
// initialState: setup: { mode: null }, career: { seasons: [], fame: 0, mode: null, name: '', number: null, lastName: '' }
export const STORAGE_KEY = 'thegoat:v7'

case 'START_SETUP':
  if (state.phase !== 'home') return state
  return { ...state, phase: 'setupMode', setup: { mode: null } }

case 'SET_MODE':
  if (state.phase !== 'setupMode') return state
  return { ...state, phase: 'setupIdentity', setup: { mode: action.mode } }

case 'BEGIN_CAREER': {
  if (state.phase !== 'setupIdentity' || !state.setup.mode) return state
  const name = action.name.trim()
  if (name.length < 2 || name.length > 22) return state
  if (!Number.isInteger(action.number) || action.number < 0 || action.number > 99) return state
  const lastName = name.split(/\s+/).at(-1)!
  const { rng, calls } = makeCountedRng(action.seed, 0)
  const first = drawPlayer(rng, [])
  return {
    ...initialState(state.lang),
    seed: action.seed, rngCalls: calls(),
    currentPlayerId: first.id, drawnIds: [first.id],
    league: initLeague(), phase: 'attrDraft',
    timePressure: state.timePressure,        // mesmo padrão do NEW_GAME antigo (bug 6 do jogo-vivo)
    setup: { mode: state.setup.mode },
    career: { seasons: [], fame: 0, mode: state.setup.mode, name, number: action.number, lastName },
  }
}

// DRAFT_REROLL: guarda nova no topo
if (state.career.mode === 'goat') return state
```

`loadState`: adicionar `localStorage.removeItem('thegoat:v6')`; defaults `parsed.setup = parsed.setup ?? { mode: null }` e, para o shape do career, `if (typeof parsed.career?.name !== 'string') return null` **apenas** quando `effectivePhase !== 'home'` (save em home sem carreira iniciada é válido; qualquer fase de jogo sem identidade = save incompatível → descarta).

`App.tsx` (boot): save no meio do setup não vira "RETOMAR" — a carreira ainda não começou:

```ts
const midSetup = saved.phase === 'setupMode' || saved.phase === 'setupIdentity'
return { ...saved, phase: 'home' as const, resumePhase: midSetup ? null : saved.phase, hubOpen: false }
```

`applyFame` e demais spreads de `career` preservam os campos novos por spread (`{ seasons, fame }` → conferir que `applyFame` usa `{ ...career, seasons: [...], fame }` — hoje ele **reconstrói** o objeto: trocar para spread para não perder identidade).

- [ ] **Step 4: Rodar e ver passar** — `npm test` + typecheck → verdes.

- [ ] **Step 5: Commit**

```bash
rtk git add src/state.ts src/engine/types.ts src/App.tsx tests
rtk git commit -m "feat(inicio): fases de setup, identidade no career, modos, save v7"
```

---

### Task 7: Modo rápido no reducer (TDD)

**Files:**
- Modify: `src/state.ts`
- Test: `tests/state-playoffs.test.ts` ou arquivo novo `tests/state-rapido.test.ts`

**Interfaces:**
- Consumes: `career.mode` (Task 6); `autoResolveGame`/`pausePlayoffGame`/`openPlayoffGame`/`continuePlayoffs` (já existem em `state.ts`)
- Produces: `fastForwardPostseason(state, rng, calls)` (função interna)

- [ ] **Step 1: Testes falhando**

```ts
// tests/state-rapido.test.ts
describe('modo rápido', () => {
  it('temporada inteira sem fases de jogo: PLAY_SEASON nunca para em seasonAdvance/keyGame/playoffGame/gameResult', () => {
    let s = careerAtPreseason({ mode: 'rapido', seed: 123 })  // helper: setup+draft+oferta até preseason
    s = gameReducer(s, { type: 'PLAY_SEASON', focus: 'scoring' })
    // pausas legítimas: eventDecision / tradeDecision; senão fecha em seasonResult
    while (s.phase === 'eventDecision' || s.phase === 'tradeDecision') {
      s = s.phase === 'eventDecision'
        ? gameReducer(s, { type: 'EVENT_DECISION', choice: 'a' })
        : gameReducer(s, { type: 'TRADE_DECISION', accept: false })
    }
    expect(s.phase).toBe('seasonResult')
    expect(s.calendar).toBeNull()          // regular fechada
    expect(s.seasonOutcome).not.toBeNull()
  })

  it('replay: mesmo seed em rapido = mesmo desfecho de um jogador que pula tudo no normal', () => {
    const finalRapido = runFullSeason({ mode: 'rapido', seed: 777 })
    const finalNormal = runFullSeasonSkippingEverything({ mode: 'normal', seed: 777 })
    // RUN_TO_PLAYOFFS + SKIP_GAME/SKIP_SERIES em tudo — mesmas calls, mesmo registro
    expect(finalRapido.career.seasons[0]).toEqual(finalNormal.career.seasons[0])
    expect(finalRapido.rngCalls).toBe(finalNormal.rngCalls)
  })
})
```

(Os helpers `careerAtPreseason`/`runFullSeason*` seguem o padrão dos helpers já existentes em `tests/state-playoffs.test.ts` — reusar/estender os de lá.)

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

Ponto único de decisão (spec §Riscos): duas mudanças em `state.ts`.

(a) `startSeasonCalendar`: calendário nasce com `autoRun: state.career.mode === 'rapido'` (em vez de `false`). Com `autoRun` ligado, `advanceCalendar` já joga os key games com `playKeyGameAuto` (mesmo contrato de calls) e nunca pausa em `seasonAdvance` — comportamento idêntico ao `RUN_TO_PLAYOFFS` de hoje, só que desde o jogo 1. O deadline (tradeDecision) continua pausando.

(b) Pós-temporada: generalizar o padrão do `SKIP_SERIES` para todos os rounds quando `rapido`:

```ts
// modo rápido: resolve a pós-temporada inteira sem telas — mesma sequência de calls
// de um jogador dando SKIP em todos os jogos (contrato da decisão-chave 11).
function fastForwardPostseason(state: GameState, rng: Rng, calls: () => number): GameState {
  let s = state
  let guard = 0
  while (guard++ < 120) {
    if (s.phase === 'gameResult' && s.pendingPlayoffs) { s = continuePlayoffs(s, rng, calls); continue }
    if (s.phase === 'playoffGame' && s.pendingGame) {
      s = pausePlayoffGame(s, s.pendingPlayoffs!, autoResolveGame(s.pendingGame, s.build!, s.age, rng), true, calls)
      continue
    }
    if (s.phase === 'playoffGame' && s.pendingPlayoffs) { s = openPlayoffGame(s, s.pendingPlayoffs, rng, calls); continue }
    return s
  }
  throw new Error('fastForwardPostseason: guard estourou')
}
```

Aplicar no fim de `closeRegularSeason` (o único ponto onde a pós-temporada começa): se `state.career.mode === 'rapido'`, retornar `fastForwardPostseason(resultado, rng, calls)` em vez do resultado direto. (`continuePlayoffs` chamado de dentro do loop cobre a continuação; o dispatch `CONTINUE` externo nunca vê `playoffGame` no rapido.)

- [ ] **Step 4: Rodar e ver passar** — `npm test` + typecheck. O teste de replay (rapido ≡ skip-tudo) é a prova de que o consumo de RNG não mudou — se ele passa, calibração não precisa rodar.

- [ ] **Step 5: Commit**

```bash
rtk git add src/state.ts tests/state-rapido.test.ts
rtk git commit -m "feat(inicio): modo rapido — temporada e playoffs auto-resolvidos sem telas"
```

---

### Task 8: i18n — chaves novas (PT + EN)

**Files:**
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`
- Test: `tests/i18n.test.ts` (paridade já cobre — só rodar)

- [ ] **Step 1: Adicionar chaves (PT abaixo; EN traduzir 1:1)**

```json
{
  "home.steps.label": "EM TRÊS PASSOS",
  "home.steps.1": "Roube um dom de cada lenda — e pague na fraqueza dela",
  "home.steps.2": "Escolha onde jogar e decida os jogos que importam",
  "home.steps.3": "Aposente e ouça como a história vai te chamar",
  "home.savelineId": "{name} · {number} · T{n} · {team}",
  "home.noteSetup": "ESCOLHER O MODO É O PRIMEIRO PASSO · APAGA O SAVE ATUAL",
  "setup.step1": "ETAPA 1 DE 2 · MODO",
  "setup.step2": "ETAPA 2 DE 2 · IDENTIDADE",
  "setup.modeTitle": "Como você quer jogar",
  "setup.modeSub": "O modo define o tamanho da carreira e as regras do roubo. Não muda depois de começar.",
  "setup.chosen": "ESCOLHIDO",
  "setup.how": "COMO FUNCIONA · 3 LINHAS",
  "setup.continue": "Continuar",
  "setup.modeNote": "O MODO NÃO MUDA DEPOIS DE COMEÇAR",
  "setup.jersey": "COSTAS DA CAMISA",
  "setup.nameLabel": "SEU NOME",
  "setup.press": "A IMPRENSA VAI TE CHAMAR DE «{lastName}»",
  "setup.numberLabel": "SEU NÚMERO",
  "setup.typeOther": "DIGITAR OUTRO",
  "setup.modeRecap": "MODO ESCOLHIDO",
  "setup.begin": "Começar a carreira",
  "setup.beginNote": "NOME E NÚMERO FICAM NO CARTÃO PARA SEMPRE",
  "mode.normal.name": "CARREIRA",
  "mode.normal.desc": "O jogo como ele é — visão total e decisões em quadra.",
  "mode.normal.meta": "COMPLETO",
  "mode.normal.line1": "Roube 8 atributos de lendas com valores e preço à vista, com 1 novo sorteio.",
  "mode.normal.line2": "Decida os jogos-chave e os playoffs momento a momento.",
  "mode.normal.line3": "Aposente quando quiser — ou quando o corpo mandar — e receba o veredito.",
  "mode.goat.name": "MODO GOAT",
  "mode.goat.desc": "Montagem às cegas, sem rede de segurança.",
  "mode.goat.meta": "ÀS CEGAS",
  "mode.goat.line1": "Roubo às cegas: números da lenda e preço ficam escondidos — só os seus valores aparecem.",
  "mode.goat.line2": "Sem novo sorteio: a lenda que veio é a lenda que fica.",
  "mode.goat.line3": "Do draft em diante, o jogo é o mesmo — mas o time que você montou é surpresa.",
  "mode.rapido.name": "MODO RÁPIDO",
  "mode.rapido.desc": "Só as decisões de carreira, temporadas em minutos.",
  "mode.rapido.meta": "SIMULADO",
  "mode.rapido.line1": "Sem decisões de jogo: jogos-chave e playoffs simulados com a política padrão.",
  "mode.rapido.line2": "As encruzilhadas continuam: trocas, eventos, contratos e aposentadoria.",
  "mode.rapido.line3": "Uma temporada em poucos toques — ideal pra correr atrás do veredito.",
  "bar.metaId": "{name} · {number} · T{n} · {team}",
  "draft.goat.stealBtn": "Roubar {slot}",
  "card.final": "SÚMULA FINAL · {from}—{to}",
  "card.mode": "MODO · {mode}",
  "card.verdictLabel": "O VEREDITO",
  "card.teamSeasons": "{team} · {n} TEMPORADAS",
  "card.points": "PONTOS",
  "card.rings": "ANÉIS",
  "card.mvps": "MVPS",
  "card.legacy": "LEGADO",
  "card.memory": "O QUE FICOU NA MEMÓRIA",
  "card.pct": "ACIMA DE {p}% DAS CARREIRAS",
  "card.scale.reserva": "RESERVA",
  "card.scale.titular": "TITULAR",
  "card.scale.estrela": "ESTRELA",
  "card.scale.lenda": "LENDA",
  "card.scale.goat": "GOAT"
}
```

Notas: `home.continue` (RETOMAR →) já existe e continua; `home.noteWipe`/`home.note` continuam para os casos sem save; o rodapé do cartão reusa `share.card.hook` existente (pendência de domínio é do dono — não inventar URL nova). Subtítulo do tier na faixa de percentil: reusar a chave que o `Verdict.tsx` já usa para "UM DEGRAU ABAIXO DO GOAT" (grep no pt.json; se for interpolada com score, criar `card.tierSub.{tier}` por tier — 7 chaves).

- [ ] **Step 2: Rodar** — `npx vitest run tests/i18n.test.ts` → PASS (paridade PT/EN).

- [ ] **Step 3: Commit**

```bash
rtk git add src/data/i18n
rtk git commit -m "feat(inicio): chaves i18n do setup, modos e cartao"
```

---

### Task 9: Home 10a

**Files:**
- Modify: `src/ui/screens/Home.tsx`

**Interfaces:**
- Consumes: `START_SETUP` (Task 6), chaves `home.steps.*`/`home.savelineId`/`home.noteSetup` (Task 8)

- [ ] **Step 1: Implementar**

Mudanças sobre o `Home.tsx` atual (masthead/toggle/tagline ficam):

- Masthead: `paddingTop` 44 → 38.
- **Bloco "EM TRÊS PASSOS"** entre a explicação e o rodapé, entre `<hr className="rule" />`, `padding: '14px 0'`, `gap: 11`: rótulo `mono-label` + 3 linhas, cada uma `display:flex` com numeral (`Archivo Black` — classe `headline` — `fontSize: 13`, cor `var(--red)`, largura 16) e texto `fontSize: 13, lineHeight: 1.4` (`home.steps.1..3`). O parágrafo `home.explain` atual morre (o bloco de passos assume o papel).
- Linha de retomar: quando `career.name` existe, usar `home.savelineId` com `{ name: nameShort, number: career.number, n, team }` onde `nameShort = career.name === career.lastName ? career.lastName : career.name[0] + '. ' + career.lastName` ("M. Vieira"); fallback para `home.saveline` se save antigo sem identidade (não acontece com v7, mas o load já descartou — código só precisa do caminho novo).
- Botão "Nova carreira": `onClick={() => dispatch({ type: 'START_SETUP' })}` (sem seed — o seed vai no `BEGIN_CAREER`).
- Nota do rodapé: `home.noteSetup` quando há save (substitui `home.noteWipe` nesse contexto), `home.note` sem save.

- [ ] **Step 2: Verificar** — typecheck + `npm run dev` sanity (bloco de passos, retomar com nome, Nova carreira leva ao setup — tela quebrada até a Task 10, ok se `setupMode` cair no fallback do App; **incluir no App.tsx o roteamento das duas fases novas JÁ nesta task** para não quebrar: `p === 'setupMode' || p === 'setupIdentity' ? <Setup .../> : ...` com um componente stub `Setup` que a Task 10 preenche).

- [ ] **Step 3: Commit**

```bash
rtk git add src/ui/screens/Home.tsx src/App.tsx src/ui/screens/Setup.tsx
rtk git commit -m "feat(inicio): Home 10a — tres passos, retomar com identidade, CTA abre setup"
```

---

### Task 10: Tela 10b — modo de jogo

**Files:**
- Modify: `src/ui/screens/Setup.tsx` (criado como stub na Task 9)

**Interfaces:**
- Consumes: `SET_MODE` (Task 6), chaves `setup.*`/`mode.*` (Task 8)
- Produces: componente `Setup({ state, dispatch })` roteando `setupMode` | `setupIdentity` internamente

- [ ] **Step 1: Implementar a etapa 1**

Estrutura (valores do README/canvas):

- Cabeçalho: filete duplo vermelho; esquerda `setup.step1` em `mono-label`; direita dois traços 22×4px (1º `var(--red)`, 2º `var(--track)`).
- Título `headline` 30px em duas linhas (`setup.modeTitle` quebrada em "Como você" / "quer jogar" — usar `\n` na chave ou split no espaço do meio como o `home.title` faz) + subtítulo 13px (`setup.modeSub`).
- Seleção local: `const [sel, setSel] = useState<GameMode>('normal')`.
- Modo selecionado = bloco preto (`strip strip--ink`, `padding: '16px 18px'`, gap 13): nome (`headline` ~15px) + `setup.chosen` em `mono-label` cor `var(--accent-warm)`; divisor `1px solid var(--ink-3)`; rótulo `setup.how` em mono 9px; três linhas numeradas ("01/02/03" em mono 11px `var(--accent-warm)`, coluna 14px; texto `mode.{sel}.line1..3` em 12.5px, lineHeight 1.45).
- Modos não selecionados = linhas de jornal separadas por `1px solid var(--rule)` (`padding: '15px 0'`): nome 15px weight 700 uppercase + `mode.{id}.desc` 12px `var(--body-dim)` + `mode.{id}.meta` em mono 10px à direita; clique = `setSel(id)`.
- Ações: `btn btn--ink` `setup.continue` → `dispatch({ type: 'SET_MODE', mode: sel })`; nota `mono-label` centralizada `setup.modeNote`.

- [ ] **Step 2: Verificar** — typecheck; dev sanity: Home → Nova carreira → escolher modo → Continuar avança pra etapa 2 (stub).

- [ ] **Step 3: Commit**

```bash
rtk git add src/ui/screens/Setup.tsx
rtk git commit -m "feat(inicio): tela de modo de jogo (10b) com os 3 modos"
```

---

### Task 11: Tela 10c — nome e número

**Files:**
- Modify: `src/ui/screens/Setup.tsx`

**Interfaces:**
- Consumes: `BEGIN_CAREER` (Task 6), chaves `setup.*` (Task 8), `state.setup.mode`

- [ ] **Step 1: Implementar a etapa 2**

- Cabeçalho: `setup.step2`; traços com o 1º `var(--ink)` (feito) e o 2º `var(--red)` (atual).
- Estado local: `const [name, setName] = useState('')`, `const [number, setNumber] = useState<number | null>(null)`, `const [typing, setTyping] = useState(false)`.
- `lastName = name.trim().split(/\s+/).at(-1) ?? ''`.
- **Preview das costas da camisa**: caixa `1px solid var(--rule)` sobre `var(--paper-2)`, `padding: '18px 18px 20px'`, centralizada; `setup.jersey` mono 9px `letterSpacing: '0.24em'`; sobrenome `headline` 17px `letterSpacing: '0.14em'`; numeral `headline` 108px `lineHeight: 0.82` cor `var(--red)` (placeholder "—"/"00" apagado quando vazio: usar `opacity: 0.25`).
- **Nome**: rótulo `setup.nameLabel`; `<input>` com `borderBottom: '1px solid var(--ink)'`, fontSize 24, fontWeight 700, fundo transparente, sem outline/borda/raio, `maxLength={22}`; abaixo `setup.press` com `{lastName}` (renderizar só com `name.trim().length >= 2`).
- **Número**: rótulo `setup.numberLabel` + botão `setup.typeOther` em `topbar__link` à direita (alterna `typing` — mostra `<input type="number" inputMode="numeric" min={0} max={99}>` no lugar dos chips). Cinco sugestões `[3, 8, 11, 24, 77]` em linha (`flex: 1`, altura 44, gap 7): não escolhida `1px solid var(--rule)` numeral `headline` 17px `var(--dim)`; escolhida faixa preta com numeral creme. **Sem linha de validação de franquia** (divergência aprovada — time ainda não existe no setup).
- **Recap do modo**: bloco `borderLeft: '2px solid var(--red)'`, `paddingLeft: 12`: `setup.modeRecap` mono + `mode.{state.setup.mode}.name`.
- **CTA**: `btn btn--primary` (vermelho) `setup.begin`, `disabled` quando `name.trim().length < 2 || number === null`; `onClick={() => dispatch({ type: 'BEGIN_CAREER', seed: Date.now() % 2 ** 31, name, number })}`. Nota `setup.beginNote`.

- [ ] **Step 2: Verificar** — typecheck + dev sanity: fluxo completo Home → modo → identidade → attrDraft; preview atualiza a cada tecla; CTA desabilita corretamente.

- [ ] **Step 3: Commit**

```bash
rtk git add src/ui/screens/Setup.tsx
rtk git commit -m "feat(inicio): tela de nome e numero (10c) com preview da camisa"
```

---

### Task 12: Identidade na barra + modo GOAT no AttrDraft

**Files:**
- Modify: `src/ui/components/CareerBar.tsx`, `src/ui/screens/AttrDraft.tsx`

**Interfaces:**
- Consumes: `career.{name,lastName,number,mode}` (Task 6), `bar.metaId`/`draft.goat.stealBtn` (Task 8)

- [ ] **Step 1: CareerBar**

Quando `career.name` existe: `bar.metaId` com `{ name: nameShort, number, n, team }` (mesmo `nameShort` da Home — extrair helper `shortName(career)` em `src/ui/format.ts`) + sufixo de anéis existente (`bar.rings`). Home e CareerBar passam a usar o mesmo helper.

- [ ] **Step 2: AttrDraft modo GOAT**

Com `state.career.mode === 'goat'`:
- Valor da lenda (o `headline` 22px com `player.attrs[slot]`): renderizar `"??"`.
- Linha de preço (`draft.price`): não renderizar.
- Linha `draft.yours` (comparação "94 · 62"): mostrar só o seu valor atual (build parcial — hoje mostra '—'; manter, só sem o valor da lenda).
- `draft.legendMeta` ("{era} · FRAQUEZA {slot}"): renderizar só `t(lang, 'era.' + player.era)` (a fraqueza é o preço — escondida junto).
- Resumo de seleção (`draft.preview` + `draft.projected` com OVR projetado): não renderizar (vaza os números).
- Botão de roubo: `draft.goat.stealBtn` (sem o valor).
- Botão de reroll: não renderizar (reducer já é no-op — Task 6).
- `DraftDone` (reveal): inalterado — revela tudo em qualquer modo.

- [ ] **Step 3: Verificar** — typecheck + `npm test`; dev sanity de um draft GOAT (nada de número da lenda na tela).

- [ ] **Step 4: Commit**

```bash
rtk git add src/ui/components/CareerBar.tsx src/ui/screens/AttrDraft.tsx src/ui/format.ts src/ui/screens/Home.tsx
rtk git commit -m "feat(inicio): identidade na barra; roubo as cegas no modo GOAT"
```

---

### Task 13: Cartão da carreira 10d (`share.ts`)

**Files:**
- Modify: `src/ui/share.ts` (reescrever `drawShareCard`), `src/ui/screens/Verdict.tsx` (assinatura nova)
- Test: `tests/share.test.ts` (ajustar ao que ele cobre hoje — provavelmente `shareText`; adicionar teste do percentil)

**Interfaces:**
- Consumes: `Verdict` (engine), `career` (identidade + `seasons`), `state.leagueHistory` (anos), chaves `card.*` (Task 8)
- Produces: `drawShareCard(canvas, data: CardData)` com
  `export interface CardData { verdict: Verdict; name: string; number: number; mode: GameMode; teamLabel: string; seasons: number; yearFrom: number; yearTo: number; memories: { year: number; text: string }[]; lang: Lang }`
  e `export function percentileOf(score: number): number`

- [ ] **Step 1: Teste falhando (percentil)**

```ts
// tests/share.test.ts — adicionar
import { percentileOf } from '../src/ui/share'
it('percentil é monotônico e bate as faixas', () => {
  expect(percentileOf(2000)).toBe(99)
  expect(percentileOf(1500)).toBe(96)
  expect(percentileOf(100)).toBe(10)
  let prev = -1
  for (const s of [0, 200, 400, 600, 900, 1200, 1600, 2000]) {
    expect(percentileOf(s)).toBeGreaterThanOrEqual(prev); prev = percentileOf(s)
  }
})
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar**

```ts
// Tabela fixa de faixas de legado → percentil (apresentação, não fórmula travada;
// aproximada das distribuições do harness de calibração).
const PERCENTILE_BANDS: Array<[number, number]> = [
  [1950, 99], [1400, 96], [1000, 88], [700, 72], [450, 52], [250, 30], [0, 10],
]
export function percentileOf(score: number): number {
  return PERCENTILE_BANDS.find(([min]) => score >= min)![1]
}
```

`drawShareCard` novo — canvas 1080×1350, valores do quadro (a 50%) dobrados, zero raio/sombra/gradiente. Layout de cima pra baixo (`PAD = 52` lateral):

1. Fundo `#EDE6D6` full.
2. Cabeçalho (y≈64): `card.final` ({from}—{to}) à esquerda, `card.mode` ({mode} = `t('mode.'+mode+'.name')`) à direita — `IBM Plex Mono` 22px, `#6B6455`, uppercase, tracking largo (`ctx.letterSpacing = '4px'` se disponível; senão espaçar manualmente com split/join).
3. Filete duplo vermelho 8px total (duas linhas de 3px com 2px de vão), `margin` lateral 52.
4. Bloco de identidade (y≈150–420): esquerda — `card.verdictLabel` mono 22px; tier `Archivo Black` 168px `#A8231C` uppercase com auto-shrink pra caber em `W - 300` (reusar o loop de shrink do código atual); nome completo 40px weight 700 uppercase Archivo; `card.teamSeasons` mono 24px (`teamLabel` ex.: "OKC THUNDER"). Direita — quadro 192×192 `4px solid #1C1A16` com o número `Archivo Black` 104px centralizado.
5. Grade de 4 números (y≈470, altura ~150): 4 colunas com `gap: 2px` sobre `#C6BCA2` (desenhar retângulo de fundo `#C6BCA2` e células `#EDE6D6` por cima), células `padding 24`: rótulos `card.points/rings/mvps/legacy` mono 18px `#6B6455`; valores `Archivo Black` 48px `#1C1A16`, LEGADO em `#A8231C`. Valores: `totals.points` (formatar milhar com ponto: `pt` → `28.450`; usar `toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')`), `counts.ring`, `counts.mvp`, `verdict.score`.
6. Memórias (y≈680): `card.memory` mono 22px; até 2 linhas — ano mono 24px `#A8231C` coluna de 76px + fato 30px `#1C1A16`; segunda linha com filete `1px #DCD3BE` acima. `memories` vem do chamador (Verdict.tsx monta com a mesma fonte da lista "O QUE FICOU NA MEMÓRIA" da tela 3d — ano de `leagueHistory` + chave i18n do momento icônico; pegar os 2 primeiros).
7. Faixa de percentil (y≈900, altura ~170, `#1C1A16` full-bleed): `card.pct` com `{p: percentileOf(score)}` mono 22px `#A79C86` à esquerda; subtítulo do tier em `#E8B24A` à direita (mesma chave da tela de veredito); barra 14px (preenchimento `#E8B24A` na proporção `p/100`, resto `#3D382D`); escala `card.scale.*` mono 18px `#8B8171` distribuída (5 rótulos, `RESERVA` alinhado à esquerda, `GOAT` à direita).
8. Rodapé vermelho (base, altura ~90, `#A8231C` full-bleed): "THE GOAT" `Archivo Black` 30px `#F6F0E4` à esquerda; `share.card.hook` (chave existente — pendência de domínio é do dono) mono 22px `#F0C4C0` à direita.

`Verdict.tsx`: montar `CardData` e aguardar `document.fonts.ready` antes de desenhar (se o código atual já não faz, adicionar — Archivo Black no canvas exige fonte carregada).

- [ ] **Step 4: Rodar e ver passar** — `npm test` + typecheck; dev sanity: terminar uma carreira (ou save editado) e gerar o cartão; conferir visual contra o quadro 10d.

- [ ] **Step 5: Commit**

```bash
rtk git add src/ui/share.ts src/ui/screens/Verdict.tsx tests/share.test.ts
rtk git commit -m "feat(inicio): cartao da carreira 10d com identidade, modo e percentil"
```

---

### Task 14: e2e playthrough + sanity dos modos

**Files:**
- Modify: `tests/e2e-playthrough.mjs`

- [ ] **Step 1: Atravessar o setup**

Todos os pontos que clicam `button.btn--ink` com texto "Nova carreira" (linhas ~102, ~432, ~468 hoje) passam a encadear:

```js
await page.locator('button.btn--ink', { hasText: 'Nova carreira' }).click()
// 10b: modo CARREIRA já vem selecionado — só continuar
await page.locator('button.btn--ink', { hasText: 'Continuar' }).click()
// 10c: nome + número
await page.locator('input').first().fill('Teste Da Silva')
await page.locator('button', { hasText: '8' }).first().click()
await page.locator('button.btn--primary', { hasText: 'Começar a carreira' }).click()
// segue no attrDraft como antes
```

Extrair como helper `newCareer(page)` no topo do arquivo e usar nos 3 pontos.

- [ ] **Step 2: Sanity do modo rápido (novo bloco no fim do e2e)**

Novo bloco: `newCareer` escolhendo o MODO RÁPIDO (clicar a linha "MODO RÁPIDO" antes de Continuar), draft rápido (8 primeiros atributos), oferta, foco, e asserir que depois de "Começar a temporada" a página chega a uma tela de balanço (`Ver o balanço`/`seasonResult`) **sem** nunca renderizar `.game-plays` nem o botão "Assumir o próximo jogo" (pausas de encruzilhada tratadas como no loop principal).

- [ ] **Step 3: Rodar** — `node tests/e2e-playthrough.mjs` → OK completo. (Lembrete de infra: primeira run pós-install pode flakear no vitest — re-rodar; e a máquina do dono tem reduced-motion sempre ativo, o e2e já força `no-preference` por default do Playwright.)

- [ ] **Step 4: Commit**

```bash
rtk git add tests/e2e-playthrough.mjs
rtk git commit -m "test(inicio): e2e atravessa o setup; sanity do modo rapido"
```

---

### Task 15: Fechamento da Fase 2 — review, merge, deploy

- [ ] **Step 1:** Review de branch (superpowers:requesting-code-review) sobre `feat/inicio`; aplicar fixes.
- [ ] **Step 2:** `npm test` + typecheck + `node tests/e2e-playthrough.mjs`. Calibração: só se alguma task tiver desviado do plano e mudado ordem/contagem de RNG (o teste de replay da Task 7 é a evidência de que não mudou).
- [ ] **Step 3:** Sanity manual em browser: um draft GOAT completo (nada vaza), uma temporada RÁPIDO (sem telas de jogo), cartão gerado com nome/número/modo.
- [ ] **Step 4:** Merge em `master`, push, deploy: `npm run build && npx wrangler pages deploy dist --project-name=the-goat --branch=master`.
- [ ] **Step 5:** Atualizar `HANDOFF.md`: decisão nova (setup/modos/identidade/v7 + cartão 10d), fases 15→17, `NEW_GAME`→`BEGIN_CAREER`, backlog (manchetes com apelido; linha de validação de número descartada). Commitar.

---

## Self-review do plano (feita)

- **Cobertura do spec:** Fase 1 — Icon (T1), Crest+motif (T2), substituições (T3), favicon/PWA (T4) ✓. Fase 2 — 10a (T9), 10b+modos (T10), 10c (T11), GOAT/AttrDraft+barra (T12), rápido (T7), estado/save v7 (T6), i18n (T8), cartão 10d (T13), e2e (T14) ✓. Fora de escopo do spec respeitado (sem manchetes com apelido, sem exports de loja).
- **Divergências aprovadas registradas:** linha de validação de franquia no número (morta), `SET_IDENTITY` fundido no `BEGIN_CAREER` (nome/número são estado local até o dispatch — registrado na Task 6).
- **Tipos consistentes:** `GameMode` definido em `engine/types.ts` (Task 6) e consumido em T7-T13; `Motif` em `engine/types.ts` (Task 2); `CardData`/`percentileOf` (Task 13); `shortName` em `format.ts` (Task 12, usado também na Home).
- **SVGs:** fonte verbatim committada em `docs/superpowers/plans/assets/2026-07-31-icones-canvas.html` — nenhuma task depende de acesso ao claude-design.
