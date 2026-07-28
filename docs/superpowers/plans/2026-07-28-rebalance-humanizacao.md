# Rebalance + Humanização Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Títulos e tiers calibrados (83 overall ≈ 1 anel de mediana, legend raro) com trava de regressão, e textos i18n sem cara de IA.

**Architecture:** Harness de calibração vive DENTRO do vitest (`tests/engine/calibration.test.ts`) — asserts folgados são a trava; `CALIBRATE=1` imprime distribuições para o tuning. Constantes ajustadas em `season.ts` (titleProb) e, se preciso, `verdict.ts` (points/κ, threshold legend). Humanização é passada manual guiada pela skill `humanizer` nos dois JSONs de i18n. (Desvio consciente do spec §A: o spec cita `tools/calibrate.mjs` mas autoriza explicitamente a alternativa via vitest — escolhida por não exigir toolchain TS extra.)

**Tech Stack:** vitest, engine puro existente. Sem dependência nova.

## Global Constraints

- Calibração ajusta SÓ constantes — forma das fórmulas é contrato. GOAT gate (score ≥ 1950 + gate icônico em `verdict.ts`) NÃO muda.
- Alvos (spec §A): 83 overall até os 40/foco scoring → mediana 1 anel, p90 ≤ 3, legend < 10%; 95 overall → legend > 20%; MVP raro < 88; GOAT < 2% (teste existente).
- Trava (asserts): build 83 → mediana anéis ≤ 2 E legend < 15%; build 95 → legend > 20%. Tolerâncias folgadas de propósito.
- i18n: chaves e placeholders (`{n}`, `{slot}`, `{name}`, `{age}`, `{team}`, `{year}`, `{archetype}`) intocados; paridade pt/en testada; PT e EN nativos, não tradução literal.
- Antes de cada commit: `npx vitest run` + `npx tsc -p tsconfig.app.json --noEmit` verdes. (Primeira run pós-install pode falhar espúrio com "no tests" — rodar de novo uma vez.)
- Engine puro: sem Math.random; RNG via `createRng(seed)`.
- Spec: `docs/superpowers/specs/2026-07-28-rebalance-humanizacao-design.md`.

---

### Task 1: Harness de calibração + tuning + trava

**Files:**
- Create: `tests/engine/calibration.test.ts`
- Modify: `src/engine/season.ts` (constantes do titleProb), possivelmente `src/engine/verdict.ts` (points/κ, threshold legend)
- Modify: `tests/engine/season.test.ts` (expectativas dos testes `recordingRng` de titleProb, se hardcodam as constantes antigas)
- Modify: `HANDOFF.md` (constantes finais + como rodar calibração; sem script npm novo — comando bash direto)

**Interfaces:**
- Consumes: `createRng`, `rollEvents`, `autoResolve`, `simRegularSeason`, `simPostseason`, `computeVerdict`, `makeOffers`, `teamById`, tipos `Build`, `SeasonResult`.
- Produces: helper local `simCareer(build: Build, seed: number): Verdict` (política fixa; não exportado do engine — vive no teste).

- [ ] **Step 1: Escrever o harness + testes-trava (falhando nos alvos)**

