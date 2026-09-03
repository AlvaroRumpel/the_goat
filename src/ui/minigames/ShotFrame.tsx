import type { JSX, ReactNode } from 'react'
import { t } from '../../i18n'
import { ANGLE_MAX, ANGLE_MIN, rad, SHOTS } from '../../engine/minigames/shot'
import { TimingBar } from './TimingBar'
import { clamp, readout, TYPE_KEY, type ShotFlow } from './shotFlow'

const JUMP_MS = 900

// Moldura comum: palco (a cena entra como `children`), HUD, barra de controles e o desfecho.
export function ShotFrame({ flow, children }: { flow: ShotFlow; children: ReactNode }): JSX.Element {
  const { L, phase, type, fate, mode, types, scenario, defender, mods, noise } = flow
  const { lang, outcome } = flow.props
  const { angle: readAngle, power: readPower } = readout(flow)
  const coPct = L.co ? clamp((L.coStart - L.co.x) / Math.max(0.1, L.coStart - 0.3), 0, 1) : 0
  const dist = type ? SHOTS[type].d : null
  // deixa grande, no palco, o que o jogador tem que fazer AGORA (a barra repete em miúdo)
  const cue = phase === 'jump' ? t(lang, 'mg.shot.jumpHint')
    : phase !== 'aim' ? null
    : mode === 'drag' ? (L.drag ? null : t(lang, 'mg.shot.dragHint'))
    : t(lang, L.meterStage === 0 ? 'mg.shot.tapPower' : 'mg.shot.tapAngle')

  return (
    <div className="mg mg-shot">
      <div className="mg-sh-stage" onPointerDown={flow.onDown} onPointerMove={flow.onMove} onPointerUp={flow.onUp} onPointerCancel={flow.onUp}>
        {children}
        <div className="mg-sh-hud">
          <div className="mg-sh-hud__row">
            <span className="mono-label mono-label--red">{t(lang, 'mg.shot.phase.' + (phase === 'done' ? 'flight' : phase))}</span>
            <span className="mg-sh-clock">{t(lang, 'mg.clock')} <b>{Math.ceil(L.clock)}</b></span>
          </div>
          <div className="mg-sh-hud__row">
            <span className="mg-sh-tagline">
              {type ? `${t(lang, TYPE_KEY[type])} · ${dist!.toFixed(1)} m` : ''}
            </span>
            <span className="mg-sh-tagline">{t(lang, scenario.home ? 'mg.shot.home' : 'mg.shot.away')}</span>
          </div>
          {(phase === 'aim' || phase === 'jump') && <>
            <div className="mg-sh-co">
              <span className="mg-sh-tagline">{t(lang, 'mg.shot.closeout')} · {defender.short}</span>
              <div className="mg-sh-co__track"><div className="mg-sh-co__fill" style={{ width: `${coPct * 100}%` }} /></div>
            </div>
            {L.co?.arrived && <span className="mg-sh-warn">{t(lang, 'mg.shot.contested')}</span>}
            {noise > 0 && <span className="mg-sh-warn mg-sh-warn--dim">{t(lang, 'mg.away.noise')}</span>}
          </>}
        </div>
        {phase === 'aim' && <AimGuide angle={readAngle} power={readPower} />}
        {cue && <div className="mg-sh-cue">{cue}</div>}
        {/* o palco inteiro é o alvo do toque do salto (CSS): a barra visível fica à direita */}
        {phase === 'jump' && (
          <div className="mg-sh-jump">
            <TimingBar periodMs={JUMP_MS} window={{ center: 0.5, half: mods.jumpWindow }} vertical
              running={phase === 'jump'} onTap={hit => flow.release(hit)} label={t(lang, 'mg.shot.jumpHint')} />
          </div>
        )}
      </div>

      <div className="mg-sh-bar">
        {phase === 'pick' ? <>
          <span className="mg-sh-label">{t(lang, 'mg.shot.pickType')}</span>
          <div className="mg-sh-pick">
            {types.map((tp, i) => (
              <button key={tp} type="button" className="mg-btn mg-sh-pickbtn" onClick={() => flow.pick(tp)}>
                <span className="mg-sh-pickbtn__top">
                  <span><span className="mg-sh-key">{i + 1}</span>{t(lang, TYPE_KEY[tp])}</span>
                  <span className="mg-sh-key">{SHOTS[tp].d.toFixed(1)} m</span>
                </span>
                <span className="mg-sh-cost">{t(lang, 'mg.shot.cost.' + tp)}</span>
              </button>
            ))}
          </div>
        </> : <div className="mg-sh-row">
          <div className="mg-sh-modes">
            {(['drag', 'meter'] as const).map(m => (
              <button key={m} type="button" disabled={phase !== 'aim'} onClick={() => flow.chooseMode(m)}
                className={'mg-sh-mode' + (mode === m ? ' mg-sh-mode--on' : '')}>{t(lang, 'mg.shot.mode.' + m)}</button>
            ))}
          </div>
          <span className="mg-sh-label">
            {phase === 'jump' ? t(lang, 'mg.shot.jumpHint')
              : phase !== 'aim' ? t(lang, TYPE_KEY[type!])
              : mode === 'drag' ? t(lang, 'mg.shot.dragHint')
              : t(lang, L.meterStage === 0 ? 'mg.shot.tapPower' : 'mg.shot.tapAngle')}
          </span>
          <div className="mg-sh-readouts">
            <span>{t(lang, 'mg.shot.angle')} <b>{readAngle === null ? '--' : Math.round(readAngle)}°</b></span>
            <span>{t(lang, 'mg.shot.power')} <b>{readPower === null ? '--' : Math.round(readPower * 100)}%</b></span>
          </div>
          <div className="mg-ft-track mg-sh-track"><div className="mg-ft-fill" style={{ width: `${(readPower ?? 0) * 100}%` }} /></div>
        </div>}
      </div>

      {phase === 'done' && outcome && (
        <div className={'mg-result' + (!outcome.success || outcome.injury ? ' mg-result--bad' : '')}>
          <span>{t(lang, outcome.injury ? 'mg.result.injury'
            : outcome.success ? 'mg.result.hit'
            : L.clockOut ? 'mg.result.turnover' : 'mg.result.miss')}</span>
          {fate && <span className="mg-result__sub">{t(lang, 'mg.shot.' + fate)}</span>}
        </div>
      )}
    </div>
  )
}

