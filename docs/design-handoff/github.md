# github.md

repo: AlvaroRumpel/the_goat
branch: master
path: src

## Last sync

date: 2026-07-29T17:25:04Z

### Updated in this project
- Redesign do fluxo: nova fase "Hub de Carreira" e recap de temporada sem abas.
- Tema visual aprovado (2B, "Jornal de Tinta Vermelha") aplicado às telas de maior peso.
- Tela de roubo de atributo redesenhada: os 8 atributos da lenda são a lista de escolha, com o preço de cada roubo.
- Regras de malus conferidas contra o engine (fraqueza da lenda, −1 a −5).

## Screen map

| Tela no projeto | Arquivos do repo |
|---|---|
| 1a · Mapa de fluxo | src/App.tsx, src/state.ts |
| 1b/1c/1d · Momento decisivo (direções) | src/ui/screens/Game.tsx, src/engine/moments.ts |
| 2a/2b · Temas do momento decisivo | src/ui/screens/Game.tsx, src/styles/tokens.css |
| 3a · Abertura | src/ui/screens/Home.tsx |
| 3b · Cerimônia | src/ui/components/LeaguePanels.tsx, src/engine/league.ts |
| 3c · Aposentadoria | src/ui/screens/Season.tsx |
| 3d · Veredito | src/ui/screens/Verdict.tsx, src/engine/verdict.ts, src/ui/share.ts |
| 4a · Hub de Carreira (fase nova) | src/state.ts, src/ui/components/LeaguePanels.tsx |
| 4b · Balanço da temporada | src/ui/screens/Season.tsx, src/engine/season.ts |
| 4c · Roubo de atributo | src/ui/screens/AttrDraft.tsx, src/engine/draft.ts, src/data/players.ts |
