import { useCallback, useEffect, useRef, useState } from 'react'

// Relógio virtual do jogo: 1.8 min de jogo por segundo real — um trecho de ~14 min
// entre duas decisões passa em ~8s, o jogo inteiro em ~30s + decisões.
const GAME_MIN_PER_SEC = 1.8
const TICK_MS = 80

// Linhas do log visíveis no minuto virtual `t`: as que o relógio já passou.
export function visibleCount(ats: number[], t: number): number {
  return ats.filter(at => at <= t).length
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

// O relógio é o mestre: `t` corre continuamente de 0 até `stopAt` (o minuto do momento
// pendente; null = sem momento, corre até 48) e as linhas surgem quando `t` passa pelo
// `at` delas. Decidido um momento, `stopAt` sobe e o relógio volta a correr — `t` nunca
// anda pra trás (a decisão recém-tomada, com at ≤ t, fica na tela).
export function usePlayReveal(input: { ats: number[]; stopAt: number | null }) {
  const { ats, stopAt } = input
  const reduced = usePrefersReducedMotion()
  const target = stopAt ?? 48
  const [t, setT] = useState(() => (reduced ? target : 0))
  // âncora derivada de performance.now() (sem drift de setInterval); reancora a cada
  // salto de `t` fora do tick (skip, reduced, mudança de alvo).
  const anchor = useRef<{ at: number; t: number }>({ at: performance.now(), t: 0 })

  const jump = useCallback((to: number) => {
    anchor.current = { at: performance.now(), t: to }
    setT(prev => Math.max(prev, to))
  }, [])

  const skip = useCallback(() => jump(target), [jump, target])

  useEffect(() => { if (reduced) jump(target) }, [reduced, target, jump])

  useEffect(() => {
    if (reduced || t >= target) return
    const id = setInterval(() => {
      const a = anchor.current
      const now = a.t + ((performance.now() - a.at) / 1000) * GAME_MIN_PER_SEC
      setT(prev => Math.max(prev, Math.min(now, target)))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [reduced, target, t >= target])

  // alvo subiu (decisão tomada): reancora em `t` pra não saltar o tempo parado pensando
  useEffect(() => {
    anchor.current = { at: performance.now(), t }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  return {
    t,
    shown: visibleCount(ats, t),
    done: t >= (stopAt ?? Math.max(...ats, 0)),
    skip,
  }
}
