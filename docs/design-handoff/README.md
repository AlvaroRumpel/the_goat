# Handoff: The GOAT — Redesign visual e replanejamento de fluxo

## Overview

Redesign completo da UI de **The GOAT** (SPA de carreira de basquete, React + TS + Vite, sem router, state machine por `phase` em `useReducer`) e replanejamento do fluxo de telas.

O redesign resolve sete problemas levantados pelo dono do produto:

1. fluxo confuso — o jogador não sabe onde está;
2. falta de emoção nos momentos decisivos;
3. recap de temporada denso demais (4 abas);
4. draft de atributos não comunica consequência;
5. veredito/cartão de compartilhar sem apelo;
6. sem histórico — sensação de trilho;
7. todas as telas parecem a mesma tela.

Três mudanças estruturais, além do novo tema visual:

- **Hub de Carreira** (fase/camada nova) alcançável de qualquer tela, com barra de carreira fixa no topo de todas as telas;
- **Balanço da temporada em tela única** (as 4 abas somem), abrindo no resultado e descendo até liga e trajetória;
- **Jogo-chave narrado**: o jogo aparece como coluna de lances + tira dos três momentos, em vez de uma situação isolada; e uma tela nova de **avanço da temporada** onde a simulação corre visível e para no próximo jogo-chave.

## About the Design Files

Os arquivos deste pacote são **referências de design feitas em HTML** — protótipos que mostram aparência e comportamento pretendidos, **não** código de produção para copiar.

A tarefa é **recriar esses designs no ambiente já existente do repositório** (`AlvaroRumpel/the_goat`: React 18 + TypeScript + Vite, CSS puro escrito à mão em `src/styles/tokens.css` + `src/styles/base.css`, sem Tailwind e sem biblioteca de componentes), seguindo os padrões dele. Mantenha a arquitetura atual: engine TS puro com RNG semeado (`mulberry32`), transições só via `Action` no `gameReducer`, persistência em `localStorage`. **Não introduza router, Redux/Zustand ou biblioteca de UI.**

Os HTMLs abrem direto no navegador (precisam de `support.js` e `doc-page.js`, incluídos).

## Fidelity

**Hi-fi.** Cores, tipografia, espaçamentos, hierarquia e copy (em português) são finais. Recrie pixel a pixel usando CSS puro do próprio projeto — os valores exatos estão em *Design Tokens* e nas descrições de tela.

Quadros mobile: **390 × 844**. Quadros desktop: **1280 × 800**.

## Screens / Views

Todas as telas compartilham:

- **Barra de carreira** (topo, altura ~46px, `padding: 18px 22px 12px`): à esquerda, mono 10px `letter-spacing: 0.16em` uppercase `#6B6455` com "T9 · 32 anos · OKC · 2 anéis"; à direita "Carreira ↗" em `#A8231C`, 10px, weight 800, uppercase. Borda inferior: `1px solid #C6BCA2` nas telas comuns, `3px double #A8231C` nas telas de peso (cerimônia, veredito, draft, série, resultado, hub).
- **Botão-bloco**: 54px de altura, sem raio, `Archivo Black` 14px, `letter-spacing: 0.1em`, uppercase. Preto (`#1C1A16` / texto `#EDE6D6`) = seguir; vermelho (`#A8231C` / texto `#F6F0E4`) = ação irreversível ou principal; contorno (`1px solid #1C1A16`, texto `#1C1A16`, altura 46px, `IBM Plex Mono` 11px) = alternativa.
- Rótulos de seção: `IBM Plex Mono` 10px, `letter-spacing: 0.2em`, uppercase, `#6B6455`.
- Fundo: `#EDE6D6`. Nada arredondado (exceto monograma circular). Nada com sombra (exceto o cartão modal da encruzilhada).

Ids abaixo referenciam os quadros no canvas `The GOAT - Redesign v1.dc.html`.