// Guia da mira: leque ANGLE_MIN..ANGLE_MAX e seta no ângulo corrente com comprimento = força.
// Sem ângulo ainda (medidor na força, arrasto não começou) a seta fica no meio, apagada.
function AimGuide({ angle, power }: { angle: number | null; power: number | null }): JSX.Element {
  const O = { x: 12, y: 88 }, R = 74, MIN = 12
  const pt = (deg: number, r: number) => ({ x: O.x + Math.cos(rad(deg)) * r, y: O.y - Math.sin(rad(deg)) * r })
  const a0 = pt(ANGLE_MIN, R), a1 = pt(ANGLE_MAX, R)
  const tip = pt(angle ?? (ANGLE_MIN + ANGLE_MAX) / 2, MIN + (power ?? 0) * (R - MIN))
  return (
    <svg className={'mg-sh-aim' + (angle === null ? ' mg-sh-aim--dim' : '')} viewBox="0 0 100 100" aria-hidden="true">
      <path className="mg-sh-aim__fan" d={`M ${O.x} ${O.y} L ${a0.x.toFixed(1)} ${a0.y.toFixed(1)} A ${R} ${R} 0 0 0 ${a1.x.toFixed(1)} ${a1.y.toFixed(1)} Z`} />
      <line className="mg-sh-aim__arrow" x1={O.x} y1={O.y} x2={tip.x} y2={tip.y} />
      <circle className="mg-sh-aim__tip" cx={tip.x} cy={tip.y} r={3.5} />
    </svg>
  )
}
