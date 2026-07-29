# Motor de Momentos — Design (Sub-projeto B da v2 "imersão")

**Data:** 2026-07-29 · **Status:** aprovado em brainstorm, aguardando revisão final do spec
**Contexto:** segunda metade da versão "imersão". Depende do sub-projeto A (liga viva, entregue 2026-07-28: standings, bracket real, prêmios por ranking, save v3).

## Objetivo

Substituir o "next next next" por jogos assistidos com decisões que influenciam resultados: 3-4 jogos-chave na regular, playoffs com peso crescente, finais jogo a jogo (best-of-7 real), momentos icônicos que entram no score.

## Decisões de escopo (aprovadas no brainstorm)

- Jogo assistido = **3 momentos, 1-2 decisões** (~30-60s de leitura por jogo).
- Séries de playoffs: **híbrido crescente** — r1/semi/conf por prob deslocada, finais best-of-7 real.
- **Skip sempre disponível** (auto-resolve com decisão padrão safe, MESMAS calls de rng).
- Lesão como risco **só em decisão que anuncia o risco** (baixa prob), reusa injury/injuryProne.
- Icônicos: **10-25 pts/momento, cap 100 na carreira**; choker é narrativo (0 pts).
- Resolução: **atributo + dado** (aprovado no brainstorm A); peso alto em jogo, médio em série.
- GOAT gate e fórmulas-contrato: **intocados**. Travas do harness (política auto) devem seguir verdes.

## 1. Motor de momentos (`src/engine/moments.ts`)

TS puro, RNG injetado, calls contadas.

- `Moment`: situação (chave i18n + params: adversário, placar, tempo restante) + 2-3 opções.
- `MomentOption`: `{ id, attr: SlotId (ou mix), risk: 'safe' | 'bold' | 'reckless', injuryRisk?: number }`. A opção define qual atributo rola: clutch three (`three`+`clutch`), atacar a cesta (`finishing`), passe pro aberto (`passing`, safe), jogar machucado (`physical`, injuryRisk anunciado).
- `resolveMoment(build, age, option, rng)`: prob de sucesso = f(atributo efetivo × idade). Safe = prob alta/impacto menor; bold = médio; reckless = prob menor/impacto alto. Sucesso/falha → delta de placar + highlight.
- `simWatchedGame`: 3 momentos (Q2 tático → Q4 pressão → clutch final SE o jogo estiver apertado; senão o 2º momento decide). Resultado: win/loss, statline do jogador no jogo, flags icônicos.
- **Contrato de replay/skip:** auto-resolve (skip) usa a opção default (safe) e consome exatamente a mesma sequência de rng calls que o caminho assistido. Assistir ou pular nunca diverge o stream.

## 2. Jogos-chave da regular

- **Seleção (3-4/temporada, rng contado):** 1 rivalidade (time forte da conferência ou quem te eliminou ano passado — usa `leagueHistory`), 1 disputa de seed (vizinho na tabela do ano anterior via `seasonOutcome`; ano 1 usa força de elenco), 1 especial rotativo (Christmas / revanche de trade / caça a recorde quando ppg alto), +1 se evento `rivalry` ativo.
- **Fluxo no reducer:** `PLAY_SEASON` → eventDecision (como hoje) → fase nova **`keyGame`** (jogos um a um; cada momento = dispatch `DECIDE_MOMENT`; `SKIP_GAME` auto-resolve o jogo) → sim da temporada (standings/lines, como hoje) → deadline → playoffs.
- **Efeito:** wins/losses dos jogos-chave deslocam `winPct` em ±0.01/jogo (dentro do clamp existente; constante calibrável); desempenho individual desloca ppg da temporada em ±0.5. Regular = narrativa + aquecimento; peso alto fica nos playoffs.
- Highlights aparecem no seasonResult (aba Resultado).

## 3. Playoffs híbrido + finais best-of-7

- **Bracket em rodadas:** lado NPC resolve como hoje. Série do jogador pausa o fluxo:
  - **R1/semi/conf:** 1 jogo assistido por série (narrado como jogo pivotal, ex. "Jogo 6, 3-2 contra"). Resultado desloca a prob da série em ±0.15-0.25; depois roll da série com prob deslocada.
  - **Finais:** best-of-7 REAL — cada jogo é assistido (3 momentos), placar da série emerge até 4 vitórias. Sem roll de série.
