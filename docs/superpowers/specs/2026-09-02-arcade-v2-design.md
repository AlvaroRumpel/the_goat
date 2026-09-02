# Modo arcade v2 — minigames completos — design

**Data:** 2026-09-02 · **Base:** commit `3e786f6` (arcade v1 + frente visual, spec `2026-09-02-arcade-e-vida-visual-design.md`). **Brainstorm com o dono** (4 rodadas, 16 perguntas): estilo jornal fica; profundidade sobe. Decisões do dono em **negrito**; o resto são escolhas de implementação derivadas.

## 0. O que NÃO muda (travas)

- Contrato com o engine: minigame devolve `{ optionId (mg*), quality 0..1, turnover? }`; `resolveMoment` desloca p em **±25 p.p.** (`SKILL_W = 0.5`); mesmas calls de RNG; política auto intocada; calibração válida por construção. Toda aleatoriedade interna dos minigames vem do rng local (`minigameSeed`).
- **Mapeamento automático** slot→minigame (clutch = arremesso; situação defensiva = muralha; resto = quadro). **Carreira intocada** (arcade é o modo dos minigames). **Estilo jornal** (papel/tinta/vermelho, SVG plano).
- A animação do desfecho OBEDECE `outcome.success` do engine. Quando o minigame "sente" uma coisa e o engine decide outra, a narração fecha a conta (roubo limpo que falha = "árbitro marca falta"; arremesso perfeito que erra = "girou e saiu").
- Um momento resolve UMA vez no engine, no fim da posse. Fases intermediárias (rebote, lances livres, contra-ataque) são decididas dentro do minigame com rng local e só alimentam a `quality` final.

## 1. Camada comum (`src/engine/minigames/common.ts`)

- **Adversário real**: `opponentFive(league, teamId)` = 5 NPCs de maior `ovr` do time (posição, tags). Cada um vira `{ name, pos, ovr, tags, speed, reach }`: `speed = 3.2 + (ovr − 55)/45 × 1.2` m/s (clamp 3.0–4.4), tag `defender` +8% e closeout mais curto, `shooter`/`playmaker`/`rebounder` alteram tendências. **Muralha usa a estrela (maior ovr) com tendências escondidas**.
- **Dificuldade escala com o adversário** (dono): `difficulty(ctx, star) = base(kind) × (0.85 + (star.ovr − 60)/100)`, `base` regular 1.0 / playoff 1.12 / finals 1.22. Multiplica velocidades da IA e divide janelas de reação/closeout.
- **Seus atributos mudam o minigame** (dono), não só a probabilidade — tabela única `attrMods(build, age)` (todos via `ageMultiplier`):
  - `handles`: eficácia da finta de drible (abre 0.8–1.6m), resistência ao desarme, step-back disponível ≥ 70.
  - `passing`: risco de interceptação (÷), passe de risco disponível sempre mas seguro só ≥ 75.
  - `physical`: velocidade dos seus ímãs, altura do salto (janela do ápice), velocidade do closeout defensivo, enterrada ≥ 75, fadiga no 4Q (< 65 = força máxima −15%, salto −20%).
  - `three`/`finishing`: tolerância dos arremessos por tipo (×0.8 a ×1.3), floater ≥ 60 em finalização.
  - `defense`: janela de reação +0–120ms, janela de roubo/toco mais larga.
  - `rebounding`: janela do box-out (largura 8%–26% da barra).
  - `clutch`: reduz o tremor da torcida e a penalidade de fadiga; fadeaway ≥ 70.
- **Duração-alvo 30–45s por momento** (dono). Cada minigame tem fases com relógio próprio; nenhuma fase passa de 15s.
- **Barra de timing** (componente `TimingBar`, reutilizado): cursor varre 0→1→0; toque dentro da janela = acerto, com "perfeito" no centro. Usada no salto do arremesso, toco, box-out, rebote ofensivo, carga.
- **Lances livres** (`FreeThrows`, sub-minigame do Arremesso): 2 arremessos sem defensor, relógio parado, só mira+salto; opção `mgFreeThrow` (safe, `clutch`) quando é o desfecho do momento (falta puxada no quadro); os do NPC (falta sua na muralha) são rng local com `p = 0.62 + (ovr − 60) × 0.006`.

## 2. JOGADA (quadro tático) — "desenhar, rodar, intervir"

Fases (relógio de posse 12s só corre na fase 2):