### 3a · Abertura (`phase: home`)
- **Purpose**: entrada; começar carreira nova ou retomar o save.
- **Layout**: coluna. Cabeçalho com "EDIÇÃO ÚNICA · Nº 1" + toggle PT/EN (dois blocos de `padding: 4px 9px` dentro de `1px solid #1C1A16`; ativo em preto com texto creme). Filete duplo vermelho de 3px. Masthead com padding-top 44px.
- **Components**: título "THE GOAT" em `Archivo Black` 66px, `line-height: 0.86`, `letter-spacing: -0.035em`, `#A8231C`, em duas linhas. Divisor `1px #C6BCA2`. Tagline 21px weight 500, largura máxima 300px. Explicação em mono 11px `line-height: 1.6`. Rodapé: linha "CARREIRA EM ANDAMENTO / Temporada 5 · 28 anos · OKC" entre filetes `1px #C6BCA2` com "RETOMAR →" em vermelho; botão-bloco preto "Nova carreira"; nota mono 10px "GRÁTIS · SEM CADASTRO · APAGA O SAVE ATUAL".
- **Nota**: a linha de retomar só aparece quando existe save válido; usa a chave i18n hoje morta `home.continue`. O toggle de idioma deve passar a usar `home.lang`.

### 4c · Roubo de atributo (`phase: attrDraft`)
- **Purpose**: escolher qual atributo roubar da lenda sorteada (8 rodadas).
- **Layout**: cabeçalho com "RODADA 3 DE 8" + oito traços de 14×4px (`#1C1A16` feitos, `#A8231C` atual, `#D8D0BB` futuros). Masthead da lenda: nome em `Archivo Black` 27px duas linhas + mono "ANOS 2000 · FRAQUEZA REBOTE"; monograma circular 48px, `2px solid #A8231C`, iniciais em `Archivo Black` 15px vermelho.
- **Components**: lista dos **oito atributos da lenda** (a escolha é do jogador). Cada linha: nome uppercase 13px weight 700 + preço em mono 10px (`PREÇO: REBOTE −4`), valor da lenda em `Archivo Black` 22px e o seu em mono 11px `#6B6455` ("94 · 62"). Separadores `1px #DCD3BE`. Já roubados: `opacity: 0.45`, nome com `line-through`, mono "JÁ SEU · RODADA 1". Linha selecionada: faixa preta full-bleed (`margin: 0 -22px; padding: 11px 22px`), valor em `#E8B24A`. Abaixo, resumo com `border-left: 2px solid #A8231C` e o OVR projetado.
- **Regra de engine (obrigatória)**: o preço cai sempre na **fraqueza da lenda** (`weakestSlot(player, slotRoubado)` em `src/engine/draft.ts`) e vale de **−1 a −5** (`malusAmount`). Não exiba valores fora dessa faixa.
- **Ações**: botão vermelho "Roubar {atributo}"; contorno "Sortear outra lenda · 1 restante" (`DRAFT_REROLL`, desabilitado depois do uso).

### 6c · Reveal do arquétipo (`phase: draftDone`)
- Manchete "VOCÊ VIROU UM" + arquétipo em `Archivo Black` 50px vermelho, duas linhas; parágrafo de 15px sobre o que isso significa. Faixa preta com "OVERALL DE ESTREIA" e o número em `Archivo Black` 38px `#E8B24A`. Oito barras de atributo (trilha `#D8D0BB` 8px; preenchimento `#1C1A16`, ou `#A8231C` quando < 70), rótulo 11px uppercase largura 82px, valor mono 11px à direita. Nota final entre filetes: "DOIS ATRIBUTOS ABAIXO DE 70 · REBOTE · FÍSICO". CTA vermelho "Ir para o draft".
- **Dívida a fechar**: separar nome e posição em `archetype.*` e remover o `.split(' (')[0]` de `AttrDraft.tsx`.

### 5a · Noite do draft (`phase: nbaDraft`)
- Manchete: "VOCÊ FOI CHAMADO NA" + "4ª" em `Archivo Black` 72px vermelho ao lado de "ESCOLHA" 22px. Três ofertas empilhadas (`padding: 20px 16px`, gap 14px): símbolo geométrico 34px + nome em `Archivo Black` 17px + perfil em mono 10px + promessa em 12px. Destacada = faixa vermelha com símbolo em contorno creme; as outras com `1px solid #C6BCA2`.
- **Símbolos de franquia** (sem logos reais): losango (`transform: rotate(45deg)`) = candidato; círculo = reconstrução; três barras horizontais = mercado grande.
- CTA preto "Assinar com {time}" + nota mono "O CONTRATO VALE 4 TEMPORADAS".

