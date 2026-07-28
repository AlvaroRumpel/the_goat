# The GOAT

**Início de sessão: leia `HANDOFF.md` antes de qualquer tarefa.** Ele tem o estado atual, arquitetura, decisões travadas, débitos e backlog. Mantenha-o atualizado ao fim de trabalhos relevantes (nova feature, deploy, decisão de design).

## Regras do projeto

- `src/engine/` é TS puro: sem React, sem localStorage, sem `Math.random` — toda aleatoriedade via `Rng` injetado (seed). Quebrar isso quebra o replay do save.
- Toda string visível ao usuário passa por i18n (`src/data/i18n/pt.json` + `en.json`, paridade de chaves testada). Nunca hardcodar texto em componente.
- Fórmulas do `season.ts` e pesos do `verdict.ts` são contrato — calibração ajusta constantes, nunca a forma. GOAT gate (score ≥ 1950 + carreira icônica) é decisão do dono; não afrouxar.
- Sem fotos/logos reais de NBA — nomes ok.
- Testes: vitest só no engine/state/data (`npm test`); playthrough completo manual: `node tests/e2e-playthrough.mjs`.
- Antes de commitar: `npm test` + `npx tsc -p tsconfig.app.json --noEmit`.
- Deploy: `npm run build && npx wrangler pages deploy dist --project-name=the-goat --branch=master`.
