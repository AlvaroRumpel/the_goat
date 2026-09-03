import { useRef } from 'react'
import * as THREE from 'three'
import type { MinigameProps } from './types'
import { t } from '../../i18n'
import { SHOTS, trajectory, type ShotType } from '../../engine/minigames/shot'
import { buildArena, buildBall, COURT_HZ, disposeObject, INK, RED } from './three/arena'
import { buildHuman } from './three/human'
import { useThreeScene } from './three/useThreeScene'
import { clamp, FLIGHT_MS, useShotFlow, type Fate, type Live } from './shotFlow'
import { ShotFrame } from './ShotFrame'

// ARREMESSO — cena 3D (arena do protótipo, câmera baixa atrás-direita). A máquina de fases,
// a entrada e o HUD vivem em `shotFlow.ts`/`ShotFrame.tsx` (compartilhados com o fallback 2D);
// cena e a animação do desfecho, que OBEDECE `outcome.success` (arremesso perfeito que erra
// = "girou e saiu").

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

// ponto final da animação (obedece o desfecho); blocked/clockOut têm tratamento próprio
const END: Record<Fate, [number, number, number]> = {
  swish: [0, 2.6, HZ], bank: [0, 2.6, HZ], short: [0, 1.5, HZ - 1.5],
  long: [0, 2.1, HZ + 0.8], rimOut: [0.55, 2.0, HZ - 0.35], blocked: [0, 0, 0], clockOut: [0, 0, 0],
}

export function ShotGame(props: MinigameProps) {
  const { seed, number, lastName, lang } = props
  const flow = useShotFlow(props)
  const { team, defender, typeRef, fateRef, L } = flow   // `L` é estável (useRef) — a cena lê por frame
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      const l = L
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

  return <ShotFrame flow={flow}><canvas ref={canvasRef} className="mg-sh-canvas" /></ShotFrame>
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
