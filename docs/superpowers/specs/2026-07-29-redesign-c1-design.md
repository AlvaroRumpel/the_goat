# The GOAT — Redesign visual, Ciclo 1 (tema 2B + barra + hub + balanço + telas estáticas)

**Data:** 2026-07-29 · **Status:** aprovado pelo dono (seções 1–4)
**Fonte de design:** `design_handoff_the_goat_redesign/README.md` (hi-fi, copy PT final) + canvas `The GOAT - Redesign v1.dc.html` (projeto claude-design `5a193998-626d-46ba-84f5-fd9a7d164ca5`)
**Base do estado atual:** `docs/DESIGN.md` (inventário pré-redesign)

## Decomposição (decisão do dono)

Redesign completo dividido em **3 ciclos**, cada um com spec → plano → deploy:

- **C1 (este spec)**: tema 2B "Jornal de Tinta Vermelha" + primitivas, barra de carreira, Hub, balanço de temporada em tela única, 8 telas estáticas em layout final, boot na Home. **Zero mudança de engine, zero bump de save.**
- **C2**: jogo-chave narrado (8a/9c), tela de resultado de jogo (`gameResult`), avanço de temporada (`seasonAdvance`), log de lances no engine, save bump `thegoat:v5`.
- **C3**: cerimônia como tela própria (3b), aposentadoria (3c), veredito em camadas + persistido (3d), dívidas restantes.

Telas de C2/C3 recebem no C1 apenas o retheme automático de tokens/primitivas (layout atual mantido).

## Decisões de design tomadas neste ciclo (registradas também no projeto claude-design)

1. **Balanço mobile**: seção "LIGA E TRAJETÓRIA" usa o condensado do desktop — standings top-4 por conferência, corrida de prêmios em 4 barras, trajetória em 9 barras. Tabela completa de 30 times vive só no Hub.
2. **Cerimônia no C1**: dados (campeão + honras) viram seção "DEMAIS HONRAS" dentro do balanço; a tela própria 3b fica pro C3.
3. **Boot sempre na Home**: com save válido, Home mostra "CARREIRA EM ANDAMENTO · RETOMAR →"; "Nova carreira" apaga o save (com aviso). Resume direto morre.
4. **Barra de carreira só de `preseason` em diante** — telas pré-carreira (home, attrDraft, draftDone, nbaDraft) mantêm cabeçalho próprio.
5. **`hubOpen` persiste no save** como campo normal do reducer (opcional no shape v4, default `false` — sem bump).

## 1. Tema e primitivas

- `src/styles/tokens.css`: substitui a paleta dourada pelos tokens do 2B (README §Design Tokens): `--paper #EDE6D6`, `--paper-2 #E7DFCD`, `--paper-3 #E4DAC4`, `--ink #1C1A16`, `--red #A8231C`, `--red-soft #C4655C`, `--on-red #F6F0E4`, `--on-red-dim #F0C4C0`, `--on-ink #EDE6D6`, `--on-ink-dim #A8A192`, `--ink-2 #22201A`, `--ink-3 #3A362E`, `--rule #C6BCA2`, `--rule-soft #DCD3BE`, `--track #D8D0BB`, `--dim #6B6455`, `--body-dim #3A362E`, `--accent-warm #E8B24A` (só dentro de faixa preta). Fundo fora do app: `#17150F`.
- Fontes (Google Fonts, como hoje): remove Marcellus; adiciona `Archivo Black` (manchetes/números, uppercase, tracking −0.02em a −0.045em) e `IBM Plex Mono` 400/500/600 (dados/rótulos, uppercase, tracking 0.08–0.3em). `Archivo` 400–700 continua para corpo.
- `--radius: 0` em tudo (exceto monograma 50%). Única sombra do app: `0 24px 60px rgba(20,18,14,0.45)` no cartão da encruzilhada. Véu de overlay: `rgba(20,18,14,0.62)`.
- `src/styles/base.css` — primitivas novas (nomes semânticos, cutover único, abordagem A aprovada):
  - `.topbar` barra de carreira (~46px, `padding: 18px 22px 12px`), variante `.topbar--heavy` (borda inferior `3px double var(--red)`; padrão `1px solid var(--rule)`).
  - `.rule` (1px `--rule`), `.rule--double` (3px double vermelho), `.rule--soft` (1px `--rule-soft`).
  - `.strip` faixa full-bleed (`margin: 0 -22px; padding: 11px 22px`), variantes `--ink` e `--red`.
  - `.btn` botão-bloco 54px sem raio, `Archivo Black` 14px tracking 0.1em uppercase: `.btn--ink` (preto/creme, seguir), `.btn--primary` (vermelho/creme, principal ou irreversível), `.btn--outline` (46px, `1px solid --ink`, `IBM Plex Mono` 11px, alternativa; modificador `--outline-red` para "Pendurar as chuteiras").
  - `.mono-label` rótulo de seção (`IBM Plex Mono` 10px, tracking 0.2em, uppercase, `--dim`).
  - `.bar` barra 8px (5px em cartão de opção): trilha `--track`, fill `--ink` normal / `--red` ruim / `--dim` secundário.
  - `.mono-ring` monograma circular (`2px solid var(--red)`, iniciais `Archivo Black` vermelhas).
  - `.modal-veil` + `.crossroads-card` (cartão da encruzilhada, `border-top: 6px solid var(--red)`, única sombra).
  - Chips viram blocos quadrados de contorno (sem pill).
  - Morrem: `.screen__glow`, `.grain`, `.goldtext`, `.banner` dourado, variantes gold de card/chip.