### 5b · Pré-temporada (`phase: preseason`)
- Ano/idade na barra; nome do time em `Archivo Black` 26px + símbolo do time à direita. Bloco "A LIGA HOJE" entre filete duplo vermelho e filete simples: até 3 manchetes 13px weight 600 com `border-left` de 2px (a primeira em vermelho). Lista "NO QUE VOCÊ VAI TRABALHAR" com os 4 focos: escolhido em faixa preta full-bleed com efeito em mono `#E8B24A`; os demais em linhas separadas por `1px #DCD3BE`. CTA vermelho "Começar a temporada".

### 8a · Jogo-chave (`phase: keyGame` / `playoffGame`) — **tela principal do loop**
- **Purpose**: decidir os 3 momentos de um jogo, vendo a partida acontecer.
- **Layout mobile** (de cima para baixo): barra de carreira → faixa preta de placar → tira dos três momentos → coluna de lances → faixa preta de decisão (`margin-top: auto`).
- **Faixa de placar**: `background: #1C1A16`, `padding: 13px 22px`; pontos em `Archivo Black` 26px, siglas em mono 10px `#A8A192`, relógio central em mono 15px weight 600 `#E8B24A` ("4Q 00:21").
- **Tira de momentos**: rótulo "SEUS MOMENTOS NESTE JOGO" + "3 DE 3" em vermelho; três cartões `flex: 1` com gap 8px. Resolvidos: `background: #E4DAC4`, `1px solid #C6BCA2`, `opacity: 0.7`, com barra de 3px (preta = ganho, vermelha = perda) e saldo em mono ("+3", "−6"). Atual: `2px solid #A8231C`, rótulo "0:21 · CLUTCH" em vermelho, título "AGORA" em `Archivo Black`.
- **Coluna de lances**: 6–7 entradas. Cada linha: horário em mono 12px largura 64px com `white-space: nowrap` ("3Q 08:22"), texto 12px `line-height: 1.4`, placar resultante em mono à direita (vermelho quando atrás). A antiguidade é opacidade decrescente: 0.28 → 0.42 → 0.58 → 0.75 → 1. As linhas geradas por decisão sua levam `border-left: 2px solid #A8231C` com `margin-left: -12px`.
- **Faixa de decisão**: `#1C1A16`, texto da situação 17px `line-height: 1.4`; três opções empilhadas com `gap: 1px` sobre `#3A362E`. A opção ousada é creme sobre preto (`#EDE6D6` / texto `#1C1A16`) com tag em vermelho; as demais `#22201A` com texto creme e atributo em mono `#A8A192`. Rodapé "SIMULAR O RESTO DO JOGO" em mono 10px centralizado.
- **Desktop (9c)**: grid `1fr 460px`. Esquerda: placar (números 52px, relógio 26px) + coluna de lances (13px, horário 70px) + rodapé com "SIMULAR O RESTO DO JOGO" e "TECLAS 1 · 2 · 3 ESCOLHEM". Direita (`border-left: 1px solid #C6BCA2`): tira de momentos na vertical (linhas de 12px 14px, a atual com `border-left: 3px solid #A8231C`) e a faixa preta de decisão fixa no rodapé, com as opções numeradas 1/2/3.
- **Precisa de dado novo**: um log de lances por jogo (5–7 entradas geradas pelo mesmo RNG semeado) e o saldo de cada momento já decidido. Não altere a resolução — é exposição de dados que o engine já produz.

### 6a · Resultado do jogo (`phase: gameResult`, nova)
- Manchete de resultado em `Archivo Black` 68px vermelho ("CAMPEÃO"), placar final (30px + siglas mono). Trio de stats entre filetes (`padding: 18px 0`, números 28px). Lista "O QUE VOCÊ DECIDIU": 3 linhas com horário mono largura 38px, descrição 13px e veredito em `Archivo Black` 11px ("OK", "FALHOU" em vermelho, "CAIU"). Faixa vermelha "MOMENTO ICÔNICO GRAVADO" com título 19px e "+40 NA PONTUAÇÃO DE LEGADO" em mono. CTA preto "Ir à cerimônia".
- Aparece também depois de `SKIP_GAME` (aí sem a lista de decisões).

