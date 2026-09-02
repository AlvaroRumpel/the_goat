import { describe, expect, test } from 'vitest'
import { createRng } from '../../../src/engine/rng'
import {
  attackerOffset, createSequence, describeBeat, evaluateBeat, resultOf, WINDOW_MS,
  type Beat, type BeatResult,
} from '../../../src/engine/minigames/defense'

const beat = (kind: Beat['kind']): Beat => ({ kind, delayMs: 500 })
const W = 650

describe('createSequence', () => {
  test('4..6 beats, last is shoot, delays 350..900 (200 seeds)', () => {
    for (let seed = 0; seed < 200; seed++) {
      const { beats } = createSequence(createRng(seed), 'rivalry')
      expect(beats.length).toBeGreaterThanOrEqual(4)
      expect(beats.length).toBeLessThanOrEqual(6)
      expect(beats[beats.length - 1].kind).toBe('shoot')
      expect(beats.slice(0, -1).every(b => b.kind !== 'shoot')).toBe(true)
      for (const b of beats) {
        expect(b.delayMs).toBeGreaterThanOrEqual(350)
        expect(b.delayMs).toBeLessThanOrEqual(900)
      }
    }
  })
  test('no two identical lateral beats adjacent; at most one expose; hesi when len >= 5', () => {
    let exposes = 0
    for (let seed = 0; seed < 200; seed++) {
      const { beats } = createSequence(createRng(seed), 'seedRace')
      for (let i = 1; i < beats.length; i++) {
        const a = beats[i - 1].kind, b = beats[i].kind
        if (a === 'left' || a === 'right') expect(b).not.toBe(a)
      }
      const n = beats.filter(b => b.kind === 'expose').length
      expect(n).toBeLessThanOrEqual(1)
      exposes += n
      if (beats.length >= 5) expect(beats.some(b => b.kind === 'hesi')).toBe(true)
    }
    expect(exposes).toBeGreaterThan(120) // p=0.8 de 200
  })
  test('windowMs by kind', () => {
    expect(createSequence(createRng(1), 'rivalry').windowMs).toBe(650)
    expect(createSequence(createRng(1), 'special').windowMs).toBe(650)
    expect(createSequence(createRng(1), 'playoff').windowMs).toBe(560)
    expect(createSequence(createRng(1), 'finals').windowMs).toBe(480)
    expect(WINDOW_MS.seedRace).toBe(650)
  })
  test('deterministic per seed', () => {
    for (let seed = 0; seed < 20; seed++) {
      expect(createSequence(createRng(seed), 'finals')).toEqual(createSequence(createRng(seed), 'finals'))
    }
    expect(createSequence(createRng(3), 'finals')).not.toEqual(createSequence(createRng(4), 'finals'))
  })
})

describe('evaluateBeat', () => {
  test('lateral: same direction inside window = hit, outside = late, none = late, wrong = miss', () => {
    expect(evaluateBeat(beat('left'), 'left', 300, W).verdict).toBe('hit')
    expect(evaluateBeat(beat('left'), 'left', 700, W).verdict).toBe('late')
    expect(evaluateBeat(beat('right'), null, null, W).verdict).toBe('late')
    expect(evaluateBeat(beat('right'), 'left', 100, W).verdict).toBe('miss')
  })
  test('hesi: any input = miss, no input = hit', () => {
    expect(evaluateBeat(beat('hesi'), 'left', 100, W).verdict).toBe('miss')
    expect(evaluateBeat(beat('hesi'), 'steal', 100, W).verdict).toBe('miss')
    expect(evaluateBeat(beat('hesi'), null, null, W).verdict).toBe('hit')
  })
  test('expose: steal inside = hit, steal late = late, no input = hit (neutral)', () => {
    expect(evaluateBeat(beat('expose'), 'steal', 200, W).verdict).toBe('hit')
    expect(evaluateBeat(beat('expose'), 'steal', 900, W).verdict).toBe('late')
    expect(evaluateBeat(beat('expose'), null, null, W).verdict).toBe('hit')
  })
  test('shoot: contest inside = hit contested, no input = hit not contested, late contest = late', () => {
    expect(evaluateBeat(beat('shoot'), 'contest', 200, W)).toMatchObject({ verdict: 'hit', contested: true })
    expect(evaluateBeat(beat('shoot'), null, null, W)).toMatchObject({ verdict: 'hit', contested: false })
    expect(evaluateBeat(beat('shoot'), 'contest', 800, W)).toMatchObject({ verdict: 'late', contested: false })
    expect(evaluateBeat(beat('shoot'), 'left', 100, W).verdict).toBe('miss')
  })
})

describe('resultOf', () => {
  const hit = (kind: BeatResult['kind'], input: BeatResult['input'] = null): BeatResult => ({ kind, input, verdict: 'hit' })
  test('steal on expose inside window -> mgSteal quality 1', () => {
    expect(resultOf([hit('left', 'left'), hit('expose', 'steal')])).toEqual({ optionId: 'mgSteal', quality: 1 })
  })
  test('steal elsewhere / late -> mgSteal quality 0', () => {
    expect(resultOf([{ kind: 'hesi', input: 'steal', verdict: 'miss' }])).toEqual({ optionId: 'mgSteal', quality: 0 })
    expect(resultOf([{ kind: 'expose', input: 'steal', verdict: 'late' }])).toEqual({ optionId: 'mgSteal', quality: 0 })
  })
  test('contested shoot -> mgContest with hits/total', () => {
    const log: BeatResult[] = [hit('left', 'left'), { kind: 'right', input: 'left', verdict: 'miss' },
      { kind: 'shoot', input: 'contest', verdict: 'hit', contested: true }]
    expect(resultOf(log)).toEqual({ optionId: 'mgContest', quality: 2 / 3 })
  })
  test('no steal, no contest -> mgLock with hits/total', () => {
    const log: BeatResult[] = [hit('left', 'left'), hit('hesi'), { kind: 'right', input: null, verdict: 'late' },
      { kind: 'shoot', input: null, verdict: 'hit', contested: false }]
    expect(resultOf(log)).toEqual({ optionId: 'mgLock', quality: 0.75 })
  })
  test('quality always in [0,1] over random play', () => {
    const rng = createRng(77)
    const inputs: BeatResult['input'][] = [null, 'left', 'right', 'contest', 'steal']
    for (let seed = 0; seed < 200; seed++) {
      const { beats, windowMs } = createSequence(createRng(seed), 'playoff')
      const log: BeatResult[] = []
      for (const b of beats) {
        const input = rng.pick(inputs)
        log.push(evaluateBeat(b, input, input ? rng.int(0, 1000) : null, windowMs))
        if (input === 'steal') break
      }
      const r = resultOf(log)
      expect(r.quality).toBeGreaterThanOrEqual(0)
      expect(r.quality).toBeLessThanOrEqual(1)
      expect(['mgSteal', 'mgContest', 'mgLock']).toContain(r.optionId)
    }
  })
})

test('describeBeat / attackerOffset', () => {
  expect(describeBeat('expose')).toBe('mg.def.beat.expose')
  expect(attackerOffset('left')).toBe(-1)
  expect(attackerOffset('right')).toBe(1)
  expect(attackerOffset('shoot')).toBe(0)
})
