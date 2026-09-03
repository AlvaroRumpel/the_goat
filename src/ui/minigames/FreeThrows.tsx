import { useEffect, useMemo, useRef, useState } from 'react'
import type { Build } from '../../engine/types'
import type { Lang } from '../../i18n'
import { t } from '../../i18n'
import { freeThrowQuality, rad, refSpeed, REF_ANGLE, SHOTS, trajectory } from '../../engine/minigames/shot'
import { FLIGHT_MS } from './Shot'

// LANCES LIVRES (spec B): dois toques em ARREMESSAR, cada um anima a bola; quality =
// skill(três) sem defensor. Sem medidor, sem timing. Usado pela prancheta na falta puxada.

const M = 30, X0 = 60, GY = 150, W = 300, H = 170
const px = (xm: number) => X0 + xm * M
const py = (h: number) => Math.min(GY, Math.max(2, GY - h * M))
const FT = SHOTS.mid            // 5.0 m ≈ linha do lance livre (4.57 m)

export function FreeThrows({ lang, build, age, onDone }: { lang: Lang; build: Build; age: number; onDone(q: number): void }) {
  const q = useMemo(() => freeThrowQuality(build, age), [build, age])
  const [shot, setShot] = useState(0)                      // 0..2 lances soltos
  const [flying, setFlying] = useState(false)
  const [, setFrame] = useState(0)
  const t0 = useRef(0), now = useRef(0)
  const sent = useRef(false)

  useEffect(() => {
    if (!flying) return
    let raf = 0
    const loop = (ts: number) => {
      now.current = ts
      if (ts - t0.current >= FLIGHT_MS) {
        setFlying(false)
        if (shot >= 2 && !sent.current) { sent.current = true; onDone(q) }
        return
      }
      setFrame(f => f + 1); raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying])

  const tap = () => { if (flying || shot >= 2) return; setShot(s => s + 1); t0.current = performance.now(); now.current = t0.current; setFlying(true) }
  const tr = trajectory(rad(REF_ANGLE.mid), refSpeed('mid'), FT.releaseH)
  const p = flying ? Math.min(1, (now.current - t0.current) / FLIGHT_MS) : 0
  const ball = flying ? tr.pointAt(p * tr.tEnd) : { x: 0.35, y: 1.15 }
  const hoop = px(FT.d), rimY = py(3.05)

  return (
    <div className="mg mg-shot mg-ft">
      <div className="mg-sh-stage">
        <svg className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect className="mg-sh__paper" x={0} y={0} width={W} height={H} />
          <line className="mg-sh__floor" x1={0} y1={GY} x2={W} y2={GY} />
          <line className="mg-sh__board" x1={hoop + 0.15 * M} y1={rimY - 1.05 * M} x2={hoop + 0.15 * M} y2={rimY + 0.3 * M} />
          <line className="mg-sh__rim" x1={hoop - 0.32 * M} y1={rimY} x2={hoop + 0.15 * M} y2={rimY} />
          <g className="mg-sh__fig">
            <line x1={X0} y1={GY} x2={X0 - 6} y2={py(0.95)} /><line x1={X0} y1={GY} x2={X0 + 6} y2={py(0.95)} />
            <line x1={X0} y1={py(0.95)} x2={X0} y2={py(1.8)} /><circle cx={X0} cy={py(1.85)} r={5} />
          </g>
          <circle className="mg-sh__ball" cx={px(ball.x)} cy={py(ball.y)} r={5} />
        </svg>
      </div>
      <div className="mg-sh-bar">
        <div className="mg-sh-row">
          <span className="mono-label mono-label--red">{t(lang, 'mg.ft.title')}</span>
          <span className="mg-sh-label">{t(lang, 'mg.ft.n', { n: Math.min(2, shot + 1) })}</span>
          <span className="mg-sh-label">{t(lang, 'mg.shot.skill')} <b>{Math.round(q * 100)}%</b></span>
        </div>
        <button type="button" className="mg-btn mg-btn--red" disabled={flying || shot >= 2} onClick={tap}>{t(lang, 'mg.shoot')}</button>
      </div>
    </div>
  )
}