### 6b · Avanço da temporada (`phase: seasonAdvance`, nova)
- **Purpose**: tornar visível o que `runSeasonSim` já calcula.
- Cabeçalho "A TEMPORADA CORRE"; campanha em `Archivo Black` 44px ("38—12", com o "—" em `#6B6455` e as derrotas em vermelho) e à direita, mono, "JOGO 50 DE 82 / 1º NO OESTE". Barra de progresso 8px: `#1C1A16` para o percorrido, `#A8231C` para o trecho atual, trilha `#D8D0BB`; legenda "OUT · PRÓXIMO JOGO-CHAVE: 52 · ABR". Ticker "PLACARES ENTRANDO": 9 linhas em mono 12px (jogo, V/D em `Archivo Black`, adversário e placar, pontos) com opacidade decrescente 1 → 0.18. Nota com `border-left: 2px solid #A8231C`: contexto de corrida de prêmios + "A SIMULAÇÃO PARA SOZINHA NO PRÓXIMO JOGO-CHAVE". Ações: preto "Assumir o próximo jogo" (`TAKE_NEXT_GAME`), contorno "Correr até os playoffs" (`RUN_TO_PLAYOFFS`).

### 5c · Encruzilhada (`phase: tradeDecision` / `eventDecision`)
- **Purpose**: decisão narrativa sobre a tela anterior preservada.
- Tela de fundo real, escurecida por `rgba(20,18,14,0.62)` cobrindo todo o quadro (`position: absolute; inset: 0`). Cartão: `left/right: 20px`, `top: 150px`, fundo `#EDE6D6`, `border-top: 6px solid #A8231C`, `padding: 24px 22px`, `box-shadow: 0 24px 60px rgba(20,18,14,0.45)` — **única sombra do app**.
- Conteúdo: rótulo "ENCRUZILHADA" em vermelho; título `Archivo Black` 26px duas linhas; corpo 15px `line-height: 1.55`; par de consequências em duas linhas mono ("SE FICAR" / "SE ACEITAR", a segunda em vermelho); dois botões-bloco (vermelho = aceitar, contorno = ficar); nota "ESTA ESCOLHA ENTRA NA SUA FICHA PARA SEMPRE".

### 5d · Série de playoffs (`phase: playoffGame` sem jogo pendente)
- Placar da série gigante: dois números em `Archivo Black` 92px (`line-height: 0.8`, `letter-spacing: -0.04em`), o adversário em vermelho, "SÉRIE" em mono no meio. Título "JOGO 7 EM BOSTON" em `Archivo Black` 20px. Histórico jogo a jogo: linhas com rótulo J1…J6, V/D, placar e pontos em mono. Faixa preta "O QUE ESTÁ EM JOGO" com duas linhas ("Vencer" → mono `#E8B24A`; "Perder" → título em `#C4655C`). Ações: vermelho "Jogar o jogo 7", contorno "Simular o jogo 7".

### 3b · Cerimônia (`phase: seasonResult`, abertura)
- Centralizada: "CERIMÔNIA · 2040" em mono; "MVP DA TEMPORADA" em `Archivo Black` 19px; monograma circular 64px `2px solid #A8231C`; nome do vencedor em `Archivo Black` 34px vermelho; linha de médias em mono. Filete duplo de 3px acima e abaixo do bloco. Tabela "DEMAIS HONRAS": 4 linhas (prêmio uppercase 13px weight 700 + vencedor em mono 12px; "Campeão" com valor em vermelho). Faixa vermelha "SUA CAMPANHA" com desfecho em `Archivo Black` 17px e detalhe em mono. CTA preto "Ver o balanço".

### 4b · Balanço da temporada (`phase: seasonResult`) — substitui as 4 abas
- **Mobile**: rolagem única — barra → faixa vermelha de resultado (título `Archivo Black` 20px + "4—2 · MVP + FMVP" em mono) → trio PTS/AST/REB entre filetes → "A TEMPORADA EM CINCO LINHAS" (eventos com `border-left` de 2px: preto normal, vermelho para eventos ruins, texto `#7A2A22`) → "JOGOS QUE VOCÊ VIVEU" (V/D + adversário + placar e pontos) → linha "LIGA E TRAJETÓRIA ↓" com a posição na conferência → CTA preto "Avançar para {ano}".
- **Desktop (9b)**: barra → faixa vermelha alta (título 44px + selos em mono à direita) → grid de duas colunas separadas por `1px solid #C6BCA2`. Esquerda: quarteto de stats (30px, inclui JOGOS), cinco linhas da temporada (14px), jogos vividos (13px). Direita: standings Oeste/Leste em duas colunas de 4 linhas (a sua em `#E4DAC4` com o registro em vermelho), corrida de prêmios em 4 barras (líder em `#A8231C`, resto `#6B6455`), trajetória de overall em 9 barras (a última em vermelho), e no rodapé os botões "Avançar para 2041" (preto, `flex: 1`) e "Ver a carreira" (contorno, 180px).
- O estado local de aba desaparece; as chaves `tabs.*` do i18n morrem.

