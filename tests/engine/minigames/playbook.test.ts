import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { initLeague } from '../../../src/data/league'
import { attrMods, opponentFive } from '../../../src/engine/minigames/common'
import { applyTemplate, COURT, createPlaybook, inPaint, setRoute, startRun, step, toggleScreen, type PlaybookInput, type PlaybookState, type Scheme } from '../../../src/engine/minigames/playbook'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number): Build => ({ attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>, picks: [], archetype: 'SF', overall: ovr })
const league = initLeague()
const input = (): PlaybookInput => ({ kind: 'rivalry', five: opponentFive(league, 'bos'), mods: attrMods(build(80), 27), difficulty: 1 })
const inside = (p: { x: number; y: number }) => p.x >= 0 && p.x <= COURT.w && p.y >= 0 && p.y <= COURT.d
const run = (s: PlaybookState, secs: number, rng: ReturnType<typeof createRng>) => { for (let i = 0; i < secs * 20; i++) { if (s.phase !== 'run' && s.phase !== 'read') break; s = step(s, 0.05, rng, input()) } return s }

describe('fases e rotas', () => {
  test('createPlaybook começa em read e passa a draw sozinho após 2s; startRun só de draw', () => {
    let s = createPlaybook(createRng(1), input()); expect(s.phase).toBe('read')
    for (let i = 0; i < 45; i++) s = step(s, 0.05, createRng(1), input())
    expect(s.phase).toBe('draw')
    s = startRun(s); expect(s.phase).toBe('run'); expect(s.clock).toBe(12)
  })
  test('scheme sorteado entre os 5, determinístico por seed', () => {
    const seen = new Set<Scheme>()
    for (let seed = 0; seed < 60; seed++) seen.add(createPlaybook(createRng(seed), input()).scheme)
    expect(seen.size).toBeGreaterThanOrEqual(4)
    expect(createPlaybook(createRng(7), input()).scheme).toBe(createPlaybook(createRng(7), input()).scheme)
  })
  test('setRoute clampa na quadra e corta em 6 pontos; toggleScreen alterna', () => {
    let s = applyTemplate(createPlaybook(createRng(1), input()), 'iso')
    s = setRoute(s, 1, Array.from({ length: 9 }, (_, i) => ({ x: -5 + i * 4, y: 30 - i * 5 })))
    expect(s.routes[1].points).toHaveLength(6); expect(s.routes[1].points.every(inside)).toBe(true)
    expect(toggleScreen(s, 1).routes[1].screen).toBe(!s.routes[1].screen)
  })
  test('rodando, os ímãs seguem a rota e ficam na quadra; sem rota, ficam parados', () => {
    let s = applyTemplate(createPlaybook(createRng(2), input()), 'fiveOut')
    s = setRoute(s, 2, [{ ...s.attackers[2] }, { x: 7.6, y: 3.0 }])
    s = setRoute(s, 3, [])
    const before3 = { ...s.attackers[3] }
    s = run(startRun(s), 3, createRng(2))
    expect(s.attackers[2].y).toBeLessThan(5); expect(s.attackers.every(inside) && s.defenders.every(inside)).toBe(true)
    expect(s.attackers[3]).toEqual(before3)
  })
  test('bloqueio prende o defensor mais próximo do portador por 0.8s', () => {
    let s = applyTemplate(createPlaybook(createRng(3), input()), 'pnr')
    s = { ...s, scheme: 'man' }
    const you = s.attackers[0]
    s = setRoute(s, 4, [{ ...s.attackers[4] }, { x: you.x + 0.6, y: you.y + 0.6 }]); s = toggleScreen(s, 4); if (!s.routes[4].screen) s = toggleScreen(s, 4)
    s = run(startRun(s), 2.5, createRng(3))
    expect(s.screenedUntil.some(u => u > 0)).toBe(true)
  })
  test('zona: defensores ocupam áreas (ninguém segue o corte); pressão: marcador a ≤ 0.6m', () => {
    let z = { ...applyTemplate(createPlaybook(createRng(4), input()), 'fiveOut'), scheme: 'zone' as const }
    z = setRoute(z, 2, [{ ...z.attackers[2] }, { x: 1.0, y: 12.0 }]); z = run(startRun(z), 2, createRng(4))
    const follower = z.defenders.find(d => Math.hypot(d.x - z.attackers[2].x, d.y - z.attackers[2].y) < 1.0)
    expect(follower).toBeUndefined()
    let p = { ...applyTemplate(createPlaybook(createRng(5), input()), 'iso'), scheme: 'press' as const }
    p = run(startRun(p), 1, createRng(5))
    const guard = p.defenders[p.defenders.findIndex(d => d.man === 0)]
    expect(Math.hypot(guard.x - p.attackers[0].x, guard.y - p.attackers[0].y)).toBeLessThanOrEqual(0.7)
  })
  test('ajuda: portador no garrafão puxa o defensor do companheiro mais perto da cesta', () => {
    let s = { ...applyTemplate(createPlaybook(createRng(6), input()), 'iso'), scheme: 'man' as const }
    s = setRoute(s, 0, [{ ...s.attackers[0] }, { x: COURT.basket.x, y: COURT.basket.y + 2.5 }])
    s = run(startRun(s), 3, createRng(6))
    expect(inPaint(s.attackers[0])).toBe(true); expect(s.helpUntil).toBeGreaterThan(0)
  })
  test('relógio zerado = turnover clock com mgMid', () => {
    let s = startRun(applyTemplate(createPlaybook(createRng(8), input()), 'horns'))
    for (let i = 0; i < 300 && s.phase === 'run'; i++) s = step(s, 0.05, createRng(8), input())
    expect(s.phase).toBe('turnover'); expect(s.turnover).toBe('clock'); expect(s.result).toEqual({ optionId: 'mgMid', quality: 0, turnover: true })
  })
})
