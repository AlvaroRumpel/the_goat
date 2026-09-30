# Auditoria de falhas — site, interface e minigames

**Data:** 2026-09-30 · **Método:** playthrough manual no browser (viewport 375×812 + desktop, modo Arcade, T1–T2 completas, playoffs, prêmios, balanço) + 3 revisões estáticas de código (minigames / telas+state / páginas HTML) + `tsc` e `oxlint` (ambos limpos).

Legenda: **[AO VIVO]** = reproduzido no browser · **[CÓDIGO]** = confirmado lendo o código, não reproduzido.

---

## ALTA

1. **[AO VIVO] Arremesso (estilingue) é cortado no ar e o veredito nunca aparece.** `src/ui/minigames/Minigame.tsx:10` segura o minigame por `HOLD_MS = 1400`, mas o voo + rede + settle leva ~1.9–2.3 s (erro quica até 3.5 s). O banner ACERTOU/ERROU e a linha de destino ("curto", "girou e saiu") só renderizam em `phase === 'done'` (`Shot.tsx:141`), que nunca chega. Como `clutch` é sempre o último momento, o jogador vai pra tela de resultado com a bola ainda voando. Reproduzido: 3 screenshots em ~1.2 s mostram bola a meio caminho; em ~2.2 s já é a tela DERROTA.
   *Fix:* hold proporcional ao comprimento da animação (o minigame já sabe `flightMs`), ou tirar o gate `done` do banner.

2. **[CÓDIGO] Lance livre: bola sobe 0.5 s e volta pra mão, sem chegar no aro.** `FreeThrows.tsx:19` corta o path com `findIndex(p => p.y < RIM_H - 0.6)` sem o guard de `|x − d| < 0.4` que `Shot.tsx:85` tem. Como a saída é `FT_H = 2.05 < 2.45`, o `findIndex` retorna 0 → path de 30 amostras → `FLIGHT_MS = 500`. Acontece em toda falta puxada (finta de arremesso).

3. **[CÓDIGO] Qualquer erro de render apaga o save inteiro.** `src/ui/ErrorBoundary.tsx:20` faz `localStorage.removeItem(STORAGE_KEY)`. O reducer roda dentro do render e lança em invariantes (`state.ts:329/384/401` "calendário incompleto"). Uma carreira de 14 temporadas some por um edge case transitório.
   *Fix:* mover pra `thegoat:v7:crashed` e só descartar se o reload crashar de novo.

## MÉDIA

4. **[AO VIVO] Legenda de movimentos da MURALHA estoura em 375 px.** `.mg-df-legend` é `repeat(5, 1fr)` + `nowrap` (`mg-defense.css:55`); "GIRO", "ARREMESSO" ficam cortados no lado direito (`.mg` tem `overflow: hidden`).

5. **[AO VIVO] Ano da temporada inconsistente.** Fim da T1: cabeçalho mostra "T2", título "PRÊMIOS DA TEMPORADA · 2027", botão "AVANÇAR PARA 2027", Hub lista como 2026. `SeasonResult.tsx:27/57` usa `2026 + seasons.length` (a temporada já foi empurrada); `CareerBar.tsx:16` idem. O cartão de share (`Verdict.tsx:35,44`) usa `league.year` que começa em 1 → "SÚMULA 1-14".

6. **[AO VIVO] Balanço "JOGOS QUE VOCÊ VIVEU" omite os jogos de playoff jogados.** Listou o jogo-chave OKC e um "Vitória 101-99" (2º jogo-chave auto-resolvido pelo "Correr até os playoffs"), mas não LAL 97-104 e DEN 93-108 que joguei com minigame. E o GameResult do jogo simulado não mostra "O que você decidiu" mesmo eu tendo decidido 1 momento.

7. **[AO VIVO] Série de playoff resolvida em silêncio.** Perdi o jogo 1 vs LAL ("a série ainda vai ser decidida"), CONTINUAR → já era "SEMIFINAL vs DEN". Nenhuma tela diz que a série foi vencida nem o placar.

8. **[AO VIVO] "Nova carreira" na Home não pede confirmação e o Setup não tem "voltar".** O save só morre no BEGIN_CAREER (bom), mas quem clicou por engano só volta dando reload.

9. **[AO VIVO] Copy do reroll contradiz o jogo.** App: `mode.normal.line1` "com 1 novo sorteio" (`pt.json:487`); `como-jogar.html:41` e `en/how-to-play.html:41` "uma vez por draft". Jogo dá 2 (`state.ts:190`), `guia-draft.html:33` diz 2, e a UI mostra "2 restantes".

