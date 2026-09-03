import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { timingHit } from '../../engine/minigames/common'

// Onda triangular 0→1→0 de período 1 (u em "voltas").
function tri(u: number): number {
  const frac = u - Math.floor(u)
  return 1 - Math.abs(2 * frac - 1)
}

// Barra de timing genérica (salto, bloqueio, box-out, rebote ofensivo): cursor varre
// 0→1→0 a cada `periodMs`; toque/clique/Espaço avalia contra a janela âmbar via
// `timingHit`. No máximo um `onTap` por janela de `running` (ignora até `running`
// voltar a false→true).
export function TimingBar(props: {
  periodMs: number
  window: { center: number; half: number }
  vertical?: boolean
  running: boolean
  onTap(hit: 'perfect' | 'hit' | 'miss', t: number): void
  label: string
}): JSX.Element {
  const { periodMs, window: win, vertical, running, onTap, label } = props
  const [t, setT] = useState(0)
  const tRef = useRef(0)
  const tappedRef = useRef(false)

  useEffect(() => {
    tappedRef.current = false
    if (!running) return
    let raf = 0
    const start = performance.now()
    const loop = () => {
      const v = tri((performance.now() - start) / periodMs)
      tRef.current = v
      setT(v)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, periodMs])

  const tap = useCallback(() => {
    if (!running || tappedRef.current) return
    tappedRef.current = true
    onTap(timingHit(tRef.current, win.center, win.half), tRef.current)
  }, [running, win.center, win.half, onTap])

  useEffect(() => {
    if (!running) return
    const key = (e: KeyboardEvent) => { if (e.key === ' ') { e.preventDefault(); tap() } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [running, tap])

  const pct = (v: number) => `${v * 100}%`
  const winStyle = vertical
    ? { top: pct(win.center - win.half), height: pct(win.half * 2) }
    : { left: pct(win.center - win.half), width: pct(win.half * 2) }
  const curStyle = vertical ? { top: pct(t) } : { left: pct(t) }

  return (
    <div
      className={`mg-timing${vertical ? ' mg-timing--vertical' : ''}`}
      role="button"
      aria-label={label}
      tabIndex={0}
      onPointerDown={tap}
    >
      <div className="mg-timing__win" style={winStyle} />
      <div className="mg-timing__cur" style={curStyle} />
    </div>
  )
}
