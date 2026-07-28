# Liga Viva — Design (Sub-projeto A da v2 "imersão")

**Data:** 2026-07-28 · **Status:** aprovado em brainstorm, aguardando revisão final do spec
**Contexto:** primeira metade da versão "imersão". Sub-projeto B (motor de momentos: jogos assistidos, playoffs jogo a jogo, finais com decisões) terá spec próprio e depende deste.

## Objetivo

Substituir a liga abstrata por uma liga concreta de 30 times com jogadores reais: tabela visível, corridas de prêmios (MVP/DPOY/ROY/MIP) contra candidatos nomeados, trades entre times, envelhecimento de NPCs e OVR efetivo do jogador visível ao longo da carreira.

## Decisões de escopo (aprovadas no brainstorm)

- Profundidade **média**: 8–10 jogadores por time com dados compactos (não os 8 atributos completos).
- Liga inicial = **NBA ~2025** (snapshot estático). Após alguns anos, draft gera fictícios e liga vira mista.
- Rival de carreira: **fora** (v3).
- Momentos icônicos no score: pertence ao sub-projeto B.
- GOAT gate e fórmulas travadas: **intocados** (handoff, decisões 1, 7–9b).

## 1. Dados

- Novo `src/data/league.ts`: 30 times × 9 jogadores reais (~270 registros).
- Registro compacto por NPC: `id`, `name`, `pos`, `age` (em 2025), `ovr` (régua 40–99, mesma escala do jogador), `tags` (0–3 de: `shooter`, `defender`, `playmaker`, `rebounder`, `rookie`).
- Elencos aproximados 2024-25 (Jokic/DEN, SGA/OKC, Wemby/SAS…). Nomes reais ok; **sem fotos/logos** (decisão 6 do handoff).
- `src/data/players.ts` (draft de lendas) **intocado** — datasets separados, propósitos separados.
- Ids de `league.ts` viram contrato do save v3 (mesma regra da decisão 7: renomear/remover id exige bump de save key).
- Draft anual (após temporada 1): rookies fictícios via gerador de nomes seedado (RNG contado), sem colidir com nomes reais do dataset.

## 2. Sim da liga (`src/engine/league.ts`)

TS puro, zero React, RNG injetado, calls contadas (contrato de replay, decisão 3).

- **Força de time** = f(OVR efetivo dos 9+ jogadores, peso maior no top 3). No seu time, seu OVR efetivo entra na conta junto com 8 NPCs.
- **Regular season:** sem jogo a jogo — record de 82 jogos por força + ruído. 2 conferências de 15, seeds 1–8 classificam.
- **Playoffs:** bracket real simulado série a série (1×8, 2×7…), campeão concreto todo ano. Pré-requisito do sub-projeto B e das narrativas ("perdeu pro OKC nas conf finals").
- **Calibração (crítico):** `titleProb = clamp((winPct − 0.5) × 0.22 + (effClutch − 75) × 0.0015, 0.01, 0.16)` deixa de decidir anel direto e passa a alimentar a **probabilidade por série** (p_série ≈ titleProb^(1/4), ajustada pela força do adversário), de modo que a chance agregada de anel por faixa de OVR bata nos alvos travados (83 ovr ≈ mediana 1 anel / p90 3; 95 ovr legend 68.5%). Forma da fórmula preservada; `tests/engine/calibration.test.ts` segue como trava de regressão e ganha asserção de equivalência da chance agregada.
- Fórmulas de stats pessoais (`ppg/rpg/apg` em `simRegularSeason`) **intocadas**. Única mudança de origem: `winPct` do seu time vem da liga (força de elenco real) em vez de rolagem abstrata.

## 3. Prêmios e corridas

