import { useRef } from 'react'
import * as THREE from 'three'
import type { MinigameProps } from './types'
import { t } from '../../i18n'
import { type DuelState, type Move } from '../../engine/minigames/defense'
import { aimLights, buildArena, buildBall, COURT_HZ, disposeObject, INK, RED, WARM } from './three/arena'
import { buildHuman, type Pose } from './three/human'
import { useThreeScene } from './three/useThreeScene'
import { CAM_MS, clamp01, END_MS, useDuelFlow } from './defenseFlow'
import { DuelFrame } from './DuelFrame'

// MURALHA — cena 3D do protótipo (modo `wall`): câmera atrás de você, atacante de frente,
// cesta dele lá no fundo. O fluxo (cartão → duelo → desfecho), os gestos e o HUD vivem em
// `defenseFlow.ts`/`DuelFrame.tsx` (compartilhados com o fallback 2D); aqui só a cena e a animação do
// desfecho, que OBEDECE `outcome.success`.

const HZ = -COURT_HZ                     // meia-quadra perto da câmera: a cesta que ele ataca
const YOU_Z = HZ + 3.3                   // você, de costas (protótipo)
const ATT_Z0 = HZ + 5.7                  // ele com attDist = 7.5 (protótipo)
const ATT_D0 = 7.5, ATT_K = 0.8          // z do atacante = ATT_Z0 − (7.5 − attDist) × 0.8
const CAM_Y = 2.5, CAM_Z = HZ + 0.7, AT_Y = 1.05, AT_Z = HZ + 8.5
const END_CAM = new THREE.Vector3(8.4, 3.2, HZ + 6.4)   // desfecho: vista lateral (a cesta entra no quadro)
const END_AT = new THREE.Vector3(0.3, 2.1, HZ + 2.0)
const IN = new THREE.Vector3(0, 2.5, HZ)                // bola entrando
const OUT = new THREE.Vector3(0.58, 2.25, HZ + 0.5)     // bola girando e saindo

const ATT_POSE: Record<Move, Pose> = {
  hesi: 'dribble', crossL: 'crossover', crossR: 'crossover', spin: 'crossover', legs: 'dribble',
  driveL: 'dribble', driveR: 'dribble', pumpFake: 'jump', shoot: 'jump', pass: 'stand',
}

export function DefenseGame(props: MinigameProps) {
  const { seed, number, lastName, lang } = props
  const flow = useDuelFlow(props)
  const { stRef, star, tend, team, endAt, outRef } = flow
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  return <DuelFrame flow={flow}><canvas ref={canvasRef} className="mg-df-canvas" /></DuelFrame>
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
