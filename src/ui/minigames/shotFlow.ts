import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { teamById } from '../../data/teams'
import { attrMods, bestDefender, difficulty, opponentFive, type AttrMods, type OppPlayer } from '../../engine/minigames/common'
import {
  ANGLE_MAX, ANGLE_MIN, angleValue, availableTypes, createCloseout, evaluate, meterValue, rad,
  refSpeed, resultFor, scenarioFor, SHOTS, stepCloseout,
  type Closeout, type Jump, type ShotEval, type ShotScenario, type ShotType,
} from '../../engine/minigames/shot'

// ARREMESSO — fluxo (máquina de fases pick → aim → jump → flight → done, closeout, relógio de
// posse, mira por arrasto/medidor, tremor da torcida) e a moldura de HUD, compartilhados pelos
// dois renderizadores (`ShotFrame.tsx`): cena 3D (`Shot.tsx`) e painel 2D (`ShotFallback.tsx`).
// Física e qualidade vêm de engine/minigames/shot.ts; o desfecho OBEDECE `outcome.success`.

export const SHOT_CLOCK = 8            // segundos de posse a partir da mira
export const FLIGHT_MS = 900
export const POWER_MAX = 1.6           // força 1.0 = 1.6 × velocidade de referência
const MAX_DRAG = 140                   // px de arrasto que valem força 1.0
const METER_POWER_MS = 1400, METER_ANGLE_MS = 1200
const MODE_KEY = 'thegoat:shotMode'

export type Mode = 'drag' | 'meter'
export type Phase = 'pick' | 'aim' | 'jump' | 'flight' | 'done'
export type Fate = 'swish' | 'bank' | 'short' | 'long' | 'rimOut' | 'blocked' | 'clockOut'

export const TYPE_KEY: Record<ShotType, string> = {
  layup: 'mg.type.layup', mid: 'mg.type.mid', three: 'mg.type.three', dunk: 'mg.type.dunk',
  floater: 'mg.shot.type.floater', stepback: 'mg.shot.type.stepback',
  fadeaway: 'mg.shot.type.fadeaway', bank: 'mg.shot.type.bank',
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const loadMode = (): Mode => { try { return localStorage.getItem(MODE_KEY) === 'meter' ? 'meter' : 'drag' } catch { return 'drag' } }
const saveMode = (m: Mode) => { try { localStorage.setItem(MODE_KEY, m) } catch { /* sem storage */ } }

export interface Live {
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

export interface ShotFlow {
  props: MinigameProps
  L: Live                          // estado vivo (mutável, lido a cada frame pelos renderizadores)
  typeRef: { readonly current: ShotType | null }
  fateRef: { readonly current: Fate | null }
  phase: Phase
  type: ShotType | null
  fate: Fate | null
  mode: Mode
  types: ShotType[]
  scenario: ShotScenario
  defender: OppPlayer
  mods: AttrMods
  team: ReturnType<typeof teamById>
  noise: number
  powerMs: number
  angleMs: number
  pick(tp: ShotType): void
  chooseMode(m: Mode): void
  release(jump: Jump): void
  onDown(e: RPointerEvent): void
  onMove(e: RPointerEvent): void
  onUp(): void
}

export function useShotFlow(props: MinigameProps): ShotFlow {
  const { seed, context, build, age, quarter, league, onResolve, outcome } = props
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
  const liveRef = useRef<Live>({
    phase: 'pick', now: performance.now(), co: null, coStart: 1, clock: SHOT_CLOCK,
    meterStage: 0, meterT0: 0, angle: 45, power: 0, drag: null, shot: null, clockOut: false,
  })
  const L = liveRef.current
  const go = useCallback((p: Phase) => { liveRef.current.phase = p; setPhase(p) }, [])

  const typeRef = useRef<ShotType | null>(null)
  typeRef.current = type
  // o pai recria `onResolve` a cada render: o laço lê sempre o mais novo sem reassinar
  const resolveRef = useRef(onResolve)
  resolveRef.current = onResolve

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
    resolveRef.current(resultFor(tp, ev))
    go('flight')
  }

  const clockOut = () => {
    const l = liveRef.current, tp = typeRef.current
    if (resolved.current) return
    resolved.current = true
    l.clockOut = true
    resolveRef.current({ optionId: SHOTS[tp ?? 'three'].optionId, quality: 0, turnover: true })
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
  const chooseMode = (m: Mode) => {
    setMode(m); saveMode(m)
    const l = liveRef.current
    l.drag = null; l.meterStage = 0; l.meterT0 = performance.now()
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

  return {
    props, L, typeRef, fateRef, phase, type, fate, mode, types, scenario, defender, mods,
    team, noise, powerMs, angleMs, pick, chooseMode, release, onDown, onMove, onUp,
  }
}

// Leitura corrente da mira (arrasto ou medidor), com o tremor da vaia já somado: o HUD e o
// arco previsto do fallback 2D mostram exatamente o ângulo/força que sairiam no lock.
export function readout(flow: ShotFlow): { angle: number | null; power: number | null } {
  const { L, phase, mode, noise, mods, powerMs, angleMs } = flow
  const now = L.now
  const meterPower = L.meterStage === 0 ? meterValue(now - L.meterT0, powerMs) : L.power
  const meterAngle = angleValue(now - L.meterT0, angleMs)
  const aiming = phase === 'aim'
  const shake = aiming && noise ? Math.sin(now / 1000 * 9) * 0.6 * noise * mods.tremor : 0
  return {
    angle: !aiming ? L.angle : mode === 'drag' ? (L.drag ? L.drag.angle + shake : null) : L.meterStage === 1 ? meterAngle + shake : null,
    power: !aiming ? L.power : mode === 'drag' ? L.drag?.power ?? null : meterPower,
  }
}