`tests/engine/calibration.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { createRng } from '../../src/engine/rng'
import { autoResolve, rollEvents } from '../../src/engine/events'
import { simPostseason, simRegularSeason } from '../../src/engine/season'
import { computeVerdict } from '../../src/engine/verdict'
import { makeOffers } from '../../src/engine/offers'
import { teamById } from '../../src/data/teams'
import { SLOT_ORDER, type Build, type Career, type SlotId, type Tier } from '../../src/engine/types'

function flatBuild(overall: number): Build {
  const attrs = Object.fromEntries(SLOT_ORDER.map(s => [s, overall])) as Record<SlotId, number>
  return { attributes: attrs, picks: [], archetype: 'SF', overall }
}

// política fixa do spec: até os 40, foco scoring, 1ª oferta a cada 4 anos,
// sem trades, escolha segura nos eventos interativos
function simCareer(build: Build, seed: number) {
  const rng = createRng(seed)
  const career: Career = { seasons: [], fame: 0 }
  let offer = makeOffers(rng)[0]
  let contractYears = 4
  let injuryProne = false
  for (let age = 19; age <= 40; age++) {
    if (contractYears === 0) {
      offer = makeOffers(rng, offer.teamId)[0]
      contractYears = 4
    }
    const team = teamById(offer.teamId)
    const events = rollEvents(rng, 'scoring', injuryProne)
    injuryProne = false
    const choices = autoResolve(events)
    const regular = simRegularSeason({
      build, age, team, profile: offer.profile, focus: 'scoring', rng,
      canTrade: false, events, choices,
    })
    const season = simPostseason({ build, regular, team, focus: 'scoring', rng })
    career.seasons.push(season)
    if (season.events.includes('viral')) career.fame += 10
    if (offer.profile === 'bigmarket') career.fame += 2
    contractYears--
  }
  return computeVerdict(career)
}

const N = 200

function distribution(overall: number) {
  const verdicts = Array.from({ length: N }, (_, i) => simCareer(flatBuild(overall), 1000 + i))
  const rings = verdicts.map(v => v.counts.ring).sort((a, b) => a - b)
  const tiers = verdicts.map(v => v.tier)
  const rate = (t: Tier) => tiers.filter(x => x === t).length / N
  return {
    ringsMedian: rings[Math.floor(N / 2)],
    ringsP90: rings[Math.floor(N * 0.9)],
    mvpRate: verdicts.filter(v => v.counts.mvp > 0).length / N,
    legendRate: rate('legend') + rate('goat'),
    goatRate: rate('goat'),
    tiers: Object.fromEntries(
      (['peladeiro', 'rolePlayer', 'starter', 'allstar', 'superstar', 'legend', 'goat'] as Tier[])
        .map(t => [t, rate(t)]),
    ),
    avgPoints: Math.round(verdicts.reduce((n, v) => n + v.totals.points, 0) / N),
  }
}

describe('calibração de dificuldade (política: até 40, foco scoring)', () => {
  test('83 overall: anéis raros, legend raro', () => {
    const d = distribution(83)
    if (process.env.CALIBRATE) console.log('83:', JSON.stringify(d, null, 2))
    expect(d.ringsMedian).toBeLessThanOrEqual(2)
    expect(d.legendRate).toBeLessThan(0.15)
  }, 30000)
  test('95 overall: legend alcançável', () => {
    const d = distribution(95)
    if (process.env.CALIBRATE) console.log('95:', JSON.stringify(d, null, 2))
    expect(d.legendRate).toBeGreaterThan(0.2)
  }, 30000)
  test('relatório completo (só com CALIBRATE=1)', () => {
    if (!process.env.CALIBRATE) return
    for (const ov of [75, 90]) console.log(`${ov}:`, JSON.stringify(distribution(ov), null, 2))
  }, 60000)
})
```

- [ ] **Step 2: Rodar e ver falhar no estado atual**

Run (Git Bash): `CALIBRATE=1 npx vitest run tests/engine/calibration.test.ts`
Expected: FAIL no caso 83 (mediana de anéis > 2 e/ou legendRate ≥ 0.15 com as constantes atuais — é o bug do playtest). Anotar as distribuições impressas como baseline.

- [ ] **Step 3: Tuning iterativo das constantes**

Em `src/engine/season.ts`, no `simPostseason`, ajustar SÓ os números do titleProb (forma intocada):

```ts
const titleProb = madePlayoffs
  ? clamp((winPct - 0.5) * 0.5 + (effClutch - 75) * 0.003, 0.01, 0.28)
  : 0
```

