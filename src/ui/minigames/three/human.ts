import * as THREE from 'three'
import { PAPER, INK, RED } from './arena'

export type Pose = 'stand' | 'shoot' | 'closeout' | 'defend' | 'crossover' | 'dribble' | 'jump'

interface Joints {
  hips: THREE.Group
  armR: [THREE.Group, THREE.Group]
  armL: [THREE.Group, THREE.Group]
  legR: [THREE.Group, THREE.Group]
  legL: [THREE.Group, THREE.Group]
}

interface PoseAngles {
  armR: number[]
  armL: number[]
  legR: number[]
  legL: number[]
  hips: number[]
}

// [ombro.z, ombro.x, cotovelo.x, ombro.y] por braço; [quadril.x, joelho.x] por perna; [hipsY, hipsRotX, hipsRotY]
const POSES: Record<Pose, PoseAngles> = {
  stand:     { armR: [0.25, 0, -0.3, 0],       armL: [0.25, 0, -0.3, 0],        legR: [0, 0],        legL: [0, 0],         hips: [0, 0, 0] },
  shoot:     { armR: [2.6, -0.5, -1.2, 0.2],   armL: [2.2, -0.9, -1.45, -0.2],  legR: [0.55, -1.25], legL: [0.25, -0.5],   hips: [0.6, 0, 0] },
  jump:      { armR: [3.0, 0.1, -0.15, 0],     armL: [3.0, 0.1, -0.15, 0],      legR: [0.4, -0.9],   legL: [0.4, -0.9],    hips: [0.7, 0, 0] },
  closeout:  { armR: [3.05, 0.1, -0.15, 0],    armL: [1.1, 0.5, -0.4, 0],       legR: [0.65, -0.95], legL: [-0.55, -0.15], hips: [0, 0.1, 0] },
  defend:    { armR: [1.4, 0.4, -0.55, 0],     armL: [1.4, 0.4, -0.55, 0],      legR: [0.4, -0.8],   legL: [0.4, -0.8],    hips: [-0.15, 0.22, 0] },
  crossover: { armR: [0.35, -1.0, -0.3, 0.1],  armL: [0.5, -0.6, -1.25, 0.3],   legR: [0.6, -0.95],  legL: [-0.3, -0.25],  hips: [-0.1, 0.32, -0.3] },
  dribble:   { armR: [0.35, -0.8, -0.4, 0.1],  armL: [0.6, 0.1, -0.5, 0],       legR: [0.3, -0.5],   legL: [-0.1, -0.2],   hips: [-0.05, 0.2, 0] },
}

export interface HumanRig {
  root: THREE.Group
  setPose(pose: Pose, k?: number): void
  dispose(): void
}

function labelTex(T: <D extends { dispose(): void }>(x: D) => D, num: number, name: string | null): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d')!
  g.fillStyle = PAPER; g.textAlign = 'center'; g.textBaseline = 'middle'
  if (name) { g.font = 'bold 34px Arial'; g.fillText(name, 128, 40) }
  g.font = 'bold 150px Arial'; g.fillText(String(num), 128, name ? 150 : 128)
  const t = T(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; return t
}