- Espaçamento: padding lateral 22px mobile / 32px desktop; gap de lista 8–14px, de seção 18–26px; linha de tabela 9–16px vertical. Alvo de toque mínimo 44px. Corpo mínimo 12px, mono mínimo 9px.
- Copy PT do handoff é final; EN traduzido mantendo paridade de chaves (teste existente cobre).

## 2. Barra de carreira + Hub

**CareerBar** (`src/ui/components/CareerBar.tsx`), em todas as telas de `preseason` em diante:
- Esquerda: mono 10px `--dim` uppercase — `T{n} · {idade} ANOS · {sigla}` + ` · {anéis} ANÉIS` quando anéis > 0.
- Direita: "CARREIRA ↗" (`--red`, 10px, weight 800, uppercase) → dispatch `OPEN_HUB`.
- `--heavy` nas telas de peso: balanço, veredito, série, hub (draft não tem barra — pré-carreira).

**Hub** (`src/ui/screens/Hub.tsx`; estado `hubOpen: boolean` + ações `OPEN_HUB`/`CLOSE_HUB` — **não** é phase, não entra no grafo):
- Camada full-screen papel sobre a tela atual. Leitura pura de `career`/`build`/`league`; nenhum efeito no jogo. "Voltar" significa reler, nunca desfazer.
- Mobile (4a): cabeçalho "Sua carreira" + "FECHAR ✕" (`CLOSE_HUB`); status (temporada/idade + time `Archivo Black` 22px vermelho + anéis como círculos 13px preenchidos vermelhos); tabela ANO/TIME/PPG/DESFECHO (cabeçalho `--paper-3`, títulos vermelhos weight 700); "ATRIBUTOS HOJE · OVR {n}" em 8 barras; no scroll: troféus (contagens `Archivo Black` 18px, anéis em faixa vermelha), momentos icônicos (ano vermelho, choke `opacity: 0.7`), standings completos 30 times (única casa da tabela cheia), contrato + pontos de carreira em mono.
- Desktop (9a): filete duplo no cabeçalho; grid `320px 1fr 300px` com divisores 1px. Col 1: monograma 62px + arquétipo + OVR, 8 barras, trajetória em 9 barras de 64px. Col 2: tabela ANO/TIME/PPG/RPG/APG/DESFECHO/HONRAS. Col 3: troféus (lista `gap: 1px`), icônicos, contrato/pontos.
- Hub sobre encruzilhada: renderiza por cima; fechar volta ao modal (camadas independentes).
- Edge sem temporada concluída: linha "PRIMEIRA TEMPORADA EM ANDAMENTO" em mono na tabela vazia; resto renderiza com o que existe.

## 3. Balanço da temporada em tela única (substitui as 4 abas)

`src/ui/screens/SeasonResult.tsx` (extraído de `Season.tsx`). Estado local de aba morre; chaves `tabs.*` do i18n morrem. Fonte de dados 100% existente: `seasonOutcome`, `leagueHistory`, `career`, `keyGameResults`. Zero engine change.

**Mobile (4b)**, rolagem única:
1. Barra `--heavy`.
2. Faixa vermelha de resultado: título `Archivo Black` 20px + linha mono (ex.: "4—2 · MVP + FMVP").
3. Trio PTS/AST/REB (+ jogos) entre filetes, números 28px.
4. "A TEMPORADA EM CINCO LINHAS": eventos com `border-left` 2px (preto normal; vermelho + texto `#7A2A22` para ruins).
5. "JOGOS QUE VOCÊ VIVEU": key games V/D + adversário + placar + pontos.
6. Momentos icônicos da temporada (chips quadrados), se houver.
7. "DEMAIS HONRAS" (cerimônia absorvida): campeão (valor vermelho) + MVP/DPOY/ROY/MIP + desfecho do próprio run.
8. "LIGA E TRAJETÓRIA": standings top-4 por conferência (sua linha `--paper-3`, registro vermelho), corrida de prêmios em 4 barras (líder vermelho), trajetória de overall em 9 barras (última vermelha).
9. CTA preto "Avançar para {ano}" (`ADVANCE`).

