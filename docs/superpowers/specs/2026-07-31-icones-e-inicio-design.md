# Spec — Ícones + Tela de Início (setup de carreira)

**Data:** 2026-07-31 · **Status:** aprovado pelo dono (brainstorm desta data)
**Fontes de design:** claude-design projeto "The GOAT" (`5a193998-626d-46ba-84f5-fd9a7d164ca5`) — `The GOAT - Ícones.dc.html` (quadros 12a e 13a) e `The GOAT - Redesign v1.dc.html` (quadros 10a–10d); valores hi-fi no `design_handoff_the_goat_redesign/README.md` (seções *Iconografia* e telas 10a–10d).

Duas entregas num spec, **duas fases de implementação com merge+deploy independentes**:

- **Fase 1 — Ícones**: 100% visual, zero engine, zero save, zero i18n de gameplay.
- **Fase 2 — Início**: abertura nova + setup em 2 etapas + modos de jogo + cartão 10d + save `v7`.

---

## Fase 1 — Ícones

### `<Icon name size tone? />` (`src/ui/components/Icon.tsx`)

- Mapa `name → conteúdo SVG` com os **33 ícones do quadro 12a**, copiados verbatim do canvas (viewBox `0 0 32 32`): bola, o GOAT (cabra), anel, título/troféu, cesta, camisa, treino, relógio, clutch, contrato, troca, lesão, tática, imprensa, temporada, evolução, embalo, veredito (coroa), aposentar, roubo (garra), preço/perda, encruzilhada, playoffs, pódio/legado, idade (ampulheta), físico (coração), treino de força, torcida, semente, recomeçar, carreira/hub, idioma, som.
- **Cores parametrizadas** (o canvas usa literais): tinta `#1C1A16` default; `tone="red"` (`#A8231C`) **só quando a coisa é sua** (seu anel, seu clutch, sua lesão, seu embalo); `tone="dim"` (`#6B6455`) quando é de outro jogador. Vazados internos = `var(--paper)`.
- **Tamanhos** 16/24/32/56. Abaixo de 24px entram as variantes simplificadas que o canvas já desenhou: bola perde as curvas laterais (só a cruz, stroke 2.2→2.6/3); demais ícones perdem vazados finos. Só implementar variantes desenhadas no canvas — não inventar.
- Ícone CAMISA usa `<text>` (numeral "8" em Archivo Black, fonte já carregada) — **aceito**, não converter pra path.
- Ícones são decorativos: `aria-hidden="true"`, sem chave i18n. Dentro de linha de texto, sempre `flex: none`.
- Sem biblioteca de ícones, sem PNG, sem emoji.

### `<Crest team size />` (`src/ui/components/Crest.tsx`)

- Estrutura fixa do canvas: escudo `M4 3h24v15c0 6-5 10.5-12 12.5C9 28.5 4 24 4 18V3Z` em `#1C1A16` + motivo em `<g transform="translate(6.7,5.4) scale(0.58)">` vazado em `var(--paper)`. **Não achatar** — manter o transform (o próprio canvas conta com scale afetando stroke-width).
- Mapa `motif → SVG` (30 motivos) no componente; a **associação `team → motif` é um campo novo em `src/data/teams.ts`** (trocar o motivo de um time = 1 linha). Associação aprovada: OKC raio · CHI touro · LAC âncora · HOU foguete · MIA chama · SAC coroa · POR pinheiro · GSW ponte · BOS chapéu de duende · MEM garra · DEN picareta · MIL cervo · DET engrenagem · SAS cacto · PHX sol · UTA montanha · BKN rede · ORL estrela · NOP pelicano · DAL ferradura · MIN lobo · TOR dinossauro · CHA abelha · PHI sino · CLE lança · IND roda · NYK farol · ATL asa · WAS varinha · LAL palmeira.
- **≤24px**: só o motivo achatado, sem escudo (variante "em contexto" do canvas, ex. Thunder `M18.5 7 11 17h4.5l-1.5 8 8-11h-5l1.5-7Z`).
- `teams.ts` é contrato do save (decisão-chave 10) — **adicionar campo não bumpa save**; não renomear/remover ids.

### Onde os ícones entram (substituições nas telas)

- **Brasão**: ofertas do draft (5a — os símbolos geométricos losango/círculo/barras **morrem**), pré-temporada (5b), renovação (6d), tabela do hub (4a/9a), cartão final.
- **Anel**: repetido em série (um por título) na cerimônia e no hub.
- **Clutch**: tira de momentos (8a) e momentos icônicos.
- **Lesão / troca**: encruzilhadas (5c).
- **Coroa (veredito)**: tela de veredito (3d).

### Favicon + PWA (quadro 13a)

