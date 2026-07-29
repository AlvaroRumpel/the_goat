# Baseline pré-liga-viva (2026-07-28)
Saída de CALIBRATE=1 na master antes do refactor. Alvos de regressão da Task 10.

> **Resultado pós-liga (Task 10) no fim do arquivo** — constantes finais e números novos.

## Overall 79
```json
{
  "ringsMedian": 1,
  "ringsP90": 3,
  "mvpRate": 0,
  "legendRate": 0,
  "goatRate": 0,
  "tiers": {
    "peladeiro": 0.31,
    "rolePlayer": 0.13,
    "starter": 0.34,
    "allstar": 0.185,
    "superstar": 0.035,
    "legend": 0,
    "goat": 0
  },
  "avgPoints": 17641,
  "peakPpg": 15.6,
  "peakRpg": 8.6,
  "peakApg": 5.8,
  "allstarRate": 0.005
}
```

## Overall 83
```json
{
  "ringsMedian": 1,
  "ringsP90": 3,
  "mvpRate": 0,
  "legendRate": 0.005,
  "goatRate": 0,
  "tiers": {
    "peladeiro": 0.025,
    "rolePlayer": 0.26,
    "starter": 0.365,
    "allstar": 0.275,
    "superstar": 0.07,
    "legend": 0.005,
    "goat": 0
  },
  "avgPoints": 21443,
  "peakPpg": 18.4,
  "peakRpg": 9.5,
  "peakApg": 6.5,
  "allstarRate": 0.835
}
```

## Overall 90
```json
{
  "ringsMedian": 2,
  "ringsP90": 3,
  "mvpRate": 0.58,
  "legendRate": 0.08,
  "goatRate": 0,
  "tiers": {
    "peladeiro": 0,
    "rolePlayer": 0,
    "starter": 0.135,
    "allstar": 0.435,
    "superstar": 0.35,
    "legend": 0.08,
    "goat": 0
  },
  "avgPoints": 29107,
  "peakPpg": 23.3,
  "peakRpg": 11,
  "peakApg": 7.7,
  "allstarRate": 1
}
```

## Overall 95
```json
{
  "ringsMedian": 2,
  "ringsP90": 4,
  "mvpRate": 0.92,
  "legendRate": 0.41,
  "goatRate": 0,
  "tiers": {
    "peladeiro": 0,
    "rolePlayer": 0,
    "starter": 0.005,
    "allstar": 0.175,
    "superstar": 0.41,
    "legend": 0.41,
    "goat": 0
  },
  "avgPoints": 34632,
  "peakPpg": 26.8,
  "peakRpg": 12.1,
  "peakApg": 8.6,
  "allstarRate": 1
}
```

## Overall 99
```json
{
  "ringsMedian": 2,
  "ringsP90": 4,
  "mvpRate": 0.985,
  "legendRate": 0.76,
  "goatRate": 0.005,
  "tiers": {
    "peladeiro": 0,
    "rolePlayer": 0,
    "starter": 0,
    "allstar": 0.015,
    "superstar": 0.225,
    "legend": 0.755,
    "goat": 0.005
  },
  "avgPoints": 39247,
  "peakPpg": 29.6,
  "peakRpg": 13,
  "peakApg": 9.4,
  "allstarRate": 1
}
```

## Overall 75 (Relatório Completo)
```json
{
  "ringsMedian": 1,
  "ringsP90": 2,
  "mvpRate": 0,
  "legendRate": 0,
  "goatRate": 0,
  "tiers": {
    "peladeiro": 0.45,
    "rolePlayer": 0.1,
    "starter": 0.34,
    "allstar": 0.1,
    "superstar": 0.01,
    "legend": 0,
    "goat": 0
  },
  "avgPoints": 14623,
  "peakPpg": 12.8,
  "peakRpg": 7.7,
  "peakApg": 5,
  "allstarRate": 0
}
```

---

# Pós-liga-viva — Task 10 (2026-07-28)

Harness reescrito com a liga completa (270 NPCs): `computeWinPct(rosterStrength)` →
`simStandings` → `simNpcLines` → `simBracket` → `simAwards` → `finishSeason` →
`advanceOffseason`. N=200 por overall, mesma política (foco scoring, até os 40).

