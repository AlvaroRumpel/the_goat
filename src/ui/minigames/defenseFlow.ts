import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { teamById } from '../../data/teams'
import { attrMods, difficulty, opponentFive, tendencies, type OppPlayer, type Tendencies } from '../../engine/minigames/common'
import {
  createDuel, contest, slide, step, trySteal,
  type DuelInput, type DuelState, type Move,
} from '../../engine/minigames/defense'
import { useSwipe, type Gesture } from './useSwipe'

// MURALHA — fluxo (cartão → duelo ao vivo → desfecho, laço do engine a 20 Hz, gestos),
// compartilhado com o desenho 2D (`Defense.tsx`). O engine (defense.ts) é a verdade; o
// desfecho OBEDECE `outcome.success` (roubo limpo que o engine reprovou vira apito do juiz).

export const CARD_MS = 1200, END_MS = 1200, OVERLAY_MS = 800
const TAP_COOLDOWN = 350                 // ruling: 2º toque logo após roubo errado = falta de graça
const TICK_MS = 50, DT = 0.05

export type Phase = 'card' | 'live' | 'end'

// top-down visto de trás do atacante: esquerda da tela = −x
export const DIR: Record<'left' | 'right', -1 | 1> = { left: -1, right: 1 }
export const GLYPH: Record<Move, string> = {
  hesi: '~', crossL: '←', crossR: '→', spin: '↺', legs: 'V',
  driveL: '«', driveR: '»', pumpFake: '↑?', shoot: '↑', pass: 'P',
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export interface DuelFlow {
  props: MinigameProps
  stRef: RefObject<DuelState>
  S: DuelState
  phase: Phase
  showResult: boolean
  star: OppPlayer
  tend: Tendencies
  team: ReturnType<typeof teamById>
  stageRef: RefObject<HTMLDivElement | null>
  endAt: RefObject<number | null>
  outRef: RefObject<MinigameProps['outcome']>
  gesture(g: Gesture): void
}

export function useDuelFlow(props: MinigameProps): DuelFlow {
  const { seed, context, build, age, quarter, league, onResolve, outcome } = props
  const rngRef = useRef<Rng | null>(null)
  if (!rngRef.current) rngRef.current = createRng(seed)
  const rng = rngRef.current

  const team = teamById(context.opponentTeamId)
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const star = five[0]
  const tend = useMemo(() => tendencies(star), [star])
  const input = useMemo<DuelInput>(() => ({
    tend, difficulty: difficulty(context.kind, star.ovr), mods: attrMods(build, age, quarter), starOvr: star.ovr,
  }), [tend, context.kind, star.ovr, build, age, quarter])

  const [phase, setPhase] = useState<Phase>('card')
  const [showResult, setShowResult] = useState(false)
  const [, setFrame] = useState(0)
  const stRef = useRef<DuelState>(createDuel(input))
  const phaseRef = useRef<Phase>('card')
  const endAt = useRef<number | null>(null)
  const tapBlock = useRef(0)
  const resolved = useRef(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const outRef = useRef(outcome)
  outRef.current = outcome
  // o pai recria `onResolve` a cada render: o laço lê sempre o mais novo sem reassinar
  const resolveRef = useRef(onResolve)
  resolveRef.current = onResolve

  // ---------- avanço de estado (uma porta só: gesto ou tick) ----------
  const commit = useCallback((s: DuelState) => {
    stRef.current = s
    setFrame(f => f + 1)
    if (s.phase === 'live' || resolved.current) return
    resolved.current = true
    endAt.current = performance.now()
    phaseRef.current = 'end'
    setPhase('end')
    resolveRef.current(s.result!)
    setTimeout(() => setShowResult(true), OVERLAY_MS)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { phaseRef.current = 'live'; setPhase('live') }, CARD_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (phase !== 'live') return
    const id = setInterval(() => {
      const s = stRef.current
      if (s.phase === 'live') commit(step(s, DT, rng, input))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [phase, commit, rng, input])

  // ---------- gestos (swipe no palco + setas/espaço + botões do fallback) ----------
  const gesture = useCallback((g: Gesture) => {
    const s = stRef.current
    if (phaseRef.current !== 'live' || s.phase !== 'live') return
    if (g === 'left' || g === 'right') { commit(slide(s, DIR[g], input)); return }
    if (g === 'up') { commit(contest(s)); return }
    const now = performance.now()
    if (now - tapBlock.current < TAP_COOLDOWN) return
    const next = trySteal(s, rng, input)
    if (next.phase === 'live' && next.stealTries > s.stealTries) tapBlock.current = now
    commit(next)
  }, [commit, input, rng])
  useSwipe(stageRef, gesture, phase === 'live')

  return { props, stRef, S: stRef.current, phase, showResult, star, tend, team, stageRef, endAt, outRef, gesture }
}
