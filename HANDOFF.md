# The GOAT — Handoff

**Data:** 2026-07-29 · **Estado:** v1 + draft fenomeno + carreira viva + rebalance/humanização + calibração de médias + liga viva + motor de momentos completos, testados (157/157 verdes) e **deployados** (2026-07-29). `master` local está ~13 commits à frente de `origin/master` (github.com/AlvaroRumpel/the_goat) — push pendente, dono decide.

## O que é

Jogo de carreira de basquete no navegador (inspirado no The Fenomeno). Rouba atributos de lendas da NBA → vive carreira completa → veredito de "Peladeiro de Quadra" até "THE GOAT". Grátis, sem cadastro, PT/EN, mobile-first.

- **Produção:** https://the-goat-3xw.pages.dev (Cloudflare Pages, projeto `the-goat`, conta alvarorumpel@gmail.com)
- **Design:** claude-design projeto "The GOAT" `5a193998-626d-46ba-84f5-fd9a7d164ca5` — 3 canvases aprovados (mobile core, fluxo completo 13 telas, desktop)
- **Spec v1:** `docs/superpowers/specs/2026-07-28-the-goat-design.md` · **Plano v1:** `docs/superpowers/plans/2026-07-28-the-goat-v1.md`
- **Iterações posteriores** (cada uma com spec+plano em `docs/superpowers/`): draft-fenomeno, carreira-viva, rebalance-humanizacao, calibracao-medias, liga-viva, motor-momentos — detalhes nas Decisões-chave 7–11.

## Arquitetura

```
src/
├── engine/    # TS puro, zero React, testado. RNG injetado (seed) — Math.random proibido.
│   ├── rng.ts       createRng (mulberry32)
│   ├── draft.ts     drawPlayer/weakestSlot/malusAmount/resolveBuild (1 jogador sorteado/rodada, malus = clamp(round((v−71)/6),1,5), piso 40)
│   ├── offers.ts    draftPickNumber, makeOffers (contender/rebuild/bigmarket)
│   ├── events.ts    8 eventos, 2 interativos, máx 2/temporada (lesão 18%/9% c/ foco saúde, rivalidade, viral, fase fria, eventDecision)
│   ├── season.ts    simRegularSeason + computeWinPct/computeTitleProb/finishSeason (league.ts orquestra); ageMultiplier(age, physical), performanceRatio (fórmulas = contrato)
│   ├── league.ts    liga viva: 29 NPCs simulados/temporada — tabela, corridas de prêmio, bracket, trades, draft/aposentadoria NPC
│   ├── moments.ts   motor de momentos: selectKeyGames (3-4/temporada), startWatchedGame/applyMoment/autoResolveGame (probabilidade-alvo), icônicos
│   ├── playoffs.ts  bracket NPC (npcRound/advancePlayer/resolveRest), bo7WinProb/pGameForSeries (finais), SERIES_SHIFT/PLAYER_OUT_MARGIN
│   └── verdict.ts   score + tiers + GATE icônico do GOAT + iconicPoints (cap 100)
├── data/      players.ts (~200 jogadores, 8 eras), teams.ts (30), i18n/{pt,en}.json (paridade testada)
├── state.ts   gameReducer (13 fases, incl. eventDecision/keyGame/playoffGame), localStorage 'thegoat:v4' (loadState descarta saves v1-v3), RNG replay via rngCalls
├── styles/    tokens.css + base.css (design "legado dourado" portado do claude-design)
└── ui/        screens/{Home,AttrDraft,NbaDraft,Season,Game,Verdict} + components (incl. LeaguePanels: Standings/Races/Ceremony/Player) + share.ts (canvas card)
```

## Decisões-chave (não reabrir sem motivo)

