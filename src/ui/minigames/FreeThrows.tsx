import { useEffect, useMemo, useRef, useState } from 'react'
import type { Build } from '../../engine/types'
import type { Lang } from '../../i18n'
import { t } from '../../i18n'
import { attrMods } from '../../engine/minigames/common'
import { angleValue, evaluate, meterValue, rad, refSpeed, SHOTS } from '../../engine/minigames/shot'

// LANCES LIVRES — mesma mira do arremesso (medidor de dois toques) sem closeout e sem
// salto: dois lances, devolve as duas qualities. Usado pelo quadro tático (Task 11).

const POWER_MS = 1400, ANGLE_MS = 1200
const POWER_MAX = 1.6
const FT: keyof typeof SHOTS = 'mid'      // 5.0m ≈ linha do lance livre (4.57m)

export function FreeThrows({ lang, build, age, onDone }: {
  lang: Lang
  build: Build
  age: number
  onDone(q: [number, number]): void
}) {
  const mods = useMemo(() => attrMods(build, age), [build, age])
  const [shot, setShot] = useState(0)                       // 0 ou 1
  const [stage, setStage] = useState<0 | 1>(0)
  const [, setFrame] = useState(0)
  const t0 = useRef(performance.now())
  const nowRef = useRef(performance.now())
  const powerRef = useRef(0)
  const doneRef = useRef<number[]>([])
  const sent = useRef(false)

  useEffect(() => {
    let raf = 0
    const loop = () => { nowRef.current = performance.now(); setFrame(f => f + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const el = nowRef.current - t0.current
  const power = stage === 0 ? meterValue(el, POWER_MS) : powerRef.current
  const angle = angleValue(el, ANGLE_MS)

  function tap() {
    if (sent.current) return
    if (stage === 0) { powerRef.current = meterValue(performance.now() - t0.current, POWER_MS); setStage(1); t0.current = performance.now(); return }
    const a = angleValue(performance.now() - t0.current, ANGLE_MS)
    const ev = evaluate(FT, rad(a), powerRef.current * POWER_MAX * refSpeed(FT), { closeout: null, jump: null, mods })
    doneRef.current.push(ev.quality)
    if (doneRef.current.length === 2) {
      sent.current = true
      onDone([doneRef.current[0], doneRef.current[1]])
      return
    }
    setShot(1); setStage(0); t0.current = performance.now()
  }

  return (
    <div className="mg mg-shot mg-ft">
      <div className="mg-sh-bar">
        <div className="mg-sh-row">
          <span className="mono-label mono-label--red">{t(lang, 'mg.ft.title')}</span>
          <span className="mg-sh-label">{t(lang, 'mg.ft.n', { n: shot + 1 })}</span>
        </div>
        <div className="mg-sh-readouts">
          <span>{t(lang, 'mg.shot.angle')} <b>{stage === 1 ? Math.round(angle) : '--'}°</b></span>
          <span>{t(lang, 'mg.shot.power')} <b>{Math.round(power * 100)}%</b></span>
        </div>
        <div className="mg-ft-track"><div className="mg-ft-fill" style={{ width: `${power * 100}%` }} /></div>
        <button type="button" className="mg-btn mg-btn--red" onClick={tap}>
          {t(lang, stage === 0 ? 'mg.shot.tapPower' : 'mg.shot.tapAngle')}
        </button>
      </div>
    </div>
  )
}