**Desktop (9b)**: barra → faixa vermelha alta (44px + selos mono à direita) → grid 2 colunas (divisor 1px): esquerda = quarteto de stats (30px, inclui JOGOS) + cinco linhas + jogos vividos; direita = standings Oeste/Leste top-4 + corridas + trajetória; rodapé: "Avançar para {ano}" (preto, `flex: 1`) + "Ver a carreira" (contorno 180px → `OPEN_HUB`).

Trajetória: dados do `Sparkline` atual, render vira 9 barras `div`; SVG `Sparkline` morre se ficar sem uso.

## 4. Boot na Home + telas estáticas

**Boot**: `App.tsx` não retoma mais direto na fase salva. Com save válido: renderiza Home com linha "CARREIRA EM ANDAMENTO / T{n} · {idade} · {time}" entre filetes + "RETOMAR →" (vermelho) e botão preto "Nova carreira" + nota mono "GRÁTIS · SEM CADASTRO · APAGA O SAVE ATUAL". Sem save: só "Nova carreira", nota sem aviso de apagar. Ação nova `RESUME` restaura a fase salva; `NEW_GAME` descarta o save. Chave `home.continue` revive; toggle PT/EN passa a usar `home.lang` (débito fechado).

Mecanismo: campo novo `resumePhase: Phase | null` no state. No boot com save válido, o init vira `{...save, phase: 'home', resumePhase: save.phase}` (só em memória — nada é persistido até o primeiro dispatch, então fechar a aba sem agir não toca o save). `RESUME` → `phase = resumePhase; resumePhase = null`. `NEW_GAME` já reseta tudo.

**Telas estáticas em layout final** (só UI):
- **Home (3a)**: cabeçalho "EDIÇÃO ÚNICA · Nº 1" + toggle PT/EN em blocos quadrados (`padding: 4px 9px` em `1px solid --ink`, ativo preto/creme); filete duplo vermelho; título "THE GOAT" `Archivo Black` 66px, `line-height: 0.86`, tracking −0.035em, vermelho, 2 linhas; divisor; tagline 21px (máx 300px); explicação mono 11px.
- **Roubo de atributo (4c)**: traços de progresso 14×4px (feitos `--ink`, atual `--red`, futuros `--track`); masthead da lenda (nome `Archivo Black` 27px 2 linhas + mono "ANOS 2000 · FRAQUEZA REBOTE"; monograma 48px); lista dos 8 atributos da lenda, cada linha com nome 13px/700 + preço mono 10px (`PREÇO: {SLOT} −{n}` via `weakestSlot`+`malusAmount` — só exibição), valor da lenda `Archivo Black` 22px + o seu em mono ("94 · 62"); roubados `opacity: 0.45` + line-through + "JÁ SEU · RODADA {n}"; selecionado em faixa preta full-bleed com valor `--accent-warm`; resumo com `border-left: 2px solid --red` + OVR projetado; CTA vermelho "Roubar {atributo}" + contorno "Sortear outra lenda · 1 restante" (desabilitado após uso). Malus exibido sempre em −1..−5 (contrato do engine).
- **Reveal (6c)**: "VOCÊ VIROU UM" + arquétipo `Archivo Black` 50px vermelho 2 linhas + parágrafo 15px; faixa preta "OVERALL DE ESTREIA" com número 38px `--accent-warm`; 8 barras (fill `--ink`, `--red` quando < 70, rótulo 11px 82px, valor mono à direita); nota entre filetes "N ATRIBUTOS ABAIXO DE 70 · {LISTA}"; CTA vermelho "Ir para o draft". **Débito fechado**: `archetype.*` separa nome e posição em chaves distintas; `.split(' (')` removido.
- **Draft NBA (5a)**: "VOCÊ FOI CHAMADO NA" + "{n}ª" `Archivo Black` 72px vermelho + "ESCOLHA" 22px; 3 ofertas empilhadas (símbolo geométrico 34px + nome 17px + perfil mono 10px + promessa 12px; destacada em faixa vermelha com símbolo em contorno creme; demais `1px solid --rule`); símbolos: losango (rotate 45°) = contender, círculo = rebuild, 3 barras horizontais = mercado grande; CTA preto "Assinar com {time}" + nota mono "O CONTRATO VALE 4 TEMPORADAS". `OfferCard.tsx` reescrito.
- **Pré-temporada (5b)**: ano/idade na barra; time `Archivo Black` 26px + símbolo à direita; "A LIGA HOJE" entre filete duplo e simples (até 3 manchetes 13px/600 com border-left 2px, 1ª vermelha); "NO QUE VOCÊ VAI TRABALHAR" com 4 focos em lista (separadores `--rule-soft`), escolhido em faixa preta com efeito mono `--accent-warm`; CTA vermelho "Começar a temporada". **Interação muda**: selecionar foco → confirmar no CTA (hoje tap direto dispara).
- **Encruzilhada (5c)** (`tradeDecision`/`eventDecision`): véu `rgba(20,18,14,0.62)` sobre tela anterior preservada; cartão `left/right: 20px; top: 150px`, `border-top: 6px solid --red`, única sombra do app; rótulo "ENCRUZILHADA" vermelho; título `Archivo Black` 26px; corpo 15px; par de consequências mono "SE FICAR" / "SE ACEITAR" (2ª vermelha — copy nova no i18n); botões vermelho (aceitar) + contorno (ficar); nota "ESTA ESCOLHA ENTRA NA SUA FICHA PARA SEMPRE".
- **Série (5d)** (`playoffGame` sem jogo pendente): placar da série `Archivo Black` 92px (`line-height: 0.8`, tracking −0.04em; adversário vermelho, "SÉRIE" mono no meio); "JOGO {n} EM {CIDADE}" 20px; histórico J1…J6 (V/D + placar + pontos mono); faixa preta "O QUE ESTÁ EM JOGO" (vencer → mono `--accent-warm`; perder → título `--red-soft`); ações vermelho "Jogar o jogo {n}" + contorno "Simular o jogo {n}".
- **Renovação (6d)** (`freeAgency`): "O CONTRATO ACABOU" + título `Archivo Black` 30px + corpo 14px; 3 ofertas (`padding: 27px 16px`, símbolo + nome 16px + termos mono); preferida em faixa vermelha; linha "OVR HOJE / {n} ↓ {delta} EM DUAS TEMPORADAS" (queda vermelha); CTA preto "Assinar com {time}" + contorno vermelho "Pendurar as chuteiras" (mesma condição atual: idade ≥ 31 ou ratio < 0.55).