## Constantes finais alteradas (só constantes; nenhuma fórmula mudou)

| Constante | Antes | Depois | Motivo |
|---|---|---|---|
| `advanceOffseason` — ovr do rookie | `55 + 30r²` | `55 + 42r²` | a liga decaía (ovr médio 74.7 → 69.9 em 10 anos, topo da corrida de MVP 55 → 45): o jogador virava MVP vitalício no fim da carreira. Com 42 a liga fica estável (ovr médio 72-76 por 22 temporadas) |
| `simNpcLines` — slope de ppg | `(eff-58) * 0.55` | `(eff-58) * 0.70` | líder de pontos da liga era 23 ppg (NBA real ~30-32). Agora topo 29-31, top-10 ~22-30 |
| `simNpcLines` — jitter de ppg | `±2` | `±4` | variância ano a ano na corrida de MVP (o mesmo NPC não lidera sempre) |
| `simAwards` — multiplicador dpoy de `defender` | `1.03` | `1.06` | DPOY do jogador estava inflado (avgDpoy 99 = 5+); agora 1.87/carreira |

Não tocados: `computeWinPct`, `computeTitleProb`, fórmulas de stats, pesos do
`verdict.ts`, expoente/ajuste do `simBracket`, constantes do `teamStrength`,
fator winPct (30) do `mvpScore`.

## Números finais (CALIBRATE=1) vs baseline

| overall | ringsMed (base) | mvpRate (base) | legendRate (base) | goatRate (base) | peakPpg (base) | avgMvp | avgDpoy | avgRings |
|---|---|---|---|---|---|---|---|---|
| 75 | 0 (1) | 0 (0) | 0 (0) | 0 (0) | 12.8 (12.8) | 0 | 0 | 0.56 |
| 79 | 0 (1) | 0 (0) | 0 (0) | 0 (0) | 15.6 (15.6) | 0 | 0 | 0.62 |
| 83 | 1 (1) | 0 (0) | 0 (0.005) | 0 (0) | 18.4 (18.4) | 0 | 0 | 1.07 |
| 90 | 1 (2) | **0.13** (0.58) | 0.005 (0.08) | 0 (0) | 23.3 (23.3) | 0.14 | 0.07 | 1.51 |
| 95 | 2 (2) | 0.855 (0.92) | 0.395 (0.41) | 0 (0) | 26.8 (26.8) | 2.25 | 0.61 | 1.73 |
| 99 | 2 (2) | 1.0 (0.985) | 0.935 (0.76) | **0** (0.005) | 29.6 (29.6) | 5.74 | 1.87 | 1.87 |

Locks do harness: 83 ringsMedian ≤2 ✓ e legendRate <0.15 ✓; 95 legendRate >0.2 ✓;
79 peakPpg 12–19 ✓; 99 peakPpg 26–34 ✓. Trava do dono goatRate(99) < 0.02 ✓ (= 0).

## Alvo não atingido: mvpRate de 90 (0.13 vs banda 0.29–0.87)

Estrutural, não falta de ajuste. No modelo antigo o MVP era um gate aleatório
(`ppg≥23 && winPct≥0.6 && chance(0.25)`); agora é ranking contra 270 NPCs. O
composto do jogador (`ppg + 1.4apg + 1.1rpg + (winPct-0.5)*30`) vale ~56.7 no pico
com 90 de overall e ~67.7 com 99 — 11 pontos de diferença —, enquanto o topo da
liga tem média ~62 e **desvio de só ~3.4** (máximo de 270 amostras concentra).
Não existe média de liga que dê ~10% de temporadas ganhas ao 90 e ~50% ao 99 ao
mesmo tempo. Varrida feita (slope 0.63/0.66/0.70/0.75, jitter ±2/±5/±8/±12):

| slope/jitter | mvpRate 90 | avgMvp 99 | goatRate 99 |
|---|---|---|---|
| 0.55 / ±2 (original) | 0.995 | ~12 | 0.105 |
| 0.63 / ±5 | 0.37 | 7.69 | 0.035 |
| 0.66 / ±2 | 0.24 | — | 0.030 |
| **0.70 / ±4 (escolhido)** | **0.13** | **5.74** | **0** |
| 0.75 / ±2 | 0.045 | — | 0 |

