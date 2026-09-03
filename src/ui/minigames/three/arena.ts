import * as THREE from 'three'

export const PAPER = '#EDE6D6'
export const INK = '#1C1A16'
export const RED = '#A8231C'
export const WARM = '#E8B24A'
export const COURT_HZ = 14.3 - 1.575

export interface Arena {
  group: THREE.Group
  farHoop: THREE.Vector3
  nearHoop: THREE.Vector3
  dispose(): void
}

interface ArenaLights {
  key: THREE.SpotLight
  fill: THREE.SpotLight
  rim: THREE.DirectionalLight
  standsLight: THREE.PointLight
}

// Aponta key/fill/rim/standsLight pro lado `side` (mesmas fórmulas do protótipo, D = side).
function aimAt(lights: ArenaLights, side: 1 | -1): void {
  const D = side
  const HZ = COURT_HZ * D
  lights.key.position.set(4, 13, HZ - 4 * D)
  lights.key.target.position.set(0.5, 0, HZ - 5 * D)
  lights.fill.position.set(-6, 12, HZ - 9 * D)
  lights.fill.target.position.set(-1, 0, HZ - 6 * D)
  lights.rim.position.set(-3, 5, HZ - 14 * D)
  lights.standsLight.position.set(0, 9, HZ + 4 * D)
}

export function aimLights(arena: Arena, side: 1 | -1): void {
  const lights = arena.group.userData.lights as ArenaLights
  aimAt(lights, side)
}

