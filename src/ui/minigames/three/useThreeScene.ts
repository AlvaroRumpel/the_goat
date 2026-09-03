import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export interface SceneCtx {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  onFrame(fn: (dt: number, t: number) => void): void
}

// Monta renderer/câmera/loop no <canvas>; `setup` constrói a cena e devolve um cleanup.
// Loop de rAF é gameplay: não respeita prefers-reduced-motion. Pausa quando a aba esconde.
export function useThreeScene(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  setup: (ctx: SceneCtx) => (() => void) | void,
  deps: unknown[],
): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140)
    const frames: Array<(dt: number, t: number) => void> = []
    const ctx: SceneCtx = { scene, camera, renderer, onFrame: fn => { frames.push(fn) } }
    const cleanup = setup(ctx)
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    let raf = 0, last = performance.now(), t = 0, running = true
    const tick = (now: number) => {
      if (!running) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now; t += dt
      for (const f of frames) f(dt, t)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const vis = () => { running = !document.hidden; if (running) { last = performance.now(); raf = requestAnimationFrame(tick) } }
    document.addEventListener('visibilitychange', vis)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', vis)
      cleanup?.()
      renderer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