1. **GOAT gate** (decisão do dono): tier `goat` = score ≥ 1950 **E** (5+ anéis && 4+ MVPs [Jordan] OU 38k+ pontos && 4+ anéis [LeBron]). Score alto sem troféus → `legend`. Calibrado: 1.33% de 300 carreiras aleatórias (teste `verdict.test.ts` trava < 2%).
2. **Trade "meio de temporada"** = deadline trade: regular season simula → oferta → decisão → playoffs com time final.
3. **RNG replay**: reducer persiste `rngCalls`; load recria rng do seed e avança N calls. Engine determinístico por seed — NUNCA consumir rng fora do fluxo contado.
4. **Aposentadoria**: fase própria quando idade ≥31 OU produção em queda (ver item 8); botão Aposentar na Free Agency quando 31+ ou declínio pesado (ratio < 0.55).
5. **Veredito computado na UI** (`computeVerdict(state.career)`), não armazenado.
6. **Sem fotos/logos reais** — nomes ok, imagens são monogramas/ilustração própria.
7. **Draft fenomeno** (2026-07-28): 1 jogador sorteado/rodada, roubo de atributo livre, reroll 1x, malus = fraqueza do jogador roubado (excluindo slot roubado) com `clamp(round((v−71)/6),1,5)`, piso 40. Save key `thegoat:v2` (v1 descartado). Ver spec `docs/superpowers/specs/2026-07-28-the-goat-design.md` e plano `docs/superpowers/plans/2026-07-28-draft-fenomeno.md`. Ids de jogadores em `players.ts` são contrato do save v2 — renomear/remover id exige bump de save key.
8. **Carreira viva** (2026-07-28): curva 0.78→1.0 (26–29)→declínio por físico (rate clamp 0.012–0.035), piso 0.60; aposentadoria por queda (ratio <0.75 oferece, <0.55 narrativa, mín. 5 temporadas; idade ≥31 mantida); eventos interativos via fase `eventDecision` (escolha a/b antes do sim); `injuryProne` 1 temporada após volta antecipada. Spec `2026-07-28-carreira-viva-design.md`.
9. **Rebalance** (2026-07-28): titleProb recalibrado (constantes finais: `clamp((winPct − 0.5) × 0.22 + (effClutch − 75) × 0.0015, 0.01, 0.16)` em `simPostseason`, `src/engine/season.ts`; forma intocada, só constantes), alvos: 83 ovr ≈ mediana 1 anel (p90 3)/legend 2.5% (<10%), 95 ovr legend 68.5% (>20%). `verdict.ts` não precisou mudar (legendRate de 83 já ficou bem abaixo do teto só com titleProb). GOAT gate (1950 + gate icônico) intocado. Trava em `tests/engine/calibration.test.ts`. Spec `2026-07-28-rebalance-humanizacao-design.md`.
9b. **Calibração rodada 2 — médias por jogo** (2026-07-28): piso 79 ovr rendia 21+ ppg (superstar num build mediano) porque as 3 fórmulas de `simRegularSeason` usavam referência `− 40`. Constantes finais: `ppg = clamp((scoringRt − 61) × 0.78 + ruído, 4, 38)` (era `− 40 × 0.55`), `apg = clamp((0.60×passing + 0.40×handles − 47) × 0.18, 1, 12)` (era `− 40`); `rpg` manteve `− 40 × 0.22` (já batia o alvo, não precisou mudar). Cascata de rodada 1 (rings/legend/GOAT) caiu de score com as médias menores, então os thresholds de awards em `simPostseason` também foram escalados: `allstar` ppg≥19 (era 20; passou por 18 na 1ª iteração), `scoring` ppg≥26 (era 29), `mvp` ppg≥23 (era 26) — `rpg≥11`/`apg≥8` do allstar e o gate de winPct/rng do mvp ficaram iguais. `verdict.ts` não precisou mudar. Harness (`tests/engine/calibration.test.ts`) ganhou `peak.{ppg,rpg,apg}` (média das temporadas 26–29) e `allstarRate`; build do harness é SF flat (+1 ppg, sem bônus reb/ast) então os alvos já assumem esse arquétipo. Resultado (N=200, flat build, foco scoring, política fixa): 79 ovr → peakPpg 15.6 / rpg 8.6 / apg 5.8, allstarRate 7.5% (raro); 83 → 18.4; 90 → 23.3, allstarRate 100% (comum); 99 → 29.6. Travas da rodada 1 seguem verdes (83 legend 0.5% <15%, 95 legend 43.5% >20%, 99 goat 0.5% <2%). Suite 85/85 + typecheck verdes. **Decisão do dono (revisão final):** aceito 83 ovr com tier mediano "starter" (realista para overall de titular sólido; alvo de cascata da rodada 2 fica superado por essa decisão), e threshold de allstar subiu de 18 para 19 para remover a dissonância de 83 ovr virar All-Star praticamente todo ano (allstarRate caiu de 99% para 83.5%; 79 seguiu raro a 0.5%, 90+ seguiu comum a 100%).
10. **Liga viva** (2026-07-28): 29 times NPC simulados junto com o do jogador — tabela (`teamStrength` = `clamp(round(68 + (weighted − 74) × 1.7), 45, 90)`, dataset real com weighted médio ~74, não ~83; recalibrado das âncoras do brief), corridas de prêmio (MVP/DPOY/ROY/MIP), bracket de playoffs, trade deadline, draft/aposentadoria de NPCs entre temporadas. Constantes calibradas: NPC ppg `clamp((eff − 58) × 0.70 + bônus + jitter ±4, 2, 36)`; DPOY favorece tag `defender` (×1.06 vs ×0.86); rookie NPC `ovr = 55 + round(42 × r²)` (skew pra 55–70, raros 90+); `ROY_NPC_BOOST = 1.8` (soma ppg+rpg+apg × 1.8 pra competir com ppg puro do jogador). Save key `thegoat:v3` (v1/v2 removidos no load) — `data/teams.ts` (30 times, ids) e o dataset de `league.ts` são contrato do save; renomear/remover team id exige bump de save key. RNG em `runSeasonSim`/`concludeSeason` (`state.ts`) segue ordem fixa comentada no código (linha ~120): `simRegularSeason → winPct → standings → lines → [pausa tradeDecision] → concludeSeason: [winPct do time final, só se trocou] → bracket → awards → finishSeason` — replay do save depende dessa ordem, não reordenar. **Superada pelo item 11**: essa ordem virou `... → concludeSeason: [winPct do time final] → simAwards → bracket/playoffs jogo a jogo → finishSeason` (awards antes dos playoffs, não depois). Decisões do dono (revisão final): MVP raro para 90 ovr mantido como está (não afrouxar gate); mediana de anéis 0 em 75–79 ovr mantida (realista pra overall sub-titular) — **parcialmente revogada pelo item 11** (drift de anéis do 79 aceito). Spec `docs/superpowers/specs/2026-07-28-liga-viva-design.md` · plano `docs/superpowers/plans/2026-07-28-liga-viva.md`.
11. **Motor de momentos** (2026-07-29): jogos-chave assistidos (3-4/temporada: rivalidade, corrida de seed, especial — natal/revanche/showcase — +1 se houve evento de rivalidade) e playoffs jogo a jogo, com decisões de risco (safe/bold/reckless) em 3 momentos por jogo (`q2tactic`, `q4pressure`, `clutch`) e momentos icônicos no score. Contrato de RNG por jogo: `GAME_RNG_CALLS = 10` (1 `baseMargin` + 3 `makeMoments` + 3×2 `resolveMoment`); pular = jogar a política padrão/safe (`autoResolveGame`), mesmo contrato de calls — replay não distingue skip de assistido. `selectKeyGames` consome 3 calls fixas (1 sorteio do jogo especial + 2 de folga fixa, contrato). Save key `thegoat:v4` (v1-v3 removidos no load); `Phase` ganhou `keyGame`/`playoffGame` (13 fases). **Awards agora resolvidos ANTES dos playoffs** em `concludeSeason` (`simAwards` não depende de resultado de playoff; só `finishSeason` liga `fmvp`/`ring` ao desfecho). **Rounds 0-2**: 1 jogo pivotal por série decide a série via shift CENTRADO na expectativa — `shifted = clamp(seriesProb + 2×SERIES_SHIFT×((venceu?1:0) − seriesProb), 0.05, 0.95)`, `SERIES_SHIFT = 0.20` — de forma que `E[shifted] = seriesProb` quando `P(pivotal) = seriesProb` (política auto); jogar bold desloca `P(pivotal)` para cima e SHIFT é o multiplicador direto desse edge na prob. de série (não é decoração narrativa). **Finais**: bo7 de verdade, tela de série (`series.next`/`series.simAll`) entre jogos; cada jogo usa margem por **probabilidade-alvo** (`targetWinP = pGame`, de `pGameForSeries(seriesProb)` — inverso numérico de `bo7WinProb` por bisseção) resolvida analiticamente sem viés de força de elenco duplicado: `margin = c + U + S` com `U~U(−N,+N)` (`MARGIN_NOISE = 16`), `won ⟺ c+U+S ≥ 0.5`, `c = 2N·p − N + 0.5 − E[S]`, `E[S] = expectedAutoDelta(build,age)` (política padrão, determinístico). **Icônicos** (`ICONIC_VALUES`, cap `iconicPoints = min(100, Σ)`): todo icônico de arremate exige jogada NÃO-safe bem-sucedida (`dagger`) — exceção ratificada pelo dono: `sweep` (série 4-0) vale para qualquer política, é resultado de série, não de jogada. **Jogos-chave reconectados** ao winPct/ppg da temporada: `keyGameEffects` centrado na própria expectativa (não no saldo bruto) — `winPctDelta = clamp(Σ((venceu?1:0) − r.winP) × 0.02, −0.04, 0.04)`, `ppgDelta = clamp(swing × 0.03, −0.5, 0.5) − lesões`, `swing = Σdeltas − jogos×expectedAutoDelta`; `winP` guardado no `PendingGame`/`WatchedGameResult` (mesma equação do `targetWinP` invertida). **Decisões do dono (revisão final)**: drift de anéis do 79 ovr aceito sem recalibrar (`ringsAvg` 0.62→0.74, revoga parcialmente a nota do item 10 sobre mediana 0 em 75-79); `goatRate(99)` = 0.0167 medido com N=600 (trava `< 0.02` mantida — N=200 é ruído demais pra essa cauda). `computeWinPct`/`computeTitleProb`/fórmulas de stats/pesos e thresholds do `verdict.ts`/gate do GOAT intocados — só constantes novas do motor de momentos. Spec `docs/superpowers/specs/2026-07-29-motor-momentos-design.md` · plano `docs/superpowers/plans/2026-07-29-motor-momentos.md` · números/constantes finais na seção "Pós-B" de `docs/superpowers/plans/2026-07-28-calibracao-baseline-liga.md`.

