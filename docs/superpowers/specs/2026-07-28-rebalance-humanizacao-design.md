# Spec — Rebalanceamento de dificuldade + humanização dos textos

**Data:** 2026-07-28 · **Status:** aprovado em conversa

## Contexto

Playtest do dono: build 83 de overall terminou a carreira (até os 40) como `legend`, com 8 anéis, 1 MVP e 37k pontos. Diagnóstico: `titleProb = clamp((winPct − 0.5) × 0.9 + (effClutch − 75) × 0.004, 0.01, 0.45)` rende ~20%+/ano num contender → 4–8 anéis em carreira longa; anéis dominam o score (`ring × 120 + fmvp × 60`). Além disso, os textos i18n têm cara de IA.

## A. Rebalanceamento — calibração (só constantes; forma das fórmulas preservada)

### Harness

`tools/calibrate.mjs` (Node, fora do bundle e do vitest): simula N carreiras por overall alvo com política fixa — build sintético no nível de overall desejado, jogar até os 40, foco `scoring`, primeira oferta sempre, trades rejeitados, eventos interativos na escolha segura ('b'). Saída: distribuição de anéis (mediana/p90), MVPs, pontos totais, tier final por faixa de overall (75 / 83 / 90 / 95). Usa o engine real via imports (`tsx` ou compilação leve — o que o repo suportar sem dependência nova; se precisar, rodar via `vitest run` num arquivo utilitário é aceitável).

### Alvos (critério de aceite da calibração)

| Perfil (carreira até 40, foco scoring) | Alvo |
|---|---|
| 83 overall | mediana 1 anel, p90 ≤ 3; tier típico allstar/superstar; legend < 10% |
| 90+ overall | legend plausível |
| 95 overall | legend > 20% |
| < 88 overall | MVP raro |
| GOAT gate | < 2% em carreiras aleatórias (teste existente continua travando) |

### Constantes candidatas (ajustar pelo harness até bater os alvos; nunca a forma)

- `season.ts` titleProb: coeficiente `0.9` → ~`0.5`; termo clutch `0.004` → ~`0.003`; cap `0.45` → ~`0.28`.
- Se necessário: `verdict.ts` `points / 400` → `/ 500`; threshold `legend` `950` → ~`1100`. GOAT gate (score ≥ 1950 + gate icônico) NÃO muda — decisão do dono.
- Valores finais são os que o harness validar; os acima são ponto de partida.

### Trava permanente

`tests/engine/calibration.test.ts` (vitest, seeds fixos, ~200 carreiras/caso via política do harness):
- build 83: mediana de anéis ≤ 2 E taxa de legend < 15%;
- build 95: taxa de legend > 20%;
- GOAT gate < 2% (já coberto por `verdict.test.ts`; manter lá).
Tolerâncias folgadas de propósito — trava regressão grossa, não flutuação estatística.

## B. Humanização dos textos i18n

- Skill `humanizer` (instalada em `~/.claude/skills/humanizer`) aplicada a TODAS as strings de `src/data/i18n/pt.json` e `en.json`.
- Voz alvo: linguagem de basquete/arquibancada, direta, sem paralelismos vazios, sem "rule of three", sem vocabulário genérico de IA. PT não é tradução literal do EN — cada idioma soa nativo.
- Chaves e placeholders (`{n}`, `{slot}`, `{name}`, `{age}`, `{team}`, `{year}`, `{archetype}`) intocados. Teste de paridade continua valendo.
- **Gate:** dono revê o diff dos textos antes do commit final (mostrar amostra pt+en das mudanças mais relevantes).

## Fora de escopo

Mudança de forma de fórmulas, GOAT gate, novos eventos/fases, UI.
