# The GOAT — Design Reference (pre-redesign)

Estado atual da UI, telas, fluxos e sistema visual. Base para redesign. Fonte de verdade: `src/state.ts` (union `Phase`), `src/ui/screens/*`, `src/data/i18n/*.json`, `src/styles/tokens.css` + `base.css`.

## 0. Fato-chave da arquitetura

**Não há router.** SPA single-track, state machine via `useReducer`. `App.tsx` lê `state.phase` e monta 1 de 6 arquivos de tela; 3 desses arquivos (`Season.tsx`, `Game.tsx`, `AttrDraft.tsx`) fazem branch interno por `phase` e viram várias views distintas. Total: **13 phases/views**, 6 arquivos.

```
phase → arquivo
home                    → Home.tsx
attrDraft / draftDone   → AttrDraft.tsx
nbaDraft                → NbaDraft.tsx
verdict                 → Verdict.tsx
keyGame / playoffGame   → Game.tsx
(resto: preseason, seasonResult, tradeDecision,
 eventDecision, freeAgency, retireDecision) → Season.tsx
```

Todas transições são dispatch de `Action` → `gameReducer` calcula phase seguinte → persiste em `localStorage['thegoat:v4']` a cada dispatch. Sem back button, sem URL, sem history. Modais (`tradeDecision`, `eventDecision`) são só phases renderizadas como overlay (`.modal-veil`) sobre versão dimmed da tela anterior.

Save/resume: `loadState()` valida e retoma direto na phase salva — por isso Home não tem botão "Continue".

RNG: seed + contador `rngCalls` — determinístico, replayável. `Math.random` banido no engine.

---

## 1. Inventário de telas (13)

### 1.1 Home — `src/ui/screens/Home.tsx` · phase `home`
Landing/título. Único ponto de entrada sem save.
- Mostra: título "THE GOAT" (serif gold gradient), kicker "One career. One verdict.", tagline, chip "Free · No signup".
- Ações: toggle idioma (chip EN/PT, hardcoded — débito, não traduzido). CTA "Start career" → `NEW_GAME` (seed = `Date.now()`).
- Débito: chave i18n `home.continue`/`home.lang` morta (nunca usada).

### 1.2 AttrDraft (roubo de atributo) — `AttrDraft.tsx` · phase `attrDraft`
Criação de personagem: rouba 1 atributo por vez de lenda sorteada, 8 rounds (three/finishing/passing/handles/defense/rebounding/physical/clutch).
- Mostra: contador de round (dots 1-8), lenda sorteada + era, fraqueza dela (flavor text), grid 2 colunas de 8 slots (preenchidos = cinza/owned, abertos = valor do jogador atual, selecionáveis). Preview de malus ao selecionar.
- Ações: tap slot → confirma "Steal {slot} {n}" (`DRAFT_STEAL`). "Draw another player · 1 left" reroll (uso único, `DRAFT_REROLL`).

### 1.3 DraftDone (reveal do build) — sub-view em `AttrDraft.tsx` · phase `draftDone`
- Mostra: nome do arquétipo (PG Maestro, SG Scorer, SF All-Around, PF Power, C Anchor), overall, bar chart de 8 atributos (vermelho se <70).
- Ações: "Go to the NBA Draft" → `CONFIRM_BUILD` (calcula pick + 3 ofertas).

### 1.4 NbaDraft — `NbaDraft.tsx` · phase `nbaDraft`
Escolha de time draft night.
- Mostra: "You went pick #{n}", 3 `OfferCard` (cidade+time, perfil: Contender/Rebuild/Big market, 1 destacada).
- Ações: tap oferta → `CHOOSE_OFFER` → `preseason`.

### 1.5 Preseason — sub-view em `Season.tsx` · phase `preseason`
Início de temporada, escolha de foco.
- Mostra: ano + idade, time atual, manchetes da liga (até 5, máx 2 de draft), 4 cards de foco: Scoring (+2 PPG), Defense, Leadership, Health.
- Ações: tap foco → `PLAY_SEASON`.

