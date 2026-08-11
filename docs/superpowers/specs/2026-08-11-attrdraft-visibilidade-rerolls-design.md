# AttrDraft: atributos visíveis + 2 sorteios extras

Data: 2026-08-11
Escopo: tela de draft de atributos (`AttrDraft`), engine de draft, estado do reroll.

## Problema

Durante as 8 rodadas do draft de atributos o jogador não enxerga a própria build:

1. A coluna "SEU VALOR APÓS O ROUBO" (`draft.legend`) existe na UI, mas `AttrDraft.tsx:148` passa
   `yours: '—'` fixo — nunca mostrou número nenhum.
2. Slot já roubado vira linha riscada com `—` no lugar do valor. O atributo que você conquistou
   some da tela na rodada seguinte.
3. `projectedOvr` (`AttrDraft.tsx:39-44`) soma os valores crus do doador e ignora o malus, então
   o "OVR PROJETADO" exibido não é o OVR que a build vai ter.

Além disso o draft dá **um** sorteio extra por partida (`rerollUsed: boolean`). O dono quer dois.

## Restrição que molda a solução

Mid-draft não existe build resolvida: `resolveBuild` só roda na rodada 8 (`state.ts:648`). Um slot
ainda não roubado não tem valor — mas pode já carregar **penalidade pendente**, porque o malus de um
pick anterior cai no `weakestSlot` do doador, que pode ser um slot vazio. `resolveBuild` chamado com
picks parciais produziria `NaN` nesses slots (`Math.max(40, undefined - n)`).

## Design

### 1. Engine — `draftAttrs` como fonte única (`src/engine/draft.ts`)

```ts
export function draftAttrs(picks: DraftPick[]): {
  owned: Partial<Record<SlotId, number>>   // slots já roubados, pós-malus
  pending: Record<SlotId, number>          // malus já direcionado a slot ainda vazio
}
```

Regra:
- para cada pick, `base[slot] = doador.attrs[slot]`
- para cada pick, `penalty[weakestSlot(doador, pick.slot)] += malusAmount(doador.attrs[pick.slot])`
- `owned[slot] = max(40, base[slot] - penalty[slot])` para slots roubados
- `pending[slot] = penalty[slot]` para slots ainda vazios

`resolveBuild` passa a consumir `draftAttrs` em vez de repetir o loop de malus. A lógica de malus
segue existindo em um lugar só. Com os 8 picks o resultado é idêntico ao atual: o clamp em 40 faz
a subtração sequencial e a somada convergirem (qualquer excesso é cortado no piso).

### 2. UI — duas colunas em toda linha (`src/ui/screens/AttrDraft.tsx`)

Linha **não roubada**:
- número grande = valor da lenda (inalterado)
- sublinha = `draft.yours` com `legend: X` e `yours: max(40, X - pending[slot])` — o valor que de
  fato fica seu se roubar aquele slot agora

Linha **já roubada**:
- sai o `text-decoration: line-through` e o `—`
- número grande = seu valor atual (`owned[slot]`)
- sublinha mantém `draft.ownedRound`; quando houve malus, acrescenta o valor de origem
  (nova chave `draft.ownedFrom`, ex.: `85 · ERA 88`)
- segue com opacidade reduzida e sem clique

Modo **GOAT**: valores da lenda continuam `??`. Só os slots já roubados mostram o valor do jogador —
o modo esconde o número da carta, não a build que você já montou.

`projectedOvr` passa a usar `draftAttrs` (valores pós-malus), mantendo o denominador atual
(`picks.length + 1`).

### 3. Reroll — contador de 2 (`src/state.ts`)

- `rerollUsed: boolean` → `rerollsLeft: number`, inicia em `2` (`state.ts:189`)
- `DRAFT_REROLL` (`state.ts:658`) decrementa; no-op quando `rerollsLeft === 0`, quando a fase não é
  `attrDraft` ou no modo GOAT (regras atuais preservadas)
- botão desabilita em 0; label mostra quantos restam
- save mid-draft antigo: no bloco de defaults do `loadState`,
  `parsed.rerollsLeft = parsed.rerollsLeft ?? (parsed.rerollUsed ? 1 : 2)`

i18n (PT + EN):
- `draft.reroll` ganha `{n}` (plural: "Sortear outro jogador · {n} restantes")
- nova `draft.rerollOne` para o singular ("Sortear outro jogador · 1 restante")
- `draft.rerollUsed` inalterada
- nova `draft.ownedFrom`

### 4. Testes

- `draftAttrs`: malus pendente em slot vazio; clamp em 40; igualdade com `resolveBuild` nos 8 picks
- reducer: dois rerolls consecutivos passam, o terceiro é no-op; GOAT segue no-op
  (`tests/state.test.ts:91` e `:441` precisam ser atualizados — hoje afirmam `rerollUsed`)
- `loadState`: save com `rerollUsed: true` migra para `rerollsLeft: 1`
- paridade de chaves i18n já é coberta pelo teste existente

## Fora de escopo

`season.ts` e `verdict.ts` não são tocados. O reroll extra consome mais RNG, mas a suíte de
calibração injeta build pronta e não passa pelo draft — as travas de distribuição não se movem.
