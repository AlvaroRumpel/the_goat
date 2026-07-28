# Calibração de Médias (rodada 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Médias por jogo realistas por faixa de overall (79 ≈ 14–17 pts, não 21), com prêmios e tiers revalidados em cascata e trava ampliada.

**Architecture:** Mesma infra da rodada 1 — harness em `tests/engine/calibration.test.ts` (`CALIBRATE=1 ... --disableConsoleIntercept` imprime). Sobe o piso de referência (`− 40` → ~`− 48/50`) nas 3 fórmulas de médias em `simRegularSeason`; se prêmios saírem do alvo, ajusta thresholds de allstar/scoring/mvp em `simPostseason`. Só constantes.

**Tech Stack:** vitest, engine existente. Sem dependência nova.

## Global Constraints

- Só constantes — forma das fórmulas é contrato. GOAT gate intocado. `verdict.ts` só se estritamente necessário (não esperado).
- Alvos de médias no pico (build flat, 26–29): 79 → ppg 14–17, reb 8–10 (c/ bônus arq. do harness SF: sem bônus), ast 5–6.5; 83 → 17–19; 90 → 22–25; 99 → 28–31.
- Cascata: All-Star raro em 79, comum em 90+; travas rodada 1 (83: anéis mediana ≤2, legend <15%; 95: legend >20%) e GOAT <2% continuam verdes.
- Trava nova: asserts folgados de ppg de pico por faixa (79: 12–19; 99: 26–34).
- Antes de commit: `npx vitest run` + `npx tsc -p tsconfig.app.json --noEmit` verdes. Flake conhecido: primeira run pós-install pode dar "no tests" — re-rodar.
- Spec: `docs/superpowers/specs/2026-07-28-calibracao-medias-design.md`.

---

### Task 1: Calibrar médias + cascata + trava

**Files:**
- Modify: `src/engine/season.ts` (constantes das 3 fórmulas de médias em `simRegularSeason`; se preciso, thresholds de awards em `simPostseason`)
- Modify: `tests/engine/calibration.test.ts` (relatório ganha médias de pico; asserts novos)
- Modify: `tests/engine/season.test.ts` (expectativas numéricas que dependam das constantes antigas — atualizar valores, nunca relaxar)
- Modify: `HANDOFF.md` (item 9 ganha a rodada 2 com constantes finais)

**Interfaces:**
- Consumes: harness existente (`simCareer`, `flatBuild`, `distribution`) em `calibration.test.ts`.
- Produces: `distribution()` passa a reportar também `peakPpg`/`peakRpg`/`peakApg` médios (média das temporadas de idade 26–29 sobre as N carreiras).

- [ ] **Step 1: Ampliar o harness (falhando)**

Em `tests/engine/calibration.test.ts`, dentro de `distribution(overall)`, calcular médias de pico: para cada carreira, média de ppg/rpg/apg das temporadas com `age` entre 26 e 29; agregar média sobre as N carreiras e expor `peakPpg`, `peakRpg`, `peakApg` no objeto retornado (precisa dos `SeasonResult`s — usar `verdicts` não basta; guardar também as careers ou computar dentro de `simCareer` e retornar `{ verdict, peak: {ppg,rpg,apg} }`; ajustar chamadas). Adicionar asserts:

```ts
test('79 overall: médias de pico realistas', () => {
  const d = distribution(79)
  if (process.env.CALIBRATE) console.log('79:', JSON.stringify(d, null, 2))
  expect(d.peakPpg).toBeGreaterThanOrEqual(12)
  expect(d.peakPpg).toBeLessThanOrEqual(19)
}, 30000)
test('99 overall: elite pontua como elite', () => {
  const d = distribution(99)
  if (process.env.CALIBRATE) console.log('99:', JSON.stringify(d, null, 2))
  expect(d.peakPpg).toBeGreaterThanOrEqual(26)
  expect(d.peakPpg).toBeLessThanOrEqual(34)
}, 30000)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `CALIBRATE=1 npx vitest run tests/engine/calibration.test.ts --disableConsoleIntercept`
Expected: FAIL no caso 79 (peakPpg ~21 > 19). Anotar baseline (79/83/90/99).

- [ ] **Step 3: Tuning**

Em `simRegularSeason`, ponto de partida:

```ts
let ppg = clamp((scoringRt - 49) * 0.55 + (rng.next() * 3 - 1.5), 4, 38)
let rpg = clamp((0.55 * eff('rebounding') + 0.30 * eff('physical') + 0.15 * eff('finishing') - 48) * 0.22, 2, 16)
let apg = clamp((0.60 * eff('passing') + 0.40 * eff('handles') - 48) * 0.18, 1, 12)
```

Iterar com o relatório até os alvos do spec. Se 99 ficar abaixo de 28, subir o multiplicador do ppg (0.55 → até 0.62) mantendo 79 na faixa. Depois conferir cascata no mesmo relatório: allstarRate por faixa (adicionar ao `distribution` se útil), tiers, anéis. Se All-Star sumir em 90+ ou continuar comum em 79, ajustar thresholds em `simPostseason` (`ppg >= 20` allstar / `>= 29` scoring / `>= 26` mvp) proporcionalmente à nova régua (ex.: 18/26/23). Máx ~6 iterações, logar cada uma no report.

- [ ] **Step 4: Consertar expectativas antigas**

`tests/engine/season.test.ts`: testes com valores numéricos de ppg/rpg/apg dependentes das constantes antigas — atualizar números esperados. Nunca `toBeTruthy`.

- [ ] **Step 5: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS — incluindo travas rodada 1 e GOAT <2%. Se a trava de legend de 95 quebrar (score caiu com médias menores), reportar as distribuições e ajustar threshold `legend` em `verdict.ts` (950 → valor que o harness validar) — última alternativa, documentar.

- [ ] **Step 6: HANDOFF**

Item 9 das Decisões-chave ganha parágrafo da rodada 2: constantes finais das médias (e thresholds de awards se mudados), alvos atingidos por faixa.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: calibração rodada 2 — médias por jogo realistas por faixa de overall"
```