### 1.6 EventDecision (modal) — sub-view em `Season.tsx` · phase `eventDecision`
Evento narrativo mid-season (lesão ou atrito no vestiário), overlay dimmed.
- Mostra: card título+descrição (borda gold).
- Ações: 2 escolhas, ex. lesão: "Return early" vs "Heal properly"; vestiário: "Pick the fight" vs "Put out the fire". `EVENT_DECISION`.

### 1.7 keyGame / playoffGame (Moment panel) — `Game.tsx` → `MomentPanel` · phases `keyGame`, `playoffGame` (com moment pendente)
Mini-sequência de "jogo assistido" — 3-4 jogos-chave/temporada + todo jogo de playoff/finals, cada um com 3 momentos (`q2tactic`, `q4pressure`, `clutch`).
- Mostra: header (tipo de jogo ou round+série nas finals), placar fictício ao vivo, banner do último resultado, texto da situação (localizado, varia por adversário), 2+ opções por momento (atributo usado, risco Safe/Bold/Reckless, tag de risco de lesão quando aplicável).
- Ações: escolher opção (`DECIDE_MOMENT`) ou "Simulate game" (`SKIP_GAME`, resolve resto com segurança).

### 1.8 SeriesScreen — sub-view em `Game.tsx` · phase `playoffGame` sem game pendente
Interstitial de série (só Finals, best-of-7; rounds 0-2 resolvem em 1 jogo só).
- Mostra: nome do round, adversário, placar da série grande (ex "2 : 1").
- Ações: "Next game" (`ADVANCE_GAME`) ou "Simulate series" (`SKIP_SERIES`).

### 1.9 SeasonResultView (recap com abas) — sub-view em `Season.tsx` · phase `seasonResult`
Hub de fim de temporada, 4 abas.
- **Result** (default): PPG/RPG/APG, jogos, eventos narrativos da temporada (ruins em vermelho), banner de resultado (campeão/playoffs/fora), prêmios ganhos (chips, ring/FMVP/MVP dourados), lista de key games (V/D + placar + pontos), momentos icônicos da temporada (chips), `CeremonyPanel` (campeão da liga + MVP/DPOY/ROY/MIP + resultado do próprio playoff run).
- **Standings**: 30 times East/West via `StandingsTable`, time do jogador destacado gold.
- **Races**: corrida de prêmios MVP/DPOY/ROY/MIP via `RacesPanel`.
- **You**: `PlayerPanel` — overall efetivo vs base + `Sparkline` da trajetória de overall entre temporadas.
- Ações: troca de aba (client-side, sem dispatch). "Advance" → `ADVANCE` (envelhece, roda offseason, roteia próxima phase).

### 1.10 TradeDecision (modal) — sub-view em `Season.tsx` · phase `tradeDecision`
Oferta de troca mid-season (trade deadline), overlay sobre standings/race parciais (scale 0.5, label "Partial — midseason").
- Mostra: card "{team} wants you. Accept?"
- Ações: "Accept trade" / "Stay" → `TRADE_DECISION`.

### 1.11 FreeAgency — sub-view em `Season.tsx` · phase `freeAgency`
Renovação de contrato (a cada 4 temporadas).
- Mostra: idade, título, descrição, 3 `OfferCard` novas.
- Ações: escolher oferta (`CHOOSE_OFFER`); se idade ≥31 ou declínio forte (ratio <0.55), botão extra "Retire" (danger, `RETIRE_DECISION` retire:true).

### 1.12 RetireDecision — sub-view em `Season.tsx` · phase `retireDecision`
Prompt de aposentadoria (idade ≥31 OU ratio <0.75).
- Mostra: idade, número da temporada, "Keep playing?", descrição contextual (padrão ou variante "pressure" em declínio forte).
- Ações: "One more season" (→ `preseason`) vs "Retire" (→ `verdict`).

### 1.13 Verdict — `Verdict.tsx` · phase `verdict`
Tela final — payoff do jogo inteiro. Calcula `computeVerdict(career)` no render (recomputa a cada re-render, ineficiência conhecida).
- Mostra: tier em gold grande (Playground Baller → Role Player → Starter → All-Star → Superstar → Legend → THE GOAT 🐐, gate por rings+MVPs ou pontos+rings), score numérico, grid 2×2 de totais de carreira (pontos, temporadas, rings, MVPs — gold se >0), chips de todo prêmio ganho com contagem, lista de momentos icônicos de carreira com bônus, chip de "clutch miss" se houve choke, `<canvas>` share card 1080×1350 (`drawShareCard` em `src/ui/share.ts`).
- Ações: "Share" (copia texto + `navigator.share` do PNG se disponível, feedback "Copied!" 2s). "Play again" → `RESET` (limpa localStorage → `home`).

