import type { Moment, MomentExec } from '../types'

// Modo arcade: cada momento do jogo assistido vira um minigame. Estes módulos são engine
// puro (sem React, sem Math.random) — a aleatoriedade interna vem de um Rng LOCAL semeado
// por `minigameSeed`, que nunca toca o contador de calls do save.

export type MinigameKind = 'playbook' | 'shot' | 'defense'

// O que o minigame devolve ao reducer: jogada do catálogo mg* + execução.
export interface MinigameResult extends MomentExec {
  optionId: string
}

// clutch é sempre o arremesso final; situações com opção defensiva viram defesa; o resto,
// quadro tático de ataque. Com o catálogo atual um jogo de 3 momentos costuma misturar os três.
export function minigameFor(moment: Moment): MinigameKind {
  if (moment.id === 'clutch') return 'shot'
  if (moment.options.some(o => o.attr === 'defense')) return 'defense'
  return 'playbook'
}

// Seed local do minigame: determinístico por (seed da carreira, posição no fluxo de RNG).
// Recarregar no meio do momento recomeça o MESMO minigame (mesma formação/sequência).
export function minigameSeed(seed: number, rngCalls: number): number {
  let h = (seed ^ Math.imul(rngCalls + 1, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
