import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { teamById } from '../../data/teams'
import { attrMods, difficulty, opponentFive, tendencies } from '../../engine/minigames/common'
import {
  createDuel, jump, slide, step, trySteal,
  type DuelInput, type DuelState, type Move,
} from '../../engine/minigames/defense'
import { useSwipe, type Gesture } from './useSwipe'
import { aimLights, buildArena, buildBall, COURT_HZ, disposeObject, INK, RED, WARM } from './three/arena'
import { buildHuman, type Pose } from './three/human'
import { hasWebGL, useThreeScene } from './three/useThreeScene'

// MURALHA — duelo 1x1 contínuo (spec §4) na cena 3D do protótipo (modo `wall`): câmera
// atrás de você, atacante de frente, cesta dele lá no fundo. O engine (defense.ts) roda a
// 20Hz num setInterval com rng local; aqui só entrada (swipes), cena e o desfecho, que
// OBEDECE `outcome.success` (roubo limpo que o engine reprovou vira apito do juiz).
// Fases: card (cartão de tendências) → live (duelo) → end (animação por `phase` do duelo).

const HZ = -COURT_HZ                     // meia-quadra perto da câmera: a cesta que ele ataca
const YOU_Z = HZ + 3.3                   // você, de costas (protótipo)
const ATT_Z0 = HZ + 5.7                  // ele com attDist = 7.5 (protótipo)
const ATT_D0 = 7.5, ATT_K = 0.8          // z do atacante = ATT_Z0 − (7.5 − attDist) × 0.8
const CAM_Y = 2.5, CAM_Z = HZ + 0.7, AT_Y = 1.05, AT_Z = HZ + 8.5
const END_CAM = new THREE.Vector3(8.4, 3.2, HZ + 6.4)   // desfecho: vista lateral (a cesta entra no quadro)
const END_AT = new THREE.Vector3(0.3, 2.1, HZ + 2.0)
const IN = new THREE.Vector3(0, 2.5, HZ)                // bola entrando
const OUT = new THREE.Vector3(0.58, 2.25, HZ + 0.5)     // bola girando e saindo

const CARD_MS = 1200, END_MS = 1200, OVERLAY_MS = 800, CAM_MS = 600
const TAP_COOLDOWN = 350                 // ruling: 2º toque logo após roubo errado = falta de graça
const TICK_MS = 50, DT = 0.05

type Phase = 'card' | 'live' | 'end'

