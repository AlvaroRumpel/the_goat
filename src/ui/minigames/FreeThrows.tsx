import { useEffect, useMemo, useRef, useState } from 'react'
import type { Build } from '../../engine/types'
import type { Lang } from '../../i18n'
import { t } from '../../i18n'
import { ballPath, freeThrowQuality, idealSpeed, rad, RIM_H, simulateShot, SPIN, type ShotScene } from '../../engine/minigames/shot'
import { Ball, Figure, Floor, H, Hoop, M, py } from './shotScene'

// LANCES LIVRES (spec B): dois toques em ARREMESSAR, cada um anima a bola (arco ideal, passa
// pela rede, quica); quality = skill(três) sem defensor. Sem medidor, sem timing. Usado pela
// prancheta na falta puxada.

const X0 = 1.6 * M, W = X0 + 6.4 * M
const px = (xm: number) => X0 + xm * M
const FT_D = 4.57, FT_H = 2.05 // linha do lance livre; altura de saída parada
const PATH_HZ = 60
// cena sem defensor (reach −1 = mão nunca no caminho); `who` só precisa de `reach` aqui
const FT_SCENE = { d: FT_D, releaseH: FT_H, gap: 0, who: { reach: -1 }, kind: 'mid', optionId: 'mgMid' } as ShotScene
const FT_FULL = ballPath(FT_SCENE, simulateShot(FT_SCENE, { angle: rad(55), speed: idealSpeed(rad(55), FT_D, FT_H), spin: SPIN }), true, PATH_HZ)
const FT_PATH = FT_FULL.slice(0, FT_FULL.findIndex(p => p.y < RIM_H - 0.6) + PATH_HZ / 2)   // até 0.5 s depois da rede
export const FLIGHT_MS = FT_PATH.length / PATH_HZ * 1000

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
  const ball = flying ? FT_PATH[Math.min(FT_PATH.length - 1, Math.floor((now.current - t0.current) / 1000 * PATH_HZ))] : { x: 0, y: FT_H, r: 0 }

  return (
    <div className="mg mg-shot mg-ft">
      <div className="mg-sh-stage">
        <svg className="mg-sh-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <rect className="mg-sh__paper" x={0} y={0} width={W} height={H} />
          <Floor w={W} />
          <Hoop x={px(FT_D)} />
          <Figure x={px(-0.3)} dir={1} hand={{ x: px(0), y: py(FT_H) }} label="" />
          <Ball x={px(ball.x)} y={py(ball.y)} r={ball.r} />
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
