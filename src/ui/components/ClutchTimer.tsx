import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../../i18n'
import { t } from '../../i18n'

// Cronômetro do último lance. Não é animação decorativa: é gameplay, então
// prefers-reduced-motion NÃO o desliga — só o toggle timePressure desliga.
export function ClutchTimer({ ms, paused, onExpire, lang }: { ms: number; paused: boolean; onExpire: () => void; lang: Lang }) {
  const [left, setLeft] = useState(ms)
  const leftRef = useRef(ms)
  const fired = useRef(false)
  useEffect(() => {
    if (paused) return
    // relógio de parede, não contagem de ticks: aba em background throttla o setInterval
    const start = performance.now(), base = leftRef.current
    const id = setInterval(() => {
      const v = Math.max(0, base - (performance.now() - start))
      leftRef.current = v
      setLeft(v)
    }, 100)
    return () => clearInterval(id)
  }, [paused])
  useEffect(() => {
    // guarda contra disparo duplo: onExpire troca de identidade a cada render do pai,
    // então sem essa trava o efeito reexecuta com left ainda em 0 e despacha de novo.
    if (left === 0 && !fired.current) {
      fired.current = true
      onExpire()
    }
  }, [left, onExpire])
  return (
    <div className="clutch-timer" role="timer" aria-label={t(lang, 'game.clutchTimer')}>
      <div className="clutch-timer__bar" style={{ width: `${(left / ms) * 100}%` }} />
      <span className="mono clutch-timer__num">{(left / 1000).toFixed(1)}</span>
    </div>
  )
}
