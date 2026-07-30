# The GOAT — Redesign, Ciclo 3 (cerimônia, aposentadoria, veredito em camadas, fechamento de débitos)

**Data:** 2026-07-30 · **Status:** aprovado pelo dono
**Fonte de design:** `design_handoff_the_goat_redesign/README.md` (telas 3b, 3c, 3d) + `DECISOES-C1.md` (decomposição em ciclos)
**Specs anteriores:** `2026-07-29-redesign-c1-design.md` (tema, barra, hub, balanço), `2026-07-29-redesign-c2-design.md` (jogo-chave narrado, calendário como verdade)

## Escopo do C3 (ciclo final do redesign)

Cerimônia (3b), aposentadoria (3c), veredito em camadas e persistido (3d) — as três últimas telas da decomposição aprovada em `DECISOES-C1.md`. Mais um upgrade aprovado fora da decomposição original (`seasonAdvance` com corrida de prêmios parcial), o fechamento de todos os débitos abertos no `HANDOFF.md` (redesign + engine/C2, exceto histórico local de runs — backlog v2), e três correções de gameplay reportadas pelo dono em playtest (ver seção 8: comunicação de impacto no `GameResult`, trava de idade na oferta de aposentadoria, copy do momento "fechou a série"). Sem bump de save; `thegoat:v5` continua valendo. Nenhuma fórmula-contrato muda de forma (`season.ts`/`verdict.ts`/`SERIES_SHIFT`/`MARGIN_NOISE` intocados — só uma constante nova de idade).

## Decisões de design tomadas neste ciclo (dono aprovou)

1. **Cerimônia não é fase nova** — sub-view local dentro de `seasonResult` (estado de componente, não do reducer): abre em cerimônia, CTA leva pro balanço já existente. Zero mudança de engine/state.
2. **Débitos**: fecha tudo que é real. Dois itens da lista do HANDOFF já estavam corrigidos no código antes deste ciclo (ver seção 6) — corrigidos ali só de documentação. Histórico local de runs fica fora (é feature de backend, não débito de redesign).
3. **`SeasonAdvance` ganha corrida de prêmios parcial** no lugar da linha de stats atual. `outcome.races` não serve — é a corrida já decidida da temporada **anterior** (só é setado no fim de `concludeSeason`), mostraria dado velho como se fosse atual. Caminho correto: duas funções puras novas em `engine/league.ts` (`projectedNpcLines`, `projectedStandings`) — mesmas fórmulas de `simNpcLines`/`simStandings` sem o termo de jitter aleatório, então **zero rng, zero impacto em replay/calibração** — alimentando o `partialMvpRace` já existente (achado no levantamento: função pronta, calibrada, pensada pro deadline, nunca chamada em lugar nenhum). Escopo só de MVP (a única corrida com fórmula determinística pronta); DPOY/ROY/MIP ficam de fora.
4. **Reducer sem guards de fase** — releitura do reducer inteiro mostrou que quase todo `case` (19 de 21) já tem `if (state.phase !== 'x') return state` inline; só `CONFIRM_BUILD` e `CHOOSE_OFFER` não têm. Fecha adicionando a mesma guarda inline a esses dois — não um mecanismo central novo (que duplicaria o padrão já estabelecido em todo o resto do arquivo).

## 1. Cerimônia (`phase: seasonResult`, sub-view 3b)

`SeasonResult.tsx` ganha um `useState<'ceremony' | 'balance'>('ceremony')` local. View `ceremony`: MVP da temporada centralizado (monograma 64px, nome vencedor `Archivo Black` 34px vermelho, linha de médias mono), tabela "DEMAIS HONRAS" (4 linhas: campeão + `RACE_AWARDS`), faixa vermelha "SUA CAMPANHA" com o desfecho (`run.*`) — todo dado já vem de `outcome`/`season`, hoje espalhado dentro do balanço. CTA preto "Ver o balanço" troca pra view `balance` (o JSX do balanço atual, inalterado). Sem dispatch, sem phase nova, sem persistência do estado do toggle (reabrir a tela sempre volta pra cerimônia — é abertura, não posição salva).

`CeremonyPanel` (`LeaguePanels.tsx`) é removido — órfão desde o C1, a sub-view acima substitui de vez.

## 2. Aposentadoria (`phase: retireDecision`, 3c)