Escolhido o ponto que respeita a trava do dono com folga, mantém 95 colado no
baseline (legendRate 0.395 vs 0.41) e deixa o 99 com 5.7 MVPs de carreira —
número de GOAT real (Jordan 5, LeBron 4, Kareem 6). Um 90 overall (23/11/7.7) é
um top-10 da liga, não favorito a MVP: 13% de carreiras com pelo menos um MVP é
defensável. Alternativa descartada: cortar título no `simBracket` para segurar o
goat com slope menor — distorceria o `computeTitleProb` (fórmula-contrato) e
derrubaria anéis em todas as faixas.

## Débitos conhecidos (não bloqueiam a Task 10)

- `royRate = 1` em **todas** as faixas (até 75 overall). `npcEffOvr` aplica a curva
  de idade do jogador ao NPC, então rookie de NPC (ovr 70, 20 anos) tem eff ~57 e
  ppg mínimo (2). O jogador ganha ROY sempre. ROY não entra no `verdict` (score
  não infla), mas a cerimônia do ano 1 é sempre previsível. Corrigir exige mexer em
  `npcEffOvr` (afeta rosterStrength/standings → recalibração inteira).
- Anéis do 75/79 caíram de mediana 1 → 0. Efeito do bracket real (precisa de seed
  + 4 séries) contra o `chance(titleProb)` solto do modelo antigo. Mais realista.
- `legendRate` do 99 subiu (0.76 → 0.935): 5.7 MVPs + 1.9 DPOY por carreira somam
  ~510 pontos de score. Tier goat continua trancado.

## Fix round 1 — ROY (2026-07-28)

`ROY_NPC_BOOST = 1.8` em `simAwards` (só na lista de ROY): `npcEffOvr` esmaga rookie de NPC
(ovr 70 / 20 anos → eff ~57 → ppg no piso), então o jogador levava ROY em 100% das carreiras.
Topo bruto dos rookies NPC no ano 1 = 7.8 ± 0.76; valor de ROY do jogador na 1ª temporada =
12.8 (75) / 14.0 (79) / 15.2 (83) / 20.3 (90) / 28.0 (99).

royRate final: 75 = 0.245, 79 = 0.455, 83 = 0.785, 90/95/99 = 1.0 (antes: 1.0 em todas).
Demais métricas inalteradas (ROY não entra no `verdict`). Lock novo no harness: `royRate(79) < 0.8`.

Também nesta rodada: `simRegularSeason` passa `standings` ao `makeOffers`, então as ofertas de
trade do deadline usam vitórias da temporada anterior em vez de `Team.strength` estático
(sem mudança no consumo de rng).

---

# Pós-B — motor de momentos, Task 8 (2026-07-29)

Harness **reescrito para ser dirigido pelo reducer** (`gameReducer` + política de
dispatches). Antes chamava `simBracket` direto — calibrava um caminho que ninguém que
classifica percorre. Agora cada temporada é a mesma sequência que a UI dispara:
`PLAY_SEASON` → jogos-chave → `[tradeDecision]` → playoffs jogo a jogo → `ADVANCE`.
Duas políticas: `auto` (sempre a opção segura = `SKIP_GAME`) e `bold` (sempre a ousada).

## O bug que a Task 7 mediu: título 2.02× o `titleProb`

Três vazamentos, todos fechados:

1. **Finais ignoravam o `pGame` guardado.** O jogo era decidido por força+ruído
   (winrate 0.595 contra `pGame` 0.463 ⇒ bo7 0.701 contra 0.420).
2. **Rounds 0-2 ganhavam +0.04 de graça**: `seriesProb ± SERIES_SHIFT` com
   P(vencer o pivotal) ≈ 0.6 ⇒ `E[shifted] = seriesProb + 0.04`.
3. **Momentos enviesavam a margem**: uma build forte acerta ~73% dos momentos, somando
   ~+7 de margem por jogo que ninguém descontava.

### Mecanismo novo: margem com probabilidade-alvo (`startWatchedGame`)

Não é fórmula-contrato; é resolução analítica da margem, determinística e com o mesmo
1 call de rng. Para um jogo com `targetWinP = p`:

```
margin = c + U + S,   U ~ U(−N, +N),  S = Σ deltas dos momentos,  N = MARGIN_NOISE
won ⟺ round(margin) > 0 ⟺ c + U + S ≥ 0.5
P(won) = (c + E[S] + N − 0.5) / 2N   ⇒   c = 2N·p − N + 0.5 − E[S]
```

`E[S] = expectedAutoDelta(build, age)` — o valor esperado dos 3 momentos na política
padrão. Quem joga **bold** desloca `S` para longe de `E[S]`: é exatamente aí que mora o
edge da política ousada. A força do elenco **não** entra nesse modo (já está dentro de
`seriesProb`/`titleProb`); reusá-la seria a contagem dupla original.

- **finais**: `targetWinP = pGame`, e `bo7(pGameForSeries(p)) = p` por construção.
- **rounds 0-2**: `targetWinP = seriesProb`, e o shift passa a ser **centrado**:
  `shifted = seriesProb + 2×SERIES_SHIFT×(venceu − seriesProb)`. Em `seriesProb = 0.5`
  continua sendo o ±0.20 clássico, mas agora `E[shifted] = seriesProb` para qualquer
  `seriesProb` — porque P(vencer o pivotal) = `seriesProb` por construção da margem.

Verificação (99 overall, N=600, taxa realizada vs alvo por rodada):

| rodada | n | realizado | alvo |
|---|---|---|---|
| r1 | 13200 | 0.5508 | 0.5545 |
| semi | 7270 | 0.5465 | 0.5446 |
| conf | 3973 | 0.5361 | 0.5386 |
| finais (série) | 2130 | 0.5385 | 0.5400 |

`titleRate` realizada = 0.0877 contra `seriesProb⁴` ≈ 0.0915. O 2.02× virou 1.00×.

## Constantes e regras alteradas

| Onde | Antes | Depois | Motivo |
|---|---|---|---|
| `RISK.bold.attrW` | 0.008 | **0.011** | bold era EV-pior que safe até ~97 de atributo (não existia edge). Com 0.011 o cruzamento cai para ~86: aposta ruim para build fraca, boa para elite |
| `MARGIN_NOISE` (era literal `±8`) | 8 | **16** | no modo alvo, quando `c + S` sai da janela a probabilidade satura — e satura **assimétrico** (só a cauda ruim bate no 0). Com ±8 as finais realizavam 0.555/jogo contra alvo 0.543; com ±16 a saturação some |
| `PLAYER_OUT_MARGIN` | −7 aplicado em `ourStrength` (valia −3.15) | **−5 aplicado no `baseMargin`** | o comentário dizia baseMargin e o código dizia strength. Alinhado pelo efeito desejado: −5 em janela de 32 ≈ −16 p.p. no jogo — derrota provável, não certa |
| `keyGameEffects` | `winPct ±0.01/jogo`, `ppg = net×0.1` | ambos derivados do **swing centrado** (`Σ deltas − jogos × expectedAutoDelta`): `winPct = swing×0.0005` (cap ±0.01), `ppg = swing×0.03` (cap ±0.5) | o saldo bruto dava +0.5 ppg e +0.03 de winPct **fixos** a toda build forte. Isso empurrava a corrida de MVP (decidida por ~3 pontos contra 270 NPCs): `avgMvp(99)` ia a 6.37 contra 5.88 do baseline |
| `playerPts` | `+7 por acerto` | `+RISK[risco].hit` (safe 4 / bold 7 / reckless 10) | três passes seguros não fazem um jogo de 45. Com bônus fixo o 99 fechava 3/3 em ~39% dos jogos e carimbava `closeout45` ~8× por carreira |
| catálogo de icônicos | `clutch.success && won && margin ≤ 4` | idem **+ jogada de arremate não-safe** (`dagger`), inclusive no `sweep` | jogar seguro nunca vira lenda. Sem o gate a política auto batia o cap de 100 pontos de icônico em TODA carreira — +100 de score grátis em todas as faixas |

Não tocados: `computeWinPct`, `computeTitleProb`, fórmulas de stats, pesos do
`verdict.ts`, thresholds de tier, gate do GOAT, expoente/ajuste do `simBracket`,
contagem de rng calls (`GAME_RNG_CALLS = 10`, `selectKeyGames = 3`).

