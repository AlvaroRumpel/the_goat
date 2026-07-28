# The GOAT — Design Spec

**Data:** 2026-07-28
**Status:** Aprovado em brainstorming, aguardando revisão final do spec

## Visão

Jogo de carreira de basquete no navegador, inspirado no The Fenomeno (futebol). O jogador rouba atributos de lendas da NBA, monta um jogador híbrido e vive uma carreira completa — draft, temporadas, trades, títulos — até o veredito final: de "Peladeiro de Quadra" a "THE GOAT".

Grátis, sem cadastro, sem download. Bilíngue PT-BR + EN desde a v1.

## Escopo da v1 (MVP)

**Dentro:** draft de atributos (posicional + trade-off), carreira com decisões (destino, trades, foco, aposentadoria), eventos aleatórios simples, veredito com tiers, compartilhar resultado, i18n pt/en, persistência local.

**Fora (v2):** mini-jogos de habilidade, leaderboard global (Supabase), login, SEO/SSR.

## Fluxo de telas

```
Home → Draft de Atributos → Draft NBA → Carreira (loop de temporadas) → Veredito → Compartilhar / Jogar de novo
```

## 1. Draft de Atributos

O jogador tem **8 slots**:

| # | Slot | Lendas exemplo |
|---|------|----------------|
| 1 | Arremesso 3PT | Curry, Bird |
| 2 | Finalização (garrafão) | Shaq, Kareem |
| 3 | Passe/Visão | Magic, Nash |
| 4 | Handles/Drible | Iverson, Kyrie |
| 5 | Defesa | Russell, Hakeem |
| 6 | Rebote | Rodman, Wilt |
| 7 | Físico/Atletismo | LeBron, Giannis |
| 8 | Clutch/Mental | Jordan, Kobe |

**Mecânica:**
- 8 rodadas, uma por slot. Em cada rodada, **2 lendas competem** pelo slot.
- Cada oferta = valor do atributo + **malus herdado** em outro dos 8 slots. Valor mais alto → malus maior. Ex: "Curry: 3PT 99, herda Físico −8" vs "Bird: 3PT 94, herda Handles −4".
- O jogador escolhe de quem roubar. Sem pular rodada.
- Malus é acumulado e aplicado **após as 8 rodadas**, sobre os valores finais (subtração). Piso de atributo: 40.
- **Pool de ~24 lendas**; cada run sorteia 16 (2 por slot). Runs sempre diferentes.
- Nomes reais de lendas e times. Imagens: ilustrações/silhuetas próprias (sem fotos com copyright).

**Arquétipo posicional:** ao final do draft, a build é classificada em posição/arquétipo por pesos:
- PG (Maestro): Passe + Handles altos
- SG (Pontuador): 3PT + Clutch
- SF (Completo): distribuição equilibrada
- PF (Força): Físico + Finalização
- C (Âncora): Rebote + Defesa + Finalização

O arquétipo define o perfil de stats gerado na carreira (PG gera mais assistências, C mais rebotes/tocos, etc.).

## 2. Draft NBA e Carreira

**Draft NBA:** posição no draft derivada do overall da build (build forte → pick alto). O jogador recebe **3 ofertas de times reais** com perfis:
- **Contender**: chance alta de título, stats individuais menores
- **Rebuild**: você é a estrela — stats altos, título difícil
- **Mercado grande**: meio-termo, bônus de "fama" no score final

**Loop de temporada** (idade ~19 até no máximo 40):
1. **Foco pré-temporada** (escolha): Pontuação / Defesa / Liderança / Saúde → buff no aspecto escolhido na simulação.
2. **Simulação**: motor gera stats (PPG, RPG, APG, jogos) a partir de atributos + arquétipo + contexto do time + curva de idade (pico 25–29, declínio pós-30).
3. **Eventos aleatórios** (0–2 por temporada): lesão (menos jogos; risco reduzido com foco Saúde), rivalidade (buff clutch nos playoffs), proposta de trade no meio da temporada (aceitar/recusar), momento viral (fama), etc.
4. **Playoffs**: classificação e chance de título = força do time + clutch do jogador + arquétipo.
5. **Prêmios**: All-Star, MVP, DPOY, cestinha (scoring title), Finals MVP, anel.
6. **Free agency** a cada fim de contrato (3–4 temporadas): 3 novas ofertas com os mesmos perfis.

