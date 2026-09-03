# Arcade 2D — arremesso e muralha sem three.js, sem timing; prancheta com pausa editável

**Data:** 2026-09-03 · **Branch:** `arcade-v2` · **Supera** as seções 3, 4 e 8 (parte 3D) da spec `2026-09-02-arcade-v2-design.md`.

## 0. Por quê

Teste do dono na cena three.js: "3D horrível, injogável". A prancheta (SVG top-down, sépia, ímãs) agradou. Decisões do dono (brainstorm 2026-09-03):

1. Arremesso e muralha viram **2D** no visual da prancheta. O 3D e a dependência `three` saem.
2. **Nenhum minigame usa timing/reflexo** (barra de ápice, medidor, ângulo, box-out). Sucesso = habilidade do jogador × quanto ele está marcado.
3. Arremesso (clutch): "como nos jogos de basquete", vista lateral, **sem defensor ou com defensor estático**.
4. Muralha: mecânica atual (deslizar / roubar / contestar) mantida; só o visual e o toco mudam.
5. Prancheta pausada: **só RODAR retoma**; a pausa é uma fase de desenho.
6. **Antes de ligar no jogo**, uma página de laboratório pra testar cada minigame isolado.

Invariantes de sempre: `src/engine/` puro (Rng injetado, sem React/localStorage/`Math.random`); minigame devolve `{optionId, quality, turnover?}`; `resolveMoment` e o contrato de RNG do save **intocados** (calibração não roda); toda string por i18n PT/EN; sem fotos/logos reais.

## A. Fora o 3D

- Apagar: `three` e `@types/three` do `package.json`; `src/ui/minigames/three/` (arena, human, useThreeScene, webgl); `src/ui/minigames/Shot.tsx` e `Defense.tsx` (cenas); `hasWebGL()`; override `localStorage['thegoat:noWebgl']`; `lazy`/`Suspense`/`preload` em `Minigame.tsx`.
- `ShotFallback.tsx` → `Shot.tsx`, `DefenseFallback.tsx` → `Defense.tsx`: únicos renderers. `ShotFrame`/`DuelFrame` deixam de existir como molduras "compartilhadas" — fundem no renderer único de cada um (menos arquivos).
- Guias (`/guia-modos`, `/en/game-modes`) e HANDOFF: tirar menções a 3D/WebGL/fallback.

## B. ARREMESSO 2D (clutch)

**Palco.** SVG vista lateral, papel sépia e tinta (mesma paleta da prancheta: `--paper`, tabuado sugerido no chão, linhas pretas, aro vermelho). Você à esquerda (ímã/boneco de traço com número e sobrenome), aro à direita na distância `d` do tipo escolhido. **Defensor estático** entre vocês.

**Defensor estático.** Sorteado uma vez pela seed local (`createRng(seed)`): `gap = 0.6 + rng.next() × 1.8` m (distância dele até você). Tipos com separação (`sep`: floater 0.4, fadeaway 0.8, step-back 1.2) somam a dela. O defensor é o `bestDefender` do quinteto (tag `defender` ou maior ovr) — nome e ovr no cartão.

**Repertório.** Igual ao v2: 8 tipos, disponibilidade por atributo efetivo (floater ≥ 60 finalização, step-back ≥ 70 handles, fadeaway ≥ 70 clutch, enterrada ≥ 75 físico), teclas 1–8. Cada botão mostra: nome, distância, barra **HABILIDADE** (do tipo) e barra **ABERTURA** (contra o defensor daquela posse). A escolha É o arremesso.

**Fórmula (contrato).**

```
skill(type)   = clamp((attrEff − 30) / 60, 0.25, 1) × (1 − fatigue × 0.5)
openness      = clamp01((gap + sep − 0.5) / 1.6)          // mesma da prancheta
quality       = skill × openness
```

Atributo por tipo: bandeja/floater/enterrada → `finishing`; pull-up/fadeaway/tabela → `handles`; três/step-back → `three`. `attrEff = atributo × ageMultiplier`. `fatigue` de `attrMods` (4Q, físico < 65). Neutro (60 de atributo, totalmente aberto) = 0,5.

`optionId` por tipo como hoje (`mgLayup`, `mgMid`, `mgThree`, `mgDunk`). Sem relógio de posse, sem turnover por relógio, sem tremor de torcida, sem mira, sem salto.

**Animação.** Bola sai na parábola ideal (`trajectory(45°, idealSpeed)` — física existente, só pra desenhar) até o aro em 900 ms; o desfecho **obedece `outcome.success`**: acerto = "só rede"; erro = "girou e saiu" se `quality ≥ 0.6`, "curto"/"longo" abaixo (alterna pela seed). Bloqueio só como narração: erro com `openness < 0.25` = "TOCO NA MÃO". Overlay de resultado como hoje (`mg-result`).