- **Fases novas:** `playoffGame` (contexto: rodada, placar da série, adversário) com `DECIDE_MOMENT`/`SKIP_GAME`; entre jogos das finais, tela de placar da série (com "simular série inteira").
- **Calibração (trava central):** com política auto-resolve, agregados ≈ atuais — pGame das finais e o deslocamento de série calibrados para P(anel | auto) ≈ titleProb efetivo atual por faixa de OVR. Jogar bem dá edge real (~+20-30% relativo no anel); jogar mal derruba. Travas existentes (ringsMedian, legendRate, goatRate < 0.02) rodam com política auto e DEVEM seguir verdes.
- **Lesão:** decisão `reckless` com `injuryRisk` pode cortar o resto dos playoffs (games perdidos + `injuryProne` na próxima temporada — mecânica existente).

## 4. Momentos icônicos + score

- **Catálogo (~8):** buzzer-beater em finais (25), game-winner de série (20), 45+ pts em closeout (18), flu game — jogar machucado e vencer (18), comeback de 15+ no 4º quarto (15), 55+ na regular (12), game-winner contra rival (12), varrida 4-0 nas finais (10).
- **Detecção:** flags do `simWatchedGame`/finais (condições pós-jogo). Registro: `SeasonResult.iconicMoments: IconicMomentId[]`.
- **Score:** `verdict.ts` soma `min(100, Σ valor)` — constante nova, forma aditiva simples, gate icônico do GOAT intocado. Política auto gera poucos icônicos; jogador ativo ganha tempero de até ~1 tier, nunca GOAT de graça (travas validam).
- **Choker (0 pts):** falha clutch em jogo de eliminação registra `chokes` — badge no card + linha no veredito.
- **Card/veredito:** seção "Momentos" com os icônicos da carreira.

## 5. UI

Mobile-first, tudo i18n pt+en (paridade testada).

- **`GameScreen`:** cabeçalho de contexto ("FINAIS · Jogo 4 · Série 2-1"), placar vivo, narração do momento (2-3 linhas), 2-3 botões de decisão mostrando atributo e risco ("Arremesso do jogo — Clutch 92 · ousado"), botão "Simular jogo" sempre visível. Pós-jogo: placar final + linha do jogador + highlight/icônico.
- **Tela de série** (entre jogos das finais): placar da série, próximo jogo, "simular série inteira".
- seasonResult: highlights dos jogos-chave; icônicos com badge dourado.
- Verdict/card: seção Momentos.

## 6. Save e replay

- Estado pendente novo: `pendingGame` (momento atual, contexto do jogo, placar de série) — save no meio de jogo retoma no momento exato.
- Shape do state muda → **save v4** (`thegoat:v4`; v3 descartado, mesmo tratamento dos bumps anteriores).
- RNG: toda pausa/resume via calls contadas (padrão das fases existentes); skip ≡ assistido no stream (contrato §1).

## 7. Testes e calibração

- Vitest engine: `moments.ts` (resolução, probs por risco), seleção de jogos-chave, best-of-7 (placar emerge, série fecha em 4-7 jogos), icônicos (detecção), replay determinístico com pausas (skip vs assistido = mesmo stream).
- Harness com 2 políticas: **`auto`** (travas existentes verdes, agregados ≈ atuais) e **`bold`** (teto do edge: anel relativo +20-30%; trava de sanidade goatRate bold < 0.04).
- E2E playthrough: joga 1 jogo assistido decidindo + pula o resto; finais jogo a jogo numa run com playoffs.

## Riscos

1. **Equivalência skip/assistido no stream de rng** — qualquer divergência quebra replay. Mitigação: teste dedicado comparando streams.
2. **Calibração das finais best-of-7** — P(anel | auto) precisa reproduzir o agregado atual; é a parte mais sensível. Mitigação: calibrar pGame antes de UI, trava no harness.
3. **State machine mais complexa** (keyGame/playoffGame/pendingGame) — mais fases pausáveis. Mitigação: seguir o padrão eventDecision/tradeDecision existente, testes de reducer por transição.

## Fora de escopo

- Rival de carreira (v3), elenco do time ofertante nas ofertas (backlog), All-Star game assistido, mini-jogos de habilidade (backlog original).