## Números finais — política auto (N=200; 99 com N=600)

| overall | ringsMed (pós-A) | ringsAvg (pós-A) | mvpRate (pós-A) | legendRate (pós-A) | goatRate (pós-A) | peakPpg (pós-A) | royRate (pós-A) |
|---|---|---|---|---|---|---|---|
| 75 | 0 (0) | 0.54 (0.56) | 0 (0) | 0 (0) | 0 (0) | 12.7 (12.8) | 0.195 (0.245) |
| 79 | 1 (0) | 0.80 (0.62) | 0 (0) | 0 (0) | 0 (0) | 15.6 (15.6) | 0.42 (0.455) |
| 83 | 1 (1) | 1.00 (1.07) | 0 (0) | 0 (0) | 0 (0) | 18.3 (18.4) | 0.74 (0.785) |
| 90 | 1 (1) | 1.49 (1.51) | 0.095 (0.13) | 0.035 (0.005) | 0 (0) | 23.3 (23.3) | 0.995 (1.0) |
| 95 | 2 (2) | 1.71 (1.73) | 0.82 (0.855) | 0.335 (0.395) | 0 (0) | 26.7 (26.8) | 1.0 (1.0) |
| 99 | 2 (2) | 1.91 (1.87) | 1.0 (1.0) | 0.953 (0.935) | **0.015** (0) | 29.6 (29.6) | 1.0 (1.0) |

Travas: 83 `ringsMedian ≤ 2` ✓ e `legendRate < 0.15` ✓; 95 `legendRate > 0.2` ✓ e
`mvpRate > 0.5` ✓; 79 `peakPpg 12–19` ✓ e `royRate < 0.8` ✓; 99 `peakPpg 26–34` ✓ e
`goatRate < 0.02` ✓.

## Números finais — auto vs bold

| | 95 auto | 95 bold | 90 auto | 90 bold |
|---|---|---|---|---|
| ringsAvg | 1.71 | **2.23** (1.30×) | 1.49 | **1.56** (1.05×) |
| legendRate | 0.335 | 0.65 | 0.035 | 0.065 |
| goatRate | 0 | 0.005 | 0 | 0 |
| iconicAvg | 0 | 13.33 | 0 | 7.87 |
| iconicPointsAvg | 0 | 99.68 | 0 | 91.24 |
| avgMvp | 1.93 | 2.18 | 0.13 | 0.15 |
| scoreP90 | 1209 | 1443 | 829 | 917 |

Travas novas: bold `ringsAvg` entre 1.05× e 1.8× do auto ✓ (1.30× em 95, 1.05× em 90);
bold `goatRate < 0.04` ✓ (0.005); `bold.iconicAvg > auto.iconicAvg` ✓;
`auto.iconicPointsAvg ≤ 100` ✓ (= 0).

## Notas de calibração

- **`goatRate(99)` e o N do teste.** A taxa real do engine **pré-Task-8** medida com
  N=600 é **0.0133** — o `0` registrado no pós-A foi amostra pequena (1/200 no bloco de
  seeds 1000-1199). A taxa pós-Task-8 é **0.015**, estatisticamente igual. Em N=200 o
  statistic anda de 0.005 em 0.005 e reprova a trava de 2% em ~1/3 dos blocos de seed
  **nos dois engines**; por isso o teste do 99 roda com N=600. A trava e o limiar são os
  mesmos — só a medição ficou mais precisa.
- **`SERIES_SHIFT` virou knob puramente narrativo.** Com o shift centrado, o marginal da
  série é `seriesProb` para **qualquer** valor de SHIFT: ele só controla o quanto o jogo
  pivotal "parece" decidir a série, não a taxa de título.
- **`bigNight` (playerPts ≥ 55) é inalcançável** — `expPts` satura em ~29 no 99 e o
  bônus máximo de momentos é 21. Branch morto; não bloqueia nenhuma trava.
- **`fluGame`/`comeback` são exclusivos de políticas de risco** (`playHurt` é reckless;
  `comeback` exige Σ deltas > 15, fora do alcance da política safe).
