import type { Rng, WatchedGameKind } from '../types'
import type { MinigameResult } from './index'
import { clamp01 } from './index'

// MURALHA (defesa, modo arcade) — spec §2.7. Puro: sequência do atacante sorteada por um
// Rng LOCAL, janelas de reação por contexto e avaliação de cada batida. Sem React, sem tempo.

export type BeatKind = 'left' | 'right' | 'hesi' | 'expose' | 'shoot'
export type Input = 'left' | 'right' | 'contest' | 'steal'
export type Verdict = 'hit' | 'miss' | 'late'

export interface Beat { kind: BeatKind; delayMs: number }
export interface BeatResult { kind: BeatKind; input: Input | null; verdict: Verdict; contested?: boolean }

export const WINDOW_MS: Record<WatchedGameKind, number> = {
  rivalry: 650, seedRace: 650, special: 650, playoff: 560, finals: 480,
}

const BODY_POOL: BeatKind[] = ['left', 'right', 'hesi']

// 4–6 batidas, a última sempre `shoot`; laterais iguais nunca seguidas; no máximo um `expose`
// (presente com p=0.8); pelo menos um `hesi` quando há 5+ batidas.
export function createSequence(rng: Rng, kind: WatchedGameKind): { beats: Beat[]; windowMs: number } {
  const len = rng.int(4, 6)
  const body: BeatKind[] = []
  for (let i = 0; i < len - 1; i++) {
    const prev = body[i - 1]
    body.push(rng.pick(BODY_POOL.filter(k => k === 'hesi' || k !== prev)))
  }
  // trocar uma batida por expose/hesi nunca cria laterais iguais adjacentes (nenhum dos dois é lateral)
  if (rng.chance(0.8)) body[rng.int(0, body.length - 1)] = 'expose'
  if (len >= 5 && !body.includes('hesi')) {
    const slots = body.map((k, i) => (k === 'expose' ? -1 : i)).filter(i => i >= 0)
    body[rng.pick(slots)] = 'hesi'
  }
  const beats = [...body, 'shoot' as BeatKind].map(kind => ({ kind, delayMs: rng.int(350, 900) }))
  return { beats, windowMs: WINDOW_MS[kind] }
}

// Avalia uma batida dado o PRIMEIRO input da janela (ou nenhum). `late` = input certo mas
// fora da janela, ou lateral sem reação; `miss` = input errado.
export function evaluateBeat(beat: Beat, input: Input | null, reactionMs: number | null, windowMs: number): BeatResult {
  const inWindow = input !== null && reactionMs !== null && reactionMs <= windowMs
  const r = (verdict: Verdict, contested?: boolean): BeatResult =>
    contested === undefined ? { kind: beat.kind, input, verdict } : { kind: beat.kind, input, verdict, contested }
  switch (beat.kind) {
    case 'left':
    case 'right':
      if (input === beat.kind) return r(inWindow ? 'hit' : 'late')
      return r(input === null ? 'late' : 'miss')
    case 'hesi':
      return r(input === null ? 'hit' : 'miss')
    case 'expose':
      if (input === 'steal') return r(inWindow ? 'hit' : 'late')
      return r('hit')
    case 'shoot':
      if (input === 'contest') return r(inWindow ? 'hit' : 'late', inWindow)
      return r(input === null ? 'hit' : 'miss', false)
  }
}

// Tentou roubar → mgSteal (1 só se foi no `expose` dentro da janela); contestou o arremesso
// na janela → mgContest; senão → mgLock. quality = acertos / batidas.
export function resultOf(log: BeatResult[]): MinigameResult {
  const steal = log.find(b => b.input === 'steal')
  if (steal) return { optionId: 'mgSteal', quality: steal.kind === 'expose' && steal.verdict === 'hit' ? 1 : 0 }
  const hits = log.filter(b => b.verdict === 'hit').length
  const quality = clamp01(log.length ? hits / log.length : 0)
  const contested = log.some(b => b.kind === 'shoot' && b.contested)
  return { optionId: contested ? 'mgContest' : 'mgLock', quality }
}

export const describeBeat = (kind: BeatKind) => `mg.def.beat.${kind}`

// deslocamento horizontal do atacante na animação (unidades relativas)
export const attackerOffset = (kind: BeatKind) => (kind === 'left' ? -1 : kind === 'right' ? 1 : 0)
