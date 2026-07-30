# The GOAT — Redesign, Ciclo 2 (jogo-chave narrado + resultado + avanço de temporada + calendário como verdade)

**Data:** 2026-07-29 · **Status:** aprovado pelo dono (seções 1–4)
**Fonte de design:** `design_handoff_the_goat_redesign/README.md` (telas 8a/9c, 6a, 6b) + `DECISOES-C1.md` (decomposição em ciclos)
**Spec anterior:** `2026-07-29-redesign-c1-design.md` (tema, barra, hub, balanço — entregue)

## Escopo do C2 (da decomposição aprovada)

Jogo-chave narrado (8a/9c), tela de resultado de jogo (`gameResult`, 6a), avanço de temporada (`seasonAdvance`, 6b), log de lances no engine, save bump **`thegoat:v5`**. Fora: cerimônia própria, aposentadoria, veredito em camadas (C3).

## Decisões de design tomadas neste ciclo (dono aprovou)

1. **`gameResult` depois de TODOS os jogos assistidos** — key games e todo jogo de playoff (pivotal dos rounds 0-2 e cada jogo das finais). Fecha o débito de feedback dos rounds 0-2. `SKIP_GAME` também mostra a tela (sem a lista de decisões). Exceção: `SKIP_SERIES` vai direto ao desfecho — pular a série é pular o drama, sem telas por jogo.
2. **Calendário como verdade** ("walk as truth"): o engine gera a temporada jogo a jogo; o registro (ex.: 38—12) é a soma literal dos jogos gerados + resultados reais dos key games. `winPct` downstream (standings, titleProb, awards) = vitórias/82 **realizado**. `keyGameEffects.winPctDelta` morre (o jogo-chave agora conta literal no registro); `ppgDelta` centrado e o desgaste de lesão ficam. Adiciona variância binomial ao winPct → **recalibração obrigatória** (só constantes, nunca forma).
3. **Trade deadline pausa no slot do calendário** (~jogo 55), entre trechos — revisa a decisão-chave #2 do handoff (motivo: o calendário agora é visível; deadline retroativo pós-82 ficaria dissonante). Aceitou → trechos restantes rodam com a força do time novo (winPct em dois segmentos, mesma fórmula por segmento).
4. **Save `thegoat:v5`** — contrato de dados e de RNG muda por inteiro; v1–v4 descartados no load (padrão dos bumps anteriores).

## 1. Engine — calendário como verdade (`src/engine/schedule.ts` novo)

TS puro, zero React, RNG injetado — regras de `src/engine/` valem.

**`buildCalendar(keyGames, rng)`** — distribui os key games no calendário de 82 jogos:
- Slots-âncora por tipo: `rivalry` ~12, `special` ~30, `seedRace` ~52, rivalidade extra (evento) ~66. Jitter ±3 via rng; **contrato: 4 calls fixas** (folga consumida quando há só 3 jogos). Jitter do `seedRace` clampado a [49, 54] — nenhum key game cai no slot 55.
- Deadline fixo no **slot 55** (sem rng); só pausa se `tradeOffer` existir.
- Saída: `CalendarSlot[]` ordenado (`{ gameIndex, keyGame }`) + `deadlineIndex`.

**`simStretch(from, to, p, teamId, rng)`** — gera os jogos comuns do trecho `[from, to]`:
- Por jogo, **4 calls fixas**: vitória (`chance(p)`), jitter de margem (→ placar `ourScore/oppScore`), jitter de pontos do jogador (centrado no ppg bruto da temporada), sorteio do adversário (entre os outros 29).
- Saída: `TickerGame[]` — `{ gameIndex, won, ourScore, oppScore, playerPts, opponentTeamId }`.
- Os pontos por jogo do ticker são cosméticos (jitter em torno do ppg bruto); o ppg final da temporada continua vindo de `simRegularSeason` + `ppgDelta` — divergência ≤ ~0.5 aceita.

**Registro e winPct realizado:**
- `wins = Σ vitórias dos trechos + Σ vitórias reais dos key games`.
- `winPctRealized = wins / 82` alimenta `simStandings` (`playerWins = wins`), `computeTitleProb`, `simAwards` (`teamWinPct`). Sem clamp adicional — a fórmula-alvo `computeWinPct` já é clampada; o realizado flutua binomialmente em torno dela.
- `computeWinPct` (fórmula-contrato, forma intocada) continua computando o `p` de cada segmento — vira a **taxa-alvo do trecho** em vez de multiplicador direto de 82.
- Trade aceito no deadline: trechos seguintes usam `p₂ = computeWinPct(build, regular, rosterStrength(time novo), focus, rng)`; `effClutch` do titleProb vem do segmento final (mesma regra de hoje pós-trade).
- `keyGameEffects` (state layer): remove `winPctDelta`; mantém `ppgDelta = clamp(swing × 0.03, −0.5, 0.5) − lesões` e `games = max(40, 82 − 10×lesões)`.

