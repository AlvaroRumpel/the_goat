# The GOAT — Ciclo "Jogo Vivo" (spec)

**Data:** 2026-07-30 · **Ciclo:** jogo-vivo · **Antecessores:** motor-momentos (decisão 11), redesign C2 (decisão 13), redesign C3 (decisões 14/15)

## Problema

Dois achados do dono no playtest:

1. **O jogo assistido não é assistido.** `startWatchedGame` já monta o log completo do jogo (falas de ambientação com minuto), mas `Game.tsx` despeja tudo na tela de uma vez, com o painel de decisão já aberto. Não há sensação de tempo passando, de jogo acontecendo, de assumir o controle num instante específico.
2. **As decisões são sempre as mesmas.** Todo jogo tem exatamente 3 momentos (`q2tactic`, `q4pressure`, `clutch`) com o mesmo catálogo fixo de opções. Depois de 3 jogos o jogador já viu tudo.

Escopo do ciclo: consertar os dois, mais os bugs que a mudança escancara, mais dois itens de acabamento (cronômetro no clutch, tutorial no primeiro jogo).

## Escopo

**Dentro:**
- Reveal animado jogada a jogada no jogo assistido (UI).
- Número variável de momentos por jogo (2–5) e pool de situações por slot (engine).
- Peso constante por jogo (`3/n`) — a trava que preserva a calibração.
- 7 bugs listados em §5.
- Cronômetro de 8s no último momento, desligável.
- Tarja de tutorial no primeiro jogo-chave da carreira.
- Bump de save `thegoat:v5` → `thegoat:v6`.

**Fora:**
- Exibir probabilidade das opções (decisão do dono: fica no feeling).
- Momentum visível / estado "pegando fogo".
- Mini-jogos de habilidade (backlog v2).
- Leaderboard, histórico de runs.
- Qualquer mudança na forma das fórmulas de `season.ts` ou nos pesos de `verdict.ts` (contrato).

---

## 1. Reveal animado do jogo assistido

Puramente UI. Nenhuma função do engine muda de assinatura por causa desta seção.

### Dado de entrada

`PendingGame.log: PlayEntry[]`, já ordenado por `at` (minuto do jogo). Cada entrada tem `at`, `clock`, `textKey`, `params`, `score`, e opcionalmente `fromDecision: true`.

### Máquina de reveal

`Game.tsx` mantém um cursor local (`useState`, não persistido):

- `revealed: number` — quantas entradas do log já apareceram por inteiro.
- `typing: string | null` — texto parcial da entrada em digitação.

Ciclo: digita a entrada corrente a **~25ms por caractere**, pausa **~600ms**, passa para a próxima. O placar da linha sobe junto com ela.

O reveal **para** quando o cursor alcança a entrada cujo `at` é o do momento pendente. Nesse ponto o painel de decisão entra em cena (hoje ele está sempre visível). Escolhida a opção, `applyMoment` acrescenta a fala do lance ao log; ela é digitada e o walk retoma até o próximo momento ou até o fim do jogo.

### Controles

- **Toque/clique em qualquer lugar da área de lances** → revela o trecho corrente instantaneamente (não pula decisão).
- **Botão `pular →`** → `SKIP_GAME` (já existe como `game.simulate`).
- **Teclas 1/2/3** seguem escolhendo a opção, mas só valem com o painel aberto.

### Acessibilidade e testes

`prefers-reduced-motion: reduce` → reveal instantâneo (sem digitação, sem pausa), painel de decisão aparece direto. Isto também é o que mantém `tests/e2e-playthrough.mjs` determinístico: o e2e roda com reduced-motion forçado no contexto do Playwright.

### Persistência

O estado da animação **não** entra no save. Recarregar no meio de um jogo reanima o trecho corrente a partir do último momento resolvido. `pendingGame` continua sendo a única verdade.

---

## 2. Momentos variáveis e pool de situações

### Slots

Cinco arquétipos, ordenados pelo tempo de jogo:

```
openTone   1Q  — definir o tom da partida
q2tactic   2Q  — ajuste tático
q3swing    3Q  — a virada / a reação
q4pressure 4Q  — pressão do fim
clutch     0:21 — o último lance (SEMPRE o último momento do jogo)
```

### Contagem por jogo

Base determinística pelo peso do jogo, mais jitter de ±1 (1 call de rng), com clamp em `[2, 5]`:

| Contexto | Base |
|---|---|
| `rivalry`, `seedRace`, `special` | 3 |
| `playoff` (rounds 0-2) | 4 |
| `playoff` com `elimination`, `finals` | 5 |

Para `n` momentos: os **últimos `n-1`** slots de `[openTone, q2tactic, q3swing, q4pressure]`, seguidos de `clutch`. Assim `n = 2` → `[q4pressure, clutch]` e `n = 5` → a lista inteira. Jogo curto fica concentrado no fim; jogo de final abre no primeiro quarto.

### Posição no relógio

`at` deixa de ser hardcoded e passa a ser campo do `Moment`. Para `n` momentos, o `i`-ésimo (0-indexado) fica em:

```
at_i = 10 + (47.65 − 10) × i / (n − 1)
```

O último cai sempre em 47.65 (`4Q 00:21`), preservando a semântica do clutch de hoje. `clockOf(at)` continua formatando.

### Pool de situações

Cada slot tem **5 situações**. Uma situação é `{ textKey, options: MomentOption[] }` — texto próprio e conjunto próprio de 2–3 opções. A escolha da situação consome **1 call de rng** (`rng.int(0, 4)`) — é exatamente a call que hoje só escolhia variação de texto, então o custo por momento não muda.

Ids de opção são reaproveitados entre situações do mesmo slot e entre slots quando fazem sentido. Orçamento: ~20 ids distintos no total (os 8 de hoje + ~12 novos). Cada id novo precisa de `option.<id>` e de 4 falas (`play.<id>.{hit,miss}.v{0,1}`) em PT e EN.

Chaves novas de i18n nesta seção:

```
moment.<slot>.label        openTone e q3swing são novos; q2tactic/q4pressure/clutch já existem
moment.<slot>.s<0-4>       texto da situação — substitui o formato .v<0-2> de hoje
game.momentsCount          "{n} DE 3" vira "{n} DE {total}" (hoje o 3 está cravado na string)
```

Regra: **toda situação tem exatamente uma opção `safe`.** É ela que `expectedAutoDelta` usa (§3) e é ela que o cronômetro joga ao estourar (§6). O atributo da `safe` pode variar entre situações — a correção de §3 torna isso seguro.

### Ambientação

Continua uma fala de ambientação antes de cada momento, mais uma de abertura: `n + 1` falas, 2 calls cada (variante + jitter do placar). A chave passa a ser escolhida pelo **quarto** derivado do `at` em vez do índice fixo:

```
play.ambient.<quarto 0-3>.v<0-2>
```

Isto reaproveita as 12 chaves de ambientação que já existem — zero string nova nessa parte.

### Contrato de RNG por jogo

Deixa de ser a constante `GAME_RNG_CALLS = 21` e passa a ser uma função documentada:

```
gameRngCalls(n) = 1 (jitter da contagem)
                + n (situação de cada momento)
                + 1 (baseMargin)
                + 2 × (n + 1) (ambientação)
                + 3 × n (resolveMoment: chance + injuryRoll + variante da fala)
                = 6n + 4
```

`n = 3` → 22. Nada no código de produção calcula calls aritmeticamente: `makeCountedRng` conta as calls reais e `rngCalls` guarda o total. Mas `tests/engine/moments.test.ts` importa `GAME_RNG_CALLS` em 5 pontos e crava `expect(GAME_RNG_CALLS).toBe(21)` — esses testes passam a chamar `gameRngCalls(n)` com o `n` do jogo montado.

---

## 3. Peso constante `3/n` — a decisão de calibração

Sem isto, mais momentos significam mais `Σ deltas`, o que empurra três coisas ao mesmo tempo: jogos-chave ficam mais fáceis (a margem carrega o viés), `playerPts` sobe, e com ele os icônicos `bigNight`/`closeout45` — que foi exatamente o mecanismo que estourou o `goatRate(99)` na Task 7 do ciclo motor-momentos.