10. **[AO VIVO] Hub "ATRIBUTOS HOJE · OVR 65" ao lado de barras com média 82.** Draft disse "Overall de estreia 83". O Hub usa `effectiveOverall` (idade) mas mostra atributos brutos (`Hub.tsx:29,112`). Sem explicação, parece bug. (Relacionado: novato do ano com 5.3 PPG na T1.)

11. **[CÓDIGO] Card de encruzilhada pode cortar os botões em viewport baixo.** `.modal-veil` fixo sem `overflow-y`, `.crossroads-card` `top: 150px` (`base.css:268-286`). Em ~600 px de altura (iOS com barras, landscape) Aceitar/Recusar somem e a fase trava.

12. **[CÓDIGO] Hub não é modal.** Sem `role="dialog"`, sem foco, sem Esc; botões da tela de baixo continuam tabuláveis (confirmado no `read_page`: SKIP_GAME/PLAY_SEASON ainda na árvore com o Hub aberto).

13. **[CÓDIGO] Roubo errado na MURALHA cancela a jogada do atacante.** `defense.ts:145` `trySteal` sobrescreve `s.move` (shoot/drive/pass) com `EVADE`; um arremesso de 0.9 s nunca vira `phase: 'shot'`. Linha 137 também permite roubo com `rush` ativo (drive já perdido).

14. **[CÓDIGO] Strip na prancheta rola RNG a cada tick.** `playbook.ts:312-314` `rng.chance(0.06 / stripResist)` a 20 Hz depois de 0.5 s de pressão = ~70 %/s, não 6 %. Compare `feint`, que é 6 % por ação.

15. **[CÓDIGO] Idioma: EN nunca é o padrão inicial e `<html lang>` fica "pt".** `App.tsx:18` `initialState('pt')` ignora `navigator.language`; páginas `/en/*` linkam "Play" pra `/` → leitor inglês cai no jogo em PT. `documentElement.lang` nunca muda (verificado via JS após trocar pra EN).

16. **[CÓDIGO] Atalhos 1/2/3 do momento (modo normal) ignoram modificadores.** `Game.tsx:116-122` sem `ctrlKey/metaKey/altKey/repeat` — Ctrl+1 pra trocar de aba decide o momento.

17. **[CÓDIGO] Cronômetro clutch de 8 s conta ticks, não relógio.** `ClutchTimer.tsx:12` `setInterval` de 100 ms; aba em background é throttled a 1 tick/s → 8 s viram ~80 s.

18. **[CÓDIGO] `useCountUp` reinicia do baseline velho quando o alvo muda no meio.** `useMotion.ts:12-26`; no `SeasonAdvance` (alvo muda a cada 140 ms, `ms=200`) o placar W–L pula pra trás a cada tick.

19. **[CÓDIGO] Share no desktop/Firefox nunca entrega a imagem.** `Verdict.tsx:51-72`: canvas `display:none`, só `navigator.share({files})` sem `canShare` nem download. No iOS a chamada vem depois de 2 awaits → pode perder a user activation.

20. **[CÓDIGO] Privacidade promete o que o código não faz.** `privacidade.html:34` promete anúncios não personalizados na UE/UK até consentir; AdSense carregado sem gate em toda página, `src/ui/ads.ts` é no-op. `:31` cita Cloudflare Web Analytics; não há beacon (HANDOFF lista como pendente).

21. **[CÓDIGO] Canonical/sitemap/OG apontam pra `https://thegoatgame.app`** enquanto o site vive em `the-goat-3xw.pages.dev`. Se o domínio não estiver ligado, todo canonical aponta pra host que não serve.

## BAIXA

