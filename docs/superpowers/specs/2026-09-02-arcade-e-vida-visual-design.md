# Ciclo arcade + vida visual — design

**Data:** 2026-09-02 · **Pedido do dono:** duas frentes. (A) review visual/usabilidade — jogo mais vivo, animações e interações, "cara de simulação aleatória". (B) novo modo de jogo em que os momentos dos jogos-chave viram **minigames** em vez das 3 opções de risco: quadro tático de jogada, arremesso realista (direção + força), e defesa.

Sessão autônoma: decisões abaixo tomadas com base no HANDOFF, no código e nas duas imagens de referência (quadro tático com ímãs; jogo de arremesso por arco). Assunções explícitas marcadas com **[assunção]**.

## 0. Travas que este ciclo respeita

- Engine puro, RNG injetado, **contrato de calls por jogo intocado** (`gameRngCalls(n) = 4n+4`, 3 calls por momento). Minigames não consomem RNG do engine além do que `applyMoment` já consome.
- Fórmulas de `season.ts`/`verdict.ts`, GOAT gate, `RISK`, `momentWeight(3/n)`: intocados. Política auto (`autoResolveGame`) idêntica → calibração válida por construção.
- Sem save bump: `GameMode` ganha um valor; saves v7 existentes continuam válidos (modos antigos).
- Ritmo é conteúdo (decisão 17c): reveals JS-driven **não** respeitam `prefers-reduced-motion` (máquina do dono reporta reduce); todo reveal é pulável com tap. Só decoração CSS fica atrás do media query.

## 1. Frente A — vida visual e usabilidade

Achados (32 screenshots mobile/desktop, PT, reduce ON) e o que muda:

| # | Achado | Mudança |
|---|--------|---------|
| A1 | A seção SEO `.home-static` do `index.html` aparece abaixo de TODAS as telas do jogo (rolando no balanço/resultado vê-se "O que é o The GOAT"). | `App` marca `document.body.dataset.phase`; CSS no `index.html`: `body:not([data-phase="home"]) .home-static { display:none }`. Crawler continua vendo (HTML inicial). |
| A2 | Draft de atributos: a lenda "aparece" pronta — sorteio não parece sorteio. | `useSpin`: ao entrar numa rodada/resorteio, o nome passa ~700ms ciclando nomes de outras lendas (índices fixos de `PLAYERS`, zero RNG) antes de fixar; os 8 valores sobem em count-up (~500ms). Tap pula. |
| A3 | Números importantes aparecem prontos (OVR de estreia, placar/stats do resultado, W–L, totais do veredito). | Hook `useCountUp(value, ms)` (rAF, pulável). Usado em: OVR do `DraftDone`, placar+PTS/REB/AST do `GameResult`, W–L do `SeasonAdvance`, 4 totais do `Verdict`. |
| A4 | `SeasonAdvance`: o trecho simulado (até 9 jogos) chega pronto — a "simulação" não é vista correndo. | Ticker revela um jogo por vez (~140ms/linha) com W–L subindo e barra da temporada crescendo, rótulo "SIMULANDO…" enquanto corre; tap pula. Só apresentação do `calendar.ticker` já calculado. |
| A5 | Jogo: decisão resolve e o feed só ganha uma linha — sem "impacto" do acerto/erro. | `OutcomeBanner` (1.3s, JS): faixa preta/vermelha sobre o painel de decisão — "ACERTOU +4.0" / "ERROU −2.0" / "LESÃO". Placar do cabeçalho pisca (`.game-score--flash`) quando muda. Barra de momento (ink×red) sob o placar mostra a margem viva. |
| A6 | Botões/linhas sem feedback tátil; opções do momento sem hover. | `.btn:active` (translate 1px + sombra some), `.game-option:hover/:active`, `[data-testid=attr-row]:active`. Transições 120ms. CSS puro, atrás de reduce onde for só decoração. |
| A7 | Veredito: camadas aparecem, mas o tier em si não tem suspense. | Roleta de tier (~1.4s): o headline cicla os 7 tiers em ordem antes de cravar o real; count-up dos totais (A3). |
| A8 | `Setup` com 3 modos: cabe o 4º (frente B) sem mudar layout. | Só ordem: `normal, arcade, goat, rapido`. |