**Regra:** cada momento pesa `3/n`. O delta efetivo de um outcome é `o.delta × 3 / n`, tanto na margem final quanto na soma de `playerPts`. Um jogo de 5 momentos tem o mesmo peso total de decisão que um de 3 — mais granularidade, não mais poder.

Consequência: `E[Σ deltas]` sob a política padrão é idêntico ao de hoje para qualquer `n`, por construção. Todas as travas de calibração continuam válidas sem recalibrar constantes. O harness confirma em vez de refazer.

### `expectedAutoDelta` recebe os momentos

Hoje `expectedAutoDelta(build, age)` itera o catálogo fixo de 3 slots e é chamada **fora** de `startWatchedGame`, sendo passada como `expectedDelta`. Com momentos sorteados dentro da função, esse valor fica errado.

Nova assinatura e novo fluxo:

```ts
expectedAutoDelta(build: Build, age: number, moments: Moment[]): number
```

Ordem dentro de `startWatchedGame` (que passa a receber `build` e `age`):

1. jitter da contagem (1 call) → `n`
2. sorteio das situações (`n` calls) → `moments` com `at` preenchido
3. `expectedDelta = expectedAutoDelta(build, age, moments)` — determinístico, sem rng
4. `center` (usa `expectedDelta` no modo probabilidade-alvo, como hoje)
5. `baseMargin` (1 call)
6. falas de ambientação (`2 × (n+1)` calls)

`expectedDelta` é guardado em `PendingGame` e copiado para `WatchedGameResult`. Os callers (`openPlayoffGame`, `startWatchedKeyGame`) param de passar `expectedDelta` e passam `build`/`age`.

`keyGameEffects` troca `results.length × expectedAutoDelta(build, age)` por `Σ r.expectedDelta` — o valor real de cada jogo.

### O que NÃO muda

`computeWinPct`, `computeTitleProb`, as fórmulas de stats de `season.ts`, os pesos e thresholds de `verdict.ts`, o gate do GOAT, `SERIES_SHIFT`, `MARGIN_NOISE`, `PLAYER_OUT_MARGIN`, a tabela `RISK` (base/attrW/hit/miss por risco) e o catálogo `ICONIC_VALUES`.

---

## 4. Save

Bump de `thegoat:v5` para `thegoat:v6`. A ordem de consumo de rng por jogo muda, então saves v5 não são replayáveis. `loadState` passa a remover `thegoat:v5` junto com v1-v4.

Carreiras em andamento na produção morrem. Decisão do dono: aceito; congelar a ordem antiga não vale a complexidade.

---

## 5. Bugs corrigidos neste ciclo

Todos foram achados no levantamento e são **forçados** pela mudança — não são débito opcional.

| # | Bug | Onde | Correção |
|---|---|---|---|
| 1 | `momentIndex < 3` hardcoded fecha o jogo no 3º momento | `state.ts` `advanceGame`, `moments.ts` `autoResolveGame` | comparar com `pending.moments.length` |
| 2 | `outcomes[2]` fixo assume que o clutch é o 3º | `moments.ts` `dagger()` e o cálculo de `choke` | ler o **último** outcome (o slot `clutch` é sempre o último) |
| 3 | Falas de ambientação calculam o placar com `deltas = 0` — depois de um momento resolvido o placar **anda pra trás** | `moments.ts` `startWatchedGame` (`logScore(..., 0, ...)`) | o placar de cada linha soma os deltas já acumulados até aquele `at`; com o reveal animado isto passa de invisível a escancarado |
| 4 | `results.length × expectedAutoDelta` assume 3 momentos por jogo | `state.ts` `keyGameEffects` | somar `r.expectedDelta` de cada resultado (§3) |
| 5 | `expectedDelta` calculado fora de `startWatchedGame` — com momentos sorteados dentro, a `P(vitória)` dos playoffs deixa de bater no alvo | `state.ts` `openPlayoffGame` / `startWatchedKeyGame` | calcular dentro, depois do sorteio (§3) |
| 6 | Relógio do momento hardcoded em duas telas, duplicando `MOMENT_AT` do engine | `Game.tsx` e `GameResult.tsx` (`MOMENT_CLOCK`) | `Moment` ganha `at`/`clock` e `MomentOutcome` ganha `clock` (a `GameResult` só recebe os outcomes); as constantes `MOMENT_CLOCK` das duas telas somem |
| 7 | `key={o.momentId}` colide no React se o mesmo slot cair duas vezes | `GameResult.tsx` | key por índice |