- **Stats de NPC:** linha por temporada (ppg/rpg/apg compactos) derivada de OVR + tags + rng.
- **MVP:** ranking único (você + NPCs) = stats + winPct do time. Os thresholds atuais (ppg≥23 + gate de winPct/rng em `simPostseason`) viram o modelo do ranking; a frequência de MVP do jogador por faixa de OVR não pode regredir (trava no harness).
- **DPOY:** atributo de defesa do jogador vs NPCs com tag `defender`. Só compete quem tem build defensivo.
- **ROY:** apenas ano 1 do jogador (vs NPCs `rookie` do dataset; depois, classes fictícias anuais).
- **MIP:** maior salto de OVR/stats ano a ano — a curva de idade (0.78→1.0) coloca o jogador jovem na corrida naturalmente.
- **All-Star e scoring title** existentes continuam, agora com concorrentes nomeados.
- **Checkpoint meio de temporada:** a fase de deadline (existente) mostra tabela parcial + top-5 de cada prêmio com stats parciais (~50% da temporada, mesmo sim escalado).
- Fim de temporada: vencedores anunciados e guardados por ano (histórico alimenta card/veredito).

## 4. Trades e envelhecimento

**Trades da liga:**
- Offseason + deadline: 2–4 trades entre NPCs por ano — valor aproximado com viés de contexto (contender busca estrela; lanterna troca veterano por jovem). Viram manchetes narrativas.
- `offers.ts`: ofertas ao jogador (deadline/free agency) passam a vir de times concretos — arquétipos contender/rebuild/bigmarket derivados da tabela real. O elenco do time ofertante é visível.

**Envelhecimento:**
- NPCs seguem curva de mesma forma que a do jogador (sobe jovem, pico 26–29, declínio). OVR < 65 ou idade ~38 → aposenta; vaga vai para rookie fictício do draft.
- **OVR efetivo do jogador:** `effectiveOverall(attrs, age, physical)` = base × `ageMultiplier` existente. Display puro — nenhuma fórmula muda. Visível na tela de temporada + sparkline da curva da carreira. Liga inteira usa a mesma régua.

## 5. UI

Mobile-first; toda string via i18n pt+en (paridade testada).

- Tela de temporada com abas: **Tabela** (2 conferências, seu time destacado), **Corridas** (top-5 por prêmio), **Você** (OVR efetivo + sparkline).
- Deadline enriquecido: tabela + corridas parciais antes da decisão.
- Fim de temporada: cerimônia de prêmios (vencedores nomeados; destaque se você ganhou ou perdeu por pouco) + bracket resolvido.
- Manchetes de trades no offseason.

## 6. Save e replay

- Save key `thegoat:v2` → **`thegoat:v3`**. Estado da liga entra no save (elencos, idades, histórico de tabela/prêmios/campeões). Saves v2 descartados (mesmo tratamento do v1→v2 — carreira é curta, migração não paga o custo).
- Tamanho ok para localStorage (~300 NPCs compactos).
- RNG: liga consome calls dentro do fluxo fixo do reducer; replay determinístico preservado. Nenhum sim fora do fluxo contado.

## 7. Testes

- Vitest só em engine/state/data (regra do projeto): unidades novas (`league.ts`, awards, trades, envelhecimento) + travas de calibração (chance agregada de anel, frequência de MVP, distribuição de records da liga plausível).
- Paridade i18n cobre chaves novas automaticamente.
- Playthrough e2e manual (`node tests/e2e-playthrough.mjs`) atualizado para as novas fases/abas.

## Riscos

1. **Calibração do bracket**: converter titleProb em probabilidades por série sem mover os alvos travados é o maior risco técnico. Mitigação: asserção de equivalência agregada no harness antes de qualquer UI.
2. **Volume de RNG calls**: cresce por temporada (liga inteira). Sem problema funcional, mas replay fica mais sensível a qualquer call fora de ordem — disciplina redobrada no reducer.
3. **Dataset real**: ~270 registros à mão; erros de elenco são cosméticos, não funcionais. Aproximação aceita pelo dono ("não precisa ser perfeito").

## Fora de escopo (B e além)

- Jogos assistidos com decisões (regular 3–4/ano, playoffs crescente, finais completas) — sub-projeto B.
- Momentos icônicos no score — B.
- Rival de carreira — v3.
- Leaderboard global, mini-jogos — backlog v2 original.
