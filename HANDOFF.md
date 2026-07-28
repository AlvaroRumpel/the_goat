# The GOAT — Handoff

**Data:** 2026-07-28 · **Estado:** v1 completa, deployada, master limpo (18 commits), 48/48 testes verdes.

## O que é

Jogo de carreira de basquete no navegador (inspirado no The Fenomeno). Rouba atributos de lendas da NBA → vive carreira completa → veredito de "Peladeiro de Quadra" até "THE GOAT". Grátis, sem cadastro, PT/EN, mobile-first.

- **Produção:** https://the-goat-3xw.pages.dev (Cloudflare Pages, projeto `the-goat`, conta alvarorumpel@gmail.com)
- **Design:** claude-design projeto "The GOAT" `5a193998-626d-46ba-84f5-fd9a7d164ca5` — 3 canvases aprovados (mobile core, fluxo completo 13 telas, desktop)
- **Spec:** `docs/superpowers/specs/2026-07-28-the-goat-design.md`
- **Plano executado:** `docs/superpowers/plans/2026-07-28-the-goat-v1.md`

## Arquitetura

```
src/
├── engine/    # TS puro, zero React, testado. RNG injetado (seed) — Math.random proibido.
│   ├── rng.ts       createRng (mulberry32)
│   ├── draft.ts     drawMatchups (2 lendas/slot), resolveDraft (malus após bases, piso 40), arquétipo
│   ├── offers.ts    draftPickNumber, makeOffers (contender/rebuild/bigmarket)
│   ├── events.ts    rollEvents (lesão 18%/9% c/ foco saúde, rivalidade, viral, fase fria; máx 2)
│   ├── season.ts    simRegularSeason + simPostseason (fórmulas = contrato; ver plano Task 8)
│   └── verdict.ts   score + tiers + GATE icônico do GOAT
├── data/      legends.ts (24, 3/slot), teams.ts (30), i18n/{pt,en}.json (paridade testada)
├── state.ts   gameReducer (10 fases), localStorage 'thegoat:v1', RNG replay via rngCalls
├── styles/    tokens.css + base.css (design "legado dourado" portado do claude-design)
└── ui/        screens/{Home,AttrDraft,NbaDraft,Season,Verdict} + components + share.ts (canvas card)
```

## Decisões-chave (não reabrir sem motivo)

1. **GOAT gate** (decisão do dono): tier `goat` = score ≥ 1950 **E** (5+ anéis && 4+ MVPs [Jordan] OU 38k+ pontos && 4+ anéis [LeBron]). Score alto sem troféus → `legend`. Calibrado: 1.33% de 300 carreiras aleatórias (teste `verdict.test.ts` trava < 2%).
2. **Trade "meio de temporada"** = deadline trade: regular season simula → oferta → decisão → playoffs com time final.
3. **RNG replay**: reducer persiste `rngCalls`; load recria rng do seed e avança N calls. Engine determinístico por seed — NUNCA consumir rng fora do fluxo contado.
4. **Aposentadoria**: fase própria aos 31+ em ano de contrato; botão Aposentar também na Free Agency quando 31+ (fix pós-review).
5. **Veredito computado na UI** (`computeVerdict(state.career)`), não armazenado.
6. **Sem fotos/logos reais** — nomes ok, imagens são monogramas/ilustração própria.

## Comandos

```
npm run dev / test / build
npx tsc -p tsconfig.app.json --noEmit     # typecheck
node tests/e2e-playthrough.mjs             # playthrough Playwright completo (manual, fora do vitest)
npx wrangler pages deploy dist --project-name=the-goat --branch=master
```

## Débitos deferidos (nenhum bloqueante)

- Validação rasa do `loadState` (só phase+seed) — save malformado com shape válido pode dar tela branca; fast-follow sugerido: whitelist de fases + error boundary que limpa storage.
- Reducer sem guards de fase (double-dispatch teoricamente inseguro; inalcançável com React 19 sync flush).
- Histórico local de runs (spec §4) não implementado — sem UI que o use; juntar com leaderboard na v2.
- i18n nits: chip EN/PT hardcoded em `Home.tsx`, `nbadraft.picked` frasing EN, arquétipo extraído via `.split(' (')` (frágil se formato de tradução mudar), 5 chaves mortas nos JSONs.
- `Verdict.tsx`: `computeVerdict` no corpo do render → redraws redundantes do canvas ao copiar.
- Botão compartilhar é no-op silencioso sem clipboard/Web Share (só HTTP puro; produção é HTTPS).

## Backlog v2 (fora do escopo v1, spec §Escopo)

- **Leaderboard global** (Supabase — usuário já tem conta; submissão por nickname, sem login) + histórico de runs
- **Mini-jogos de habilidade** em momentos-chave (era desejo original do dono, adiado no MVP)
- EN landing/SEO, custom domain
- Calibração fina com playtest real (constantes do season.ts são o contrato; ajustar só valores, nunca forma das fórmulas)

## Processo usado

Superpowers: brainstorming → spec aprovado → plano (15 tasks TDD) → subagent-driven development (implementer+reviewer por task, fix loops) → review final de branch → fix wave → merge → deploy. Design via claude-design com aprovação do usuário (requisito explícito).
