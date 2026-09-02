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

## 4. MURALHA — duelo 1x1 contínuo (estilo Basketball Stars), câmera atrás de você

**Revisado com o dono em 2026-09-02** (substitui a versão "posse em fases"): a defesa é um **duelo contínuo**, não uma sequência de batidas com janelas. Referência explícita do dono: o modo ataque × defesa do Basketball Stars (Miniclip). Atacante = **estrela do adversário** com **tendências conhecidas** (cartão antes da posse: "arremessa 55% · infiltra pela direita 30% · passa 15%", derivado das tags/ovr do NPC; a série de jogadas anteriores dele na partida aparece como histórico). As três sensações que o dono quer: **muralha** (ele não passa), **ladrão** (roubo na hora certa e contra-ataque), **tocador** (subir e dar o toco).

Loop (uma posse, relógio de posse 8s + o tempo que ele gastar no arremesso):

- **Ele dribla livre** (IA a 20Hz, rng local): alterna `hesitação`, `cruzada esquerda/direita`, `giro`, `entre as pernas` (bola exposta por 0.35s), `infiltração` (arranca pro lado escolhido), `finta de arremesso` (sobe meio corpo, não solta), `arremesso` (sobe de verdade). A escolha segue as tendências do cartão com jitter — quem lê o cartão antecipa.
- **Você sombreia** em tempo real: **swipe esquerda/direita** desloca seu defensor lateralmente (velocidade por `physical`+`defense`); ficar na frente dele conta "contenção" (fração do tempo com o atacante dentro do seu cone de 40°). Antecipar (deslizar ANTES da cruzada) vale mais que reagir: contenção pesa 0.5 da `quality`.
- **Toque = tentativa de roubo**: só faz sentido quando a bola está exposta (entre as pernas, cruzada larga); acertou a janela (largura por `defense`; ±120ms) = **roubo** → contra-ataque animado e `mgSteal` com `quality 1`; errou = ele passa por você (perde contenção por 1.2s) e, na 2ª tentativa errada, **falta** (lances livres dele por rng local).
- **Swipe pra cima = salto pra toco**: se ele está subindo de verdade, ápice dentro da janela (por `physical`) = **toco** → `mgContest` `quality 1`; subir na **finta de arremesso** = você no ar, ele infiltra livre (contenção zera por 1.5s) ou puxa falta.
- **Fim**: arremesso dele (contestado ou não), infiltração até a bandeja, roubo, toco, ou relógio.
- **Quality** sem roubo/toco: `0.5 × contenção + 0.3 × contestação no arremesso (distância da sua mão ao release) + 0.2 × (não caiu em finta)`. Mapeamento: roubo → `mgSteal`; toco ou contestação forte (mão a < 0.6m no release) → `mgContest`; contido sem contestar → `mgLock`. Falta sua (2ª tentativa de roubo errada, ou salto em cima dele) → `mgLock` com `quality 0.35` e, se ele acerta os dois lances livres, erro forçado.
- **Escala**: velocidade dos dribles e janelas por `difficulty(ctx, star)`; sua velocidade lateral e janelas por `attrMods`.

## 5. Tela e apresentação

- Moldura comum (`ArcadePanel`) ganha: **fase atual** (mono-label vermelha: LEITURA · DESENHAR · RODAR · REBOTE…), o adversário (nome curto + tag + cartão de tendências na muralha), o relógio da fase.
- **Controles da muralha**: swipes (esquerda/direita = deslocar; toque = roubo; pra cima = salto) como principal; teclado no desktop (setas + espaço); sem botões de apoio (decisão do dono). Barra de ações do quadro com ícones do `Icon.tsx` onde existir.
- Desenho de rotas: pointer events com captura; no desktop também Shift+arrasto pra polilinha; mobile 346px: ímãs com hit-area r=75 (já existe), rotas com traço de 6px.
- Sem nota S/A/B/C, sem tutorial guiado (dono recusou). A linha de dica fica por fase (`mg.hint.<kind>.<phase>`).
- i18n: ~120 chaves novas (fases, ações, esquemas, tipos de arremesso, cadeia, narração curta).

## 8. Estilo visual (fechado com o dono em 2026-09-02, canvas `Minigames do The GOAT`)

- **JOGADA (prancheta)** — **plano refinado, 2D/SVG**: vista de cima, piso em madeira sépia (tabuado `#DDD0B3`/`#D3C4A3`, juntas `#BFAE86`), linhas em tinta a 80%, ímãs redondos com sombra projetada e número (vermelho = nós, tinta = eles) com nome curto do NPC real abaixo, rota tracejada vermelha à mão com marca de bloqueio, manchete de jornal (Archivo Black, vermelho com sombra de papel) por cima nos lances grandes. Sem 3D.
- **ARREMESSO** — **3D com three.js**, arena "meio-termo" (visível, não preta; luz de ginásio real, sombras suaves; holofotes quentes), câmera baixa atrás-direita do arremessador (V1). **Bonecos realistas low-poly**: proporção 7.5 cabeças, músculo sugerido, rosto com nariz/boca, cabelo com volume, pele com variação; uniforme com número grande e nome nas costas; você com faixa vermelha. **Arquibancada com cadeiras individuais e torcedores com cabeça e braços** (alguns de pé, braços pra cima), não cápsulas. Tabela de vidro, aro vermelho, relógio de posse aceso, faixa vermelha no primeiro degrau. Mira por arrasto/medidor + timing do salto (spec §3, mantido).
- **MURALHA** — **mesmo motor 3D e mesma arena**, câmera atrás de você (de costas, número visível), atacante de frente com o número, cartão de tendências no canto; contra-ataque, toco e roubo animados na cena.
- Paleta do jogo em tudo (papel/tinta/vermelho/âmbar; madeira sépia); vermelho só em nós, aro, faixa e placar. Nenhuma imagem/logo real.
- **Custo aceito**: dependência `three` (~150 KB gz), WebGL; fallback sem WebGL = painel 2D simplificado (arremesso lateral em SVG, muralha em prancheta) com a mesma mecânica.

## 6. Estrutura e testes

```
src/engine/minigames/common.ts    opponentFive, difficulty, attrMods, timingWindow, freeThrowP
src/engine/minigames/playbook.ts  v2: rotas/desenho, esquemas, ações, rebote ofensivo
src/engine/minigames/shot.ts      v2: repertório, closeout, salto, pressão, tabela, lances livres
src/engine/minigames/defense.ts   v2: fases, tendências, passe, toco, box-out, cadeia
src/ui/minigames/TimingBar.tsx, FreeThrows.tsx (dentro de Shot), Playbook (SVG) / Shot e Defense (three.js: src/ui/minigames/three/{arena,human,camera}.ts compartilhados) v2
```
Testes por módulo (determinismo, invariantes de quadra, cada esquema produz o sinal esperado, monotonicidade dos mods de atributo, transições de fase, cadeia → mapeamento de opção, quality em [0,1]); `state-arcade` cobre `mgFreeThrow`; e2e arcade mantém o bloco (defesa por teclado atravessa as fases; "Simular o resto" fecha).

## 7. Fora de escopo

Novos icônicos (ex.: chase-down) — mexe em `verdict.ts`; memória de tendências entre jogos; nota/ranking de execução; tutorial guiado; som.
