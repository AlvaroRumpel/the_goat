# UI/UX + Ads-Ready — Design (Ciclo 2 de 3)

**Data:** 2026-08-02 · **Status:** aprovado pelo dono (triagem completa — 4 blocos)
**Contexto:** ciclo 2 da sequência SEO → UI/UX → Ads. Base: auditoria com 32 screenshots reais (Playwright, mobile 390×844 + desktop 1280×800, PT/EN, jogo + páginas estáticas), dois relatórios (5 P0 · 12 P1 · 11 P2). Metodologia aprovada: screenshots reais + triagem, sem mockups claude-design.

## Decisões do dono (registradas, não reabrir)

- **Monetização máxima**: banner fixo de rodapé em TODAS as telas, **inclusive jogo assistido** (keyGame/playoffGame); intersticial entre temporadas; banners nas páginas de conteúdo. Trade-off de imersão aceito explicitamente.
- Tema jornal e decisões de design C1-C3 **travados** — este ciclo poli, não redesenha.
- Ciclo 3 (AdSense de verdade) implementa os anúncios; este ciclo só deixa o layout pronto (placeholders, zero mudança visual até lá).

## Bloco A — Infra de anúncios (raiz do ciclo)

1. **CSS var `--ad-h`** (default `0px`) em `tokens.css`. Todo container de tela que hoje termina em CTA — `.screen`, `.hub` (overlay), tela do jogo — passa a reservar `calc(<padding atual> + var(--ad-h) + env(safe-area-inset-bottom))` no rodapé. Achado raiz: `.screen` tem só 40px (`base.css:44`) e o banner de 60-90px cobriria o último botão de quase toda tela; `.game-decision` (`margin-top: auto`) cola as opções de decisão no fundo.
2. **Componente `AdSlot`** (`src/ui/components/AdSlot.tsx`): placeholder `<div class="ad-slot" data-slot="...">`, sem conteúdo, altura 0 enquanto `--ad-h` = 0. Instâncias: barra fixa global (App), slot nas telas de pausa (balanço, veredito, Hub) e nas 6 páginas estáticas (div estática equivalente). Ciclo 3 preenche.
3. **Hook de intersticial**: módulo `src/ui/ads.ts` com `interstitialAt(point)` no-op, chamado no fechamento de temporada (UI, não reducer). Ciclo 3 implementa.
4. Política AdSense antecipada: distância mínima entre `.ad-slot` e elementos clicáveis (ClutchTimer/opções) garantida pelo próprio padding reservado.

## Bloco B — P0s

5. **Draft de atributos**: instrução "toque num atributo…" sai do rodapé (11px dim) e vai pra **cima das linhas de stats** (abaixo do cabeçalho da lenda), legível; a notação "58 · —" ganha legenda ("SEU ATUAL · APÓS ROUBO" — copy exata no plano). Fecha também o P1 da notação sem rótulo.
6. **Veredito**: override de contraste do `CareerBar` na única tela vermelha — `.verdict-screen .topbar__meta` → `--on-red-dim`, `.topbar__link` → `--on-red`. (Contraste hoje: meta ~1.22:1, link vermelho-sobre-vermelho ~1:1.)
7. **Alvos de toque ≥44px** sem mudar o visual: `.topbar__link` ("CARREIRA ↗") e "FECHAR ×" do Hub ganham área de toque via padding + margin negativa equivalente.

## Bloco C — P1s

**Novato/jogo:**
8. **Setup de modos**: os 3 cartões mostram a descrição completa SEMPRE (morre a expansão só-no-selecionado) — comparação lado a lado antes de escolher.
9. **Feed do jogo**: enquanto nenhuma linha revelada, placeholder dim no feed (indicador de "jogo rolando"), some na primeira linha real.
10. **Cores de risco em escada**: intensidade visual segue o risco — SEGURO quieto, OUSADO médio (perde o tratamento invertido gritante atual), IMPRUDENTE é o que grita (acento vermelho). Sem tocar nas mecânicas/EVs.
11. **Toggle "pressão de tempo"** só aparece na Home quando existe save (jogador retornando tem contexto); novato usa default. Sem mudança de reducer — condição de render.
12. **Veredito sem eco**: canvas do cartão fica oculto (offscreen) — stats não aparecem duplicadas; botão SHARE inalterado.

**Desktop (≥900px):**
13. **`.screen` ganha max-width centralizado** (~560px) — conserta de uma vez Home encostada no canto e draft com label↔valor separados por 1200px. Telas com grid próprio (`.game-side`, Hub) mantêm seus layouts.
14. **Keygame desktop**: colunas alinhadas pelo topo, feed com min-height que não deixe ~550px mortos entre log e rodapé.

## Bloco D — Estáticas + P2s baratos

15. **CTA real nas páginas de conteúdo**: "Começar uma carreira agora →" vira botão bloco vermelho (classe `.page-cta` em `pages.css`), não linha de texto.
16. **"EVOLUÇÃO DO ANO — —"**: quando não há vencedor, mostrar rótulo dim i18n ("NÃO DECIDIDO" / copy no plano) em vez de travessões que parecem dado faltando.
17. **"SEU IMPACTO +0 · RESTO DO TIME +13"**: uma linha dim de explicação (i18n) ligando as decisões ao número.
18. **Malus sem eco 3×**: no draft, o preço aparece no cabeçalho (FRAQUEZA) e na linha (PREÇO) — o callout de baixo que repete a mesma frase morre.

## Fora de escopo (registrado, sem ciclo)

P2s não selecionados: labels ~7px no export do cartão (share), números nos cartões de oferta de time, empilhamento de opacidade nos chips do veredito, headroom de contraste do `--dim` (4.7:1 passa AA). Guardados nos relatórios de auditoria (scratchpad da sessão; achados citam shots + linhas de código).

## Restrições e testes

- **Zero engine/state.ts/RNG/save** (item 11 é condição de render; nada de reducer). Calibração NÃO roda.
- Toda string nova via i18n (paridade PT/EN testada). Sem fotos/logos reais.
- e2e playthrough continua verde (asserts existentes; painel de decisão continua acessível com `--ad-h` 0 e com 90px simulado — sanity manual).
- Verificação visual: recaptura dos screenshots das telas alteradas (script de captura da auditoria, reutilizável) + conferência.
- `npm test` + typecheck antes de cada commit; deploy no fim do ciclo.
