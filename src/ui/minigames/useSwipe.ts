import { useEffect, type RefObject } from 'react'

export type Gesture = 'left' | 'right' | 'up' | 'tap'

// Classifica um gesto por deslocamento (dx, dy em px) e duração (dtMs).
// Toque: deslocamento mínimo e rápido. Swipe: eixo dominante acima do limiar.
export function classifySwipe(dx: number, dy: number, dtMs: number): Gesture | null {
  const ax = Math.abs(dx), ay = Math.abs(dy)
  if (ax < 12 && ay < 12) return dtMs < 300 ? 'tap' : null
  if (ax >= 28 && ax > ay) return dx < 0 ? 'left' : 'right'
  if (dy <= -28) return 'up'
  return null
}

// Liga pointer + teclado no elemento de `ref` e chama `onGesture` a cada gesto reconhecido.
export function useSwipe(ref: RefObject<HTMLElement | null>, onGesture: (g: Gesture) => void, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let start: { x: number; y: number; t: number } | null = null
    const down = (e: PointerEvent) => { el.setPointerCapture(e.pointerId); start = { x: e.clientX, y: e.clientY, t: performance.now() } }
    const up = (e: PointerEvent) => {
      if (!start) return
      const g = classifySwipe(e.clientX - start.x, e.clientY - start.y, performance.now() - start.t)
      start = null
      if (g) onGesture(g)
    }
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
      const g = e.key === 'ArrowLeft' ? 'left' : e.key === 'ArrowRight' ? 'right' : e.key === 'ArrowUp' ? 'up' : e.key === ' ' || e.key === 'Enter' ? 'tap' : null
      if (g) { e.preventDefault(); onGesture(g) }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', key)
    }
  }, [ref, onGesture, enabled])
}
