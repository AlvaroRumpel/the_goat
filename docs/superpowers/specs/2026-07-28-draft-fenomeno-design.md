# Spec — Draft Fenomeno: pool grande + roubo de atributo livre

**Data:** 2026-07-28 · **Status:** aguardando aprovação de design (claude-design)

## Objetivo

Substituir o draft atual (8 confrontos fixos, 2 lendas por slot, malus fixo) por um sistema estilo The Fenomeno: pool grande de jogadores da história da NBA, sorteio de 1 jogador por rodada, usuário escolhe **qual atributo roubar**, penalidade dinâmica e leve.

## Decisões (aprovadas pelo dono)

1. **Modelo:** RNG sorteia 1 jogador por rodada (independente dos atributos dele); usuário escolhe qual atributo ainda vazio rouba; **reroll 1x por draft** (troca o jogador da rodada).
2. **Pool:** ~200 jogadores curados de todas as eras, dataset estático — **sem API em runtime** (82-0 também usa dataset estático derivado de box-scores; API quebraria replay determinístico e custaria dinheiro).
3. **Penalidade híbrida e leve:** alvo = atributo mais fraco do jogador roubado (excluindo o roubado); tamanho escala com valor roubado.
4. **Times:** mantém os 30 atuais. Season/verdict/offers intocados.

## 1. Dados — `src/data/players.ts`

- ~200 jogadores, cada um: `id`, `name`, `era` (tag, ex: "90s"), `attrs: Record<SlotId, number>` (8 atributos, 40–99).
- **Curadoria direta** (notas estilo 2K escritas à mão/geradas pelo assistente), não pipeline stats→ratings — handles/clutch não derivam de box-score.
- `legends.ts` removido.
- Sem fotos/logos reais (regra do projeto); nomes ok.

## 2. Engine — `src/engine/draft.ts`

- `drawPlayer(rng, drawnIds)`: sorteia do pool sem repetição.
- 8 rodadas; cada rodada preenche 1 dos 8 slots ainda vazios.
- Reroll consome 1 draw do RNG (contado em `rngCalls`).
- **Malus:** `target = atributo mais fraco do jogador roubado (excluindo o slot roubado)`; `malus = clamp(round((valor − 71) / 6), 1, 5)` → 99→5, 93→4, 83→2, 77→1. Constantes calibráveis; forma da fórmula é contrato.
- Maluses aplicados após as 8 bases; piso 40 mantido.
- `computeOverall`, `computeArchetype`, shape de `Build.attributes` inalterados.
- `Build.picks` vira `{ playerId, slot }[]`.

## 3. State / save

- Actions novas: `DRAFT_ROLL`, `DRAFT_REROLL`, `DRAFT_STEAL { slot }`.
- Todos os draws contados em `rngCalls` (replay por seed preservado).
- Save key: `thegoat:v1` → `thegoat:v2` (shape de picks incompatível; save antigo ignorado, começa limpo).

## 4. UI — `src/ui/screens/AttrDraft.tsx`

- Card do jogador sorteado: nome, era, 8 atributos visíveis.
- Atributos de slots já preenchidos desabilitados.
- Preview do malus ao focar/tocar num atributo antes de confirmar (ex: "Roubar 99 Três → −5 Físico").
- Botão reroll (1 uso, some depois).
- Progresso "Rodada X/8".
- Todas as strings via i18n pt/en (paridade testada).
- **Mockup no claude-design (projeto "The GOAT") aprovado pelo dono antes de implementar.**

## 5. Testes

- `draft.test.ts`: sem repetição de jogador; reroll único; malus alvo = fraqueza excluindo slot roubado; escala da fórmula; piso 40; determinismo por seed.
- Sanity do dataset: ~200 entradas, ids únicos, attrs 40–99, cada atributo com ≥ 8 jogadores fortes (≥90) — draft viável em qualquer seed.
- Calibração: teste existente do GOAT gate (< 2% em 300 carreiras) continua valendo.

## Fora de escopo

Times históricos, mudanças em season.ts/verdict.ts/offers.ts, fotos, leaderboard.