### 4a · Hub de Carreira (novo)
- **Purpose**: ver a carreira acumulada a qualquer momento; "voltar" passa a significar reler, nunca desfazer.
- **Mobile**: cabeçalho "Sua carreira" + "FECHAR ✕"; bloco de status (temporada/idade + time em `Archivo Black` 22px vermelho + anéis como círculos de 13px, preenchidos em vermelho); tabela de temporadas (colunas ANO/TIME/PPG/DESFECHO, títulos em `#E4DAC4` com texto vermelho weight 700); "ATRIBUTOS HOJE · OVR 93" em 4 barras; rodapé "ROLE PARA TROFÉUS, MOMENTOS E LIGA ↓".
- **Desktop (9a)**: filete duplo no cabeçalho e grid `320px 1fr 300px` com divisores de 1px. Coluna 1: monograma 62px + arquétipo + OVR, oito barras de atributo, trajetória de overall em 9 barras de 64px. Coluna 2: tabela larga (ANO/TIME/PPG/RPG/APG/DESFECHO/HONRAS), 9 linhas, títulos destacados. Coluna 3: troféus como lista `gap: 1px` (Anéis em faixa vermelha, resto creme, contagens em `Archivo Black` 18px), momentos icônicos (ano em vermelho, o "choke" com `opacity: 0.7`), contrato e pontos de carreira em mono.
- **Implementação sugerida**: `hubOpen: boolean` no state em vez de nova `phase`, para não sujar o grafo. Lê apenas `career` e `build`.

### 6d · Renovação de contrato (`phase: freeAgency`)
- "O CONTRATO ACABOU" + título `Archivo Black` 30px duas linhas + corpo 14px. Três ofertas (`padding: 27px 16px`) com símbolo, nome em `Archivo Black` 16px e termos em mono ("3 ANOS · CAMISA APOSENTADA NO FIM"); a preferida em faixa vermelha. Linha "OVR HOJE / 84 ↓ 7 EM DUAS TEMPORADAS" (queda em vermelho) acima do rodapé. Ações: preto "Assinar com {time}" e contorno vermelho "Pendurar as chuteiras" (só com idade ≥ 31 ou declínio forte).

### 3c · Aposentadoria (`phase: retireDecision`)
- Papel mais quente: `#E7DFCD`. "FIM DA TEMPORADA 16" em mono; pergunta "Mais uma temporada?" em Archivo **regular** 34px weight 500 (a única manchete não-Black — é uma carta, não uma manchete); corpo 16px `line-height: 1.6` `#3A362E`. Bloco entre filetes: "OVERALL EFETIVO / 91 → 74" e 10 barras de declínio (`#C6BCA2`, pico em `#1C1A16`, as últimas em `#D8A29C` → `#C77168` → `#A8231C`), legenda "T1 · PICO T4 · T16". Ações: preto "Mais uma temporada", contorno vermelho "Encerrar a carreira", nota "ENCERRAR ABRE O VEREDITO. NÃO HÁ VOLTA."

### 3d · Veredito (`phase: verdict`) — única página integralmente vermelha
- Fundo `#A8231C`, texto `#F6F0E4`, filete duplo `#F0C4C0` no cabeçalho. Tier em `Archivo Black` 60px (`line-height: 0.88`, `letter-spacing: -0.035em`); "LEGADO 1.204 · UM DEGRAU ABAIXO DO GOAT" em mono `#F0C4C0`. Grid 2×2 de totais com `gap: 1px` sobre `#C4655C` (rótulos mono `#F0C4C0`, números `Archivo Black` 26px). "O QUE FICOU NA MEMÓRIA": 3 linhas (ano em mono `#F0C4C0` + fato), o choke com `opacity: 0.72`. Ações: bloco creme "Gerar cartão da carreira" (texto vermelho) e contorno `#F0C4C0` "Começar de novo".
- O veredito deve ser **calculado uma vez** na transição para `verdict` e guardado no state (hoje `computeVerdict` roda a cada render) — a revelação é em camadas.