---

## 6. Cronômetro no clutch

- Barra vermelha esvaziando, **8 segundos**, **só no último momento** do jogo (slot `clutch`).
- Começa quando o reveal chega no momento; congela com o Hub aberto (`hubOpen`).
- Estourou → despacha `DECIDE_MOMENT` com a opção `safe` da situação.
- Campo novo `timePressure: boolean` no `GameState`, default `true`, persistido. Toggle na Home e no Hub.
- `prefers-reduced-motion` **não** desliga o cronômetro (é gameplay, não animação); a barra vira número contando.

---

## 7. Tutorial do primeiro jogo

Tarja acima das opções no **primeiro jogo-chave da carreira**, condição derivada do estado (nenhum campo novo):

```ts
career.seasons.length === 0 && keyGameResults.length === 0
```

Conteúdo: uma linha explicando `seguro` / `ousado` / `temerário` e que a decisão mexe na margem do jogo e nos seus pontos. Some sozinha nos jogos seguintes.

---

## 8. Testes

**vitest (engine/state):**
- contagem de momentos por contexto fica dentro de `[2, 5]` e respeita a base ± 1.
- o último momento é sempre o slot `clutch`.
- **trava do peso constante:** `E[Σ deltas]` para `n = 5` é igual ao de `n = 3` para a mesma build/idade (tolerância de ponto flutuante).
- `dagger()` lê o último outcome, não o índice 2 — teste com `n = 4` e `n = 5`.
- placar do log é monotônico em relação aos deltas acumulados (bug 3): nenhuma linha posterior a um momento vencedor mostra placar pior que o da linha anterior por causa do delta ignorado.
- `expectedDelta` de `WatchedGameResult` bate com o recomputado a partir dos momentos.
- toda situação de todo slot tem exatamente uma opção `safe`.
- paridade de chaves PT/EN (teste que já existe) cobre as chaves novas.

**Harness de calibração** (`tests/engine/calibration.test.ts`, `CALIBRATE=1`): re-rodado para confirmar, não para recalibrar. Travas que precisam continuar verdes:
- `goatRate(99, N=600) < 0.02`
- `legendRate(95) > 0.2`
- `mvpRate(95) > 0.5`
- `legendRate(83) < 0.15`

Se alguma virar vermelha, a hipótese do peso `3/n` falhou e o ciclo para para reavaliação — não se ajusta constante de fórmula para forçar verde.

**e2e:** `node tests/e2e-playthrough.mjs` com reduced-motion forçado no contexto do Playwright; cobre um jogo assistido inteiro com decisão em cada momento, um `SKIP_GAME`, e o estouro do cronômetro no clutch.

**Snapshot que vai quebrar:** `tests/state-calendar.test.ts` está ancorado na seed 42 (débito já registrado no HANDOFF). A ordem de rng muda, então o snapshot precisa ser regravado — isso é trabalho previsto, não regressão.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Peso `3/n` não segura a calibração (variância maior de `S` satura a janela de ruído nos extremos) | harness roda cedo no plano, antes da UI; se estourar, para e reavalia |
| Volume de i18n (~25 situações + ~12 opções novas × PT/EN) | ids de opção reaproveitados entre situações; ambientação reusa as chaves existentes |
| Animação deixa o e2e instável | reduced-motion como caminho de reveal instantâneo, forçado no Playwright |
| Cronômetro irrita quem lê devagar | só no último momento, desligável, default explícito na Home |