**Lances livres** (`FreeThrows`, chamado pela prancheta na falta puxada): dois toques em ARREMESSAR (um por lance), cada um anima a bola; `quality = média(skill('three') × 1, skill('three') × 1)` = `skill(three)` sem defensor, sem fadiga extra. Sem medidor.

**Engine `shot.ts`** fica com: `SHOTS` (d, sep, optionId, attr), `availableTypes`, `createStaticDefender(rng, five)`, `shotQuality(type, gap, build, age, mods)`, `skillOf`, `trajectory`/`idealSpeed` (animação). Sai: `evaluate`, `crossX`, `bankCrossX`, `entryAngleOf`, closeout dinâmico, `meterValue`, `angleValue`, `ANGLE_*`, `scenarioFor`, `jumpTiming`. Testes reescritos: fórmula (neutro 0,5; 90 aberto = 1; contestado a 0,5 m = 0), disponibilidade, determinismo do defensor.

## C. MURALHA 2D

**Palco.** Meia-quadra top-down da prancheta: tabuado, linhas, garrafão e aro (extraídos de `Playbook.tsx` pra `src/ui/minigames/Court.tsx`, componente estático reusado pelos dois). Ele = ímã preto com as iniciais, você = ímã vermelho com seu número, cesta atrás de você. Cone de contenção (meia-abertura `CONE_HALF`) à sua frente, aceso quando `inFront`. Bola acesa (`--ball`) e maior enquanto exposta. Cartão de tendências antes da posse (1,2 s) e resumido no HUD, como hoje.

**Controles.** Botões grandes ESQ · ROUBAR · CONTESTAR · DIR (≥ 48 px) sempre visíveis; setas/Espaço/↑ e swipe no palco continuam (`useSwipe`).

**Toco sem ápice.** `jump(s)` vira `contest(s)`: alterna a postura **armada** (`s.armed`). No `step`:
- ele começa `shoot` com você armado e `inFront` e a < 0,9 m → `rng.chance(mods.blockP)` = toco (`block`); senão a contestação fica pela distância como hoje (`contestDist` com a mão em cima = sem os 0,8 m de penalidade).
- ele começa `pumpFake` com você armado → `bitFake`, `airborne 1.5`, `rng.chance(0.3)` = falta (regra atual do "pulou na finta").
- `armed` some ao fim de qualquer movimento dele (você precisa re-armar; ler o cartão decide quando).

`mods.blockP = lin(defense, 0.35, 0.006, 0.2, 0.6)` substitui `jumpWindow`.

**Roubo.** Exposição mais longa e legível: `legs` 0,35 → 0,7 s, cruzadas 0,2 → 0,4 s. Toque com bola exposta = `rng.chance(mods.stealP)` (`stealP = lin(defense, 0.45, 0.006, 0.25, 0.8)` substitui `stealWindow`); fora da exposição ou chance falha = erro (`stealTries++`, 2º erro = falta, cooldown de 350 ms na UI mantido).

`timingHit` sai do engine. Testes de `defense.ts`: contest armado + shoot em frente = toco com rng favorável; armado + pumpFake = bitFake; roubo só com exposição.

## D. Prancheta

**Pausa = desenhar.** Quando `isSettled` (ninguém em rota, bola na mão, sem finta/pump), a UI entra em `paused`:
- Voltam os controles de desenho: arrastar ímã = `setRoute` (inclusive o seu, substitui a infiltração), toque no ímã com rota = bloqueio, LIMPAR, DESFAZER, RODAR. Modelos **não** (reposicionam a formação).
- Desabilitados: passe (toque no companheiro), infiltração (toque na quadra), FINTA, BLOQUEIO, FINTA ARR., PASSE RISCO.
- **ARREMESSAR liberado** (encerra a posse — sem isso, RODAR sem rota trava no loop).
- Relógio, defesa e pressão congelados. Só **RODAR** retoma (`paused = false`; o tick roda enquanto `!isSettled`; ao assentar de novo, pausa de novo). Label `mg.pb.phase.paused` → "PAROU · DESENHE".
- Durante `run` (não pausado) tudo continua ao vivo como hoje.

**Arremesso da prancheta** usa a mesma fórmula do B: `quality = min(1, skill(type) × openness + creationBonus)`, `creationBonus = 0.1` se ≥ 2 passes ou bloqueio nos últimos 1,5 s. Saem `typeFactor` e `clockFactor`. Tipo pelo lugar (bandeja/floater/enterrada perto do aro, pull-up dentro do arco, três fora; assistência = quality do companheiro com `skill` = 0.6 fixo — companheiro genérico). Putback continua `max(1ª abertura, 0.8 × abertura do putback)`.

