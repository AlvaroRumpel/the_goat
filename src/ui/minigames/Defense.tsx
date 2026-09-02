import { useEffect, useRef, useState } from 'react'
import type { MinigameProps } from './types'
import { t } from '../../i18n'
import { createRng } from '../../engine/rng'
import {
  attackerOffset, createSequence, describeBeat, evaluateBeat, resultOf,
  type BeatResult, type Input,
} from '../../engine/minigames/defense'

// MURALHA — defesa por reação (spec §2.7). O sequenciador é ritmo de jogo: NÃO respeita
// prefers-reduced-motion (só a decoração CSS em mg-defense.css fica atrás do media query).
type Phase = 'ready' | 'wait' | 'cue' | 'verdict' | 'done'
interface View { phase: Phase; i: number; log: BeatResult[]; flash: string | null; move: Input | null }

const READY_MS = 800
const FLASH_MS = 350
const SLIDE_PX = 150

function flashKey(r: BeatResult): string {
  if (r.input === 'steal') return r.kind === 'expose' && r.verdict === 'hit' ? 'mg.def.stealHit' : 'mg.def.stealMiss'
  return `mg.def.${r.verdict}`
}

export function DefenseGame({ seed, context, number, lang, onResolve, outcome }: MinigameProps) {
  const [seq] = useState(() => createSequence(createRng(seed), context.kind))
  const [view, setView] = useState<View>({ phase: 'ready', i: 0, log: [], flash: null, move: null })

  // estado mutável do sequenciador (refs: o handler de input lê o instante atual sem re-render)
  const phase = useRef<Phase>('ready')
  const beatIdx = useRef(0)
  const openAt = useRef(0)
  const log = useRef<BeatResult[]>([])
  const resolved = useRef(false)
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve
  const settleRef = useRef<(i: number, input: Input | null, reactionMs: number | null) => void>(() => {})

  useEffect(() => {
    const timers: number[] = []
    const after = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)) }
    const { beats, windowMs } = seq
    log.current = []

    const show = (p: Phase, patch: Partial<View> = {}) => {
      phase.current = p
      setView(v => ({ ...v, phase: p, i: beatIdx.current, log: [...log.current], ...patch }))
    }
    const finish = () => {
      show('done', { move: null })
      if (resolved.current) return
      resolved.current = true
      onResolveRef.current(resultOf(log.current))
    }
    const settle = (i: number, input: Input | null, reactionMs: number | null) => {
      if (phase.current !== 'cue' || beatIdx.current !== i) return
      const r = evaluateBeat(beats[i], input, reactionMs, windowMs)
      log.current.push(r)
      show('verdict', { flash: flashKey(r), move: input })
      after(FLASH_MS, () => {
        if (input === 'steal' || i === beats.length - 1) finish()
        else start(i + 1)
      })
    }
    const start = (i: number) => {
      beatIdx.current = i
      show('wait', { flash: null, move: null })
      after(beats[i].delayMs, () => {
        openAt.current = performance.now()
        show('cue')
        after(windowMs, () => settle(i, null, null))
      })
    }
    settleRef.current = settle

    show('ready')
    after(READY_MS, () => start(0))
    return () => { timers.forEach(clearTimeout); phase.current = 'ready' }
  }, [seq])

  const press = (input: Input) => {
    if (outcome || phase.current === 'done') return
    if (phase.current === 'cue') settleRef.current(beatIdx.current, input, performance.now() - openAt.current)
    else setView(v => ({ ...v, move: input }))
  }
  const pressRef = useRef(press)
  pressRef.current = press

  useEffect(() => {
    const KEYS: Record<string, Input> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'contest', KeyS: 'steal' }
    const onKey = (e: KeyboardEvent) => {
      const input = KEYS[e.code]
      if (!input) return
      e.preventDefault()
      pressRef.current(input)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { beats } = seq
  const cur = beats[view.i]
  const active = view.phase === 'cue' || view.phase === 'verdict'
  const kind = active ? cur.kind : null
  const attackerX = kind ? attackerOffset(kind) * SLIDE_PX : 0
  const attackerY = kind === 'shoot' ? -90 : 0
  const youX = view.move === 'left' ? -SLIDE_PX : view.move === 'right' ? SLIDE_PX : 0
  const youY = view.move === 'contest' ? -70 : view.move === 'steal' ? 70 : 0

  const cueText = view.phase === 'ready' ? t(lang, 'mg.def.ready')
    : view.phase === 'cue' ? t(lang, describeBeat(cur.kind))
    : view.phase === 'verdict' && view.flash ? t(lang, view.flash) : ''
  const cueBad = view.phase === 'verdict' && view.flash !== 'mg.def.hit' && view.flash !== 'mg.def.stealHit'
  const done = view.phase === 'done'

  return (
    <div className="mg mg-defense">
      <div className={`mg-df-cue mono-label${view.phase === 'verdict' ? ' mg-df-cue--flash' : ''}${cueBad ? ' mg-df-cue--bad' : ''}`}>
        {cueText}
      </div>
      <svg viewBox="0 0 1000 620" aria-hidden="true">
        {/* piso e cesta (atrás de você) */}
        <rect className="mg-df-floor" x="0" y="530" width="1000" height="90" />
        <line className="mg-df-line" x1="0" y1="530" x2="1000" y2="530" />
        <rect className="mg-df-board" x="440" y="56" width="120" height="70" />
        <ellipse className="mg-df-rim" cx="500" cy="132" rx="34" ry="9" />
        <path className="mg-df-net" d="M470 136 L480 176 M500 141 L500 180 M530 136 L520 176 M470 136 L530 136" />

        {/* você */}
        <g className={`mg-df-you${view.move ? ` mg-df-you--${view.move}` : ''}`}
          style={{ transform: `translate(${youX}px, ${youY}px)` }}>
          <circle cx="500" cy="290" r="52" />
          <text className="headline" x="500" y="304">{number ?? ''}</text>
        </g>

        {/* atacante e bola */}
        <g className={`mg-df-att${kind ? ` mg-df-att--${kind}` : ''}${outcome ? (outcome.success ? ' mg-df-att--stopped' : ' mg-df-att--scored') : ''}`}
          style={{ transform: `translate(${attackerX}px, ${attackerY}px)` }}>
          <circle cx="500" cy="440" r="58" />
          <g className={`mg-df-ball${kind === 'expose' ? ' mg-df-ball--expose' : ''}`}>
            <circle cx="552" cy="462" r="17" />
          </g>
        </g>

        {/* desfecho: bola arca até a cesta (cesta deles) ou clarão de toco/roubo */}
        {outcome && !outcome.success && <circle className="mg-df-shot" cx="552" cy="372" r="17" />}
        {outcome && outcome.success && <circle className="mg-df-block" cx="500" cy="365" r="20" />}
      </svg>

      <div className="mg-df-beats">
        <span className="mono-label">{t(lang, 'mg.def.beats')}</span>
        <div className="mg-df-beats__row">
          {beats.map((_, i) => {
            const r = view.log[i]
            const cls = r ? (r.verdict === 'hit' ? ' mg-df-beat--hit' : ' mg-df-beat--miss')
              : i === view.i && view.phase !== 'ready' && !done ? ' mg-df-beat--now' : ''
            return <span key={i} className={`mg-df-beat${cls}`} />
          })}
        </div>
      </div>

      <div className="mg-row mg-df-row">
        <button type="button" className="mg-btn" disabled={done} onPointerDown={() => press('left')}>{t(lang, 'mg.def.left')}</button>
        <button type="button" className="mg-btn mg-btn--red" disabled={done} onPointerDown={() => press('steal')}>{t(lang, 'mg.def.steal')}</button>
        <button type="button" className="mg-btn mg-btn--warm" disabled={done} onPointerDown={() => press('contest')}>{t(lang, 'mg.def.contest')}</button>
        <button type="button" className="mg-btn" disabled={done} onPointerDown={() => press('right')}>{t(lang, 'mg.def.right')}</button>
      </div>

      {outcome && (
        <div className={`mg-result${outcome.success ? '' : ' mg-result--bad'}`}>
          <span>{t(lang, outcome.success ? 'mg.result.stop' : 'mg.result.scored')}</span>
          {outcome.success && <span className="mg-result__sub">{t(lang, `option.${outcome.optionId}`)}</span>}
        </div>
      )}
    </div>
  )
}