## Interactions & Behavior

- **Navegação**: continua por `dispatch` de `Action` → `gameReducer` → nova `phase` → `saveState()`. Sem URL, sem back do navegador. O único caminho "para trás" é o Hub (leitura).
- **Barra de carreira**: "Carreira ↗" abre o hub (`hubOpen: true`); "FECHAR ✕" fecha. O hub não altera o jogo.
- **Jogo-chave**: tocar numa opção despacha `DECIDE_MOMENT`. No desktop, teclas 1/2/3 selecionam as opções. Ao resolver o 3º momento, vai para `gameResult`.
- **Avanço da temporada**: a simulação avança em passos e **para automaticamente** no próximo jogo-chave; "Correr até os playoffs" avança até o fim da temporada regular. Progresso e ticker refletem o mesmo RNG semeado — nenhum resultado novo é inventado na UI.
- **Encruzilhada**: overlay sobre a tela anterior preservada; as duas escolhas despacham `TRADE_DECISION` / `EVENT_DECISION`.
- **Animações**: discretas. Entrada de linha nova no ticker/coluna de lances por fade curto (120–180ms, `ease-out`); revelação do veredito em camadas (tier → totais → momentos, ~200ms entre camadas). Nada mais anima.
- **Estados**: opção já usada/roubada → `opacity: 0.45` + `line-through`; reroll usado → botão desabilitado com texto trocado; sem estados de loading (tudo local) nem formulários.
- **Responsivo**: coluna única de 390–430px centralizada até 900px; a partir daí o layout desktop (grids de 9a/9b/9c) com largura máxima de 1280px. Alvos de toque nunca abaixo de 44px.

## State Management

Continua `useReducer` único em `App.tsx`, sem Context nem store externa.

Novo/alterado em `src/state.ts`:

- `phase` ganha `gameResult` e `seasonAdvance`;
- `hubOpen: boolean` (camada do Hub);
- persistir as **escolhas resolvidas do jogo** (o dado existe em `pendingChoices`, hoje descartado na UI) para a tela 6a;
- **log de lances por jogo**: 5–7 entradas `{ clock, text, score, fromDecision? }`, geradas no engine com o RNG semeado;
- **saldo por momento** decidido (`+3`, `−6`) para a tira de momentos;
- `verdict` calculado uma vez e guardado no state;
- ações novas: `OPEN_HUB`, `CLOSE_HUB`, `TAKE_NEXT_GAME`, `RUN_TO_PLAYOFFS`;
- `tabs.*` deixa de ser usado (recap em rolagem única);
- **bump do save para `thegoat:v5`** — o contrato de dados muda.

Invariantes a preservar: `Math.random` continua banido no engine; toda transição passa pelo reducer; replay exato por re-seed + fast-forward de `rngCalls`.

## Design Tokens

```
Cores
--paper        #EDE6D6   fundo padrão
--paper-2      #E7DFCD   papel de carta (aposentadoria)
--paper-3      #E4DAC4   linha/cartão destacado
--ink          #1C1A16   texto, faixas escuras, CTA neutro
--red          #A8231C   manchete, adversário, perda, irreversível
--red-soft     #C4655C   texto secundário sobre vermelho
--on-red       #F6F0E4   texto sobre vermelho
--on-red-dim   #F0C4C0   texto secundário sobre vermelho
--on-ink       #EDE6D6   texto sobre tinta
--on-ink-dim   #A8A192   texto secundário sobre tinta
--ink-2        #22201A   opção não escolhida dentro da faixa preta
--ink-3        #3A362E   divisor dentro da faixa preta
--rule         #C6BCA2   filete forte
--rule-soft    #DCD3BE   filete de tabela
--track        #D8D0BB   trilha de barra
--dim          #6B6455   rótulos mono e valores secundários
--body-dim     #3A362E   corpo secundário
--accent-warm  #E8B24A   só dentro de faixa preta (relógio, ganho, OVR)
Fundo do canvas (fora do app): #17150F

Tipografia
Manchete/números:  'Archivo Black', sans-serif — uppercase, letter-spacing -0.02em a -0.045em
Corpo/UI:          'Archivo', 400/500/600/700
Dados/rótulos:     'IBM Plex Mono', 400/500/600 — uppercase, letter-spacing 0.08em–0.3em
Escala mobile:     hero 66/60/50 · título 34/30/26 · subtítulo 21/20/19 · corpo 15/14/13 · rótulo mono 10/9
Escala desktop:    placar 92/52 · hero 44 · título 30/26/22 · corpo 14/13 · rótulo mono 11/10/9
Mínimos:           corpo 12px, rótulo mono 9px, alvo de toque 44px

Espaçamento
Padding lateral mobile 22px · desktop 32px
Gap de lista 8–14px · gap de seção 18–26px
Linha de tabela: padding 9–16px vertical
Faixas full-bleed: margin 0 -22px; padding 11px 22px

Raio e sombra
border-radius: 0 em tudo (exceto monograma: 50%)
Única sombra: 0 24px 60px rgba(20,18,14,0.45) no cartão da encruzilhada
Véu do overlay: rgba(20,18,14,0.62)

Barras
altura 8px (5px dentro de cartão de opção) · trilha #D8D0BB
preenchimento #1C1A16 normal, #A8231C quando ruim/perda, #6B6455 quando secundário
```