0. **Leitura (2s)**: os 5 do adversário entram com nome curto; o esquema é sorteado e **escondido** — só sinais no movimento (zona não segue o corte inicial; pressão cola a 0.5m; troca-tudo aparece no primeiro bloqueio; armadilha só aparece no pick&roll).
1. **Desenhar (sem relógio, botão RODAR)**: **controle total** — arrasta qualquer ímã vermelho pra desenhar a rota (polilinha até 6 pontos, fica desenhada como no quadro); toque num ímã com rota = alterna "termina em BLOQUEIO" (o companheiro para e bloqueia o defensor mais próximo do portador previsto). 6 modelos como ponto de partida (pick&roll, horns, corta-luz duplo, isolamento, 5-out, transição) + LIMPAR + DESFAZER. O portador inicial é você; a rota do portador também pode ser desenhada (infiltração planejada).
2. **Rodar (12s)**: tudo se move nas rotas (velocidade por `physical`, defensores por `speed × difficulty`) contra o esquema; você intervém ao vivo com a barra de ações: **PASSE** (toque no companheiro), **FINTA** (drible: 0.6s, abre `0.8 + handles-mod` m se vencer o marcador; 6% × mod de perder a bola), **BLOQUEIO** (companheiro mais perto vem fazer pick na hora), **FINTA DE ARREMESSO** (marcador a < 1.2m pula: abre infiltração por 0.7s; se ele cai em cima = falta → **Lances livres**, momento vira `mgFreeThrow`), **PASSE DE RISCO** (por cima/skip: destino +0.3 de abertura, interceptação ×2), **ARREMESSAR** (tipo pelo lugar; perto do aro: bandeja/floater/enterrada; a decisão abre o Arremesso? NÃO — no quadro o arremesso é instantâneo pela abertura; o Arremesso completo é o minigame do clutch). Rotas terminam → ímãs ficam onde pararam; você pode arrastar de novo ao vivo.
3. **Rebote ofensivo** (só se a abertura do arremesso foi < 0.4): "arremesso forçado" — `TimingBar` com janela por `rebounding` vs o `rebounder` deles; acerto = segunda posse curta (5s, sem desenho) e a `quality` final = max(primeira, 0.8 × abertura do putback); erro = fim.

**Esquemas de defesa** (rng local, peso por time: times fortes usam mais armadilha/troca): homem (base v1, ajuda no garrafão), zona 2-3 (defensores guardam áreas; cantos e meio abertos, infiltração encontra 2–3), troca-tudo (bloqueio = troca; se o pivô deles cai em você, você ganha +15% de velocidade = mismatch), armadilha no pick&roll (2 na bola após o bloqueio → o bloqueador rola livre, 4×3), pressão (marcador a 0.5m, desarme ×1.5, mas passar por ele = bandeja aberta).

**Turnovers** (forçam erro): interceptação, desarme, relógio, **falta de ataque** (infiltrar em defensor parado há > 0.6s no garrafão = carga deles).

**Quality** = abertura no arremesso × fator do tipo (bandeja 1.0, meio 0.95, três 0.9 — o risco já está no `RISK`) × relógio (< 2s: ×0.85) + 0.1 se a jogada "criou" o arremesso (≥ 2 passes ou bloqueio antes), cap 1.

## 3. ARREMESSO — closeout, repertório, salto, pressão

Fases (~25–40s):

1. **Escolha** (relógio parado): repertório com disponibilidade por atributo: bandeja, **floater** (finalização ≥ 60), pull-up, **step-back** (drible ≥ 70; empurra o defensor +1.2m, tolerância ×0.8), **fadeaway** (clutch ≥ 70; +0.8m, ×0.85), três, **tabela** (qualquer; reflexão na tabela com restituição 0.7, ponto doce marcado, tolerância ×1.1 se acertar o ponto), enterrada (físico ≥ 75). Mapeamento: bandeja/floater → `mgLayup`; pull-up/fadeaway/tabela-meio → `mgMid`; step-back → `mgThree` se fora do arco senão `mgMid`; três/tabela-longa → `mgThree`; enterrada → `mgDunk`. Cada tipo mostra distância e uma linha de "custo/benefício".
2. **Closeout** (começa ao confirmar o tipo): o melhor defensor deles (tag `defender`, senão maior ovr) parte de 2.5–4.0m (por abertura do contexto) a `speed × difficulty`; ao chegar a 1.2m levanta a mão (linha no SVG). Arco que passa abaixo da mão no x do defensor = **bate na mão** (quality 0, animação de toco). Chegou colado antes de você soltar = **contestado** (tolerância ×0.6). Step-back/fadeaway reiniciam o closeout com +distância.
3. **Mira + salto**: arrasto ou medidor (como v1) e depois **timing do salto**: soltar a mira inicia o salto; `TimingBar` vertical sobe até o ápice e desce; toque no ápice = release perfeito (tolerância ×1.15), cedo/tarde (×0.85/×0.7); janela do ápice por `physical` e encolhe com fadiga.
4. **Pressão**: **torcida fora de casa** — tremor da mira (amplitude por `noise(team) = 0.6 × strength/85 + 0.4 × bigMarket` menos `clutch`-mod), medidor 15% mais rápido; casa = estável. **Fadiga no 4Q** (físico < 65: força máxima −15%, ápice −20%). **Relógio real do lance**: o `moment.clock` (ex.: 0:21) corre em tempo real do início da fase 2; zerou = sem arremesso (`turnover`, "estourou o relógio"). **Placar vivo no fundo**: placar/série/torcida reagem ao desfecho (explode/silencia).
5. **Desfecho** (obedece o engine): swish / bate e entra / curto / longo / girou e saiu / toco.

