import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import * as THREE from 'three'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import { attrMods, bestDefender, difficulty, opponentFive } from '../../engine/minigames/common'
import {
  ANGLE_MAX, ANGLE_MIN, angleValue, availableTypes, createCloseout, evaluate, meterValue, rad,
  refSpeed, resultFor, scenarioFor, SHOTS, stepCloseout, trajectory,
  type Closeout, type Jump, type ShotEval, type ShotScenario, type ShotType,
} from '../../engine/minigames/shot'
import { TimingBar } from './TimingBar'
import { buildArena, buildBall, COURT_HZ, disposeObject, INK, RED } from './three/arena'
import { buildHuman } from './three/human'
import { hasWebGL, useThreeScene } from './three/useThreeScene'

// ARREMESSO — cena 3D (arena do protótipo, câmera baixa atrás-direita) + máquina de fases
// pick → aim → jump → flight → done. Física e qualidade vêm de engine/minigames/shot.ts;
// aqui só entrada (arrasto/medidor + timing do salto), cena e a animação do desfecho, que
// OBEDECE `outcome.success` (arremesso perfeito que erra = "girou e saiu").

const HZ = COURT_HZ
const SX = 1.6, SZ = HZ - 8            // arremessador (protótipo)
const DEF_X = 0.7, DEF_Z0 = SZ + 1.7   // defensor colado = 1.7m à frente
const HAND: [number, number, number] = [SX + 0.07, 2.72, SZ + 0.14]   // bola no set point
const HOLD: [number, number, number] = [SX + 0.33, 1.18, SZ + 0.24]   // bola na mão, em pé

// câmera baixa atrás-direita (ref-arremessso.jpg): fecha o enquadramento pra o arremessador
// preencher o terço inferior-direito e a tabela ficar legível a 390px
const CAM_FOV = 34
const CAM_POS: [number, number, number] = [SX + 3.6, 2.05, SZ - 3.4]
const CAM_AT: [number, number, number] = [-0.2, 2.45, HZ - 1.0]

const SHOT_CLOCK = 8                   // segundos de posse a partir da mira
const FLIGHT_MS = 900
const POWER_MAX = 1.6                  // força 1.0 = 1.6 × velocidade de referência
const MAX_DRAG = 140                   // px de arrasto que valem força 1.0
const METER_POWER_MS = 1400, METER_ANGLE_MS = 1200
const JUMP_MS = 900
const MODE_KEY = 'thegoat:shotMode'

type Mode = 'drag' | 'meter'
type Phase = 'pick' | 'aim' | 'jump' | 'flight' | 'done'
type Fate = 'swish' | 'bank' | 'short' | 'long' | 'rimOut' | 'blocked' | 'clockOut'

