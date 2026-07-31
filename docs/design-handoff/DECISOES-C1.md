# Decisões pós-handoff — Ciclo 1 (2026-07-29)

Decisões tomadas no brainstorm de implementação (dono aprovou). Complementam o `README.md` deste pacote; onde houver conflito, este arquivo vence.

## Decomposição em 3 ciclos

- **C1**: tema 2B + primitivas, barra de carreira, Hub, balanço em tela única, 8 telas estáticas (3a, 4c, 6c, 5a, 5b, 5c, 5d, 6d) em layout final, boot na Home. Zero engine change, sem bump de save.
- **C2**: jogo-chave narrado (8a/9c), `gameResult` (6a), `seasonAdvance` (6b), log de lances no engine, save `thegoat:v5`.
- **C3**: cerimônia como tela própria (3b), aposentadoria (3c), veredito em camadas + persistido (3d), dívidas restantes.

Telas de C2/C3 recebem no C1 só o retheme de tokens/primitivas (layout atual mantido até seus ciclos).

## Decisões de design

1. **Balanço mobile (4b)** — seção "LIGA E TRAJETÓRIA" usa o condensado do desktop: standings top-4 por conferência, corrida de prêmios em 4 barras, trajetória em 9 barras. Tabela completa de 30 times vive só no Hub.
2. **Cerimônia no C1** — dados (campeão + honras + desfecho do run) viram seção "DEMAIS HONRAS" dentro do scroll do balanço; a tela própria 3b chega no C3.
3. **Boot sempre na Home (3a)** — com save válido, Home mostra "CARREIRA EM ANDAMENTO · RETOMAR →" (nova ação `RESUME`); "Nova carreira" apaga o save com aviso. O resume direto para a fase salva morre.
4. **Barra de carreira só de `preseason` em diante** — home, attrDraft, draftDone e nbaDraft mantêm cabeçalho próprio (pré-carreira, não há o que mostrar na barra).
5. **Hub via `hubOpen: boolean` persistido no save** — campo opcional no shape `thegoat:v4` (default `false`), sem bump. Ações `OPEN_HUB`/`CLOSE_HUB`.
6. **Foco de pré-temporada (5b)** — interação vira selecionar + confirmar no CTA "Começar a temporada" (hoje o tap no foco já dispara).

## Spec no repositório

`docs/superpowers/specs/2026-07-29-redesign-c1-design.md` (repo `AlvaroRumpel/the_goat`).