**Rebote ofensivo sem barra.** `shoot` com `eff < 0.4` → `phase: 'rebound'` como hoje, mas o engine resolve na hora: `rng.chance(mods.reboundP × (1 − (reboteiroOvr − 75) / 100))` (`reboundP = lin(rebounding, 0.4, 0.006, 0.2, 0.7)` substitui `boxWindow`; `reboundWindow` vira `reboundChance`). Acerto = manchete REBOTE! + segunda posse de 5 s (pausada, pra desenhar); erro = arremesso com `quality = firstShotOpenness`. `reboundTap` sai.

**Regras (cartão COMO JOGAR)** ganham: "FINTA = drible: por 0,6 s você fica 0,8 m mais aberto (handles). 6% de perder a bola." e "FINTA ARR. = marcador a < 1,2 m pula por 0,7 s e não conta na abertura. 15% de ele cair em cima: falta, lances livres."

## E. Limpeza

- Sai: `TimingBar.tsx`, `shotFlow.ts`, `ShotFrame.tsx`, `DuelFrame.tsx`, `thegoat:shotMode`, `thegoat:noWebgl`, `timingHit`, `jumpWindow`, `boxWindow`, `stealWindow`, `tremor`, `meterSpeed`, `SHOT_CLOCK`.
- `common.ts` `AttrMods`: `blockP`, `stealP`, `reboundP` no lugar dos três acima; `tol` sai (o `skill` por tipo cobre).
- i18n: remover chaves de mira/medidor/salto/tremor/modo; adicionar `mg.shot.skill`, `mg.shot.open`, `mg.shot.defender`, `mg.def.arm`, `mg.def.armed`, `mg.pb.phase.paused` reescrita, regras novas. Paridade PT/EN testada.
- e2e: ramo arremesso = clicar um `.mg-sh-pickbtn`; muralha igual; prancheta `RODAR` → `ARREMESSAR`.
- Bundle: sem chunk lazy; typecheck + `npm test` limpos. Calibração não roda (nada em `season.ts`/`verdict.ts`, mesmas calls no save).

## F. Laboratório (primeiro entregável)

Página `lab.html` + `src/lab.tsx` (entrada Vite própria, fora do sitemap, link nenhum no site; `<meta name="robots" content="noindex">`). Monta um minigame por vez com `MinigameProps` sintéticos:

- Seletor: minigame (JOGADA / ARREMESSO / MURALHA), seed (número, botão "nova"), adversário (select dos times), tipo de jogo (regular/rivalry/playoff/finals), quarto (1–4), idade, 8 atributos (sliders 40–99).
- `league = initLeague()`, `build = { attributes, picks: [], archetype: computeArchetype(attrs), overall: computeOverall(attrs) }`, `number = 23`, `lastName = 'TESTE'`, `lang` alternável.
- `onResolve(r)`: mostra o `{optionId, quality, turnover}` cru e o `p` resultante (`clamp(0.5 + (q − 0.5) × SKILL_W, 0.05, 0.95)` com base 0,5 só pra leitura), sorteia `outcome.success` com `Math.random() < p` (fora do engine; lab não é save), passa `outcome` pro minigame por 1,4 s como o `ArcadePanel`, depois botão DE NOVO (mesma seed) / NOVA SEED.
- Log dos últimos 10 resultados na tela (seed, tipo, quality, sucesso) pra caçar bug.
- Ordem de entrega: lab com a prancheta atual → arremesso novo → muralha nova → prancheta com pausa/rebote novos → só então `Minigame.tsx` (ArcadePanel) troca pros novos e o 3D sai.

## G. Arquivos

```
apagar   src/ui/minigames/three/*, Shot.tsx(3D), Defense.tsx(3D), ShotFrame.tsx, DuelFrame.tsx,
         shotFlow.ts, TimingBar.tsx
renomear ShotFallback.tsx → Shot.tsx (reescrito), DefenseFallback.tsx → Defense.tsx (reescrito)
novo     src/ui/minigames/Court.tsx, lab.html, src/lab.tsx, src/styles/lab.css
editar   engine/minigames/{shot,defense,playbook,common}.ts, ui/minigames/{Playbook,FreeThrows,Minigame,defenseFlow}.tsx,
         styles/{mg-shot,mg-defense,mg-playbook,minigames}.css, i18n pt/en, tests/engine/minigames/*,
         tests/e2e-playthrough.mjs, vite.config.ts, package.json, HANDOFF.md, guia-modos PT/EN
```