- **SVG mestre 1024×1024 sem cantos arredondados** (máscara é do SO): campo `#A8231C`, cabra de perfil `#F6F0E4`, detalhes `#1C1A16` — camadas e paths do quadro 13a (chifre de trás cheio; chifre da frente separado por fio `#A8231C` de 1.3px; estrias/orelha vazada/narina/boca só na versão grande; barba escura).
- **Regras de escala do canvas**: abaixo de 60px caem estrias, orelha vazada e boca (ficam cabeça, chifres, olho, barba); fio entre chifres engrossa 1.3→1.8px.
- **Entrega web (sem lojas)**: `favicon.svg` + PNGs 32/16 (favicon) e 192/512 (PWA) em `public/`, `manifest.webmanifest` básico (name, icons, `display: standalone`, `background_color`/`theme_color` `#A8231C`), links no `index.html`. PNGs gerados por script one-off (`scripts/`) usando Playwright (já é dependência) — screenshot do SVG por tamanho.
- Nas telas do app continua valendo o ícone simples de 32px "O GOAT" do conjunto 12a.

### Testes (Fase 1)

- Teste de data: todo time de `teams.ts` tem motivo, e todo motivo referenciado existe no mapa (30/30). Vitest projeto `unit` (regra do projeto: vitest só em engine/state/data — componentes não ganham teste próprio; a paridade motivo↔time vive no nível de data).
- `npm test` + typecheck. Calibração **não** roda (zero RNG).

---

## Fase 2 — Início (10a–10d) + Modos

### Fluxo

`home` (10a) → "Nova carreira" → `setupMode` (10b) → `setupIdentity` (10c) → "Começar a carreira" (apaga save) → `attrDraft`. Retomar continua indo direto pra Home com linha "CARREIRA EM ANDAMENTO".

### 10a — Abertura (substitui a Home atual)

- Masthead `padding-top: 38px`; **bloco "EM TRÊS PASSOS"** entre filetes (rótulo mono + 3 linhas com numeral Archivo Black 13px vermelho em coluna de 16px) — é a explicação do jogo, não existe tela de tutorial.
- Linha de retomar mostra **nome + número**: "M. Vieira · 8 · T5 · OKC".
- Nota do rodapé: "ESCOLHER O MODO É O PRIMEIRO PASSO · APAGA O SAVE ATUAL".
- "Nova carreira" **não começa o jogo** — despacha `START_SETUP`.

### 10b — Modo de jogo (`phase: setupMode`)

Cabeçalho "ETAPA 1 DE 2 · MODO" + 2 traços de progresso; título "Como você quer jogar"; modo selecionado em bloco preto com "ESCOLHIDO" em `#E8B24A` e 3 linhas numeradas de regra; não selecionados como linhas de jornal. CTA preto "Continuar"; nota "O MODO NÃO MUDA DEPOIS DE COMEÇAR".

**Modos definidos pelo dono (2026-07-31)** — nenhum placeholder:

| id | Nome | Regras (as 3 linhas da tela) |
|---|---|---|
| `normal` | **CARREIRA** | O jogo completo como é hoje: 8 roubos com valores à vista, 1 reroll de lenda, jogos-chave e playoffs assistidos com decisões. |
| `goat` | **MODO GOAT** | Roubo às cegas: valores da lenda **e** preço (malus) escondidos — só os seus valores ficam visíveis; **sem reroll**; resto igual ao Carreira. Reveal completo dos números no `draftDone`. |
| `rapido` | **MODO RÁPIDO** | Sem escolhas nos jogos: jogos-chave e playoffs **auto-resolvidos com a política padrão** (telas `keyGame`/`playoffGame`/`gameResult` não aparecem; a temporada corre direto). Encruzilhadas (troca/evento), free agency e aposentadoria **continuam** — são decisões de carreira. |

**Contrato de engine: nenhuma fórmula muda.** GOAT = ocultação de UI + reroll indisponível (reroll só consome RNG quando usado — replay conta calls reais, nada quebra). RÁPIDO usa o auto-resolve existente (`autoResolveGame`/skip de série — decisão-chave 11: skip = mesmo contrato de calls, replay não distingue). **Calibração não re-roda** (distribuição da política padrão é a já calibrada).

### 10c — Nome e número (`phase: setupIdentity`)

- Preview das costas da camisa (sobrenome + numeral 108px vermelho), atualiza a cada tecla.
- Nome: input sublinhado, 24px; validação **2–22 caracteres** (vazio desabilita CTA). Apelido = **última palavra do nome** (`lastName`), derivado uma vez, mostrado em "A IMPRENSA VAI TE CHAMAR DE «{sobrenome}»".
- Número: obrigatório, 0–99; **5 sugestões** em linha + "DIGITAR OUTRO" (teclado numérico).
- **Divergência aprovada vs canvas**: a linha de validação de franquia ("Número 8 está livre em OKC" / "23 · APOSENTADO") **não existe** — no setup o time ainda não foi definido (draft vem depois). A linha some; sem substituto.
- Recap do modo com `border-left` vermelho.
- CTA **vermelho** "Começar a carreira" (irreversível, apaga o save) + nota "NOME E NÚMERO FICAM NO CARTÃO PARA SEMPRE".