Fora: redesign de tela, Home animada (YAGNI), toggle de motion (reduce já decidido).

## 2. Frente B — MODO ARCADE

### 2.1 Modo

`GameMode = 'normal' | 'arcade' | 'goat' | 'rapido'`. PT "MODO ARCADE" · EN "ARCADE MODE" · meta "MINIGAMES". Draft, liga, encruzilhadas, aposentadoria, veredito, cartão: idênticos ao normal. Só o **painel de decisão** dos jogos assistidos muda: em vez das 2–3 opções, um minigame. "Simular o resto do jogo" continua (política auto). `timePressure`/`ClutchTimer` não se aplicam (o minigame tem o próprio relógio).

### 2.2 Qual minigame em qual momento

`minigameFor(moment)` (puro, em `engine/minigames/index.ts`):

- slot `clutch` → **Arremesso** (o último lance é sempre um arremesso);
- senão, alguma opção da situação tem `attr === 'defense'` → **Muralha** (defesa);
- senão → **Quadro tático** (ataque).

Com o catálogo atual: `openTone` s1/s3 e `q3swing` s1/s3/s4 e `q4pressure` s0/s2 → defesa; o resto → quadro. Um jogo de 3 momentos costuma misturar os três. O texto da situação (`moment.situationKey`) continua sendo a manchete do momento.

### 2.3 Como o minigame entra no engine

O minigame entrega `MinigameResult = { optionId, quality: 0..1, turnover?: true }`.

- `optionId` vem de um **catálogo novo** dentro de `O` (moments.ts), ids `mg*`, mesma tabela `RISK` — assim `RISK_OF`, `dagger`, `playerPts`, i18n `play.<id>.hit/miss` funcionam sem caso especial:

| id | risco | attr | attr2 | usado por |
|----|-------|------|-------|-----------|
| `mgAssist` | safe | passing | — | quadro (arremesso de companheiro) |
| `mgMid` | safe | handles | clutch | quadro, arremesso |
| `mgThree` | bold | three | clutch | quadro, arremesso |
| `mgLayup` | bold | finishing | — | quadro, arremesso |
| `mgDunk` | reckless (injury 0.06) | finishing | physical | quadro, arremesso |
| `mgLock` | safe | defense | — | muralha |
| `mgContest` | bold | defense | physical | muralha |
| `mgSteal` | reckless | defense | handles | muralha |

- `resolveMoment(build, age, option, weight, rng, exec?)` ganha o parâmetro opcional `exec: { quality, turnover? }`. Com ele: `p = clamp(momentProb + (quality − 0.5) × SKILL_W, 0.05, 0.95)`, `SKILL_W = 0.5` (execução perfeita = +25 p.p., péssima = −25 p.p.; atributos continuam mandando). `success = rng.chance(p) && !turnover`. **Mesmas 2 calls**, mesma ordem. Sem `exec` = comportamento atual, byte a byte.
- `DECIDE_MOMENT` ganha `exec?: MinigameExec`. Reducer: com `exec`, exige `career.mode === 'arcade'` e resolve o `optionId` no catálogo `mg*` (não em `moment.options`); sem `exec`, caminho atual. `applyMoment` repassa `exec`.
- Aleatoriedade interna do minigame (IA da defesa, sequência do atacante, cenário): `createRng(hash(state.seed, state.rngCalls))` local na UI — determinístico, replayável, **zero calls** no engine. Recarregar no meio de um minigame recomeça o minigame do zero (estado local não persiste) **[assunção]**.

### 2.4 Estrutura

```
src/engine/minigames/
  index.ts     minigameFor, MinigameResult/MinigameExec, hashSeed
  playbook.ts  estado + step(dt) + ações (pass/move/shoot) + IA de defesa — puro
  shot.ts      física do arremesso, cenários, qualidade — puro
  defense.ts   sequência do atacante, janelas, avaliação — puro
src/ui/minigames/
  Minigame.tsx     roteia pelo minigameFor; moldura comum (título, instrução, relógio)
  Playbook.tsx     SVG meia-quadra (top-down)
  Shot.tsx         SVG vista lateral + controles (arrasto / medidor)
  Defense.tsx      SVG frente a frente + botões ← ROUBAR ↑ →
src/styles/minigames.css
tests/engine/minigames/*.test.ts, tests/state-arcade.test.ts
```