Retheme completo de `RetireDecision` (`Season.tsx`):
- Papel `--paper-2` (já em `tokens.css`, comentado "aposentadoria, C3").
- Título "Mais uma temporada?" em Archivo **regular** 34px weight 500 — única manchete não-Black do app (é carta, não manchete).
- Bloco "OVERALL EFETIVO {pico} → {atual}" entre filetes + 10 barras de declínio: reaproveita `effectiveOverall(build.overall, season.age, build.attributes.physical)` sobre `state.career.seasons.slice(-10)` — mesma função que já alimenta `TrajectoryBars` do Hub, sem dado novo de engine. Pico em `--ink`, últimas barras em gradiente `--paper-2`-escurecido → `--red` conforme o README.
- Ações inalteradas (`RETIRE_DECISION`), só o visual muda.

## 3. Veredito (`phase: verdict`, 3d) — persistido + em camadas

**Persistência.** `GameState` ganha `verdict: Verdict | null`. Computado uma vez, nos dois pontos que hoje levam a `phase: 'verdict'`:
- `RETIRE_DECISION` com `retire: true` (aposentadoria voluntária);
- `case 'ADVANCE'` quando `age > 40` (aposentadoria forçada por idade, `state.ts` linha ~750).

`Verdict.tsx` passa a ler `state.verdict!` em vez de chamar `computeVerdict(state.career)` no corpo do render (fecha o débito das redraws redundantes do canvas). `loadState` faz backfill: se a fase efetiva (`resumePhase ?? phase`) for `'verdict'` e `verdict` estiver ausente (save gravado antes deste ciclo), computa ali mesmo antes de devolver o estado — sem precisar bump de save, mesmo padrão do `hubOpen` no C1.

**Retema completo.** Fundo `--red` full-bleed (única tela assim no app), filete duplo `#F0C4C0` no cabeçalho, grid 2×2 de totais com divisores de 1px sobre `--red-soft`, "O QUE FICOU NA MEMÓRIA" com ano + fato por momento icônico (hoje são chips soltos sem ano) — choke com `opacity: 0.72`. Botões ganham variantes novas pro contexto vermelho (`--ink`/`--btn--primary` padrão não servem em fundo vermelho): CTA principal ("Gerar cartão da carreira") = bloco creme/texto vermelho; secundário ("Começar de novo") = contorno `#F0C4C0`. Fecha o débito do botão "jogar de novo" sem variante.

**Revelação em camadas.** Stagger puro em CSS (tier → totais → momentos, ~200ms entre camadas, fade + leve `translateY`) — não é máquina de estado nova, é timing de entrada aplicado nas seções já renderizadas de uma vez (o dado já está todo disponível em `state.verdict`).

## 4. `SeasonAdvance` — corrida de MVP parcial (upgrade aprovado)

Troca a linha de stats do walk (simplificação deliberada do C2, `# ponytail`) por uma corrida de MVP projetada, determinística: `projectedNpcLines(league)` + `projectedStandings(league)` (novas, puras, sem rng) alimentam o `partialMvpRace` já existente em `engine/league.ts` (definido, calibrado, nunca usado — resgate de código morto). Renderiza no `RaceBars` já usado pelo balanço final, com o rótulo deixando claro que é projeção.

## 5. Débitos fechados

- **`GameResult.tsx` só renderiza `iconics[0]`** — vira `result.iconics.map(...)`, mostra todos os momentos icônicos do jogo.
- **`StandingsTop4`/`StandingsTable` sem tiebreak determinístico** — `.sort((a, b) => b.wins - a.wins || a.teamId.localeCompare(b.teamId))` nos dois componentes.
- **`pendingChoices` campo morto** — removido de `GameState`, do reducer (`PLAY_SEASON`, resets, `loadState`) e do tipo; nunca foi lido em lugar nenhum além de ser setado/resetado.
- **Comentário de contrato RNG incompleto** (`continuePlayoffs`, perto de `advancePlayer`) — passa a listar `advancePlayer` explicitamente entre as calls contadas do avanço de playoffs.
- **`tests/state-calendar.test.ts` ancorado em seed 42** — comentário no topo do arquivo deixando explícito que é trava de *snapshot* (RNG call-order), não trava de *comportamento* — pra quem for debugar uma falha futura não confundir as duas coisas.
- **`loadState` validação rasa** — troca o `typeof parsed.phase !== 'string'` por whitelist contra o union `Phase` (mesmo para `resumePhase`, quando presente). Mais um `ErrorBoundary` (classe React simples) em `main.tsx` envolvendo `<App/>`: qualquer erro de render limpa o `localStorage` e mostra uma tela mínima de "recomeçar" em vez de branco.
- **Reducer sem guards de fase** — `CONFIRM_BUILD` e `CHOOSE_OFFER` ganham a mesma guarda `if (state.phase !== ...) return state` que já existe em todos os outros `case`s do reducer (não um mecanismo novo).

## 6. Débitos já obsoletos (correção de documentação, zero código)