### Estado e save

- `Phase` ganha `setupMode` e `setupIdentity` (15 → 17 fases).
- `setup: { mode: 'normal' | 'goat' | 'rapido' | null; name: string; number: number | null }` no `GameState` (transiente do fluxo de setup; persiste junto do state sem cerimônia).
- `career` ganha `{ mode, name, number, lastName }` — gravados no `BEGIN_CAREER`, **imutáveis depois**.
- Ações novas: `START_SETUP`, `SET_MODE`, `SET_IDENTITY`, `BEGIN_CAREER`. Toda transição via reducer, como sempre.
- **Save key bump → `thegoat:v7`** (`loadState` descarta v1–v6). Carreiras em andamento morrem — aceito pelo dono (padrão dos ciclos anteriores). Sem migração.
- Modo RÁPIDO no reducer: nos pontos que hoje entram em `keyGame`/`playoffGame`, com `career.mode === 'rapido'` o reducer resolve na hora com a política padrão e segue o fluxo sem parar nas fases de jogo. `timePressure` fica irrelevante nesse modo (não há lance clutch assistido).
- Modo GOAT na UI: `AttrDraft` esconde valor da lenda e preço quando `career.mode === 'goat'` (o draft só acontece depois do `BEGIN_CAREER`, então `career.mode` já existe); botão de reroll não renderiza.

### Onde a identidade aparece

- Barra de carreira: "M. Vieira · 8 · T5 · OKC" (inicial do primeiro nome + sobrenome + número).
- Linha de retomar da Home.
- Cartão da carreira (10d): nome completo + número em quadro + "MODO · {modo}".
- **Fora de escopo (v2)**: varredura de manchetes/i18n para usar o apelido «sobrenome» nos textos de eventos/imprensa — são dezenas de chaves; fica no backlog.

### 10d — Cartão da carreira (1080×1350)

- Substitui o card atual de `share.ts`. **Mantém a abordagem canvas direto** (padrão existente), layout novo 4:5; valores do quadro estão a 50% — dobrar tudo.
- Blocos: cabeçalho ("SÚMULA FINAL · {anos}" + "MODO · {modo}", filete duplo vermelho), identidade (tier 84px→168px vermelho, nome, time+temporadas, número em quadro 2px), grade de 4 números (PONTOS/ANÉIS/MVPS/LEGADO, este vermelho), "O QUE FICOU NA MEMÓRIA" (2 momentos), faixa de percentil preta com barra `#E8B24A` e escala RESERVA·TITULAR·ESTRELA·LENDA·GOAT, rodapé vermelho "THE GOAT · JOGUE A SUA · THE-GOAT.APP".
- **Percentil**: tabela fixa de faixas de legado (score → percentil), determinística, em código — sem servidor. Fonte dos números: distribuições já medidas no harness de calibração (aproximação em ~5 faixas é suficiente; não é fórmula travada, é apresentação).
- Sem foto, sem gradiente, sem logo real.

### i18n

Chaves novas: bloco três passos, telas 10b/10c (títulos, rótulos, notas), nomes/descrições/regras dos 3 modos, textos do cartão. PT + EN, paridade coberta pelo teste existente. Chave morta `home.continue` passa a ser usada (linha de retomar).

### Testes (Fase 2)

- Reducer: transições `START_SETUP`/`SET_MODE`/`SET_IDENTITY`/`BEGIN_CAREER`, validação de nome/número, imutabilidade da identidade, modo rápido pulando fases de jogo, save v7 (descarte de v6).
- `tests/e2e-playthrough.mjs` atualizado pra atravessar o setup (modo Carreira). Sanity manual dos outros dois modos em browser.
- `npm test` + typecheck antes de commit. Calibração não re-roda (zero mudança de consumo de RNG); se qualquer task acabar tocando ordem/contagem de RNG, roda `test:calibration` (regra do CLAUDE.md).

---

## Fora de escopo

- Manchetes com apelido «sobrenome» (varredura de i18n) — v2.
- Exports de loja iOS/Android do ícone (180/120/87/60, adaptativo) — sem loja hoje.
- Modos adicionais / regras de modo que exijam mexer em fórmula travada.
- Histórico de runs, leaderboard (backlog v2 existente).

## Riscos e mitigação

- **e2e-playthrough** quebra com o setup novo → atualizar no mesmo task que cria as fases.
- **Save v7**: testar descarte de v6 explicitamente no reducer test.
- **Cartão**: canvas 1080×1350 com fontes — garantir `document.fonts.ready` antes de desenhar (padrão do share.ts atual).
- **Modo rápido**: ponto único de decisão no reducer (não espalhar `if (mode === 'rapido')` pela UI) — as fases de jogo simplesmente nunca são atingidas.