const TYPE_KEY: Record<ShotType, string> = {
  layup: 'mg.type.layup', mid: 'mg.type.mid', three: 'mg.type.three', dunk: 'mg.type.dunk',
  floater: 'mg.shot.type.floater', stepback: 'mg.shot.type.stepback',
  fadeaway: 'mg.shot.type.fadeaway', bank: 'mg.shot.type.bank',
}
// ponto final da animação (obedece o desfecho); blocked/clockOut têm tratamento próprio
const END: Record<Fate, [number, number, number]> = {
  swish: [0, 2.6, HZ], bank: [0, 2.6, HZ], short: [0, 1.5, HZ - 1.5],
  long: [0, 2.1, HZ + 0.8], rimOut: [0.55, 2.0, HZ - 0.35], blocked: [0, 0, 0], clockOut: [0, 0, 0],
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const loadMode = (): Mode => { try { return localStorage.getItem(MODE_KEY) === 'meter' ? 'meter' : 'drag' } catch { return 'drag' } }
const saveMode = (m: Mode) => { try { localStorage.setItem(MODE_KEY, m) } catch { /* sem storage */ } }

interface Live {
  phase: Phase
  now: number
  co: Closeout | null
  coStart: number
  clock: number
  meterStage: 0 | 1
  meterT0: number
  angle: number
  power: number
  drag: { ox: number; oy: number; angle: number; power: number } | null
  shot: { angle: number; speed: number; ev: ShotEval; t0: number } | null
  clockOut: boolean
}

export function ShotGame(props: MinigameProps) {
  if (!hasWebGL()) return <div className="mg mg-shot"><p className="mg-sh-nogl">{t(props.lang, 'mg.noWebgl')}</p></div>
  return <Shot3D {...props} />
}

function Shot3D({ seed, context, build, age, quarter, league, number, lastName, lang, onResolve, outcome }: MinigameProps) {
  // seed local: scenarioFor primeiro, createCloseout depois (ordem fixa = determinismo)
  const setupRef = useRef<{ rng: Rng; scenario: ShotScenario } | null>(null)
  if (!setupRef.current) { const rng = createRng(seed); setupRef.current = { rng, scenario: scenarioFor(context, rng) } }
  const { rng, scenario } = setupRef.current

  const team = teamById(context.opponentTeamId)
  const defender = useMemo(() => bestDefender(opponentFive(league, context.opponentTeamId)), [league, context.opponentTeamId])
  const diff = useMemo(() => difficulty(context.kind, opponentFive(league, context.opponentTeamId)[0].ovr), [league, context])
  const mods = useMemo(() => attrMods(build, age, quarter), [build, age, quarter])
  const types = useMemo(() => availableTypes(build, age), [build, age])
  // pressão da torcida adversária: só fora de casa
  const noise = scenario.home ? 0 : 0.6 * team.strength / 85 + 0.4 * (team.bigMarket ? 1 : 0)
  const powerMs = METER_POWER_MS / scenario.meterSpeed, angleMs = METER_ANGLE_MS / scenario.meterSpeed

  const [phase, setPhase] = useState<Phase>('pick')
  const [type, setType] = useState<ShotType | null>(null)
  const [mode, setMode] = useState<Mode>(loadMode)
  const [, setFrame] = useState(0)
  const resolved = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef<Live>({
    phase: 'pick', now: performance.now(), co: null, coStart: 1, clock: SHOT_CLOCK,
    meterStage: 0, meterT0: 0, angle: 45, power: 0, drag: null, shot: null, clockOut: false,
  })
  const L = liveRef.current
  const go = useCallback((p: Phase) => { liveRef.current.phase = p; setPhase(p) }, [])

  const typeRef = useRef<ShotType | null>(null)
  typeRef.current = type

  // ---------- transições ----------
  const pick = (tp: ShotType) => {
    if (liveRef.current.phase !== 'pick') return
    setType(tp)
    const l = liveRef.current
    l.co = createCloseout(rng, { difficulty: diff, defender, sep: SHOTS[tp].sep })
    l.coStart = l.co.x
    l.clock = SHOT_CLOCK
    l.meterStage = 0
    l.meterT0 = performance.now()
    go('aim')
  }

  const lockAim = (angleDeg: number, power: number) => {
    const l = liveRef.current
    if (l.phase !== 'aim' || power <= 0.06) return
    l.angle = angleDeg
    l.power = power
    l.drag = null
    go('jump')
  }

  const release = (jump: Jump) => {
    const l = liveRef.current, tp = typeRef.current
    if (!tp || resolved.current) return
    resolved.current = true
    const speed = l.power * POWER_MAX * refSpeed(tp)
    const ev = evaluate(tp, rad(l.angle), speed, { closeout: l.co, jump, mods, bankAim: tp === 'bank' })
    l.shot = { angle: rad(l.angle), speed, ev, t0: performance.now() }
    onResolve(resultFor(tp, ev))
    go('flight')
  }

  const clockOut = () => {
    const l = liveRef.current, tp = typeRef.current
    if (resolved.current) return
    resolved.current = true
    l.clockOut = true
    onResolve({ optionId: SHOTS[tp ?? 'three'].optionId, quality: 0, turnover: true })
    go('done')
  }

  // ---------- laço de lógica (closeout, relógio, medidor, fim do voo) ----------
  useEffect(() => {
    if (phase === 'pick' || phase === 'done') return
    let raf = 0, last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const l = liveRef.current
      l.now = now
      if (l.phase === 'aim' || l.phase === 'jump') {
        if (l.co) l.co = stepCloseout(l.co, dt)
        l.clock = Math.max(0, l.clock - dt)
        if (l.clock === 0) { clockOut(); return }
      }
      if (l.phase === 'flight' && now - l.shot!.t0 >= FLIGHT_MS) { go('done'); return }
      setFrame(f => f + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ---------- teclado: 1..8 escolhe, Espaço trava o medidor ----------
  // o laço de lógica re-renderiza a 60fps: o listener assina UMA vez e lê o closure
  // atual por ref (assinar por render tiraria e poria o handler a cada frame).
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = e => {
    const l = liveRef.current
    if (l.phase === 'pick') { const i = '12345678'.indexOf(e.key); if (i >= 0 && types[i]) pick(types[i]); return }
    if (l.phase === 'aim' && mode === 'meter' && e.key === ' ') { e.preventDefault(); meterTap() }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------- entrada ----------
  const tremor = () => noise ? Math.sin(liveRef.current.now / 1000 * 9) * 0.6 * noise * mods.tremor : 0

  // trava com o `now` do último frame — o mesmo que o HUD desenhou: o que você vê é o que sai
  function meterTap() {
    const l = liveRef.current
    if (l.phase !== 'aim') return
    const now = l.now
    if (l.meterStage === 0) { l.power = meterValue(now - l.meterT0, powerMs); l.meterStage = 1; l.meterT0 = now; return }
    lockAim(angleValue(now - l.meterT0, angleMs) + tremor(), l.power)
  }

  const dragFrom = (ox: number, oy: number, x: number, y: number) => {
    const dx = ox - x, dy = y - oy      // puxa pra trás/baixo = lança pra frente/cima
    return {
      ox, oy,
      angle: clamp(Math.atan2(dy, Math.max(1, dx)) * 180 / Math.PI, ANGLE_MIN, ANGLE_MAX),
      power: Math.min(1, Math.hypot(dx, dy) / MAX_DRAG),
    }
  }
  const onDown = (e: RPointerEvent) => {
    const l = liveRef.current
    if (l.phase !== 'aim') return
    if (mode === 'meter') { meterTap(); return }
    e.currentTarget.setPointerCapture(e.pointerId)
    l.drag = dragFrom(e.clientX, e.clientY, e.clientX, e.clientY)
  }
  const onMove = (e: RPointerEvent) => {
    const l = liveRef.current
    if (!l.drag) return
    l.drag = dragFrom(l.drag.ox, l.drag.oy, e.clientX, e.clientY)
  }
  const onUp = () => {
    const l = liveRef.current
    if (!l.drag) return
    const d = l.drag
    l.drag = null
    lockAim(d.angle + tremor(), d.power)
  }

  // ---------- desfecho (obedece o engine) ----------
  const fate: Fate | null = L.clockOut ? 'clockOut' : !L.shot ? null : (() => {
    const ev = L.shot!.ev
    if (!outcome) return ev.blocked ? 'blocked' : ev.verdict
    if (outcome.success) return type === 'bank' ? 'bank' : 'swish'
    if (ev.blocked) return 'blocked'
    return ev.verdict === 'swish' || ev.verdict === 'bank' ? 'rimOut' : ev.verdict
  })()
  const fateRef = useRef<Fate | null>(null)
  fateRef.current = fate

  // ---------- cena 3D ----------
  useThreeScene(canvasRef, ctx => {
    ctx.scene.background = new THREE.Color('#2E2A24')
    ctx.scene.fog = new THREE.Fog('#2E2A24', 26, 60)
    const arena = buildArena({ teamShort: team.name.toUpperCase() })
    ctx.scene.add(arena.group)
    const you = buildHuman({ jersey: RED, shorts: RED, number, name: lastName || t(lang, 'mg.you'), you: true })
    you.root.position.set(SX, 0, SZ); you.root.rotation.y = 0.15
    ctx.scene.add(you.root)
    const def = buildHuman({ jersey: INK, shorts: INK, number: null, name: defender.short, skin: '#5E4433', hair: '#120E0B' })
    def.root.position.set(DEF_X, 0, DEF_Z0 + 2.5); def.root.rotation.y = Math.PI + 0.2
    ctx.scene.add(def.root)
    const ball = buildBall()
    ball.position.set(...HOLD)
    ctx.scene.add(ball)
    ctx.camera.fov = CAM_FOV
    ctx.camera.position.set(...CAM_POS)
    ctx.camera.lookAt(...CAM_AT)

    const pos = new THREE.Vector3()
    ctx.onFrame(dt => {
      const l = liveRef.current
      if (l.co) {
        def.root.position.z = DEF_Z0 + (l.co.x - 0.5)
        def.setPose(l.co.handUp ? 'closeout' : 'stand', Math.min(1, dt * 6))
      }
      const up = l.phase === 'jump' || l.phase === 'flight' || l.phase === 'done'
      you.setPose(up ? 'shoot' : 'stand', Math.min(1, dt / 0.25))
      ballAt(l, typeRef.current, fateRef.current, def.root.position.z, pos)
      if (l.shot) ball.position.copy(pos)
      else ball.position.lerp(pos, Math.min(1, dt * 8))
    })

    return () => {
      ctx.scene.remove(arena.group, you.root, def.root, ball)
      arena.dispose(); you.dispose(); def.dispose(); disposeObject(ball)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  // ---------- HUD ----------
  const now = L.now
  const meterPower = L.meterStage === 0 ? meterValue(now - L.meterT0, powerMs) : L.power
  const meterAngle = angleValue(now - L.meterT0, angleMs)
  const aiming = phase === 'aim'
  const shake = aiming ? tremor() : 0        // a vaia treme a mira ANTES de travar, não só no lock
  const readAngle = !aiming ? L.angle : mode === 'drag' ? (L.drag ? L.drag.angle + shake : null) : L.meterStage === 1 ? meterAngle + shake : null
  const readPower = !aiming ? L.power : mode === 'drag' ? L.drag?.power ?? null : meterPower
  const coPct = L.co ? clamp((L.coStart - L.co.x) / Math.max(0.1, L.coStart - 0.3), 0, 1) : 0
  const dist = type ? SHOTS[type].d : null

  return (
    <div className="mg mg-shot">
      <div className="mg-sh-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <canvas ref={canvasRef} className="mg-sh-canvas" />
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
        {phase === 'jump' && (
          <div className="mg-sh-jump">
            <TimingBar periodMs={JUMP_MS} window={{ center: 0.5, half: mods.jumpWindow }} vertical
              running={phase === 'jump'} onTap={hit => release(hit)} label={t(lang, 'mg.shot.jumpHint')} />
          </div>
        )}
      </div>

      <div className="mg-sh-bar">
        {phase === 'pick' ? <>
          <span className="mg-sh-label">{t(lang, 'mg.shot.pickType')}</span>
          <div className="mg-sh-pick">
            {types.map((tp, i) => (
              <button key={tp} type="button" className="mg-btn mg-sh-pickbtn" onClick={() => pick(tp)}>
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
              <button key={m} type="button" disabled={phase !== 'aim'}
                onClick={() => { setMode(m); saveMode(m); const l = liveRef.current; l.drag = null; l.meterStage = 0; l.meterT0 = performance.now() }}
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

// Posição da bola: presa na mão até soltar; no voo segue a parábola do engine mapeada na
// linha arremessador→aro e, nos últimos 25%, converge pro ponto do desfecho.
function ballAt(l: Live, type: ShotType | null, fate: Fate | null, defZ: number, out: THREE.Vector3): THREE.Vector3 {
  if (!l.shot || !type) return out.set(...(l.phase === 'pick' || l.phase === 'aim' ? HOLD : HAND))
  const s = SHOTS[type]
  const tr = trajectory(l.shot.angle, l.shot.speed, s.releaseH)
  const el = (l.now - l.shot.t0) / 1000
  const p = clamp(el / (FLIGHT_MS / 1000), 0, 1.15)
  const pt = tr.pointAt(p * tr.tEnd * 1.05)
  const k = pt.x / s.d
  out.set(
    HAND[0] + (0 - HAND[0]) * k,
    pt.y + (HAND[1] - s.releaseH) * Math.max(0, 1 - k * 4),
    HAND[2] + (HZ - HAND[2]) * k,
  )
  if (fate === 'blocked') {
    const hit = Math.min(1, p / 0.35)
    out.lerp(new THREE.Vector3(DEF_X, (l.co?.handH ?? 2.7) + 0.1, defZ), hit)
    if (p > 0.35) out.y -= (p - 0.35) * 4
    return out
  }
  if (p > 0.8) out.lerp(new THREE.Vector3(...END[fate ?? 'swish']), (p - 0.8) / 0.2)
  return out
}