- **"Botão compartilhar no-op silencioso sem clipboard/Web Share"** — `Verdict.tsx` já implementa `navigator.clipboard.writeText` + `navigator.share` com fallback. Já resolvido antes deste ciclo.
- **"Game.tsx: botão simular duplicado no desktop"** — já corrigido no commit `8e721a0` (fix wave final do C2): o hint desktop virou `<div>` só com `game.keys`, sem dispatch nem texto `game.simulate` duplicado.

`HANDOFF.md` é atualizado ao final do ciclo pra remover essas duas linhas da lista de débitos.

## 7. Gameplay reportado pelo dono (playtest, 2026-07-30) — comunicação, não mecânica

Três achados de sessão real (screenshots), investigados a fundo (root cause) antes de qualquer correção. As três correções escolhidas pelo dono são as de menor risco (nenhuma mexe em fórmula travada ou constante calibrada existente):

1. **Perder o jogo com os 3 momentos "OK"** — não é bug: `margin = baseMargin (força do time + ruído U(±MARGIN_NOISE)) + Σ deltas dos seus 3 momentos`; o ruído é deliberadamente largo o bastante pra "engolir" a soma dos seus momentos (comentário já existente em `moments.ts`), ou seja o resto do time pode pesar mais que suas decisões. Matematicamente correto, mas ilegível na tela. **Correção: só comunicação.** `GameResult.tsx` ganha uma linha "SEU IMPACTO {±n} · RESTO DO TIME {±n}" — `yourImpact = Σ result.outcomes[].delta` (já disponível, sem dado novo), `teamImpact = result.margin − yourImpact`. Zero mudança de engine/calibração.
2. **Oferta de aposentadoria aos 24 anos** — bug real: `performanceRatio` (`season.ts`) compara a ppg da última temporada contra o **pico histórico de todas as temporadas**, ativo a partir da 5ª temporada, **sem gate de idade nenhum**. Como `ageMultiplier` só atinge 1.0 aos 26 (curva 0.78→1.0 entre 19-26), uma temporada de estreia com sorte (foco/evento/perfil de time bons) pode virar "pico" e qualquer temporada normal seguinte parecer "queda de 25%+" mesmo com o jogador ainda subindo na curva. **Correção: trava de idade mínima.** A oferta de aposentadoria por queda só é oferecida com `age >= 28` (perto de onde a curva realmente começa a cair, ageMultiplier deixa de valer 1.0 depois de 29) — aplicada nos dois lugares que checam declínio: `case 'ADVANCE'` (`state.ts`, campo `declining`) e o botão "Pendurar as chuteiras" da `FreeAgency` (`Season.tsx`). Constante nova (`RETIRE_MIN_AGE = 28`), forma da fórmula de `performanceRatio` intocada.
3. **"Cesta que fechou a série" seguida de eliminação** — bug real de comunicação: nas rodadas 0-2 dos playoffs só existe um jogo pivotal por série; vencê-lo **desloca uma probabilidade** (`SERIES_SHIFT`, decisão-chave 11, travada) — não decide a série. O código já marca `elimination: true` incondicionalmente nessas rodadas ("sempre narrado como decisivo", comentário existente em `state.ts`), e o sorteio real da série acontece depois, num dispatch separado (`CONTINUE`/`continuePlayoffs`), sem o jogador ver a conexão. **Correção: só narrativa.** `iconic.seriesWinner` muda de "Cesta que fechou a série" pra "Cesta decisiva" (pt) / "Series-clinching shot" → "Decisive shot" (en) — não afirma mais uma certeza que o mecanismo não entrega. `GameResult.tsx` ganha uma nota (`result.pivotalNote`) exibida sempre que `context.kind === 'playoff'` (rounds 0-2, nunca finais — finais têm placar de série literal, sem essa ambiguidade): "Esse resultado muda suas chances de avançar — a série ainda vai ser decidida." `SERIES_SHIFT` e o mecanismo de shift continuam intocados — decisão do dono foi não mexer na calibração agora.

## 8. Testes

- **Vitest**: `verdict.ts`/reducer — cálculo único do veredito nas duas rotas de entrada em `phase: 'verdict'`, backfill do `loadState` pra save sem `verdict`; guard de fase do reducer (dispatch de ação fora da fase esperada é no-op); tiebreak de standings; `GameResult` renderiza múltiplos `iconics`; trava de idade da aposentadoria por queda (`RETIRE_MIN_AGE`). Paridade i18n (teste existente) cobre chaves novas de cerimônia/aposentadoria/veredito/`GameResult`.
- **e2e:** `tests/e2e-playthrough.mjs` ajustado pro toggle cerimônia→balanço e pra aposentadoria/veredito retemados (sem mudança de fluxo de fases).
- Pré-commit: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`.