## Comandos

```
npm run dev / test / build
npx tsc -p tsconfig.app.json --noEmit     # typecheck
node tests/e2e-playthrough.mjs             # playthrough Playwright completo (manual, fora do vitest)
CALIBRATE=1 npx vitest run tests/engine/calibration.test.ts  # relatório de distribuições (bash)
npx wrangler pages deploy dist --project-name=the-goat --branch=master
```

## Débitos deferidos (nenhum bloqueante)

- Validação rasa do `loadState` (só phase+seed) — save malformado com shape válido pode dar tela branca; fast-follow sugerido: whitelist de fases + error boundary que limpa storage.
- Reducer sem guards de fase (double-dispatch teoricamente inseguro; inalcançável com React 19 sync flush).
- Histórico local de runs (spec §4) não implementado — sem UI que o use; juntar com leaderboard na v2.
- i18n nits: chip EN/PT hardcoded em `Home.tsx`, `nbadraft.picked` frasing EN, arquétipo extraído via `.split(' (')` (frágil se formato de tradução mudar), 5 chaves mortas nos JSONs.
- `Verdict.tsx`: `computeVerdict` no corpo do render → redraws redundantes do canvas ao copiar.
- Botão compartilhar é no-op silencioso sem clipboard/Web Share (só HTTP puro; produção é HTTPS).

