import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import { initLeague } from '../../../src/data/league'
import { attrMods, opponentFive } from '../../../src/engine/minigames/common'
import { applyTemplate, callScreen, COURT, createPlaybook, feint, inPaint, isSettled, moveTo, openness, pass, pumpFake, setRoute, shoot, startRun, step, toggleScreen, type PlaybookInput, type PlaybookState, type Scheme } from '../../../src/engine/minigames/playbook'
import { SLOT_ORDER, type Build, type SlotId } from '../../../src/engine/types'

const build = (ovr: number): Build => ({ attributes: Object.fromEntries(SLOT_ORDER.map(s => [s, ovr])) as Record<SlotId, number>, picks: [], archetype: 'SF', overall: ovr })
const league = initLeague()
const input = (): PlaybookInput => ({ kind: 'rivalry', five: opponentFive(league, 'bos'), mods: attrMods(build(80), 27), difficulty: 1,
  skill: { layup: 1, mid: 1, three: 1, dunk: 1 }, reboundChance: 0.5 })
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
  test('bloqueio (man): prende uma vez (one-shot) e libera de novo depois de 0.8s', () => {
    let s = { ...applyTemplate(createPlaybook(createRng(3), input()), 'pnr'), scheme: 'man' as const }
    s = startRun(s)
    const rng = createRng(3)
    let everArmed = false, freedAfterFire = false
    for (let i = 0; i < 90 && s.phase === 'run'; i++) {
      s = step(s, 0.05, rng, input())
      const defHolderIdx = s.defenders.findIndex(d => d.man === s.ball.holder)
      const remaining = s.screenedUntil[defHolderIdx] - s.t
      expect(remaining).toBeLessThanOrEqual(0.8 + 1e-9) // nunca rearma além da janela de 0.8s
      if (remaining > 0) everArmed = true
      else if (everArmed) freedAfterFire = true
    }
    expect(everArmed).toBe(true)
    expect(freedAfterFire).toBe(true)
  })
  test('switch: troca de homem uma vez no bloqueio, sem oscilar depois', () => {
    let s = { ...applyTemplate(createPlaybook(createRng(3), input()), 'pnr'), scheme: 'switch' as const }
    s = startRun(s)
    const rng = createRng(3)
    const seen = new Set<string>()
    for (let i = 0; i < 90 && s.phase === 'run'; i++) {
      s = step(s, 0.05, rng, input())
      seen.add(s.defenders.map(d => d.man).join(','))
    }
    expect(seen.size).toBe(2) // configuração inicial + 1 troca — nunca mais que isso
  })
  test('trap: só o defensor do bloqueador dobra no portador, e só enquanto durar', () => {
    let s = { ...applyTemplate(createPlaybook(createRng(3), input()), 'pnr'), scheme: 'trap' as const }
    s = startRun(s)
    const rng = createRng(3)
    let sawWindow = false, sawAfter = false, duringOk = true, afterOk = true
    for (let i = 0; i < 90 && s.phase === 'run'; i++) {
      s = step(s, 0.05, rng, input())
      const holder = s.ball.holder
      const holderPos = s.attackers[holder]
      const trapTarget = { x: holderPos.x + (COURT.basket.x - holderPos.x) * 0.15, y: holderPos.y + (COURT.basket.y - holderPos.y) * 0.15 }
      const doublers = s.defenders.filter(d => d.man !== holder && Math.hypot(d.target.x - trapTarget.x, d.target.y - trapTarget.y) < 0.01).length
      if (s.trapUntil > s.t) { sawWindow = true; if (doublers !== 1) duringOk = false }
      else if (sawWindow) { sawAfter = true; if (doublers !== 0) afterOk = false }
    }
    expect(sawWindow).toBe(true); expect(duringOk).toBe(true)
    expect(sawAfter).toBe(true); expect(afterOk).toBe(true)
  })
  test('zona: bloqueio nunca dispara (screenedUntil fica em zero o run inteiro)', () => {
    let s = { ...applyTemplate(createPlaybook(createRng(3), input()), 'pnr'), scheme: 'zone' as const }
    s = startRun(s)
    const rng = createRng(3)
    for (let i = 0; i < 90 && s.phase === 'run'; i++) {
      s = step(s, 0.05, rng, input())
      expect(s.screenedUntil.every(u => u === 0)).toBe(true)
    }
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

describe('ações', () => {
  const live = (seed: number, tpl: Parameters<typeof applyTemplate>[1] = 'horns') => { let s = applyTemplate(createPlaybook(createRng(seed), input()), tpl); s = { ...s, scheme: 'man' }; return startRun(s) }
  test('passe limpo chega; passe com defensor na linha pode ser interceptado; passe de risco intercepta mais', () => {
    let clean = 0, risky = 0
    for (let seed = 0; seed < 150; seed++) {
      let s = live(seed); const rng = createRng(seed)
      // coloca um defensor no meio da linha 0→2
      const mid = { x: (s.attackers[0].x + s.attackers[2].x) / 2, y: (s.attackers[0].y + s.attackers[2].y) / 2 }
      s = { ...s, defenders: s.defenders.map((d, i) => i === 1 ? { ...d, ...mid } : d) }
      if (pass(s, 2, rng, input()).turnover === 'intercept') clean++
      if (pass(s, 2, createRng(seed), input(), true).turnover === 'intercept') risky++
    }
    expect(clean).toBeGreaterThan(0); expect(risky).toBeGreaterThan(clean)
    let far = live(1); far = { ...far, defenders: far.defenders.map(d => ({ ...d, x: 0.5, y: 13.5 })) }
    expect(pass(far, 2, createRng(1), input()).turnover).toBeNull()
  })
  test('finta abre espaço temporário e pode perder a bola', () => {
    let s = live(2); const d0 = openness(s, 0); s = feint(s, createRng(2), input())
    expect(s.feintUntil).toBeGreaterThan(s.t); expect(openness(s, 0)).toBeGreaterThanOrEqual(d0)
    let lost = 0; for (let seed = 0; seed < 300; seed++) if (feint(live(3), createRng(seed), input()).turnover === 'strip') lost++
    expect(lost).toBeGreaterThan(0); expect(lost).toBeLessThan(60)
  })
  test('pedir bloqueio cria rota com screen no companheiro mais perto', () => {
    const s = callScreen(live(4)); const r = s.routes.findIndex((r, i) => i !== 0 && r.screen && r.points.length > 0)
    expect(r).toBeGreaterThan(0)
  })
  test('finta de arremesso com marcador perto: pumpUntil sobe; às vezes puxa falta (mgFreeThrow)', () => {
    let fouls = 0, pumps = 0
    for (let seed = 0; seed < 200; seed++) { let s = live(seed, 'iso'); s = { ...s, defenders: s.defenders.map(d => d.man === 0 ? { ...d, x: s.attackers[0].x + 0.5, y: s.attackers[0].y } : d) }; s = pumpFake(s, createRng(seed), input()); if (s.phase === 'done' && s.result?.optionId === 'mgFreeThrow') fouls++; else if (s.pumpUntil > s.t) pumps++ }
    expect(fouls).toBeGreaterThan(5); expect(pumps).toBeGreaterThan(100)
  })
  test('shoot: quality = skill × abertura (+0.1 criação); fechado (< 0.4) = rebote por chance: acerta = 2ª posse de 5s, erra = arremesso fraco', () => {
    let open = live(5, 'iso'); open = { ...open, defenders: open.defenders.map(d => ({ ...d, x: 0.5, y: 13.5 })) }
    const half = { ...input(), skill: { layup: 0.5, mid: 0.5, three: 0.5, dunk: 0.5 } }
    const o = shoot(open, createRng(1), half)
    expect(o.phase).toBe('shooting'); expect(o.result!.quality).toBeCloseTo(0.5 * openness(open, 0), 5)
    let tight = live(6, 'iso'); tight = { ...tight, defenders: tight.defenders.map(d => ({ ...d, x: tight.attackers[0].x + 0.4, y: tight.attackers[0].y })) }
    const yes = { next: () => 0, int: () => 0, pick: <T,>(a: T[]) => a[0], chance: () => true }
    const no = { ...yes, chance: () => false }
    const again = shoot(tight, yes, input())
    expect(again.phase).toBe('run'); expect(again.clock).toBe(5); expect(again.reboundUsed).toBe(true); expect(again.rebounds).toBe(1)
    expect(again.firstShotOpenness).toBeLessThan(0.4)
    const miss = shoot(tight, no, input())
    expect(miss.phase).toBe('shooting'); expect(miss.result!.quality).toBeCloseTo(miss.firstShotOpenness! * 1, 5)
  })
  test('putback (spec §2.3): quality = max(1ª abertura, 0.8 × abertura do putback), sem bônus, ≤ 1', () => {
    let tight = live(11, 'iso'); tight = { ...tight, passes: 4, defenders: tight.defenders.map(d => ({ ...d, x: tight.attackers[0].x + 0.4, y: tight.attackers[0].y })) }
    const yes = { next: () => 0, int: () => 0, pick: <T,>(a: T[]) => a[0], chance: () => true }
    const r = shoot(tight, yes, input())
    expect(r.phase).toBe('run')
    const second = { ...r, defenders: r.defenders.map(d => ({ ...d, x: 0.5, y: 13.5 })) }
    expect(second.reboundUsed).toBe(true)
    const put = shoot(second, createRng(1), input())
    expect(put.phase).toBe('shooting')
    const expected = Math.max(second.firstShotOpenness!, 0.8 * openness(second, second.ball.holder))
    expect(put.result!.quality).toBeCloseTo(expected, 5)   // 0.8 puro: sem tipo, relógio nem criação
    expect(put.result!.quality).toBeLessThanOrEqual(1)
  })
  test('bônus de criação: 2 passes antes do arremesso somam 0.1', () => {
    let s = live(7); s = { ...s, defenders: s.defenders.map(d => ({ ...d, x: 0.5, y: 13.5 })) }
    const solo = shoot(s, createRng(1), input()).result!.quality
    let p = { ...s, passes: 2 }
    expect(shoot(p, createRng(1), input()).result!.quality).toBeCloseTo(Math.min(1, solo + 0.1), 5)
  })
  test('carga: infiltrar em defensor parado no garrafão = turnover charge', () => {
    let s = live(8, 'iso'); s = { ...s, defenders: s.defenders.map((d, i) => i === 0 ? { ...d, x: COURT.basket.x, y: COURT.basket.y + 2.0, target: { x: COURT.basket.x, y: COURT.basket.y + 2.0 } } : d) }
    for (let i = 0; i < 20; i++) s = step(s, 0.05, createRng(8), input())   // defensor parado > 0.6s
    s = moveTo(s, COURT.basket.x, COURT.basket.y + 2.0)
    for (let i = 0; i < 60 && s.phase === 'run'; i++) s = step(s, 0.05, createRng(8), input())
    expect(s.turnover).toBe('charge'); expect(s.result?.turnover).toBe(true)
  })
  test('bônus de criação usa lastScreenAt (janela de 1.5s), não a duração do freeze do bloqueio', () => {
    let s = { ...applyTemplate(createPlaybook(createRng(3), input()), 'pnr'), scheme: 'man' as const }
    s = startRun(s)
    const rng = createRng(3)
    for (let i = 0; i < 90 && s.lastScreenAt === -Infinity; i++) s = step(s, 0.05, rng, input())
    expect(s.lastScreenAt).toBeGreaterThan(-Infinity)
    // abre o suficiente pra sair da fase de rebote (eff ≥ 0.4) sem saturar em 1 — sobra espaço pro +0.1 de criação
    const far = (st: PlaybookState) => ({ ...st, defenders: st.defenders.map(d => ({ ...d, x: st.attackers[0].x + 1.7, y: st.attackers[0].y })) })
    const soon = { ...far(s), t: s.lastScreenAt + 1.0 }
    const late = { ...far(s), t: s.lastScreenAt + 2.0 }
    expect(shoot(soon, createRng(1), input()).result!.quality).toBeCloseTo(shoot(late, createRng(1), input()).result!.quality + 0.1, 5)
  })
  test('drible batido no press (sem bloqueio) nunca soma o bônus de criação', () => {
    let s = live(9, 'iso'); s = { ...s, scheme: 'press' as const }
    const holderDefIdx = s.defenders.findIndex(d => d.man === 0)
    s = { ...s, defenders: s.defenders.map((d, i) => i === holderDefIdx ? { ...d, x: COURT.basket.x, y: 11.0 } : { ...d, x: 0.5, y: 13.5 }) }
    s = step(s, 0.05, createRng(9), input())
    expect(s.screenedUntil[holderDefIdx]).toBeGreaterThan(s.t) // blow-by detectado (marcador batido)
    expect(s.lastScreenAt).toBe(-Infinity) // mas nenhum bloqueio de fato ocorreu
    const far = { ...s, defenders: s.defenders.map(d => ({ ...d, x: 0.5, y: 13.5 })) }
    expect(shoot(far, createRng(1), input()).result!.quality).toBeCloseTo(1, 5) // sem bônus: skill(1) × eff(1)
  })
  test('ações ficam bloqueadas com a bola em voo; auto-passe é no-op', () => {
    let s = live(10); s = { ...s, defenders: s.defenders.map(d => ({ ...d, x: 0.5, y: 13.5 })) }
    const afterPass = pass(s, 2, createRng(10), input())
    expect(afterPass.ball.flying).not.toBeNull()
    expect(shoot(afterPass, createRng(1), input())).toBe(afterPass)
    expect(pass(afterPass, 3, createRng(11), input())).toBe(afterPass)
    expect(pass(s, s.ball.holder, createRng(12), input())).toBe(s)
  })
})

describe('isSettled (jogada parada = laço congela)', () => {
  test('só em run, sem bola no ar, rotas concluídas e sem finta ativa', () => {
    const rng = createRng(3)
    let s = createPlaybook(rng, input())
    expect(isSettled(s)).toBe(false)                                   // read/draw nunca
    s = startRun(s)
    expect(isSettled(s)).toBe(true)                                    // nada desenhado: para na hora
    s = moveTo(s, s.attackers[0].x, s.attackers[0].y - 1.5)
    expect(isSettled(s)).toBe(false)                                   // portador em rota
    for (let i = 0; i < 40 && s.phase === 'run' && !isSettled(s); i++) s = step(s, 0.05, rng, input())
    expect(s.phase).toBe('run'); expect(isSettled(s)).toBe(true)      // chegou: parou de novo
    expect(isSettled(feint(s, createRng(99), input()))).toBe(false)    // finta corre 0.6s
    const p = pass(s, 1, createRng(99), input())
    expect(p.phase).toBe('run'); expect(p.ball.flying).not.toBeNull() // passe limpo: bola no ar
    expect(isSettled(p)).toBe(false)
  })
})
