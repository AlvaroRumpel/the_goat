# Arcade — ajustes pós-teste do dono (passe planejado, rebote pra qualquer um, formações, arremesso estilingue, muralha fluida + WASD)

**Data:** 2026-09-03 · **Branch:** `arcade-v2` · **Complementa** `2026-09-03-arcade-2d-design.md` (§B do arremesso é substituído por inteiro; §C e §D ganham itens).

## 0. Pedido do dono (verbatim, resumido)

1. Jogada: (1.1) passar a bola antes de RODAR — escolher pra quem e quando (CEDO / NORMAL / TARDE); (1.2) rebote pode ir pra qualquer companheiro, mostrando a bola indo ao aro e voltando até um jogador; (1.3) ≥ 5 posições iniciais diferentes.
2. Arremesso: (2.1) tirar o repertório de 8 tipos — vira "angry birds": arrasta e solta pra acertar a cesta; (2.2) atributo de arremesso = mira menos precisa; muito perto da cesta = finalização; (2.3) adversário só como obstáculo estático; (2.4) variações de distância e altura.
3. Muralha: (3.1) jogadores pulam de posição — deixar fluido como a prancheta; (3.2) controles ruins — WASD e informação visual dos controles.

Invariantes: `src/engine/` puro (Rng injetado, sem React/`Math.random`); minigame devolve `{optionId, quality, turnover?}`; contrato de RNG do save intocado (o rng dos minigames é LOCAL, semeado por `minigameSeed`, então mais calls locais não mexem na calibração); i18n PT/EN com paridade; sem fotos/logos reais.

Decisões tomadas pelo agente sem o dono (sessão autônoma) estão marcadas **⚠ assumido**.

## 1. Jogada (`engine/minigames/playbook.ts`, `ui/minigames/Playbook.tsx`)

### 1.1 Passe planejado

Estado novo: `plannedPass: { to: number; when: 'early' | 'mid' | 'late'; at: number | null } | null`.

- `planPass(s, to, when)`: só em `draw` ou `run` pausado (a UI garante; o engine só exige `to !== ball.holder` e `to` válido). Grava `{ to, when, at: null }`. `planPass(s, null)` limpa. `applyTemplate` e `clearRoutes` (UI) limpam o plano.
- Resolução do instante no `step` (fase `run`), no primeiro tick com `plannedPass.at === null`:
  `dur = max_i (routeLength(rota_i) − routeProgress_i) / runSpeed` (duração restante das rotas; 0 se ninguém tem rota).
  `at = t + { early: 0, mid: dur / 2, late: dur }[when]`.
  Resolver no tick (e não em `startRun`) cobre o RODAR inicial e o RODAR de retomada da pausa com o mesmo código.
- Execução: no `step`, se `plannedPass.at !== null && t >= at && isLive(s)` → `pass(s, to, rng, input)` (mesma interceptação de sempre) e `plannedPass = null`. Se `to === holder` no instante (bola já mudou de mão) → só limpa.
- `isSettled` devolve `false` enquanto `plannedPass` existe (senão TARDE pausaria antes de executar).
- UI (draw e pausa): botão **PASSAR** entra no modo "toque no companheiro" (hint muda); toque num ímã companheiro seleciona; aparecem os chips **CEDO · NORMAL · TARDE**; escolher fecha o modo e `snapshot()` antes (DESFAZER cobre). Plano desenhado como seta tracejada do portador ao alvo com a etiqueta do momento. Tocar em PASSAR de novo com plano = cancela o plano. Modelos e LIMPAR cancelam.

### 1.2 Rebote pra qualquer um

Em `shoot`, no ramo "rebote acertou": quem pega é sorteado entre os 5 atacantes com peso `1 / (0.6 + distToBasket)` (**1 call local** a mais). `ball.holder = rebounder`; `reboundBy = rebounder` fica no estado pra UI. Nada mais muda no engine (2ª posse de 5 s, rotas zeradas, pausa na UI).

Animação (UI): quando `rebounds` sobe → bola vai ao aro (500 ms, `--shot`) e depois quica até o `reboundBy` (300 ms, `--bounce`), tudo via transição CSS de `transform` como o arremesso de hoje. Se cair num companheiro, o botão de arremesso já vira ASSISTÊNCIA (`shotOptionFor` existente) e passe de volta funciona ao vivo.