## 2. Fases e fluxo

`Phase` ganha `seasonAdvance` e `gameResult` → **15 fases**. Ações novas: `TAKE_NEXT_GAME`, `RUN_TO_PLAYOFFS`, `CONTINUE` (sai do `gameResult`). Save key **`thegoat:v5`**; `loadState` remove `thegoat:v1`–`v4`.

**Estado novo em `GameState`:**
- `calendar: { slots: CalendarSlot[]; deadlineIndex: number; ticker: TickerGame[]; played: number } | null` — o walk acumulado da temporada corrente (fonte do 6b e do registro).
- `lastGame: { context: WatchedGameContext; result: WatchedGameResult } | null` — dado da tela `gameResult`.

**Fluxo da temporada regular (ordem de rng POR DISPATCH, contrato de replay redocumentado no código):**
1. `PLAY_SEASON`: `rollEvents` → [pausa `eventDecision` como hoje] → `simRegularSeason` (stats brutos, eventos, `tradeOffer`) → `computeWinPct` (p₁) → `selectKeyGames` (3 calls, como hoje) → `buildCalendar` (4 calls) → `simStretch` do trecho 1 → fase **`seasonAdvance`**.
2. `TAKE_NEXT_GAME`: `startWatchedGame` do key game do slot → fase `keyGame` → 3 momentos (`DECIDE_MOMENT`/`SKIP_GAME`) → resultado guardado em `lastGame` + entra no registro → fase **`gameResult`**.
3. `CONTINUE` (em `gameResult`, temporada regular): `simStretch` do próximo trecho → `seasonAdvance`; se o trecho cruza o slot 55 com `tradeOffer` pendente, o trecho para no 55 e pausa **`tradeDecision`** (overlay 5c sobre o `seasonAdvance` preservado); `TRADE_DECISION` retoma o trecho com p₁ ou p₂. Depois do último key game + trecho final → `concludeSeason` (awards antes dos playoffs, seed, bracket — como hoje).
4. `RUN_TO_PLAYOFFS` (em `seasonAdvance`): auto-resolve todos os key games restantes (mesmo contrato de calls por jogo — replay não distingue) e simula os trechos restantes sem telas; deadline pendente ainda pausa `tradeDecision`; termina em `concludeSeason`.

**Playoffs:** todo jogo fechado (decidido, `SKIP_GAME` ou auto por `playerOut`) → `lastGame` + fase **`gameResult`** → `CONTINUE` consome o rng do avanço (roll de série dos rounds 0-2, `npcRound`/`enterRound`, próximo `startWatchedGame`) — o rng do pós-jogo move-se do dispatch do último momento para o `CONTINUE`. Destinos do `CONTINUE`: próximo round (rounds 0-2 vencidos), tela de série (finais em aberto), `seasonResult` (eliminação ou título — CTA vira "Ir à cerimônia"). `SKIP_SERIES`: sem `gameResult` por jogo, direto ao desfecho.

**Lesão em key game:** como hoje — ppg/games sofrem, `injuryProne` liga; key games restantes continuam existindo. `playerOut` segue exclusivo dos playoffs.

## 3. Log de lances + telas 8a/9c/6a/6b

**Log de lances (engine, `PendingGame.log`):** `PlayEntry { clock, textKey, params, score: { us, them }, fromDecision?: true }`.
- `startWatchedGame` gera **4 linhas de ambientação** (1Q/2Q/3Q/4Q): variante de texto (`rng.int`) + jitter de placar — **8 calls**. Placar de cada linha interpola o `baseMargin` proporcional ao tempo, com jitter, partindo de 0—0.
- Cada `applyMoment` acrescenta **1 linha de decisão** (`fromDecision: true`, relógio do momento: 2Q / 4Q / 4Q 00:21): texto por variante (**1 call** além das 2 atuais), placar = walk parcial + delta do outcome.
- `GAME_RNG_CALLS` atualizado: 1 (baseMargin) + 3 (makeMoments) + 8 (ambientação) + 3×3 (resolve + variante) = **21**; contrato fixo, decidindo ou pulando.
- Placar final da coluna fecha consistente com `margin`/`scoreOf` (o placar-vivo de hoje).

