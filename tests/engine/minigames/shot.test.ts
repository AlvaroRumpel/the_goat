import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { initLeague } from '../../../src/data/league'
import { opponentFive } from '../../../src/engine/minigames/common'
import {
  aimNoise, BALL_R, ballPath, BOARD_X, createScene, flightPoint, freeThrowQuality, idealSpeed, launchFromPull, rad, RIM_H, RIM_R,
  shotQuality, simulateShot, skillOf, SPIN_MAX, spinOf, stageFlight, trajectory, type ShotScene,
} from '../../../src/engine/minigames/shot'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number, over: Partial<Record<SlotId, number>> = {}): Build => ({
  attributes: { ...Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])), ...over } as Record<SlotId, number>,
  picks: [], archetype: 'SF', overall: ovr,
})
const league = initLeague()
const five = opponentFive(league, 'bos')
const scene = (over: Partial<ShotScene> = {}): ShotScene => ({ d: 6, releaseH: 2.05, gap: 1.5, who: { ...five[0], reach: 2.8 }, kind: 'mid', optionId: 'mgMid', ...over })

describe('skill', () => {
  test('60 = 0.5, 90 = 1, 40 = 0.25, fadiga reduz, atributo por tipo', () => {
    expect(skillOf(build(60), 27, 'three')).toBeCloseTo(0.5, 5); expect(skillOf(build(90), 27, 'mid')).toBeCloseTo(1, 5)
    expect(skillOf(build(40), 27, 'layup')).toBe(0.25); expect(skillOf(build(60), 27, 'three', 0.3)).toBeCloseTo(0.425, 5)
    const b = build(60, { three: 90, finishing: 40, handles: 75 })
    expect(skillOf(b, 27, 'three')).toBeCloseTo(1, 5); expect(skillOf(b, 27, 'dunk')).toBe(0.25); expect(skillOf(b, 27, 'mid')).toBeCloseTo(0.75, 5)
    expect(skillOf(build(85), 35, 'mid')).toBeLessThan(skillOf(build(85), 27, 'mid'))
    expect(freeThrowQuality(b, 27)).toBeCloseTo(1, 5)
  })
})

describe('cena', () => {
  test('intervalos, determinismo, zona pela distância, defensor antes do aro', () => {
    const kinds = new Set<string>()
    for (let seed = 0; seed < 80; seed++) {
      const s = createScene(createRng(seed), five, build(80), 27)
      expect(s.d).toBeGreaterThanOrEqual(1.2); expect(s.d).toBeLessThan(8.5)
      expect(s.releaseH).toBeGreaterThanOrEqual(1.9); expect(s.releaseH).toBeLessThan(2.6)
      expect(s.gap).toBeGreaterThanOrEqual(0.6); expect(s.gap).toBeLessThanOrEqual(s.d - 0.4)
      expect(s.kind).toBe(s.d < 1.8 ? (s.d < 1.0 ? 'dunk' : 'layup') : s.d < 7.24 ? 'mid' : 'three')
      expect(five.some(p => p.id === s.who.id)).toBe(true)
      kinds.add(s.kind)
    }
    expect(kinds.size).toBeGreaterThanOrEqual(3)
    expect(createScene(createRng(4), five, build(80), 27)).toEqual(createScene(createRng(4), five, build(80), 27))
    for (let seed = 0; seed < 80; seed++) expect(createScene(createRng(seed), five, build(60), 27).kind).not.toBe('dunk')
  })
})

