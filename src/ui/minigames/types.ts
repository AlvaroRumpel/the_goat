import type { Build, MomentOutcome, WatchedGameContext } from '../../engine/types'
import type { MinigameResult } from '../../engine/minigames'
import type { Lang } from '../../i18n'

// Contrato dos três minigames (modo arcade). O componente:
//  1. joga com `seed` (createRng(seed) LOCAL — nunca Math.random, nunca o rng do save);
//  2. chama `onResolve` EXATAMENTE uma vez quando a jogada termina (arremesso, turnover,
//     fim da sequência de defesa) — o pai despacha DECIDE_MOMENT e o engine resolve;
//  3. continua montado ~1.4s com `outcome` preenchido (success/injury já decididos pelo
//     engine) para animar o desfecho: a animação OBEDECE `outcome.success`, nunca o
//     contrário (arremesso perfeito que erra = "girou e saiu"; é basquete).
export interface MinigameProps {
  seed: number
  context: WatchedGameContext
  build: Build
  number: number | null        // camisa do jogador (rótulo do "você")
  lang: Lang
  onResolve: (result: MinigameResult) => void
  outcome: MomentOutcome | null
}