### 2.5 Quadro tático (ataque) — "JOGADA"

Meia-quadra top-down (cesta no topo), 5 ímãs vermelhos (nós; o seu leva o número da camisa), 5 pretos (eles). Relógio de posse **12s** real. Loop `step(state, dt)` a 20Hz.

- **Formação inicial** sorteada (rng local) de 4 sets: 5-out, horns, pick&roll lateral, iso topo. A bola começa com você.
- **Ações do portador** (se for você ou um companheiro — a bola pode circular):
  - **Passe**: tap num companheiro. Voa 0.35s. Interceptação se um defensor está na linha do passe a < 0.9m da reta: chance `laneRisk × (1 − passing/140)` (rng local) → **turnover**.
  - **Drible/infiltrar**: tap num ponto da quadra; o portador anda a 4.2 m/s (× `handles/85` clampado 0.8–1.15). Se 2 defensores a < 1.0m por > 0.5s → chance de desarme por tick `0.06 × (1 − handles/150)` → **turnover**.
  - **Arremessar**: botão. Tipo pelo lugar: a < 1.8m do aro → escolha rápida BANDEJA (`mgLayup`) ou ENTERRAR (`mgDunk`); dentro do arco → `mgMid`; fora → `mgThree`. Se quem arremessa não é você → `mgAssist`.
- **Qualidade** = abertura do arremessador: `clamp((distDefMaisPerto − 0.5) / 1.6, 0, 1)`, × 0.85 se restam < 2s no relógio. Relógio zerado → turnover (`mgMid`, `turnover: true`).
- **IA de defesa** (o que dá o "imprevisível"): homem-a-homem; cada defensor vai para o ponto entre o seu homem e a cesta (`0.35` do caminho), mais colado no portador (`0.15`). **Rotação com atraso** de 0.4s após um passe (janela de abertura). **Ajuda**: quando o portador entra no garrafão, o defensor do companheiro mais perto da cesta colapsa nele → o companheiro fica livre (o loop real: infiltra → ajuda vem → passa pra fora → 3 aberto). Velocidade dos defensores `3.6 m/s × (0.9..1.1)` sorteada por defensor; playoffs/finais +8%.
- Fim: arremesso (dispatch com `optionId`+`quality`) ou turnover. Resultado animado 1.3s (bola entra/erra ou "BOLA PERDIDA") lendo o `outcome` já resolvido no estado.

### 2.6 Arremesso — "ARREMESSO"

Vista lateral, você à esquerda, cesta à direita, arco desenhado ao vivo. Antes do arremesso escolhe o **tipo** (distância real): BANDEJA 1.5m (`mgLayup`), PULL-UP 5.0m (`mgMid`), TRÊS 7.24m (`mgThree`); ENTERRAR (`mgDunk`) só quando `physical ≥ 75` **[assunção]**.

- **Dois jeitos de arremessar** (toggle na moldura, lembrado em `localStorage`): **ARRASTO** — arrasta a bola pra trás e solta (vetor = ângulo + força, como na referência, com a trajetória prevista tracejada enquanto arrasta); **MEDIDOR** — tap 1 trava a força num medidor que sobe e desce, tap 2 trava o ângulo num ponteiro que oscila (jeito "de arcade").
- **Física** (puro, `shot.ts`): projétil 2D, g = 9.81, release a 2.05m (+0.25 no dunk/bandeja), aro a 3.05m, raio 0.225m. Solução analítica: onde a bola cruza a altura do aro descendo (`xCross`). `err = |xCross − d|`; ângulo de entrada < 32° aperta a tolerância pela metade. `quality = 1 − clamp(err / 0.55, 0, 1)`. Bandeja: tolerância ×1.6 (é fácil, o risco está no `RISK`).
- **Cenários** (rng local + contexto): fundo muda com `kind` (regular: arquibancada neutra; rivalidade: torcida vermelha; playoffs: faixa "PLAYOFFS"; finais: confete+placar da série), casa/fora pela cor da tabela; leve **vento de arena não existe** — variação real vem de release/tempo: nas finais o medidor oscila 25% mais rápido.
- Após o dispatch, a animação usa o `success` do engine: acerto → a trajetória é ajustada nos últimos 20% pra entrar (swish se `quality > 0.7`, senão "bate e entra"); erro → curta/longa/anel conforme o sinal do `err` (arremesso perfeito que erra = "girou e saiu", é basquete).