## 4. MURALHA — posse defensiva em fases

Atacante = **estrela do adversário, tendências escondidas** (shooter: 60% arremessa de longe, 20% infiltra, 20% passa; playmaker: 45% passa; rebounder/defender: 55% infiltra). Fases (~30–45s):

1. **Perímetro (6–9 batidas)**: v1 ampliada — `left/right/hesi/expose/drive/shoot` com combos (finta+cruzada, hesi+drive) e ritmo crescente (`delay` cai 8% por batida); janela por `defense`-mod ÷ `difficulty`. Ações: ← →, segurar na finta, **ROUBAR** (na `expose`), **TOMAR A CARGA** (na `drive`: `TimingBar` curta; acerto = falta de ataque, posse nossa; erro = falta sua → lances livres deles), **FALTA TÁTICA** (a qualquer hora: encerra em lances livres deles).
2. **Passe** (se a tendência sortear passe ou você segurou 4 batidas): o atacante cospe a bola — 3 linhas de passe aparecem 0.8s; **fechar a linha certa** = interceptação (roubo); errada = o recebedor está aberto → fase 3 contra ele (closeout mais longo).
3. **Contestar**: o arremessador sobe — **TOCO com timing** (`TimingBar`: ápice = toco, bola nossa; cedo = falta → lances livres; tarde = arremesso sai) ou ↑ CONTESTAR (sem timing, só reduz a abertura dele).
4. **Box-out** (se o arremesso saiu e não foi toco): `TimingBar` por `rebounding` vs o `rebounder` deles; acerto = rebote nosso; erro = putback deles (2 batidas rápidas de contestação).

**Cadeia completa** (dono): roubo/toco/carga/interceptação → contra-ataque animado (bola vai pro outro lado, cesta nossa) e `quality` final = 1; lances livres deles = 2 arremessos por rng local (`p` por ovr): 2/2 = **forçado erro** ("cesta deles"), 1/2 = `quality` 0.45, 0/2 = `quality` 0.7; putback deles convertido = erro forçado.

**Mapeamento**: roubo/carga/interceptação → `mgSteal` (reckless); toco → `mgContest` (bold); contido/box-out/falta tática → `mgLock` (safe). `quality` das fases sem cadeia = acertos ÷ batidas (perímetro) ponderado 0.6 + contestação 0.25 + box-out 0.15.

## 5. Tela e apresentação

- Moldura comum (`ArcadePanel`) ganha: **fase atual** (mono-label vermelha: LEITURA · DESENHAR · RODAR · REBOTE…), o adversário (nome curto + tag), o relógio da fase. Barra de ações do quadro com ícones do `Icon.tsx` onde existir.
- Desenho de rotas: pointer events com captura; no desktop também Shift+arrasto pra polilinha; mobile 346px: ímãs com hit-area r=75 (já existe), rotas com traço de 6px.
- Sem nota S/A/B/C, sem tutorial guiado (dono recusou). A linha de dica fica por fase (`mg.hint.<kind>.<phase>`).
- i18n: ~120 chaves novas (fases, ações, esquemas, tipos de arremesso, cadeia, narração curta).

## 6. Estrutura e testes

```
src/engine/minigames/common.ts    opponentFive, difficulty, attrMods, timingWindow, freeThrowP
src/engine/minigames/playbook.ts  v2: rotas/desenho, esquemas, ações, rebote ofensivo
src/engine/minigames/shot.ts      v2: repertório, closeout, salto, pressão, tabela, lances livres
src/engine/minigames/defense.ts   v2: fases, tendências, passe, toco, box-out, cadeia
src/ui/minigames/TimingBar.tsx, FreeThrows.tsx (dentro de Shot), Playbook/Shot/Defense v2
```
Testes por módulo (determinismo, invariantes de quadra, cada esquema produz o sinal esperado, monotonicidade dos mods de atributo, transições de fase, cadeia → mapeamento de opção, quality em [0,1]); `state-arcade` cobre `mgFreeThrow`; e2e arcade mantém o bloco (defesa por teclado atravessa as fases; "Simular o resto" fecha).

## 7. Fora de escopo

Novos icônicos (ex.: chase-down) — mexe em `verdict.ts`; memória de tendências entre jogos; nota/ranking de execução; tutorial guiado; som.
