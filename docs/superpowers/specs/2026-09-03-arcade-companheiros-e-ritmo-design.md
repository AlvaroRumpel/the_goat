# Arcade: companheiros reais na prancheta + ritmo enxuto — design

**Data:** 2026-09-03 · **Dono:** aprovou em chat (números: "Enxuto"). Sucede a decisão 28 (a–d) do HANDOFF.

## Problema

1. Na **prancheta**, os 4 companheiros são anônimos: camisas fixas `[4, 11, 23, 33]` (`Playbook.tsx`), arremesso de companheiro usa skill fixa 0,6 (`ASSIST_SKILL`), todo mundo corre na velocidade do jogador. Os defensores já são o quinteto real do adversário (`opponentFive`). Dono: "tem que simbolizar meus companheiros, com os atributos deles".
2. No **modo arcade** cada momento é um minigame de ~20–40 s. Hoje: 3–4 partidas-chave × 2–4 momentos na regular, 1 jogo pivotal por série nos rounds 0–2 (3–5 momentos) e finais bo7 com 4–5 momentos por jogo (até 35 minigames). Dono: "diminuir os momentos na partida e diminuir as partidas-chave" quando o modo é arcade.

## Escopo

Só modo arcade e só prancheta. Modos normal/goat/rápido intocados. Arremesso/muralha intocados (o marcador deles já é real). Calibração e contrato de RNG do save preservados **por construção** (ver §4).

## 1. Companheiros reais (`common.ts`, `playbook.ts`, `Playbook.tsx`, `Minigame.tsx`, `lab.tsx`)

### Dados
`league.players` já tem todos os jogadores de todos os times (`name`, `pos`, `ovr`, `tags`, `teamId`). O time do jogador é `state.currentOffer.teamId` na regular e `state.pendingPlayoffs.finalOffer.teamId` nos playoffs. Não há número de camisa nos dados.

### `MinigameProps.teamId: string`
Novo campo obrigatório. `Minigame.tsx` passa `state.pendingPlayoffs?.finalOffer.teamId ?? state.currentOffer!.teamId`. `lab.tsx` ganha select "Meu time" (default `lal`) ao lado de "Adversário".

### `teammates(league, teamId): Mate[]` (common.ts)
```ts
export interface Mate extends OppPlayer { number: number; skill: Record<'layup' | 'mid' | 'three' | 'dunk', number>; pass: number }
```
- Os 4 melhores por `ovr` do time (mesma ordenação de `opponentFive`: `ovr desc, id asc`), `toOpp` + campos novos. Rosters mudam de temporada em `league.players` → acompanha sozinho.
- `number`: determinístico por hash do `id` (soma dos char codes × 31 mod 46 + 10 → 10..55), estável por jogador. Colisão com a camisa do usuário: +1.
- `skill`: régua igual à do jogador: `base = clamp((ovr − 30) / 60, 0.25, 1)`; `three = base × (shooter ? 1.15 : 0.9)`, `mid = base × (shooter ? 1.05 : 1)`, `layup = base × (rebounder ? 1.1 : 1)`, `dunk = pos ∈ {PF, C} || ovr ≥ 75 ? layup : layup × 0.7`; tudo `clamp01`.
- `pass`: `playmaker ? 0.8 : 1` — multiplicador do risco de interceptação quando ELE é o **passador** (holder ≠ você). Passe de playmaker é mais seguro. Uma linha em `pass()`.
- `speed` já vem de `toOpp` (3,0–4,4 m/s).

### Engine (`playbook.ts`)
- `PlaybookInput.mates: Mate[]` (índices 1–4 dos `attackers`; 0 = você).
- `skillFor(optionId, input, holder)`: `holder === 0` → `input.skill[tipo]` (como hoje); senão `input.mates[holder − 1].skill[tipo]`. `ASSIST_SKILL` SAI. `optionId` continua `mgAssist` quando não é você (o catálogo do momento não muda).
- `step`: `runSpeed_i = i === 0 ? 4.2 × mods.speed : mates[i − 1].speed × 1.1` (companheiro de elite ≈ você em forma).
- `pass()`: `chance *= holder !== 0 ? mates[holder − 1].pass : 1`.
- Rebote/esquemas/bloqueio: intocados.