---

## 2. Grafo de fases completo

```
home
 └─NEW_GAME──▶ attrDraft (×8 DRAFT_STEAL, 1× DRAFT_REROLL opcional)
                 └─(8º pick)──▶ draftDone
                                   └─CONFIRM_BUILD──▶ nbaDraft
                                                        └─CHOOSE_OFFER──▶ preseason
──────────────── LOOP DE TEMPORADA (repete) ────────────────
preseason
 └─PLAY_SEASON──▶ [rollEvents]
       ├─ evento interativo ──▶ eventDecision ─EVENT_DECISION─▶ keyGame (fila)
       └─ sem evento ─────────────────────────────────────────▶ keyGame (fila)
keyGame (repete por jogo-chave, 3-4/temporada)
 └─DECIDE_MOMENT / SKIP_GAME (×3 momentos)──▶ próximo keyGame OU
      (fila vazia) runSeasonSim
                        ├─ oferta de troca mid-season ──▶ tradeDecision
                        │      └─TRADE_DECISION──▶ concludeSeason
                        └─ sem troca ──────────────────▶ concludeSeason
concludeSeason (prêmios calculados)
 ├─ fora dos playoffs ──▶ (bracket auto) ──▶ seasonResult
 └─ nos playoffs ───────▶ playoffGame (round 0..3)
playoffGame
 ├─ rounds 0-2: 1 jogo pivotal (DECIDE_MOMENT/SKIP_GAME) ──▶ ganha: próx round | perde: seasonResult
 └─ round 3 (Finals): tela de jogo ⇄ SeriesScreen (ADVANCE_GAME/SKIP_SERIES) até 4V/4D ──▶ seasonResult
seasonResult (abas: result/standings/races/you)
 └─ADVANCE──▶ [offseason: idade+1, liga avança]
       ├─ idade > 40 ──────────────────────▶ verdict (FIM)
       ├─ contractYearsLeft === 0 ─────────▶ freeAgency
       │      └─CHOOSE_OFFER──▶ preseason (loop)  |  RETIRE_DECISION(retire)──▶ verdict (se 31+/declínio forte)
       ├─ idade≥31 ou declínio (ratio<0.75) ▶ retireDecision
       │      └─ continua──▶ preseason (loop) | para──▶ verdict (FIM)
       └─ senão ───────────────────────────▶ preseason (volta ao topo)
verdict
 └─RESET──▶ home
```

## 3. Estágios do loop principal

| Estágio | Tela(s) |
|---|---|
| Onboarding / criação | Home → AttrDraft (8 rounds) → DraftDone |
| Draft / escolha de time | NbaDraft (3 ofertas) |
| Setup de temporada | Preseason (escolha de foco) |
| Narrativa in-season | EventDecision (modal, condicional) |
| Simulação de jogos | keyGame (Game.tsx MomentPanel, 3-4 jogos) |
| Troca mid-season | TradeDecision (modal, condicional, temporada 3+) |
| Playoffs | playoffGame (MomentPanel por jogo pivotal/Finals + SeriesScreen nas Finals) |
| Offseason / recap | SeasonResultView (4 abas) |
| Renovação de contrato | FreeAgency (a cada 4 temporadas) |
| Aposentadoria | RetireDecision (idade 31+/declínio) |
| Fim de carreira / veredito | Verdict (tier, score, prêmios, momentos, share card) |

---

## 4. Componentes compartilhados — `src/ui/components/`

- **OfferCard.tsx** — card de oferta de time (usado em NbaDraft + FreeAgency): cidade+nome, chip de perfil, descrição, variante destacada/gold.
- **StatLine.tsx** — bloco de stat mínimo (número serif grande + label). Usado em SeasonResultView (PPG/RPG/APG) e PlayerPanel.
- **LeaguePanels.tsx** — 4 widgets:
  - `Sparkline` — SVG inline, curva de overall na carreira.
  - `StandingsTable` — standings East/West 2 colunas, prop `scale` p/ preview parcial mid-season.
  - `RacesPanel` — leaderboard de prêmios, scale-aware.
  - `CeremonyPanel` — bloco de cerimônia: campeão + vencedores de prêmio + resultado do playoff run.
  - `PlayerPanel` — aba "You" (StatLine + Sparkline).