### 2.7 Muralha (defesa) — "MURALHA"

O dono não fixou mecânica. Escolha: **reação** (não outro quadro tático — evita dois minigames com a mesma cara). Frente a frente: o atacante (preto) dribla contra você (vermelho); ele faz uma sequência de 4–6 **batidas** sorteada (rng local) entre `left`, `right`, `hesi` (finta: NÃO reagir), `expose` (bola exposta: janela de roubo), `shoot` (última). Cada batida aparece com atraso aleatório 350–900ms e janela de reação de 650ms (playoffs 560, finais 480).

- **Entradas**: ← / → acompanha (também setas), ↑ CONTESTAR (só vale na batida `shoot`), ROUBAR (tecla S). Botões grandes no mobile.
- **Avaliação** (`defense.ts`): acerto = reagiu com o input certo dentro da janela; `hesi` = não apertar nada. `quality = acertos / batidas`.
- **Opção resultante** (o jogador escolhe o risco pelo que faz): tentou ROUBAR → `mgSteal` (na batida `expose` dentro da janela: `quality = 1`; fora: `quality = 0`, "passou por você"); senão, CONTESTOU no `shoot` dentro da janela → `mgContest` (bold) com `quality`; senão → `mgLock` (safe) com `quality`.
- Animação de resultado: toco/roubo/erro do atacante vs cesta do atacante.

### 2.8 Tela

`Game.tsx`: em arcade, o `game-decision` renderiza `<Minigame pending moment build number onResolve/>` no lugar das opções; instrução curta na moldura (1 linha por minigame, sempre visível — sem tutorial de 1 uso). Desktop: cabe na coluna de 460px; mobile: largura total, altura ~62vw. Tutorial da tarja `game.tutorial` ganha versão arcade.

### 2.9 i18n

`mode.arcade.*` (5), `option.mg*` (8), `play.mg*.{hit,miss}.v{0,1}` (32), `mg.*` (moldura, tipos de arremesso, botões, resultados, instruções, ~30). PT+EN, paridade testada; o teste do catálogo cobre os `mg*` automaticamente via `ALL_OPTION_IDS`. Guia `/guia-modos` + `/en/game-modes` ganham a seção do modo.

### 2.10 Testes

- `minigames/index`: mapeamento slot→minigame (clutch=shot; defesa; quadro).
- `resolveMoment` com `exec`: 2 calls sempre; `quality` 1/0 desloca p em ±0.25 e clampa; `turnover` força miss; sem `exec` = resultado idêntico ao atual (mesma seed).
- `playbook`: determinismo por seed; posições dentro da quadra; passe com defensor na linha pode virar turnover, passe limpo nunca; ajuda colapsa ao entrar no garrafão; relógio zerado = turnover; `shootOption` por distância.
- `shot`: `idealSpeed(angle, d)` acerta o aro (err ≈ 0); erro cresce com desvio; bandeja mais tolerante; `quality` em [0,1].
- `defense`: sequência termina em `shoot`; avaliação de janela; `resultOf` escolhe steal/contest/lock; quality = razão.
- `state-arcade`: DECIDE_MOMENT com `exec` só em arcade; `rngCalls` após um jogo idêntico ao normal com mesma seed; `optionId` persistido no outcome é `mg*`; dagger no clutch com `mgThree` sucesso.
- e2e: bloco arcade (newCareer MODO ARCADE → `.mg` aparece; "Simular o resto do jogo" fecha o jogo).
- Calibração: não re-rodada por construção (política auto intocada; contagem/ordem de RNG intocada). Registrar no HANDOFF.

## 3. Fora de escopo

Persistir o estado interno do minigame no save; minigames no modo normal (toggle); ranking/pontuação de minigame; físicas de rebote; nomes de companheiros.