### 1.3 Formações iniciais

`createPlaybook` sorteia a formação (**1 call local** a mais, antes do esquema) entre 7: `fiveOut`, `horns`, `pnr`, `iso` (existentes) + `box` (1-4 baixo), `stack` (pilha lateral), `sideOut` (bola na asa, reposição lateral). Índice 0 continua sendo o portador. Modelos seguem apontando pra suas formações fixas (aplicar modelo reposiciona — comportamento atual).

## 2. Arremesso estilingue (`engine/minigames/shot.ts` reescrito, `ui/minigames/Shot.tsx` reescrito)

### Cena

Sorteada 1× pela seed local (3 calls): distância `d ∈ [1.2, 8.5)` m, altura de saída `releaseH ∈ [1.9, 2.6)` m (**⚠ assumido**: "alturas" = altura da bola na mão — parado × saltando; o aro fica em 3,05 m porque é basquete), `gap` do defensor `∈ [0.8, 2.4)` clampado a `≤ d − 0.4`. Defensor = `bestDefender(five)`, mão erguida na altura `who.reach` (2,7–2,9 m). Zona pelo `d`: `< 1.8` = **finalização** (`mgLayup`; `mgDunk` se físico efetivo ≥ 75 e `d < 1.0`; atributo `finishing`), `< 7.24` = **meia** (`mgMid`, `handles`), senão **três** (`mgThree`, `three`).

### Mecânica

Arrastar em qualquer ponto do palco e soltar. Vetor de puxada (ponto inicial − ponto atual, em metros do viewBox) × `PULL_GAIN = 4.0` = velocidade de lançamento (m/s), módulo clampado em `[2, 14]`. Puxar pra trás e pra baixo = bola vai pra frente e pra cima (estilingue). Enquanto arrasta: pontilhado do arco previsto cobrindo a fração `0.3 + 0.5 × skill` do voo. Soltar com puxada < 0,15 m = nada.

Ruído de mira no soltar (2 calls locais, gaussiana por Box-Muller): ângulo `+= g₁ × (1 − skill) × 5°`, velocidade `×= 1 + g₂ × (1 − skill) × 0.06`. `skill = skillOf(build, age, zona, fatigue)` (fórmula da spec anterior: `clamp((attrEff − 30) / 60, 0.25, 1) × (1 − fadiga × 0.5)`); skill 1 = ruído zero.

### Física (engine, `simulateShot`)

Parábola sem arrasto: `x = vx t`, `y = h0 + vy t − g t² / 2`.
1. Bloqueio: em `x = gap`, se `y < reach` → `blocked` (quality 0).
2. Cruzamento do aro descendo: `t* = (vy + √(vy² − 2g(RIM − h0))) / g`; sem raiz real (não sobe até o aro) → `short`, `err = −∞` (quality 0).
3. `err = x(t*) − d`. Tabela: `|err| > d + 0.15` passa da tabela = `long`.
4. `accuracy = clamp01(1 − |err| / TOL)`, `TOL = 0.45` m (0,8 na finalização).
5. `quality = accuracy × lerp(0.6, 1, skill)`. **⚠ assumido**: sem multiplicador de abertura — o defensor é só obstáculo (pedido 2.3).

Retorna `{ optionId, quality, fate: 'in' | 'short' | 'long' | 'rimOut' | 'blocked', tCross, path }` pra UI animar. Contrato de quality em [0, 1] mantido.

### Animação

Bola percorre a trajetória real (tempo de voo real × 1.0, mín. 600 ms) até 80 % e converge pro ponto do desfecho, que **obedece `outcome.success`** (regra do projeto): sucesso = SÓ REDE mesmo que a geometria dissesse curto; erro = `blocked` se bloqueada, senão pelo `err`: `< −0.1` CURTO, `> 0.1` LONGO, senão GIROU E SAIU. Overlay `mg-result` como hoje.

### Sai

`SHOTS`, `ORDER`, `availableTypes`, `shotOpenness`, `shotQuality`, `createStaticDefender`, `resultFor`, `REF_ANGLE`, `refSpeed`, `TYPE_KEY`, teclas 1–8, `.mg-sh-pick*`. `FreeThrows` continua com a parábola automática (fora do pedido) usando `trajectory`/`idealSpeed` + constantes próprias (`FT_D = 4.57`, `FT_H = 2.05`). `skillOf` passa a receber `'layup' | 'mid' | 'three' | 'dunk'` (é o que a prancheta usa).