### Primitivas de layout/visual (`base.css`, aplicadas via className em toda tela — não são componentes React, mas de facto um design system)
```
.screen          shell único: max-width 430px mobile / 1080px desktop (@900px), centralizado, min-height 100dvh
.screen__glow    glow radial gold decorativo (topo)
.grain           textura de grão fixa full-viewport (opacity 0.05)
.kicker / .kicker--gold   eyebrow uppercase pequeno
.display / .goldtext      tipo serif de display, variante gold gradient text-clip
.hint            texto de ajuda/caption pequeno e dim
.rule            divisor horizontal gold gradient
.btn / .btn--gold / .btn--danger / .btn--ghost   variantes de botão (outline padrão, CTA gold, destrutivo vermelho, secundário dim)
.card / .card--gold       card de superfície, variante gold-bordered p/ destaque
.chip / .chip--dim        badges pill (prêmios, tags de perfil, toggle EN/PT)
.banner / .banner--bad    banners de resultado (campeão vs. fora dos playoffs)
.evrow / .evrow--bad      linhas de evento de temporada (borda esquerda gold/vermelha)
.attr-row*       linhas de bar chart de atributo (tela de reveal do build)
.attr-cell* / .preview-bar   células do grid de draft + banner de preview de roubo
.totcell         célula do grid de totais no Verdict
.stat-line*      bloco de stat número grande/label
.mono-ring*      placeholder circular de monograma (sem fotos/logos reais — decisão de design #6 do HANDOFF)
.modal-veil      overlay fixo full-screen dimmed p/ os 2 modais (trade/event)
```
Sem biblioteca de componentes (sem shadcn/MUI), sem Tailwind — CSS puro escrito à mão + `style={{}}` inline para layout ad hoc (flex/grid) em cada arquivo de tela.

---

## 5. Estado — resumo

- Estado global único: `useReducer(gameReducer, ..., loadState() ?? initialState('pt'))` em `App.tsx`. Sem Context API, sem store externa (sem Redux/Zustand/Jotai).
- `GameState` (`src/state.ts`) guarda tudo: `phase` atual, `lang`, RNG `seed`+`rngCalls`, progresso de draft (`currentPlayerId`, `drawnIds`, `rerollUsed`, `draftRound`, `picks`, `build`), time/contrato (`currentOffer`, `contractYearsLeft`, `age`, `pickNumber`, `offers`), dados de temporada em andamento (`pendingRegular`, `pendingFocus`, `pendingEvents`, `pendingChoices`, `pendingKeyGames`, `pendingGame`, `pendingPlayoffs`, `keyGameResults`, `injuryProne`), `career` completa (todas `seasons` passadas + `fame`), simulação da liga (`league`, `seasonOutcome`, `leagueHistory`, `headlines`, `pendingLeague`).
- Transições só via `Action` dispatched (`NEW_GAME`, `DRAFT_STEAL`, `DRAFT_REROLL`, `CONFIRM_BUILD`, `CHOOSE_OFFER`, `PLAY_SEASON`, `TRADE_DECISION`, `EVENT_DECISION`, `DECIDE_MOMENT`, `SKIP_GAME`, `ADVANCE_GAME`, `SKIP_SERIES`, `ADVANCE`, `RETIRE_DECISION`, `RESET`) → `reduce()` computa phase nova → persiste (`saveState()` → `localStorage['thegoat:v4']`) a cada dispatch.
- Engine 100% TS puro, zero React, RNG seedado (mulberry32) — replay exato via re-seed + fast-forward de `rngCalls`.
- Save versionado `v4` — bump descarta saves antigos quando contrato de dados muda.
- Verdict recomputado no render, não persistido no state (ineficiência conhecida, baixo impacto).

---

## 6. i18n — o que revela sobre as telas

`src/data/i18n/en.json` / `pt.json`, 203 chaves cada, paridade testada.