## Backlog v2 (fora do escopo v1, spec §Escopo)

- **Rival de carreira** (v3): NPC recorrente que segue a carreira do jogador temporada a temporada (rivalidade com história, não só o `event.rivalry` pontual de hoje).
- **Elenco ofertante** visível nas ofertas (spec §4, não entregue no ciclo liga viva)
- **All-Star assistido**: hoje é só um award calculado no fim de temporada; podia virar um jogo-chave extra ou tela própria
- `mvpRate(90)` estrutural ~0.11 contra alvo desejado de ~10-15% — é ranking contra 270 NPCs, não dá pra fazer 90 raro e 99 quase-certo ao mesmo tempo sem mexer na fórmula (fora do escopo de calibração por constante)
- **Leaderboard global** (Supabase — usuário já tem conta; submissão por nickname, sem login) + histórico de runs
- **Mini-jogos de habilidade** em momentos-chave (era desejo original do dono, adiado no MVP)
- EN landing/SEO, custom domain
- Calibração fina contínua com playtest real — infra pronta: harness em `calibration.test.ts` (rodar com `CALIBRATE=1 ... --disableConsoleIntercept`), ajustar só constantes, nunca forma das fórmulas
- Feedback pós-jogo nos playoffs rounds 0-2 (spec §5 do motor-momentos, parcial: resultado só aparece no seasonResult)
- Política reckless no harness de calibração (playHurt/playerOut/bigNight sem cobertura; lock sugerido reckless.goatRate < 0.04)

## Processo usado

Superpowers em ciclos: brainstorming → spec aprovado → plano TDD → subagent-driven development (implementer+reviewer por task, fix loops, worktree isolado) → review final de branch → fix wave → merge → deploy. Sete ciclos completos até aqui (v1 com 15 tasks; depois draft-fenomeno, carreira-viva, rebalance-humanizacao, calibracao-medias, liga-viva com 14 tasks; motor-momentos com 11 tasks). Design/mockups via claude-design com aprovação do usuário (requisito explícito). Calibração de gameplay sempre via harness + travas de regressão, nunca chute.