Loop: rodar `CALIBRATE=1 npx vitest run tests/engine/calibration.test.ts`, comparar com os alvos do spec (83 → mediana 1, p90 ≤ 3, legend < 10%; 95 → legend > 20%; MVP raro em 75/83). Se anéis calibrados mas legendRate de 83 ainda alto por pontos acumulados: em `verdict.ts` trocar `points / 400` por `points / 500`; se ainda alto, threshold `legend` de `950` para `1100`. Se 95 ficar SEM legend alcançável, recuar o último ajuste. Máximo ~6 iterações; anotar cada rodada no report. GOAT gate: não tocar em `1950` nem no gate icônico.

- [ ] **Step 4: Consertar expectativas de testes existentes que hardcodam as constantes antigas**

`tests/engine/season.test.ts` — os testes determinísticos de titleProb (`recordingRng`) recomputam o valor esperado; se usam as constantes antigas (0.9/0.004/0.45), atualizar os números esperados para as novas constantes. NUNCA relaxar os asserts para "toBeTruthy".

- [ ] **Step 5: Suite completa + typecheck**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS — incluindo `verdict.test.ts` (GOAT < 2%) e os dois asserts de calibração.

- [ ] **Step 6: HANDOFF**

Em `HANDOFF.md`: na seção Comandos adicionar `CALIBRATE=1 npx vitest run tests/engine/calibration.test.ts  # relatório de distribuições (bash)`; nas Decisões-chave, item 9: "**Rebalance** (2026-07-28): titleProb recalibrado (constantes finais: <valores>), alvos: 83 ovr ≈ mediana 1 anel/legend <10%, 95 ovr legend >20%. Trava em `calibration.test.ts`. Spec `2026-07-28-rebalance-humanizacao-design.md`." (Preencher <valores> com o resultado real do tuning.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: rebalance de títulos e tiers — titleProb recalibrado + trava de calibração"
```

---

### Task 2: Humanização dos textos i18n

**Files:**
- Modify: `src/data/i18n/pt.json`, `src/data/i18n/en.json`
- Create: (nenhum arquivo novo de código; amostra vai no report)

**Interfaces:**
- Consumes: skill `humanizer` em `C:\Users\alvar\.claude\skills\humanizer\SKILL.md` — LER antes de editar; aplicar os padrões dela (remover inflated symbolism, promotional language, rule of three, vocabulário genérico de IA, paralelismos vazios, filler).
- Produces: os mesmos key sets nos dois JSONs (paridade), placeholders intactos.

- [ ] **Step 1: Ler a skill e os dois JSONs inteiros**

Ler `C:\Users\alvar\.claude\skills\humanizer\SKILL.md`, depois `src/data/i18n/pt.json` e `en.json` completos. Listar (mentalmente/report) as strings com cara de IA — candidatos típicos: descrições de foco, eventos, veredito, hints.

- [ ] **Step 2: Reescrever as strings**

Regras:
- Voz: arquibancada/locução de basquete — direta, concreta, com personalidade. Ex. (ilustrativo, não prescritivo): `"event.coldstreak": "Fase fria — arremessos não caíram"` pode virar `"Mês inteiro sem a bola entrar. Acontece."` se soar mais humano; o implementador julga string a string.
- PT e EN cada um nativo no seu idioma (não traduzir literalmente).
- NUNCA tocar em chave, ordem das chaves, ou placeholders `{...}`.
- Strings que já estão boas ficam como estão — mudar por mudar é ruído.
- Termos de basquete consagrados em inglês (clutch, playoffs, MVP, All-Star) ficam em inglês no PT.

- [ ] **Step 3: Rodar suite (paridade + tudo)**

Run: `npx vitest run && npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS (o teste de paridade i18n pega chave quebrada; nenhum outro teste depende do TEXTO das strings)

- [ ] **Step 4: Gerar amostra para revisão do dono**

No report da task, incluir tabela com as ~10 mudanças mais significativas (chave, antes, depois, pt e en) — o dono revê antes do merge (gate do spec §B).

- [ ] **Step 5: Commit**

```bash
git add src/data/i18n/pt.json src/data/i18n/en.json
git commit -m "feat: textos humanizados — voz de arquibancada, sem cara de IA"
```