// tela vira o eixo x: a câmera olha pra +z, então o +x do mundo aparece à ESQUERDA
const DIR: Record<'left' | 'right', -1 | 1> = { left: 1, right: -1 }
const ATT_POSE: Record<Move, Pose> = {
  hesi: 'dribble', crossL: 'crossover', crossR: 'crossover', spin: 'crossover', legs: 'dribble',
  driveL: 'dribble', driveR: 'dribble', pumpFake: 'jump', shoot: 'jump', pass: 'stand',
}
const GLYPH: Record<Move, string> = {
  hesi: '~', crossL: '←', crossR: '→', spin: '↺', legs: 'V',
  driveL: '«', driveR: '»', pumpFake: '↑?', shoot: '↑', pass: 'P',
}
const END_KEY: Record<DuelState['phase'], string> = {
  live: 'clock', done: 'pass', steal: 'steal', block: 'block', shot: 'shot',
  drive: 'drive', foul: 'foul', clock: 'clock',
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function DefenseGame(props: MinigameProps) {
  if (!hasWebGL()) return <div className="mg mg-defense"><p className="mg-df-nogl">{t(props.lang, 'mg.noWebgl')}</p></div>
  return <Defense3D {...props} />
}

function Defense3D({ seed, context, build, age, quarter, league, number, lastName, lang, onResolve, outcome }: MinigameProps) {
  const rngRef = useRef<Rng | null>(null)
  if (!rngRef.current) rngRef.current = createRng(seed)
  const rng = rngRef.current

  const team = teamById(context.opponentTeamId)
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const star = five[0]
  const tend = useMemo(() => tendencies(star), [star])
  const input = useMemo<DuelInput>(() => ({
    tend, difficulty: difficulty(context.kind, star.ovr), mods: attrMods(build, age, quarter), starOvr: star.ovr,
  }), [tend, context.kind, star.ovr, build, age, quarter])

  const [phase, setPhase] = useState<Phase>('card')
  const [showResult, setShowResult] = useState(false)
  const [, setFrame] = useState(0)
  const stRef = useRef<DuelState>(createDuel(input))
  const phaseRef = useRef<Phase>('card')
  const endAt = useRef<number | null>(null)
  const tapBlock = useRef(0)
  const resolved = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const outRef = useRef(outcome)
  outRef.current = outcome
  const S = stRef.current

  // ---------- avanço de estado (uma porta só: gesto ou tick) ----------
  const commit = useCallback((s: DuelState) => {
    stRef.current = s
    setFrame(f => f + 1)
    if (s.phase === 'live' || resolved.current) return
    resolved.current = true
    endAt.current = performance.now()
    phaseRef.current = 'end'
    setPhase('end')
    onResolve(s.result!)
    setTimeout(() => setShowResult(true), OVERLAY_MS)
  }, [onResolve])

  useEffect(() => {
    const id = setTimeout(() => { phaseRef.current = 'live'; setPhase('live') }, CARD_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (phase !== 'live') return
    const id = setInterval(() => {
      const s = stRef.current
      if (s.phase === 'live') commit(step(s, DT, rng, input))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [phase, commit, rng, input])

  // ---------- gestos (swipe no palco + setas/espaço) ----------
  const onGesture = useCallback((g: Gesture) => {
    const s = stRef.current
    if (phaseRef.current !== 'live' || s.phase !== 'live') return
    if (g === 'left' || g === 'right') { commit(slide(s, DIR[g], input)); return }
    if (g === 'up') { commit(jump(s, input, rng)); return }
    const now = performance.now()
    if (now - tapBlock.current < TAP_COOLDOWN) return
    const next = trySteal(s, rng, input)
    if (next.phase === 'live' && next.stealTries > s.stealTries) tapBlock.current = now
    commit(next)
  }, [commit, input, rng])
  useSwipe(stageRef, onGesture, phase === 'live')

  // ---------- cena 3D ----------
  useThreeScene(canvasRef, ctx => {
    ctx.scene.background = new THREE.Color('#2E2A24')
    ctx.scene.fog = new THREE.Fog('#2E2A24', 30, 72)
    const arena = buildArena({ teamShort: team.name.toUpperCase() })
    aimLights(arena, -1)
    ctx.scene.add(arena.group)

    const you = buildHuman({ jersey: RED, shorts: RED, number, name: lastName || t(lang, 'mg.you'), you: true })
    you.root.position.set(0, 0, YOU_Z)
    const att = buildHuman({
      jersey: INK, shorts: INK, number: (star.id.charCodeAt(star.id.length - 1) * 7) % 45,
      name: star.short, skin: '#5E4433', hair: '#120E0B',
    })
    att.root.position.set(0, 0, ATT_Z0); att.root.rotation.y = Math.PI
    const mates = ([
      [-3.0, HZ + 4.3, 0.3, RED, 'defend', undefined],
      [3.9, HZ + 3.7, -0.3, RED, 'defend', '#9A7A60'],
      [-4.4, HZ + 7.4, Math.PI, INK, 'stand', '#6E5240'],
      [4.9, HZ + 5.6, Math.PI + 0.4, INK, 'stand', '#8A6A50'],
    ] as Array<[number, number, number, string, Pose, string | undefined]>).map(([x, z, ry, jersey, pose, skin]) => {
      const h = buildHuman({ jersey, shorts: jersey, number: null, name: null, skin })
      h.root.position.set(x, 0, z); h.root.rotation.y = ry; h.setPose(pose)
      return h
    })
    const ball = buildBall()
    const shell = ball.children[0] as THREE.Mesh
    const shellMat = shell.material as THREE.MeshStandardMaterial
    shellMat.emissive = new THREE.Color(WARM)
    shellMat.emissiveIntensity = 0
    ctx.scene.add(you.root, att.root, ball, ...mates.map(m => m.root))
    ctx.camera.position.set(0.9, CAM_Y, CAM_Z)

    const side = tend.side === 'right' ? 1 : -1
    const camP = new THREE.Vector3(), camA = new THREE.Vector3(), bp = new THREE.Vector3()
    ctx.onFrame((dt, time) => {
      const s = stRef.current
      const k = Math.min(1, dt * 9)
      const ended = endAt.current !== null
      const p = ended ? clamp01((performance.now() - endAt.current!) / END_MS) : 0
      const win = outRef.current?.success ?? true

      // corpos
      const run = ended && s.phase === 'steal' && win ? p * 7 : 0
      you.root.position.x += (s.defX - you.root.position.x) * k
      you.root.position.z += (YOU_Z + run - you.root.position.z) * k
      att.root.position.x += (s.attX - att.root.position.x) * k
      att.root.position.z += (ATT_Z0 - (ATT_D0 - s.attDist) * ATT_K - att.root.position.z) * k
      you.setPose(ended && s.phase === 'steal' && win ? 'dribble' : s.airborne > 0 || (ended && s.phase === 'block') ? 'jump' : 'defend', k)
      att.setPose(ended
        ? (s.phase === 'shot' || s.phase === 'drive' ? 'jump' : s.phase === 'foul' ? 'shoot' : 'stand')
        : s.move ? ATT_POSE[s.move.kind] : 'dribble', k)

      // bola
      const ax = att.root.position.x, az = att.root.position.z
      if (!ended) {
        if (s.exposed > 0) bp.set(ax, 0.26, az - 0.05)
        else bp.set(ax + 0.34 * side, 0.5 + Math.abs(Math.sin(time * 6.5)) * 0.55, az - 0.34)
        shellMat.emissiveIntensity = s.exposed > 0 ? 0.9 : 0
      } else {
        shellMat.emissiveIntensity = 0
        endBall(s, p, win, you.root.position, ax, az, bp)
      }
      ball.position.lerp(bp, ended ? Math.min(1, dt * 14) : Math.min(1, dt * 20))

      // câmera: segue o duelo; no desfecho abre pra lateral
      const e = ended ? clamp01((performance.now() - endAt.current!) / CAM_MS) : 0
      const ease = e * e * (3 - 2 * e)
      // pesos: a câmera anda quase colada em você (você fica no mesmo canto do quadro, como
      // no ref) mas mira mais nele — quando ele te bate, você deriva pro lado contrário
      camP.set(0.9 + s.defX * 0.8 + s.attX * 0.2, CAM_Y, CAM_Z).lerp(END_CAM, ease)
      camA.set(0.5 + s.defX * 0.35 + s.attX * 0.65, AT_Y, AT_Z).lerp(END_AT, ease)
      ctx.camera.position.lerp(camP, Math.min(1, dt * 7))
      ctx.camera.lookAt(camA)
    })

    return () => {
      ctx.scene.remove(arena.group, you.root, att.root, ball, ...mates.map(m => m.root))
      arena.dispose(); you.dispose(); att.dispose(); mates.forEach(m => m.dispose()); disposeObject(ball)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  // ---------- HUD ----------
  const pct = (n: number) => Math.round(n * 100) + '%'
  const sideLabel = t(lang, 'mg.def.side.' + tend.side)
  const contain = S.live > 0 ? clamp01(S.contain / S.live) : 0
  // roubo/toco que o engine reprovou vira apito do juiz (a animação obedece o desfecho)
  const whistle = outcome ? !outcome.success && (S.phase === 'steal' || S.phase === 'block') : false
  const endKey = whistle ? 'foul' : END_KEY[S.phase]
  const made = S.freeThrows ? S.freeThrows.filter(Boolean).length : 0

  const card = (big: boolean) => (
    <div className={'mg-df-card' + (big ? ' mg-df-card--big' : '')}>
      <span className="mg-df-card__name">{star.short} · {star.pos} · {star.ovr}</span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.shoot')}</span><b>{pct(tend.shoot)}</b></span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.drive', { side: sideLabel })}</span><b>{pct(tend.drive)}</b></span>
      <span className="mg-df-card__line"><span>{t(lang, 'mg.def.card.pass')}</span><b>{pct(tend.pass)}</b></span>
      <span className="mg-df-card__line mg-df-card__last">
        <span>{t(lang, 'mg.def.last')}</span>
        <b>{S.log.length ? S.log.slice(-4).map(m => GLYPH[m]).join(' ') : '—'}</b>
      </span>
    </div>
  )

  return (
    <div className="mg mg-defense">
      <div className="mg-df-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="mg-df-canvas" />
        <div className="mg-df-hud">
          <div className="mg-df-top">
            {phase === 'card' ? <span /> : card(false)}
            <div className="mg-df-right">
              <span className="mg-df-clock">{t(lang, 'mg.clock')}<b>{Math.max(0, Math.ceil(S.clock))}</b></span>
              <span className="mg-df-contain">
                {t(lang, 'mg.def.contain')}
                <span className="mg-df-contain__track"><span className="mg-df-contain__fill" style={{ width: pct(contain) }} /></span>
              </span>
            </div>
          </div>
          {phase === 'live' && (
            <div className="mg-df-gest">
              <span>{t(lang, 'mg.def.gest.slide')}</span>
              <span>{t(lang, 'mg.def.gest.tap')}</span>
              <span>{t(lang, 'mg.def.gest.up')}</span>
            </div>
          )}
        </div>
        {phase === 'card' && (
          <div className="mg-df-intro">
            <span className="mono-label mono-label--red">{t(lang, 'mg.def.card.title')}</span>
            {card(true)}
            <span className="mg-df-ready">{t(lang, 'mg.def.ready')}</span>
          </div>
        )}
        {phase === 'end' && (
          <div className="mg-df-shout">
            {t(lang, 'mg.def.end.' + endKey)}
            {S.fouled && <small>{t(lang, 'mg.def.ft', { made })}</small>}
            {S.bitFake && !S.fouled && <small>{t(lang, 'mg.def.bitFake')}</small>}
          </div>
        )}
        {showResult && outcome && (
          <div className={'mg-result' + (outcome.success ? '' : ' mg-result--bad')}>
            <span>{t(lang, outcome.success ? 'mg.result.stop' : 'mg.result.scored')}</span>
            <span className="mg-result__sub">
              {outcome.success ? t(lang, 'option.' + S.result!.optionId) : t(lang, 'mg.def.end.' + endKey)}
            </span>
            {S.bitFake && <span className="mg-result__sub">{t(lang, 'mg.def.bitFake')}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// Bola no desfecho: roubo = vai pra sua mão e sai com você; toco = cai; arremesso/infiltração
// = arco até a cesta que OBEDECE `win` (você parou = girou e saiu); falta = os 2 lances dele.
function endBall(s: DuelState, p: number, win: boolean, you: THREE.Vector3, ax: number, az: number, out: THREE.Vector3): void {
  const arc = (fx: number, fy: number, fz: number, to: THREE.Vector3, q: number, h: number) => {
    out.set(fx + (to.x - fx) * q, fy + (to.y - fy) * q + h * Math.sin(Math.PI * q), fz + (to.z - fz) * q)
  }
  if (!win && (s.phase === 'steal' || s.phase === 'block')) {   // apito: a bola fica com ele
    return void out.set(ax + 0.34, 0.95, az - 0.3)
  }
  switch (s.phase) {
    case 'steal': return void out.set(you.x + 0.34, 1.05 + Math.abs(Math.sin(p * 14)) * 0.3, you.z - 0.3)
    case 'block': return void out.set(ax + 0.7, Math.max(0.13, 2.2 - p * 5), az + 0.5 - p * 0.8)
    case 'foul': {
      const n = p < 0.5 ? 0 : 1
      const made = s.freeThrows?.[n] ?? false
      return arc(ax, 2.4, az + 1.6, made ? IN : OUT, clamp01((p - n * 0.5) / 0.45), 1.7)
    }
    case 'shot': return arc(ax, 2.7, az, win ? OUT : IN, p, 1.9)
    case 'drive': return arc(ax, 1.6, az, win ? OUT : IN, p, 0.7)
    default: return void out.set(ax + 0.34, 0.3, az - 0.2)
  }
}