**Aposentadoria:** a partir dos 31 anos, ao fim de cada temporada o jogador escolhe continuar ou parar. Continuar em declínio acumula totais, mas temporadas ruins reduzem médias e podem gerar eventos negativos de legado.

## 3. Veredito

Score final ponderado (pesos indicativos, calibrar na implementação):
- Anéis (peso mais alto), Finals MVP, MVPs
- Totais de carreira (pontos, assistências, rebotes)
- Médias de carreira
- All-Stars, DPOY, cestinha
- Modificadores de narrativa: lealdade (carreira num só time), fama (mercado grande), eventos

**Tiers:**
```
Peladeiro de Quadra → Role Player → Titular → All-Star → Superstar → Lenda → THE GOAT 🐐
```
THE GOAT deve ser praticamente impossível (exige carreira quase perfeita).

**Compartilhar:** card-imagem gerado via canvas (ilustração do arquétipo, stats, tier) + texto copiável estilo Wordle. Sem backend.

## 4. Arquitetura

Stack: **Vite + React + TypeScript**, SPA estática, deploy Cloudflare Pages.

```
src/
├── engine/          # TS puro, zero React — testável isolado
│   ├── types.ts     # Player, Legend, Team, Season, GameState
│   ├── rng.ts       # RNG com seed (runs reproduzíveis)
│   ├── draft.ts     # sorteio de lendas, roubo+malus, arquétipo
│   ├── season.ts    # simulação, stats, playoffs, prêmios
│   ├── events.ts    # eventos aleatórios
│   └── verdict.ts   # score final + tier
├── data/
│   ├── legends.ts   # ~24 lendas (slot, valor, malus, ilustração)
│   ├── teams.ts     # 30 times NBA (força base, perfil)
│   └── i18n/        # pt.json, en.json
├── ui/
│   ├── screens/     # Home, Draft, NbaDraft, Season, Verdict
│   └── components/  # LegendCard, StatLine, EventModal...
├── state.ts         # useReducer único com fases do jogo
└── App.tsx
```

**Decisões:**
- Estado: um `useReducer` com fases (`home → draft → career → verdict`). Sem lib de estado.
- Persistência: `localStorage` (carreira em andamento sobrevive a refresh; histórico local de runs).
- i18n: dicionário próprio — 2 JSONs + hook `useT()` com interpolação. Sem lib.
- Testes: vitest apenas no engine (determinístico via seed). UI sem testes na v1.
- Mobile-first (público de referência joga no celular, retrato).

## 5. Estética

Direção: **Legado dourado** — escuro + dourado, vibe hall da fama/documental (Last Dance). Serifas fortes, brilho de troféu, drama.

Fase de implementação visual usa **claude-design** para gerar o design system (paleta, tipografia, componentes) antes das telas.

## 6. Tratamento de erros

- Estado corrompido no `localStorage` → descarta e volta pra Home (sem crash).
- Simulação é pura e determinística (seed) → bugs reproduzíveis.
- Sem rede na v1 → sem estados de erro de rede.

## Riscos

- **IP/nomes reais**: NBA é protetiva com marca. Projeto gratuito fan-made, risco aceito pelo usuário. Sem fotos reais, sem logos oficiais dos times (nomes ok, identidade visual própria).
- **Calibração do motor**: pesos do veredito e curvas de stats precisam de iteração pra "THE GOAT quase impossível" ser verdade. Testes com seeds fixas ajudam.