export function buildHuman(opts: { jersey: string; shorts: string; number: number | null; name: string | null; skin?: string; hair?: string; you?: boolean }): HumanRig {
  const disposables: Array<{ dispose(): void }> = []
  const T = <D extends { dispose(): void }>(x: D): D => { disposables.push(x); return x }
  const skin = opts.skin ?? '#7A5A44', hair = opts.hair ?? '#1E1712'

  const J = T(new THREE.MeshStandardMaterial({ color: opts.jersey, roughness: 0.72 }))
  const S = T(new THREE.MeshStandardMaterial({ color: opts.shorts, roughness: 0.72 }))
  const K = T(new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }))
  const P = T(new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.6 }))
  const Hm = T(new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 }))

  const root = new THREE.Group()
  const hips = new THREE.Group(); root.add(hips)

  function limb(len: number, r0: number, r1: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(T(new THREE.CylinderGeometry(r1, r0, len, 10)), mat); m.castShadow = true; m.geometry.translate(0, -len / 2, 0); return m
  }
  function joint(r: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(T(new THREE.SphereGeometry(r, 10, 8)), mat); m.castShadow = true; return m
  }

  // tronco: peito largo → cintura estreita
  const chest = new THREE.Mesh(T(new THREE.CylinderGeometry(0.235, 0.175, 0.4, 14)), J); chest.scale.set(1.15, 1, 0.68); chest.position.y = 1.42; chest.castShadow = true; hips.add(chest)
  const waist = new THREE.Mesh(T(new THREE.CylinderGeometry(0.175, 0.18, 0.22, 14)), J); waist.scale.set(1.15, 1, 0.68); waist.position.y = 1.11; hips.add(waist)
  const traps = new THREE.Mesh(T(new THREE.SphereGeometry(0.2, 14, 10)), J); traps.scale.set(1.5, 0.42, 0.7); traps.position.y = 1.6; hips.add(traps)
  const delt = (sd: 1 | -1) => { const d = new THREE.Mesh(T(new THREE.SphereGeometry(0.085, 10, 8)), J); d.position.set(0.285 * sd, 1.58, 0); d.castShadow = true; hips.add(d) }; delt(1); delt(-1)
  const collar = new THREE.Mesh(T(new THREE.TorusGeometry(0.085, 0.012, 6, 20)), P); collar.rotation.x = Math.PI / 2; collar.position.y = 1.655; hips.add(collar)
  const armhole = (sd: 1 | -1) => { const t = new THREE.Mesh(T(new THREE.TorusGeometry(0.09, 0.01, 6, 18)), P); t.rotation.y = Math.PI / 2; t.position.set(0.27 * sd, 1.5, 0); hips.add(t) }; armhole(1); armhole(-1)
  const sho = new THREE.Mesh(T(new THREE.CylinderGeometry(0.21, 0.24, 0.36, 14)), S); sho.scale.set(1.15, 1, 0.8); sho.position.y = 0.86; sho.castShadow = true; hips.add(sho)
  const stripe = new THREE.Mesh(T(new THREE.BoxGeometry(0.025, 0.34, 0.05)), P); stripe.position.set(0.255, 0.86, 0); hips.add(stripe)
  const stripe2 = new THREE.Mesh(T(new THREE.BoxGeometry(0.025, 0.34, 0.05)), P); stripe2.position.set(-0.255, 0.86, 0); hips.add(stripe2)
  const belt = new THREE.Mesh(T(new THREE.TorusGeometry(0.2, 0.014, 6, 24)), P); belt.rotation.x = Math.PI / 2; belt.scale.set(1.15, 0.8, 1); belt.position.y = 1.0; hips.add(belt)

  // pescoço e cabeça
  const neck = new THREE.Mesh(T(new THREE.CylinderGeometry(0.055, 0.065, 0.11, 10)), K); neck.position.y = 1.7; hips.add(neck)
  const headG = new THREE.Group(); headG.position.y = 1.86; hips.add(headG)
  const head = new THREE.Mesh(T(new THREE.SphereGeometry(0.118, 18, 14)), K); head.scale.set(0.88, 1.12, 0.94); head.castShadow = true; headG.add(head)
  const jaw = new THREE.Mesh(T(new THREE.SphereGeometry(0.09, 12, 8)), K); jaw.scale.set(0.95, 0.75, 0.95); jaw.position.set(0, -0.07, 0.01); headG.add(jaw)
  const capH = new THREE.Mesh(T(new THREE.SphereGeometry(0.128, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58)), Hm); capH.scale.set(0.92, 1.0, 0.98); capH.position.y = 0.03; headG.add(capH)
  const capB = new THREE.Mesh(T(new THREE.SphereGeometry(0.12, 14, 10)), Hm); capB.scale.set(0.85, 0.7, 0.7); capB.position.set(0, 0.0, -0.04); headG.add(capB)
  const eyeM = T(new THREE.MeshStandardMaterial({ color: '#120E0B' })); const whiteM = T(new THREE.MeshStandardMaterial({ color: '#EFE8DA' }))
  ;[-0.042, 0.042].forEach(ex => {
    const w = new THREE.Mesh(T(new THREE.SphereGeometry(0.017, 8, 6)), whiteM); w.scale.set(1.2, 0.8, 0.6); w.position.set(ex, 0.005, 0.104); headG.add(w)
    const e = new THREE.Mesh(T(new THREE.SphereGeometry(0.009, 8, 6)), eyeM); e.position.set(ex, 0.005, 0.114); headG.add(e)
  })
  const brow = new THREE.Mesh(T(new THREE.BoxGeometry(0.105, 0.011, 0.02)), Hm); brow.position.set(0, 0.04, 0.104); headG.add(brow)
  const nose = new THREE.Mesh(T(new THREE.ConeGeometry(0.018, 0.05, 6)), K); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.02, 0.118); headG.add(nose)
  const mouth = new THREE.Mesh(T(new THREE.BoxGeometry(0.045, 0.008, 0.01)), T(new THREE.MeshStandardMaterial({ color: '#4A2E26' }))); mouth.position.set(0, -0.062, 0.1); headG.add(mouth)
  const ear = new THREE.Mesh(T(new THREE.SphereGeometry(0.024, 8, 6)), K); ear.scale.set(0.5, 1, 0.8); ear.position.set(0.105, -0.005, 0); headG.add(ear)
  const ear2 = new THREE.Mesh(T(new THREE.SphereGeometry(0.024, 8, 6)), K); ear2.scale.set(0.5, 1, 0.8); ear2.position.set(-0.105, -0.005, 0); headG.add(ear2)
  if (opts.you) {
    const band = new THREE.Mesh(T(new THREE.TorusGeometry(0.115, 0.016, 6, 24)), T(new THREE.MeshStandardMaterial({ color: RED })))
    band.rotation.x = Math.PI / 2; band.position.y = 0.05; band.scale.set(0.9, 0.92, 1); headG.add(band)
  }
  if (opts.number !== null) {
    const front = new THREE.Mesh(T(new THREE.PlaneGeometry(0.2, 0.2)), T(new THREE.MeshStandardMaterial({ map: labelTex(T, opts.number, null), transparent: true }))); front.position.set(0.07, 1.46, 0.158); hips.add(front)
    const back = new THREE.Mesh(T(new THREE.PlaneGeometry(0.34, 0.34)), T(new THREE.MeshStandardMaterial({ map: labelTex(T, opts.number, opts.name), transparent: true }))); back.position.set(0, 1.4, -0.152); back.rotation.y = Math.PI; hips.add(back)
  }

  function arm(side: 1 | -1): [THREE.Group, THREE.Group] {
    const g = new THREE.Group(); g.position.set(0.285 * side, 1.56, 0); hips.add(g)
    g.add(limb(0.3, 0.062, 0.05, K))
    const el = new THREE.Group(); el.position.y = -0.31; g.add(el); el.add(joint(0.05, K))
    el.add(limb(0.28, 0.048, 0.036, K))
    const hand = new THREE.Mesh(T(new THREE.SphereGeometry(0.055, 10, 8)), K); hand.scale.set(0.75, 0.5, 1.3); hand.position.y = -0.32; el.add(hand)
    return [g, el]
  }
  function leg(side: 1 | -1, shoe: string): [THREE.Group, THREE.Group] {
    const g = new THREE.Group(); g.position.set(0.12 * side, 0.86, 0); hips.add(g)
    g.add(limb(0.46, 0.095, 0.07, K))
    const kn = new THREE.Group(); kn.position.y = -0.47; g.add(kn); kn.add(joint(0.065, K))
    kn.add(limb(0.42, 0.068, 0.045, K))
    const sock = new THREE.Mesh(T(new THREE.CylinderGeometry(0.052, 0.058, 0.12, 10)), P); sock.position.y = -0.4; kn.add(sock)
    const shoeM = new THREE.Mesh(T(new THREE.BoxGeometry(0.13, 0.09, 0.3)), T(new THREE.MeshStandardMaterial({ color: shoe, roughness: 0.5 }))); shoeM.position.set(0, -0.485, 0.06); shoeM.castShadow = true; kn.add(shoeM)
    const sole = new THREE.Mesh(T(new THREE.BoxGeometry(0.135, 0.03, 0.31)), T(new THREE.MeshStandardMaterial({ color: INK }))); sole.position.set(0, -0.535, 0.06); kn.add(sole)
    return [g, kn]
  }
  const shoeC = opts.you ? RED : PAPER

  const joints: Joints = { hips, armR: arm(1), armL: arm(-1), legR: leg(1, shoeC), legL: leg(-1, shoeC) }

  const shadow = new THREE.Mesh(T(new THREE.CircleGeometry(0.36, 20)), T(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28 })))
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.008; root.add(shadow)

  let cur: PoseAngles = { armR: [...POSES.stand.armR], armL: [...POSES.stand.armL], legR: [...POSES.stand.legR], legL: [...POSES.stand.legL], hips: [...POSES.stand.hips] }

  function writeJoints(p: PoseAngles): void {
    const [shR, elR] = joints.armR
    shR.rotation.z = p.armR[0]; shR.rotation.x = p.armR[1]; shR.rotation.y = p.armR[3]
    elR.rotation.x = p.armR[2]
    const [shL, elL] = joints.armL
    shL.rotation.z = -p.armL[0]; shL.rotation.x = p.armL[1]; shL.rotation.y = -p.armL[3]
    elL.rotation.x = p.armL[2]
    const [hR, knR] = joints.legR
    hR.rotation.x = p.legR[0]; knR.rotation.x = p.legR[1]
    const [hL, knL] = joints.legL
    hL.rotation.x = p.legL[0]; knL.rotation.x = p.legL[1]
    hips.position.y = p.hips[0]; hips.rotation.x = p.hips[1]; hips.rotation.y = p.hips[2]
  }
  writeJoints(cur)

  function setPose(pose: Pose, k?: number): void {
    const target = POSES[pose]
    const kk = k ?? 1
    cur = {
      armR: cur.armR.map((v, i) => THREE.MathUtils.lerp(v, target.armR[i], kk)),
      armL: cur.armL.map((v, i) => THREE.MathUtils.lerp(v, target.armL[i], kk)),
      legR: cur.legR.map((v, i) => THREE.MathUtils.lerp(v, target.legR[i], kk)),
      legL: cur.legL.map((v, i) => THREE.MathUtils.lerp(v, target.legL[i], kk)),
      hips: cur.hips.map((v, i) => THREE.MathUtils.lerp(v, target.hips[i], kk)),
    }
    writeJoints(cur)
  }

  return { root, setPose, dispose: () => disposables.forEach(d => d.dispose()) }
}
