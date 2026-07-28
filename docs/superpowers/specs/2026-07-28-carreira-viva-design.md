# Spec — Carreira viva: curva de idade, aposentadoria por performance, eventos interativos + fix do glow

**Data:** 2026-07-28 · **Status:** aprovado em conversa (design travado)

## Objetivo

Quebrar a linearidade da carreira: rookie fraco → pico → declínio sentido, longevidade ligada ao físico, aposentadoria oferecida quando a produção cai (não só por idade), rol de eventos maior com 2 eventos interativos (escolha, sem minijogo). Inclui fix do bug visual do glow.

## 1. Fix do glow (bug v1)

`src/styles/base.css`: `.screen > *` (position: relative, regra posterior) sobrescreve o `position: absolute` de `.screen__glow` (mesma especificidade) → glow entra no fluxo e ocupa ~420px, empurrando o conteúdo (Home mede 810px num viewport de 700px). **Fix:** seletor do glow vira `.screen > .screen__glow` (0,2,0 vence 0,1,0). Nenhuma outra mudança visual.

## 2. Curva de carreira — `ageMultiplier(age, physical)`

Nova forma (mudança de contrato da v1 autorizada pelo dono):

```
age ≤ 26:  0.78 + (age − 19) × (0.22 / 7)     // 19 → 0.78, 26 → 1.0, linear
26 < age ≤ 29:  1.0                             // pico
age > 29:  max(0.60, 1.0 − (age − 29) × rate)   // piso 0.60
rate = clamp(0.035 − physical × 0.0002, 0.012, 0.035)
```

- Físico 99 → rate ≈ 0.0152 (−1.5%/ano); físico 60 → 0.023; físico ≤ 0 teórico → 0.035.
- Assinatura muda: `ageMultiplier(age: number, physical: number)`. Callers: `simRegularSeason`, `simPostseason`.
- Constantes calibráveis; forma nova é o novo contrato.
- Teste de calibração do GOAT gate (< 2% em 300 carreiras) precisa continuar passando — ajustar constantes de `season.ts` se a curva derrubar/inflar demais (só valores, não forma).

## 3. Aposentadoria escalonada por performance

- `peakPpg` = maior `ppg` da carreira até aqui; `ratio` = ppg da última temporada / `peakPpg`.
- Gatilhos no `ADVANCE` (além do atual `age ≥ 31`, que permanece):
  - `ratio < 0.75` **e** `career.seasons.length ≥ 5` → fase `retireDecision` (texto padrão).
  - `ratio < 0.55` (mesma condição de 5 temporadas) → `retireDecision` com narrativa extra: chave i18n "a imprensa especula sobre seu futuro" (variação do título/subtítulo da tela).
- Ordem de fases no `ADVANCE` preservada: verdict (>40) > free agency (contrato acabou) > retireDecision (idade OU ratio) > preseason.
- Botão de aposentar na Free Agency continua como hoje (31+); não expande.

## 4. Eventos

### 4.1 Passivos novos (entram no rol; máx 2 eventos/temporada mantido)

| id | rate | efeito |
|---|---|---|
| `hotstreak` | 0.10 | +2 ppg (contraparte de coldstreak; mutuamente exclusivos — se ambos rolarem, vale o primeiro) |
| `coachchange` | 0.08 | win% do time ±0.02 (sorteio 50/50 no ano) |
| `playoffspark` | 0.08 | se foi aos playoffs: +8 no clutch efetivo do roll de título/FMVP |
| `lockerroom` | 0.10 | interativo — efeitos definidos pela escolha (§4.2); em qualquer escolha, chance de trade offer no deadline sobe de 0.10 para 0.20 |

### 4.2 Interativos (máx 1/temporada; escolha ANTES do sim)

- **`injury` (vira interativo):**
  - *Voltar antes:* perde `rng.int(10, 18)` jogos, −2 ppg na temporada, e a próxima temporada tem chance de lesão multiplicada por 1.5 (flag `injuryProne` de 1 temporada no estado).
  - *Curar direito:* perde `rng.int(10, 35)` jogos (como hoje), sem sequela.
- **`lockerroom` (vira interativo):**
  - *Comprar a briga:* +6 clutch efetivo nos playoffs, −0.03 win%.
  - *Apaziguar:* +0.02 win%, sem malus.
- Foco `health` continua reduzindo a chance de lesão pela metade (aplicado antes do multiplicador de sequela).

### 4.3 Fluxo (mudança estrutural)

- `rollEvents` sai de dentro de `simRegularSeason` e roda no reducer (`PLAY_SEASON`), com os draws contados em `rngCalls`.
- `simRegularSeason` recebe `events` (e as escolhas resolvidas) como parâmetro.
- Se um evento interativo rolou: fase nova `eventDecision` (padrão do `tradeDecision`) com action `{ type: 'EVENT_DECISION'; choice: 'a' | 'b' }`; pendências no estado (`pendingEvent`, foco e contexto necessários para retomar). Depois da escolha, o sim roda normalmente (regular → possível trade → playoffs).
- Sem evento interativo: fluxo idêntico ao atual.
- UI: tela/painel de decisão do evento (nova seção na Season screen ou tela própria seguindo padrão do TradeDecision) — todas as strings i18n pt/en (título, descrição, 2 botões por evento).

## 5. Testes

- `ageMultiplier`: forma (0.78/1.0/piso 0.60), influência do físico na taxa, clamps.
- Aposentadoria: bandas 0.75/0.55, mínimo de 5 temporadas, gatilho de idade preservado, ordem de fases.
- Eventos: rates dos novos, máx 2/temporada, exclusão hotstreak×coldstreak, efeitos (ppg, win%, clutch eff, trade chance), `injuryProne` expira em 1 temporada.
- Fluxo `eventDecision`: determinismo por seed (replay com escolha), pendências limpas após decisão, no-ops seguros.
- i18n paridade pt/en; GOAT gate < 2% mantido (recalibrar constantes se preciso); e2e playthrough atualizado (lidar com possível tela de decisão de evento no caminho).

## Fora de escopo

Minijogos, leaderboard, mudanças no draft/verdict/offers além do citado, histórico de runs.