- `home.*` — inclui `home.continue`/`home.lang` mortas (Home não tem Continue, toggle de idioma é chip hardcoded).
- `draft.* / slot.* / era.* / archetype.*` — AttrDraft + DraftDone. Nomes de arquétipo embutem a posição entre parênteses ("Maestro (PG)"); UI extrai via `.split(' (')[0]` (frágil, débito).
- `nbadraft.* / profile.*` — NbaDraft/FreeAgency; `nbadraft.picked` tem fraseado só-inglês mesmo no pt.json (débito).
- `season.* / focus.* / event.* / trade.* / eventdec.* / fa.* / retire.*` — todo o loop de temporada, incluindo os 2 fluxos de evento interativo.
- `award.* / tabs.* / standings.* / races.* / you.* / ceremony.* / run.* / news.* / headline.*` — as 4 abas do SeasonResultView + cerimônia/manchetes da liga.
- `verdict.* / tier.* / share.*` — Verdict + share card; nomes de tier = vocabulário do "GOAT ladder" (Playground Baller → Role Player → Starter → All-Star → Superstar → Legend → THE GOAT).
- `game.* / moment.* / option.* / risk.* / series.* / iconic.* / keygames.*` — Game.tsx (moment panel) + SeriesScreen; `moment.*` tem 3 variantes narrativas (`.v0/.v1/.v2`) por tipo de momento.
- HANDOFF cita "5 chaves mortas" nos JSONs (só 2 identificadas acima) — vale audit antes de usar as chaves como spec literal.

---

## 7. Sistema visual atual ("legado dourado")

Sem Tailwind/framework CSS. Tokens em `src/styles/tokens.css`, utilitários em `src/styles/base.css`. Portado do projeto claude-design "The GOAT" (3 canvases aprovados: mobile core, fluxo completo de 13 telas, desktop).

**Cores** (`tokens.css`):
```
--bg: #0d0b08              fundo quase-preto
--surface: #161209         --surface2: #1e1810     superfícies de card
--border: #2a2318          --border-gold: #4a3c1c
--gold: #d4a73c   --gold-hi: #efc75e   --gold-dim: #7a6224   acento primário da marca
--text: #f1ead8   --dim: #9c9080   --faint: #5c543f          hierarquia de texto
--danger: #c4553b   --danger-border: #6b3325                 retire/lesão/evento ruim
```

**Tipografia:** `--serif: 'Marcellus', serif` (display/headline, hero text gold gradient via `.goldtext`), `--sans: 'Archivo', sans-serif` (corpo/UI). Carregadas via Google Fonts em `base.css`.

**Raios:** `--radius: 12px` (cards), `--radius-btn: 8px` (botões).

**Layout:** mobile-first single-column, shell `.screen` max-width 430px, breakpoint desktop 900px (max-width 1080px). Sem grid system responsivo além disso — cada tela usa flex/grid ad hoc inline.

**Motivos visuais recorrentes:** textura de grão (`.grain`), glow radial gold atrás de hero content (`.screen__glow`), texto gold gradient clip (`.goldtext`), cards "featured" com borda gold (`.card--gold`), placeholders de monograma no lugar de foto/logo real (`.mono-ring` — decisão explícita de design, sem licenciamento NBA).

---

## 8. Pontos de atenção p/ redesign

- 13 telas reais, mas só 6 arquivos — refatorar visual pode exigir separar sub-views em componentes próprios (hoje `Season.tsx` e `Game.tsx` concentram várias telas via if/switch interno).
- Toggle de idioma no Home é hardcoded (não usa i18n) — oportunidade de consertar junto do redesign.
- Extração de nome de arquétipo via `.split(' (')[0]` é frágil — se mexer no texto de `archetype.*`, quebra silenciosamente.
- Modais (trade/event) são phases, não overlays reais sobre estado anterior preservado — repensar como modal state se for reestruturar navegação.
- Sem router: qualquer redesign que precise de URL/deep-link/back-button exige introduzir um de verdade (trade-off vs. simplicidade atual do reducer).
- `.mono-ring` (placeholder de time/jogador) é candidato natural a upgrade visual sem violar a regra de "sem fotos/logos reais".