export function buildArena(opts: { crowdRows?: number; teamShort?: string } = {}): Arena {
  const group = new THREE.Group()
  const add = (o: THREE.Object3D) => { group.add(o) }
  const disposables: Array<{ dispose(): void }> = []
  const T = <D extends { dispose(): void }>(x: D): D => { disposables.push(x); return x }

  const rows = opts.crowdRows ?? 9
  const cols = 32
  const bandText = opts.teamShort ?? 'THE GOAT ARENA'

  // ---------- piso ----------
  function woodTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const g = c.getContext('2d')!
    const A = '#D8C59E', B = '#CBB68C'
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? A : B; g.fillRect(i * 64, 0, 64, 1024)
      for (let k = 0; k < 44; k++) { g.strokeStyle = `rgba(110,85,50,${0.05 + (k % 3) * 0.03})`; g.lineWidth = 1 + (k % 2); g.beginPath(); const x = i * 64 + 5 + ((k * 37) % 54); g.moveTo(x, 0); g.bezierCurveTo(x + 7, 300, x - 7, 700, x + 3, 1024); g.stroke() }
      g.fillStyle = 'rgba(80,60,30,0.35)'; g.fillRect(i * 64, 0, 2, 1024)
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(80,60,30,0.22)'; g.fillRect(i * 64 + 2, (k * 211 + i * 53) % 1024, 60, 2) }
    }
    const t = T(new THREE.CanvasTexture(c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 7); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
    return t
  }
  const floor = new THREE.Mesh(T(new THREE.PlaneGeometry(15.24, 28.65)), T(new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.38, metalness: 0.06 })))
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; add(floor)
  const apron = new THREE.Mesh(T(new THREE.PlaneGeometry(44, 64)), T(new THREE.MeshStandardMaterial({ color: '#4A3A34', roughness: 0.95 })))
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.01; apron.receiveShadow = true; add(apron)
  const lineMat = T(new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.6 }))
  function line(x1: number, z1: number, x2: number, z2: number, w = 0.05): void {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz)
    const m = new THREE.Mesh(T(new THREE.BoxGeometry(len, 0.006, w)), lineMat)
    m.position.set((x1 + x2) / 2, 0.004, (z1 + z2) / 2); m.rotation.y = -Math.atan2(dz, dx); add(m)
  }
  function arc(cx: number, cz: number, r: number, a0: number, a1: number, n = 56): void {
    for (let i = 0; i < n; i++) { const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n; line(cx + r * Math.cos(t0), cz + r * Math.sin(t0), cx + r * Math.cos(t1), cz + r * Math.sin(t1)) }
  }
  function halfCourt(sign: 1 | -1): number {
    const BZ = 14.3 * sign, HZ = BZ - 1.575 * sign
    line(-7.62, BZ, 7.62, BZ, 0.08); line(-7.62, BZ, -7.62, 0); line(7.62, BZ, 7.62, 0)
    line(-2.45, BZ, -2.45, BZ - 5.8 * sign); line(2.45, BZ, 2.45, BZ - 5.8 * sign); line(-2.45, BZ - 5.8 * sign, 2.45, BZ - 5.8 * sign)
    arc(0, BZ - 5.8 * sign, 1.8, 0, Math.PI * (sign > 0 ? -1 : 1))
    line(-6.7, BZ, -6.7, BZ - 4.3 * sign); line(6.7, BZ, 6.7, BZ - 4.3 * sign)
    const a = Math.atan2(4.3 - 1.575, -6.7)
    if (sign > 0) arc(0, HZ, 7.24, -a, -(Math.PI - a)); else arc(0, HZ, 7.24, a, Math.PI - a)
    const pole = new THREE.Mesh(T(new THREE.BoxGeometry(0.16, 3.7, 0.16)), T(new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5 }))); pole.position.set(0, 1.85, BZ + 1.3 * sign); pole.castShadow = true; add(pole)
    const base = new THREE.Mesh(T(new THREE.BoxGeometry(1.2, 0.5, 1.6)), T(new THREE.MeshStandardMaterial({ color: RED, roughness: 0.7 }))); base.position.set(0, 0.25, BZ + 1.6 * sign); base.castShadow = true; add(base)
    const armB = new THREE.Mesh(T(new THREE.BoxGeometry(0.12, 0.12, 1.9)), T(new THREE.MeshStandardMaterial({ color: INK }))); armB.position.set(0, 3.6, BZ + 0.35 * sign); add(armB)
    const glassM = T(new THREE.MeshPhysicalMaterial({ color: '#BFCBCD', transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.1 }))
    const glassG = T(new THREE.BoxGeometry(1.83, 1.06, 0.03))
    const glass = new THREE.Mesh(glassG, glassM); glass.position.set(0, 3.35, HZ + 0.6 * sign); add(glass)
    const frame = new THREE.Mesh(T(new THREE.BoxGeometry(1.9, 1.12, 0.02)), T(new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.6 }))); frame.position.set(0, 3.35, HZ + 0.62 * sign); add(frame)
    const glass2 = glass.clone(); glass2.position.z = HZ + 0.58 * sign; add(glass2)
    const sq = new THREE.Mesh(T(new THREE.TorusGeometry(0.3, 0.012, 6, 4)), T(new THREE.MeshStandardMaterial({ color: PAPER }))); sq.rotation.z = Math.PI / 4; sq.position.set(0, 3.25, HZ + 0.56 * sign); add(sq)
    const rim = new THREE.Mesh(T(new THREE.TorusGeometry(0.225, 0.016, 10, 40)), T(new THREE.MeshStandardMaterial({ color: RED, roughness: 0.35, metalness: 0.35 }))); rim.rotation.x = Math.PI / 2; rim.position.set(0, 3.05, HZ); rim.castShadow = true; add(rim)
    const net = new THREE.Mesh(T(new THREE.CylinderGeometry(0.22, 0.13, 0.42, 14, 3, true)), T(new THREE.MeshStandardMaterial({ color: PAPER, wireframe: true, transparent: true, opacity: 0.8 }))); net.position.set(0, 2.84, HZ); add(net)
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#0E0C0A'; g.fillRect(0, 0, 256, 128); g.fillStyle = WARM; g.font = 'bold 84px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('14', 128, 68)
    const ct = T(new THREE.CanvasTexture(c)); ct.colorSpace = THREE.SRGBColorSpace
    const faces = [0, 1, 2, 3].map(() => T(new THREE.MeshStandardMaterial({ color: '#0E0C0A' })))
    const lit = T(new THREE.MeshStandardMaterial({ map: ct, emissive: '#5a3a00', emissiveMap: ct, emissiveIntensity: 1.4 }))
    const clock = new THREE.Mesh(T(new THREE.BoxGeometry(0.9, 0.45, 0.1)), [...faces, lit, lit]); clock.position.set(0, 4.2, HZ + 0.62 * sign); if (sign < 0) clock.rotation.y = Math.PI; add(clock)
    return BZ
  }

  // ---------- arquibancada com cadeiras e torcedores com braços ----------
  function stands(zBase: number, sign: 1 | -1): void {
    const stepM = T(new THREE.MeshStandardMaterial({ color: '#3B342C', roughness: 0.95 }))
    for (let r = 0; r < rows; r++) { const s = new THREE.Mesh(T(new THREE.BoxGeometry(26, 0.5, 1.1)), stepM); s.position.set(0, 0.25 + r * 0.5, zBase + (2.4 + r * 1.1) * sign); s.receiveShadow = true; add(s) }
    const wall = new THREE.Mesh(T(new THREE.BoxGeometry(30, 12, 0.5)), T(new THREE.MeshStandardMaterial({ color: '#26221D', roughness: 1 }))); wall.position.set(0, 6, zBase + (2.4 + rows * 1.1 + 0.6) * sign); add(wall)
    const n = rows * cols
    const seatG = T(new THREE.BoxGeometry(0.5, 0.08, 0.45)), backG = T(new THREE.BoxGeometry(0.5, 0.42, 0.06))
    const seatA = T(new THREE.MeshStandardMaterial({ color: '#6E1F1A', roughness: 0.8 })), seatB = T(new THREE.MeshStandardMaterial({ color: '#2C2622', roughness: 0.8 }))
    const seats = [new THREE.InstancedMesh(seatG, seatA, n), new THREE.InstancedMesh(seatG, seatB, n)]
    const backs = [new THREE.InstancedMesh(backG, seatA, n), new THREE.InstancedMesh(backG, seatB, n)]
    const bodyG = T(new THREE.CapsuleGeometry(0.17, 0.3, 3, 8)), headG = T(new THREE.SphereGeometry(0.1, 8, 6)), armG = T(new THREE.CapsuleGeometry(0.04, 0.32, 2, 6))
    const shirt = [
      T(new THREE.MeshStandardMaterial({ color: '#4A423A', roughness: 0.9 })),
      T(new THREE.MeshStandardMaterial({ color: RED, roughness: 0.9 })),
      T(new THREE.MeshStandardMaterial({ color: '#C9BFA9', roughness: 0.9 })),
      T(new THREE.MeshStandardMaterial({ color: '#2A2420', roughness: 0.9 })),
    ]
    const skin = T(new THREE.MeshStandardMaterial({ color: '#8A6E58', roughness: 0.7 }))
    const bodies = shirt.map(m => new THREE.InstancedMesh(bodyG, m, n))
    const heads = new THREE.InstancedMesh(headG, skin, n)
    const arms = new THREE.InstancedMesh(armG, skin, n * 2)
    const bi = [0, 0, 0, 0]; let hi = 0, ai = 0; const si = [0, 0]
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1)
    for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
      const x = (i - cols / 2 + 0.5) * 0.78 + (r % 2) * 0.2
      const y = 0.5 + r * 0.5, z = zBase + (2.4 + r * 1.1) * sign
      const sec = Math.floor((i + 3) / 8) % 2
      M.makeTranslation(x, y + 0.04, z); seats[sec].setMatrixAt(si[sec], M); M.makeTranslation(x, y + 0.28, z + 0.22 * sign); backs[sec].setMatrixAt(si[sec]++, M)
      const h = (i * 7 + r * 13 + 3) % 13; if (h === 0 || h === 5) continue
      const standing = h % 4 === 1
      const by = standing ? y + 0.75 : y + 0.45
      M.makeTranslation(x, by, z - 0.05 * sign); const k = h % 4; bodies[k].setMatrixAt(bi[k]++, M)
      M.makeTranslation(x, by + 0.42, z - 0.05 * sign); heads.setMatrixAt(hi++, M)
      if (standing) { for (const sd of [-1, 1]) { Q.setFromEuler(new THREE.Euler(0, 0, sd * 0.35)); V.set(x + sd * 0.2, by + 0.55, z - 0.05 * sign); M.compose(V, Q, S1); arms.setMatrixAt(ai++, M) } }
      else { for (const sd of [-1, 1]) { Q.setFromEuler(new THREE.Euler(-1.3, 0, sd * 0.2)); V.set(x + sd * 0.2, by + 0.05, z - 0.2 * sign); M.compose(V, Q, S1); arms.setMatrixAt(ai++, M) } }
    }
    seats.forEach((s, k) => { s.count = si[k]; add(s) }); backs.forEach((s, k) => { s.count = si[k]; add(s) })
    bodies.forEach((b, k) => { b.count = bi[k]; add(b) }); heads.count = hi; add(heads); arms.count = ai; add(arms)
    const bandMat = T(new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.25, roughness: 0.7 }))
    const band = new THREE.Mesh(T(new THREE.BoxGeometry(26, 0.6, 0.06)), bandMat); band.position.set(0, 0.32, zBase + 1.7 * sign); add(band)
    const c = document.createElement('canvas'); c.width = 2048; c.height = 64; const g = c.getContext('2d')!; g.fillStyle = RED; g.fillRect(0, 0, 2048, 64); g.fillStyle = PAPER; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; for (let i = 0; i < 6; i++) g.fillText(bandText, 170 + i * 340, 34)
    const bt = T(new THREE.CanvasTexture(c)); bt.colorSpace = THREE.SRGBColorSpace; bt.wrapS = THREE.RepeatWrapping; bt.repeat.x = sign > 0 ? 1 : -1
    bandMat.map = bt; bandMat.emissiveMap = bt; bandMat.needsUpdate = true
  }

  line(-7.62, 0, 7.62, 0, 0.08); arc(0, 0, 1.8, 0, Math.PI * 2)
  const farBZ = halfCourt(1), nearBZ = halfCourt(-1)
  stands(farBZ, 1); stands(nearBZ, -1)

  // ---------- luz meio-termo ----------
  add(new THREE.HemisphereLight('#FFF1D8', '#4A3E30', 0.9))
  add(new THREE.AmbientLight('#6B5E4E', 0.45))
  const key = new THREE.SpotLight('#FFE6BF', 1400, 60, 0.6, 0.5, 1.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; add(key); add(key.target)
  const fill = new THREE.SpotLight('#FFE6BF', 900, 60, 0.7, 0.6, 1.4); add(fill); add(fill.target)
  const rim = new THREE.DirectionalLight('#E8B24A', 0.5); add(rim)
  const standsLight = new THREE.PointLight('#FFE0B0', 160, 40, 1.6); add(standsLight)
  const lights: ArenaLights = { key, fill, rim, standsLight }
  aimAt(lights, 1)
  group.userData.lights = lights

  return { group, farHoop: new THREE.Vector3(0, 3.05, COURT_HZ), nearHoop: new THREE.Vector3(0, 3.05, -COURT_HZ), dispose: () => disposables.forEach(d => d.dispose()) }
}

// Libera geometria, material(is) e mapas de um objeto avulso (bola, rig temporário).
export function disposeObject(o: THREE.Object3D): void {
  o.traverse(child => {
    const m = child as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []
    for (const mat of mats) {
      for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'alphaMap'] as const) {
        const tex = (mat as any)[key]
        if (tex && tex.dispose) tex.dispose()
      }
      mat.dispose()
    }
  })
}

// Caller descarta a bola com `disposeObject(ball)` quando terminar (sem dispose próprio).
export function buildBall(): THREE.Group {
  const g = new THREE.Group()
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.121, 20, 16), new THREE.MeshStandardMaterial({ color: '#C77E2C', roughness: 0.55 }))
  ball.castShadow = true; g.add(ball)
  const seamRots: Array<[number, number, number]> = [[0, 0, 0], [0, Math.PI / 2, 0], [Math.PI / 2, 0, 0]]
  for (const rot of seamRots) {
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.121, 0.005, 4, 40), new THREE.MeshStandardMaterial({ color: INK }))
    seam.rotation.set(rot[0], rot[1], rot[2]); seam.castShadow = true; g.add(seam)
  }
  return g
}