**8a — jogo-chave/playoff (mobile):** barra de carreira → faixa preta de placar (pontos `Archivo Black` 26px, relógio mono `--accent-warm`) → tira dos 3 momentos (resolvidos: `--paper-3`, opacidade 0.7, barra 3px preta/vermelha + saldo mono "+3"/"−6" dos `outcomes`; atual: `2px solid --red`, "AGORA") → coluna de lances (horário mono 12px, opacidade decrescente 0.28→1, linhas de decisão com `border-left: 2px solid --red`) → faixa preta de decisão (`margin-top: auto`, situação 17px, opções empilhadas `gap: 1px` sobre `--ink-3`; ousada em creme invertido com tag vermelha) → "SIMULAR O RESTO DO JOGO" mono 10px.

**9c — desktop:** grid `1fr 460px`. Esquerda: placar (52px, relógio 26px) + coluna de lances (13px) + rodapé "SIMULAR O RESTO DO JOGO · TECLAS 1 · 2 · 3 ESCOLHEM". Direita (`border-left: 1px solid --rule`): tira de momentos vertical (atual com `border-left: 3px solid --red`) + faixa de decisão fixa no rodapé com opções numeradas. Teclas 1/2/3 despacham `DECIDE_MOMENT`.

**6a — `gameResult`:** manchete `Archivo Black` 68px vermelha (vitória/derrota/campeão), placar final 30px + siglas mono, trio PTS/REB/AST do jogo entre filetes (números 28px; **reb/ast derivados deterministicamente** de rebounding/passing + margem — sem rng novo, guardados no `WatchedGameResult`), "O QUE VOCÊ DECIDIU" (3 linhas: horário mono + descrição + veredito `Archivo Black` 11px "OK"/"FALHOU"/"CAIU"; ausente após `SKIP_GAME`), faixa vermelha "MOMENTO ICÔNICO GRAVADO" quando `iconics` não vazio, CTA preto (`CONTINUE`; rótulo "Ir à cerimônia" quando o destino é `seasonResult`).

**6b — `seasonAdvance`:** "A TEMPORADA CORRE"; campanha `Archivo Black` 44px ("38—12", travessão `--dim`, derrotas vermelhas) + "JOGO {n} DE 82 / {pos}º NO {conf}" mono — posição **projetada**: ritmo de vitórias do jogador comparado ao ritmo esperado dos NPCs da conferência (determinístico de `teamStrength`, sem rng; a tabela real só existe no fim da temporada); barra de progresso 8px (percorrido `--ink`, trecho atual `--red`, trilha `--track`); legenda "PRÓXIMO JOGO-CHAVE: {slot}"; ticker "PLACARES ENTRANDO" = últimas 9 entradas do walk (V/D `Archivo Black`, adversário, placar, pontos; opacidade 1→0.18); nota `border-left --red` com contexto de corrida de prêmios + "A SIMULAÇÃO PARA SOZINHA NO PRÓXIMO JOGO-CHAVE"; ações: preto "Assumir o próximo jogo" (`TAKE_NEXT_GAME`), contorno "Correr até os playoffs" (`RUN_TO_PLAYOFFS`).

**i18n:** chaves novas em `pt.json`/`en.json` com paridade (teste existente cobre): variantes de lances (`play.*`, ~3 variantes por tipo), `result.*`, `advance.*`, rótulos das telas. Copy PT do handoff é final.

## 4. Testes e recalibração

- **Vitest engine/state:** `schedule.ts` (slots dentro das janelas, contrato de calls por jogo/trecho, soma do registro = trechos + key games), log de lances (contrato de 21 calls, placar da última linha consistente com `margin`), transições novas (`seasonAdvance`/`gameResult`/`CONTINUE`/`RUN_TO_PLAYOFFS`, deadline no slot 55 com e sem trade), replay (save v5 no meio de `seasonAdvance`/`gameResult` restaura idêntico).
- **Recalibração obrigatória** (variância binomial + key games literais + deadline no slot): rodar `CALIBRATE=1`, re-medir todas as travas — 83 legend < 15%, 95 legend > 20%, 99 goat < 2% (N=600), medianas de anéis, peak ppg/rpg/apg, allstarRate. Ajustar **só constantes** se estourarem; formas de `season.ts`/pesos de `verdict.ts`/GOAT gate intocados (decisão do dono, handoff).
- **e2e:** `tests/e2e-playthrough.mjs` reescrito para o fluxo novo (seasonAdvance → keyGame → gameResult → … → playoffs jogo a jogo → veredito).
- Pré-commit: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`.