describe('estilingue', () => {
  test('puxar pra trás e pra baixo = frente e cima; curto demais = null; velocidade clampada', () => {
    const l = launchFromPull(-1, -1)!
    expect(l.angle).toBeCloseTo(rad(45), 5); expect(l.speed).toBeCloseTo(Math.SQRT2 * 4, 5)
    expect(launchFromPull(-0.1, 0)).toBeNull()
    expect(launchFromPull(-9, -9)!.speed).toBe(14); expect(launchFromPull(-0.3, -0.3)!.speed).toBe(2)
  })
  test('lançamento ideal (arco alto) = accuracy ≈ 1, fate in; ponto final no aro', () => {
    const sc = scene()
    const f = simulateShot(sc, { angle: rad(60), speed: idealSpeed(rad(60), sc.d, sc.releaseH) })
    expect(f.fate).toBe('in'); expect(f.accuracy).toBeCloseTo(1, 3)
    const end = flightPoint(f, f.tEnd); expect(end.x).toBeCloseTo(sc.d, 3); expect(end.y).toBeCloseTo(RIM_H, 3)
  })
  test('forte demais = long, fraco = short (inclusive sem subir até o aro), raso por baixo da mão = blocked, pra trás = short', () => {
    expect(simulateShot(scene(), { angle: rad(50), speed: 11 }).fate).toBe('long')
    expect(simulateShot(scene(), { angle: rad(50), speed: 6 }).fate).toBe('short')
    expect(simulateShot(scene(), { angle: rad(80), speed: 3 }).fate).toBe('short')
    const b = simulateShot(scene(), { angle: rad(20), speed: 10 }); expect(b.fate).toBe('blocked'); expect(b.accuracy).toBe(0)
    expect(simulateShot(scene(), { angle: rad(120), speed: 8 }).fate).toBe('short')
  })
  test('tolerância: 0.2 m fora (arco alto, com giro) ainda pontua na meia; finalização tolera mais', () => {
    const near = simulateShot(scene(), { angle: rad(60), speed: idealSpeed(rad(60), 6.2, 2.05), spin: SPIN_MAX })
    expect(near.accuracy).toBeGreaterThan(0.3); expect(near.accuracy).toBeLessThan(0.8)
    const fin = scene({ d: 1.4, gap: 0.8, kind: 'layup', optionId: 'mgLayup' })
    const f = simulateShot(fin, { angle: rad(70), speed: idealSpeed(rad(70), 1.7, 2.05), spin: SPIN_MAX })
    expect(f.accuracy).toBeGreaterThan(0.5)
  })
  test('ângulo de entrada: centro perfeito mas raso (lançamento 35°) = flat e accuracy < 0.45; 50° ≈ 0.75; 60° = 1', () => {
    const sc = scene()
    const at = (deg: number) => simulateShot(sc, { angle: rad(deg), speed: idealSpeed(rad(deg), sc.d, sc.releaseH) })
    const flat = at(35), mid = at(50), high = at(60)
    expect(Math.abs(flat.err)).toBeLessThan(0.02); expect(flat.fate).toBe('flat'); expect(flat.accuracy).toBeLessThan(0.45)
    expect(mid.accuracy).toBeGreaterThan(0.6); expect(mid.accuracy).toBeLessThan(0.9); expect(mid.fate).toBe('in')
    expect(high.accuracy).toBeCloseTo(1, 3); expect(high.entry).toBeGreaterThan(rad(50))
    expect(high.accuracy).toBeGreaterThan(mid.accuracy); expect(mid.accuracy).toBeGreaterThan(flat.accuracy)
  })
  test('backspin: mesmo erro de 0.2 m no aro pontua mais com giro (aro amigo); spinOf cresce com skill até SPIN_MAX', () => {
    const sc = scene()
    const l = { angle: rad(60), speed: idealSpeed(rad(60), sc.d + 0.2, sc.releaseH) }
    const dry = simulateShot(sc, { ...l, spin: 0 }), wet = simulateShot(sc, { ...l, spin: SPIN_MAX })
    expect(Math.abs(dry.err - 0.2)).toBeLessThan(0.02); expect(wet.err).toBeCloseTo(dry.err, 6)
    expect(wet.accuracy).toBeGreaterThan(dry.accuracy + 0.1)
    expect(spinOf(0.25)).toBeLessThan(spinOf(1)); expect(spinOf(1)).toBeCloseTo(SPIN_MAX, 6)
  })
  test('aimNoise: skill 1 = sem ruído; skill 0.25 espalha; determinístico', () => {
    const l = { angle: rad(50), speed: 8 }
    expect(aimNoise(createRng(1), 1, l)).toEqual(l)
    const n = aimNoise(createRng(1), 0.25, l)
    expect(n).not.toEqual(l); expect(Math.abs(n.angle - l.angle)).toBeLessThan(rad(20))
    expect(aimNoise(createRng(1), 0.25, l)).toEqual(aimNoise(createRng(1), 0.25, l))
  })
  test('shotQuality ∈ [0,1], cresce com skill, 0 quando bloqueado', () => {
    const sc = scene()
    const f = simulateShot(sc, { angle: rad(60), speed: idealSpeed(rad(60), sc.d, sc.releaseH) })
    expect(shotQuality(f, 1)).toBeCloseTo(1, 3); expect(shotQuality(f, 0.5)).toBeCloseTo(0.8, 3); expect(shotQuality(f, 0.25)).toBeCloseTo(0.7, 3)
    expect(shotQuality(simulateShot(sc, { angle: rad(20), speed: 10 }), 1)).toBe(0)
  })
  test('trajectory (lance livre) sai da altura de saída e chega ao aro', () => {
    const v = idealSpeed(rad(45), 4.57, 2.05); const tr = trajectory(rad(45), v, 2.05)
    expect(tr.pointAt(0).y).toBeCloseTo(2.05, 6); expect(tr.pointAt(tr.tEnd).x).toBeCloseTo(4.57, 3)
  })
})