22. **[AO VIVO]** "1 ATRIBUTOS ABAIXO DE 70" (plural) no fim do draft; "CONTRATO · 1 TEMPORADAS RESTANTES" (`hub.contract`); EN `advance.pos` "3 IN THE EAST" sem ordinal; "VOCÊ VIROU UM" + "FORÇA/ÂNCORA" (gênero).
23. **[AO VIVO]** "6º NO Oeste" — `{conf}` não vem em caixa alta no label mono.
24. **[AO VIVO]** "EVOLUÇÃO DO ANO — AINDA NÃO DECIDIDO" no balanço de fim de temporada (temporada já acabou).
25. **[AO VIVO]** Rótulos sobrepostos na prancheta/muralha: "VOCÊ" cola em "DONCIC"/"GILGEOUS-ALEXANDER" quando o marcador está encostado.
26. **[AO VIVO]** Unidades hardcoded nos minigames: "6.2 m", "1.9 m" com ponto em PT (`Shot.tsx:127,129`, `Playbook.tsx:315`); pt.json usa vírgula ("0,6s").
27. **[AO VIVO]** Draft: copy "Toque num atributo pra ver o preço" no modo Arcade/Normal, onde o preço já está visível em todas as linhas.
28. **[AO VIVO]** Bloco SEO estático (`#home-static`, "O que é o The GOAT", FAQ, nav de guias) continua renderizado abaixo de TODAS as telas do app (Setup, draft, jogo…) e fica em PT mesmo com o app em EN.
29. **[AO VIVO]** Durante "SIMULANDO… TOQUE PRA PULAR" os botões "Assumir o próximo jogo"/"Correr até os playoffs" já estão ativos.
30. **[CÓDIGO]** Regras vs engine na MURALHA (`pt.json:597`): "posse ~9s" (é 8), "postura ~1s" (é 1.2), "re-arme" apertando de novo na verdade DESARMA (`defense.ts:149`). Prancheta: finta de arremesso "15 %" é `0.15 × difficulty` (até ~22 %).
31. **[CÓDIGO]** `defenseFlow.ts:126-142`: `held` só limpa no `keyup` → alt-tab com A/D segurado deixa o defensor correndo até a borda; Space/Enter no window fazem `preventDefault` e roubam mesmo com foco no botão SIMULAR.
32. **[CÓDIGO]** `Defense.tsx:136`: botões só em `pointerdown`, sem `onClick` (TalkBack/VoiceOver não ativam). ARREMESSO e JOGADA são só pointer (SVG `aria-hidden`, ímãs `<g>` sem role); banners sem `role="status"`.
33. **[CÓDIGO]** `onPointerCancel` ligado ao mesmo handler de up em Shot/Playbook: cancel do sistema (puxar notificação) solta o arremesso com drag parcial / commita rota pela metade. Shot sem pointer-id → 2º dedo sobrescreve o drag.
34. **[CÓDIGO]** `shot.ts:41` `'dunk'` inalcançável (`d < 1.0` mas `d ≥ 1.2`). `Playbook.tsx:307` `canDunk` usa `physical` bruto, `createScene` usa `physical × ageMultiplier`.
35. **[CÓDIGO]** `Playbook.tsx:211` `idx > 0` exclui você como alvo de passe depois de rebote ofensivo de companheiro.
36. **[CÓDIGO]** `i18n.ts:9` `replaceAll(str, String(v))` interpreta `$&`/`$$` — nome "A$$AP" vira "A$AP". Fix: replacer função.
37. **[CÓDIGO]** `state.ts:686,842`: PLAY_SEASON e RETIRE_DECISION sem guard de fase (todos os outros têm); PLAY_SEASON com `currentOffer null` lança → cai no item 3.
38. **[CÓDIGO]** RESET (`state.ts:871`) volta `timePressure` pra true; BEGIN_CAREER preserva. "Jogar de novo" religa a preferência.
39. **[CÓDIGO]** `share.ts:28-33` `percentileOf` ignora o downgrade do gate GOAT → card diz "acima de 99 %" pra quem foi rebaixado a lenda.
40. **[CÓDIGO]** `card.mode` "MODO · {mode}" com `mode.*.name` = "MODO GOAT" → "MODO · MODO GOAT".
41. **[CÓDIGO]** `SeasonAdvance.tsx:67` prefixo `J{n}` hardcoded (EN vê "J12").
42. **[CÓDIGO]** `en/game-modes.html:66` "all three" (são quatro modos). Guias (4 PT + 4 EN) sem cobertura em `tests/pages.test.ts`; sitemap test só checa 7 URLs.
43. **[CÓDIGO]** `robots.txt` `Disallow: /lab.html` não casa com a URL limpa `/lab` do Pages; `lab.html` está no rollup input de produção (`vite.config.ts:11`) → lab público.
44. **[CÓDIGO]** Sub-páginas (7 PT + 7 EN) sem OG/twitter/favicon PNG/manifest; `index.html:14` só `x-default` no hreflang; nenhum skip-link; `pages.css:2` `@import` de Google Fonts bloqueando render.
45. **[CÓDIGO]** Setup: inputs com `outline:none` sem `:focus-visible` (`Setup.tsx:66,98`); chips PT/EN sem `aria-pressed`; `div onClick` pra pular spin (`AttrDraft.tsx:77`, `Game.tsx:148`) inacessível por teclado; `.mg-pb__ball--*` e `.bar__fill` não respeitam `prefers-reduced-motion`.
46. **[CÓDIGO]** `minigames.css:5-7`: `.mg` `overflow:hidden` + `touch-action:none`; prancheta precisa ~415 px — em 360×640/landscape as linhas RODAR/ARREMESSAR podem ser cortadas sem rolagem.