### UI (`Playbook.tsx`)
- Ímã do companheiro: número dele (`mate.number`) no lugar de `MATE_NUM`; etiqueta abaixo com `mate.short` (igual à dos defensores). `MATE_NUM` SAI.
- Sem cartão de atributos (ponytail): nome + número + o que acontece em quadra já contam a história.

### Testes
- `common.test.ts`: `teammates` devolve 4, ordenados, números estáveis e ∈ [10, 55] sem repetir a camisa do usuário; `shooter` tem `three` > não-shooter de mesmo ovr; `playmaker` tem `pass < 1`.
- `playbook.test.ts`: arremesso de companheiro usa a skill dele (dois inputs iguais exceto `mates[0].skill.three` → quality maior no maior); companheiro rápido percorre a rota antes do lento; `ASSIST_SKILL` não existe mais.

## 2. Ritmo enxuto no arcade (`moments.ts`, `state.ts`)

### Momentos por jogo
`baseCount(kind, arcade)`: arcade → regular 2, playoff 3, finais 3; senão 3/4/5 (como hoje). `momentCount(context, rng, arcade)` = `clamp(base + rng.int(−1, 1), 2, arcade ? 4 : 5)` — **1 call, sempre**. `makeMoments(context, rng, arcade = false)` e `startWatchedGame({ …, arcade })` propagam. `state.ts` passa `state.career.mode === 'arcade'` em `startWatchedKeyGame` e no início do jogo de playoff.

### Partidas-chave
`selectKeyGames({ …, arcade })`: arcade → `[rivalry, special]` (sem `seedRace`, sem o extra do evento de rivalidade). As **3 calls fixas continuam sendo consumidas** (o sorteio do especial acontece antes do corte). `buildCalendar` já consome 4 calls sempre e aceita < 4 jogos.

### Playoffs
Rounds 0–2 já são 1 jogo pivotal por série — ficam. Finais continuam bo7 jogo a jogo (a série é contrato de probabilidade); só os momentos por jogo caem (3 ± 1). `series.simAll` já existe pra quem quiser pular.

### Por que não mexe na calibração
- `momentWeight(n) = 3/n` → E[Σ deltas] invariante em n (decisão 16). Menos momentos = mesma expectativa de margem.
- `keyGameEffects` é centrado na expectativa de cada jogo (E = 0) e clampado → menos jogos = menos variância, mesma média.
- Calibração roda em modo normal (`tests/engine/calibration.test.ts`); arcade não entra nela. **Não re-rodar.**

### Contrato de RNG / save
- Nenhuma mudança na contagem de calls por caminho: `momentCount` 1 call, `selectKeyGames` 3, `buildCalendar` 4, `gameRngCalls(n) = 4n + 4` (já função de n).
- Replay: `rngCalls` persistido + `career.mode` persistido → determinístico. Save `thegoat:v7` sem bump; save arcade em andamento mantém o calendário já sorteado e passa a usar os números novos nos próximos jogos.

### Testes
- `moments.test.ts`: `momentCount` arcade ∈ [2, 4] com base 2/3/3, 1 call; normal inalterado.
- `state-arcade.test.ts`: temporada arcade tem 2 slots de key game (`rivalry` + `special`) e `rngCalls` bate com replay (load do save reproduz o estado); temporada normal segue com 3–4.
- e2e (`tests/e2e-playthrough.mjs`): se conta jogos-chave por modo, ajustar.

## Fora de escopo
Cartão de atributos dos companheiros; escolher quem entra em quadra; número de camisa real nos dados da liga; mexer em `SKILL_W`/probabilidade dos momentos.