## Assets

Nenhum. Sem fotos, sem logos, sem ícones de biblioteca — decisão de design mantida do projeto original (sem licenciamento NBA).

- **Franquias/jogadores**: monograma de iniciais em anel (`border-radius: 50%`, `2px solid #A8231C`, iniciais em `Archivo Black`) e símbolos geométricos por perfil (losango, círculo, três barras) feitos com `div` + `transform: rotate(45deg)`.
- **Fontes**: Google Fonts — `Archivo` (400,500,600,700), `Archivo Black`, `IBM Plex Mono` (400,500,600). O projeto hoje carrega Marcellus + Archivo; substituir Marcellus por Archivo Black.
- Gráficos (trajetória, gangorra do placar, declínio) são `div`s com altura percentual — nenhum SVG necessário.

## Files

Neste pacote:

- `The GOAT - Redesign v1.dc.html` — canvas com tudo. Ids por rodada: `1a` mapa de fluxo; `1b/1c/1d` direções visuais exploradas; `2a/2b` temas (2B aprovado); `3a–3d` abertura, cerimônia, aposentadoria, veredito; `4a–4c` hub, balanço, roubo; `5a–5d` draft, pré-temporada, encruzilhada, série; `6a–6d` resultado, avanço, reveal, renovação; `7a/7b/7c` explorações da tela de jogo; `8a` jogo-chave final; `9a/9b/9c` desktop.
- `The GOAT - Especificacao do Redesign.dc.html` — a mesma especificação em documento imprimível (tokens, primitivas, mudanças de fase, dívidas, ordem sugerida).
- `../DESIGN.md` — inventário do estado **anterior** ao redesign (13 fases, 6 arquivos, sistema visual antigo). Útil para saber o que existe hoje.
- `support.js`, `doc-page.js` — runtime necessário para abrir os HTMLs.

No repositório, os arquivos que mudam:

| Área | Arquivos |
|---|---|
| Tema e primitivas | `src/styles/tokens.css`, `src/styles/base.css` |
| Fases e estado | `src/state.ts`, `src/App.tsx` |
| Telas | `src/ui/screens/Home.tsx`, `AttrDraft.tsx`, `NbaDraft.tsx`, `Season.tsx`, `Game.tsx`, `Verdict.tsx` (+ arquivos novos para hub, resultado de jogo e avanço) |
| Componentes | `src/ui/components/OfferCard.tsx`, `StatLine.tsx`, `LeaguePanels.tsx` |
| Engine (exposição de dados) | `src/engine/season.ts`, `moments.ts`, `playoffs.ts`, `draft.ts`, `verdict.ts` |
| i18n | `src/data/i18n/pt.json`, `en.json` |

## Ordem sugerida de implementação

1. **Tema**: `tokens.css` + `base.css` para 2B e reescrever as primitivas. As 13 telas atuais já mudam de cara sem tocar no reducer.
2. **Barra de carreira + Hub** (4a / 9a) — resolve "não sei onde estou".
3. **Balanço em rolagem** (4b / 9b) — remove as abas.
4. **Jogo-chave** (8a / 9c) + **resultado** (6a) — onde está o orçamento emocional.
5. **Avanço da temporada** (6b), depois cerimônia (3b), aposentadoria (3c) e veredito em camadas (3d).
6. Dívidas: `home.lang`, `archetype.*` sem `.split`, veredito persistido, save `v5`.