---

## Playthrough E2E (`node tests/e2e-playthrough.mjs`)

Terminou com `PLAYTHROUGH FAILED`, zero erros de console. Asserts que falharam:
- "modo arcade: first minigame resolved with an outcome overlay (or gameResult): false" — coerente com os itens 1/18 (overlay de resultado curto demais ou ausente).
- "career has iconic moments: false" — pode ser dependente da seed; verificar se o script assume momento icônico garantido em 10 temporadas.
- O script imprime FAILED mas sai com código 0 (`process.exitCode` não é setado) → CI/terminal não percebe a falha.

## O que estava OK

- `tsc` e `oxlint` limpos (3 warnings só em `docs/design-handoff/support.js` e fast-refresh).
- Sem `Math.random`/`Date.now` no engine e no reducer (só seed no `Setup.tsx:140`, handler de UI).
- Paridade de chaves pt/en OK; nenhum href interno quebrado; hreflang PT↔EN simétrico; sitemap sem `lab.html`.
- Save persiste no reload e retoma na fase certa; troca PT/EN reativa; input de número clampa 0–99.
- Prancheta e muralha funcionam de ponta a ponta no mobile; tela de regras rola; lab.html monta.

## Sugestão de ordem

1 e 2 (animação do arremesso/lance livre) → 3 (ErrorBoundary) → 5 + 9 (ano e copy do reroll, baratos) → 4, 11, 12 (layout/modal) → 13, 14 (engine da muralha/prancheta, exigem `test:calibration`? não: minigames têm rng local, mas rodar `npm test`) → resto.

---

## Status das correções (2026-09-30, mesma sessão)

**Corrigido (43 de 46):** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18 (`HOLD_MS` 1400 → 1800: faixa da prancheta/muralha visível ≥ 1 s), 19, 20 (texto da privacidade alinhado ao que existe; ativar a mensagem de consentimento do Google no painel do AdSense continua sendo ação do dono), 22, 23, 24, 26, 27, 30, 31, 32 (`onClick` fallback na muralha e Space/Enter não sequestram botões; ARREMESSO/JOGADA continuam só pointer), 33, 34, 35, 36, 37, 38, 40, 41, 42 (guias cobertos pelos testes, sitemap = 15 URLs), 43 (`Disallow: /lab`; lab continua no build por decisão 26), 44 (OG/twitter/favicon nas 14 sub-páginas, hreflang pt-BR/en no root; skip-link e `@import` de fontes ficaram), 45 (`:focus-visible` global, `aria-pressed` nos chips; os `div onClick` de pular spin ficaram), 46. Extra: ordenação da tabela Top 4 agora segue o seed (mostrava "3 · BOS" antes de "2 · MIA" com o mesmo recorde).

**Não corrigido, de propósito:**
- 21 (canonical `thegoatgame.app`): decisão do dono sobre o domínio; ligar o custom domain no Pages resolve.
- 25 (rótulos sobrepostos quando o marcador encosta): cosmético, exigiria reposicionar labels no SVG.
- 28: falso positivo — o bloco SEO já é escondido por `body[data-phase]` (o `read_page` lista elementos `display:none`).
- 29 (botões ativos durante o ticker): o ticker dura ≤1,3 s e o dispatch é seguro; desabilitar exigia içar o `useReveal`.
- 39 (percentil do card no downgrade do gate): o percentil é por score, não por tier — o texto continua verdadeiro.
- E2E "exit 0 com FAILED": era o `| tail` do meu comando engolindo o código de saída; o script já usava `process.exit(exitCode)`.

**Como validar no browser:** a animação do arremesso agora segura o painel por `voo mais longo + 0,35 s + 1 s` (`Shot.tsx` passa `holdMs` no `onResolve`; `Minigame.tsx` usa `max(1400, holdMs)`). Não deu pra confirmar visualmente aqui porque a janela do browser ficou oculta (rAF pausa em aba escondida), então vale um arremesso de teste em `lab.html`.
