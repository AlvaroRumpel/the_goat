# Spec — Calibração rodada 2: médias por jogo

**Data:** 2026-07-28 · **Status:** aprovado em conversa

## Contexto

Playtest pós-rebalance: 79 de overall com 21.1 pts / 11.4 reb / 8.2 ast aos 28 — linha de superstar num overall de titular comum. Régua das médias é generosa no meio da tabela: as três fórmulas usam piso de referência `− 40` (`ppg = (scoringRt − 40) × 0.55`, `rpg = (mix − 40) × 0.22`, `apg = (mix − 40) × 0.18`), então 79 flat rende ~21/8.6+arq/7.

## Mudança (só constantes; forma intocada)

Subir o piso de referência das três fórmulas de `40` para ~`48–50` (valor final decidido pelo harness), mantendo os multiplicadores — ajustar multiplicador só se necessário para o topo (99 ovr) ficar nos alvos.

## Alvos (política do harness: carreira até 40, foco scoring, build flat)

| Overall flat | ppg no pico (26–29) | reb (com bônus arq.) | ast |
|---|---|---|---|
| 79 | ~14–17 | ~8–10 | ~5–6.5 |
| 83 | ~17–19 | — | — |
| 90 | ~22–25 | — | — |
| 99 | ~28–31 | — | — |

Cascata a revalidar (mesmo harness):
- All-Star por temporada: raro em 79, comum em 90+ — se sumir demais, ajustar threshold `ppg >= 20` do allstar em `simPostseason` (constante) para acompanhar a nova régua (idem `scoring` 29, `mvp` 26).
- Tiers: 83 ovr continua mediana allstar/superstar-baixo, legend < 10%; 95 legend > 20%; GOAT < 2% (travas existentes).
- Anéis: travas da rodada 1 continuam verdes.

## Trava

Ampliar `tests/engine/calibration.test.ts`: asserts de médias no pico por faixa (folgados, ex.: 79 flat → ppg pico entre 12 e 19; 99 flat → entre 26 e 34) + manter travas existentes.

## Fora de escopo

Forma das fórmulas, GOAT gate, UI, i18n.