**Telas C2/C3** (`Game.tsx` moment panel, cerimônia própria, aposentadoria, veredito): herdam só tokens/primitivas; layout atual até seus ciclos.

## 5. Estado

- Campos/ações novos em `src/state.ts`: `hubOpen: boolean` (default `false`), `OPEN_HUB`, `CLOSE_HUB`, `RESUME`.
- **Sem bump de save** — campos opcionais no shape `thegoat:v4`; saves existentes carregam com defaults.
- Engine (`src/engine/*`): **zero mudança**. `weakestSlot`/`malusAmount` só ganham chamadas de exibição na UI (funções puras, sem RNG — replay intacto).
- Invariantes preservadas: transição só via reducer; `Math.random` banido no engine; replay por seed + `rngCalls`.

## 6. i18n

- Copy PT do handoff é final; EN mantém paridade (teste existente).
- Chaves que morrem: `tabs.*`, chaves mortas já auditadas. Chaves que revivem: `home.continue`, `home.lang`. Chaves novas: barra de carreira, hub, encruzilhada (consequências), notas de rodapé, seções do balanço, `archetype.*` reformulado (nome/posição separados).
- Audit das "5 chaves mortas" citadas no HANDOFF junto da mexida.

## 7. Testes e verificação

- `npm test` (vitest engine/state/data): paridade i18n cobre chaves novas/mortas; testes de state ganham `OPEN_HUB`/`CLOSE_HUB`/`RESUME` (incl. hub não altera jogo, RESUME restaura phase).
- `npx tsc -p tsconfig.app.json --noEmit`.
- `node tests/e2e-playthrough.mjs` atualizado no mesmo PR: boot na Home (novo passo RETOMAR/Nova carreira), foco selecionar+confirmar, balanço sem abas, seletores novos.
- Risco principal: e2e quebra a cada mudança de interação — atualizar seletores junto, não depois.

## 8. Fora de escopo do C1

- `gameResult`, `seasonAdvance`, log de lances, save v5 (C2).
- Cerimônia como tela própria, aposentadoria, veredito em camadas/persistido (C3).
- Animações (fade de ticker, revelação em camadas) — chegam com as telas que animam (C2/C3).
- Leaderboard, histórico de runs, mini-jogos (backlog v2 do HANDOFF).