i18n: `mg.shot.dragHint`, `mg.shot.zone.finish|mid|three`, `mg.shot.dist`; regras/hint reescritas; chaves de tipo/pick removidas (`mg.shot.type.*`, `mg.shot.pickType`, `mg.shot.phase.pick`). `mode.arcade.line1` já diz "arremesso por ângulo e força" — volta a ser verdade.

## 3. Muralha (`engine/minigames/defense.ts`, `ui/minigames/{Defense.tsx,defenseFlow.ts,useSwipe.ts}`)

### 3.1 Fluidez

- **Atacante interpola.** `move` ganha `fromX`/`toX`; `toX` decidido no início do movimento (cruzada ±0.9, giro ±1.1, drive ±0.3 provisório); cada tick `attX = lerp(fromX, toX, clamp01((t − at) / dur))`. No fim do drive, se batido (`!inFront || airborne`): `attX += dir × 0.3`, `attDist = 1.2`, `phase = 'drive'` (como hoje). Ele também **avança devagar**: `attDist = max(4.0, 7.5 − 0.45 × live)`.
- **Defensor por velocidade.** `slide(s, dir: -1 | 0 | 1, input, hold)`: `defVx = dir × SLIDE_SPEED (3.2) × mods.speed`, `slideUntil = hold ? ∞ : t + 0.3`. No `step`: `defX += defVx × dt` (clamp ±2.5); `t ≥ slideUntil` zera. `airborne > 0` continua bloqueando (e zera `defVx`).
- **UI**: ímãs posicionados por `transform: translate()` com `transition: transform 60ms linear` (20 Hz → suave); no `drive` a transição sobe pra 600 ms (ele vai à cesta). `you.y` continua derivado de `attDist`.

### 3.2 Controles

- Teclado (window, keydown/keyup, ignora inputs): **A/←** e **D/→** = deslizar enquanto segura; **W/↑** = CONTESTAR; **S/↓/Espaço** = ROUBAR. `useSwipe` perde o teclado (só pointer); swipe = `slide(dir, hold=false)` (burst 0,3 s), tap = roubo, up = contestar.
- Pad: 4 botões com o glifo da tecla em cima (`A ◀`, `S`, `W ▲`, `▶ D`) e o nome embaixo; ESQ/DIR seguram (`pointerdown` liga, `pointerup`/`pointerleave`/`pointercancel` desliga). Legenda no HUD substitui `mg-df-gest`: "A/D deslizar · S roubar · W contestar" (i18n).
- Cartão "COMO JOGAR" da muralha reescrito com as teclas.

## 4. Testes

- `playbook.test.ts`: planPass early/mid/late (instante e execução; `isSettled` false com plano; plano com `to === holder` limpa); rebote cai em qualquer atacante (≥ 2 índices distintos em 60 seeds) e `reboundBy` bate com `ball.holder`; formações ≥ 5 distintas em 60 seeds, determinístico por seed; testes existentes ajustados aos calls extras.
- `shot.test.ts` reescrito: cena determinística e nos intervalos; `simulateShot` com lançamento ideal (`idealSpeed`) → `accuracy ≈ 1`; muito forte → `long`; fraco → `short`; por baixo da mão → `blocked`; zona por `d`; `aimNoise` com skill 1 = 0 e cresce com skill menor; `quality ∈ [0, 1]`.
- `defense.test.ts`: política de sombra usa `slide(dir | 0, hold=true)` por tick; atacante nunca "salta" (|Δattx| por tick ≤ 0.3 m fora do fim de drive); `attDist` decresce; burst para sozinho.
- e2e (`tests/e2e-playthrough.mjs`): ramo arremesso = arrastar no `.mg-sh-svg` (mouse down → move → up); muralha = segurar `KeyA`/`KeyD`.

## 5. Arquivos

```
editar  engine/minigames/{playbook,shot,defense}.ts · ui/minigames/{Playbook,Shot,Defense,FreeThrows}.tsx,
        ui/minigames/{defenseFlow,useSwipe}.ts · styles/{mg-shot,mg-defense,mg-playbook}.css · i18n pt/en ·
        tests/engine/minigames/{playbook,shot,defense}.test.ts · tests/e2e-playthrough.mjs · HANDOFF.md
```