// ---- física do desfecho (bola de verdade: aro, tabela, chão, mão) ----
const throughHoop = (sc: ShotScene, path: Array<{ x: number; y: number }>) =>
  path.some((p, i) => i > 0 && path[i - 1].y >= RIM_H && p.y < RIM_H && Math.abs(p.x - sc.d) < RIM_R - BALL_R)
describe('desfecho físico', () => {
  test('stageFlight: acerto obedece o outcome — erro geométrico "long" vira arco pelo centro e a bola passa pelo aro', () => {
    const sc = scene()
    const f = simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d + 0.3, sc.releaseH) })
    expect(f.fate).toBe('long')
    const g = stageFlight(sc, f, true)
    expect(Math.abs(g.err)).toBeLessThan(0.02); expect(g.vy).toBe(f.vy); expect(g.h0).toBe(f.h0)
    expect(throughHoop(sc, ballPath(sc, g, true))).toBe(true)
  })
  test('stageFlight: erro obedece o outcome — geometria "in" vira bola no aro e ela NUNCA passa pelo aro', () => {
    const sc = scene()
    const f = simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d, sc.releaseH) })
    expect(f.fate).toBe('in')
    const g = stageFlight(sc, f, false)
    expect(Math.abs(g.err)).toBeGreaterThanOrEqual(0.15)
    expect(throughHoop(sc, ballPath(sc, g, false))).toBe(false)
  })
  test('ballPath: nunca atravessa a tabela nem o chão; forte demais bate na tabela e volta', () => {
    const sc = scene()
    const f = stageFlight(sc, simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d + 0.6, sc.releaseH) }), false)
    const path = ballPath(sc, f, false)
    let back = false
    for (let i = 1; i < path.length; i++) {
      const p = path[i]
      expect(p.y).toBeGreaterThanOrEqual(BALL_R - 1e-6)
      if (p.y > RIM_H - 0.3 && p.y < RIM_H + 0.75) expect(p.x + BALL_R).toBeLessThanOrEqual(sc.d + BOARD_X + 1e-6)
      if (p.x < path[i - 1].x - 1e-4) back = true
    }
    expect(back).toBe(true)
  })
  test('ballPath: com backspin a bola morre no aro (para mais perto da cesta) e o path carrega a rotação', () => {
    const sc = scene()
    const l = { angle: rad(60), speed: idealSpeed(rad(60), sc.d, sc.releaseH) }
    const dry = stageFlight(sc, simulateShot(sc, { ...l, spin: 0 }), false), wet = stageFlight(sc, simulateShot(sc, { ...l, spin: SPIN_MAX }), false)
    expect(dry.fate).toBe('in'); expect(wet.fate).toBe('in')
    const pd = ballPath(sc, dry, false), pw = ballPath(sc, wet, false)
    expect(throughHoop(sc, pw)).toBe(false)
    expect(Math.abs(pw.at(-1)!.x - sc.d)).toBeLessThan(Math.abs(pd.at(-1)!.x - sc.d))
    expect(pd.every(p => p.r === 0)).toBe(true)
    expect(pw[10].r).toBeGreaterThan(pw[5].r); expect(pw[5].r).toBeGreaterThan(0)
  })
  test('ballPath: toco = a bola não passa da mão dele e cai no chão; todo voo termina parado no chão', () => {
    const sc = scene()
    const b = simulateShot(sc, { angle: rad(20), speed: 10 }); expect(b.fate).toBe('blocked')
    const path = ballPath(sc, b, false)
    expect(Math.max(...path.map(p => p.x))).toBeLessThanOrEqual(sc.gap + BALL_R + 0.05)
    expect(path.at(-1)!.y).toBeCloseTo(BALL_R, 1)
    // acerto sorteado (p mínimo 5 %) em cima de um toco geométrico: arco ideal, sem a mão, passa pelo aro
    const lucky = stageFlight(sc, b, true); expect(lucky.fate).toBe('in')
    expect(throughHoop(sc, ballPath(sc, lucky, true))).toBe(true)
    const ok = ballPath(sc, stageFlight(sc, simulateShot(sc, { angle: rad(50), speed: idealSpeed(rad(50), sc.d, sc.releaseH) }), true), true)
    expect(ok.at(-1)!.y).toBeLessThan(RIM_H - 1); expect(ok.length).toBeLessThanOrEqual(60 * 4)
  })
})
