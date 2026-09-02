import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import type { MinigameProps } from './types'
import { t } from '../../i18n'
import { createRng } from '../../engine/rng'
import {
  COURT, createPlaybook, moveTo, openness, pass, shoot, shotOptionFor, step,
  type PlaybookState, type Pos,
} from '../../engine/minigames/playbook'

// Quadro tático (JOGADA): SVG meia-quadra top-down, cesta no topo. Loop a 20Hz no engine
// puro; o React só renderiza. Movimento do loop é conteúdo — não respeita reduced-motion.

const S = 100 // metros → unidades do viewBox
const W = COURT.w * S, D = COURT.d * S
const BASKET = { x: COURT.basket.x * S, y: COURT.basket.y * S }
const PAINT = { x: (COURT.basket.x - COURT.paintW / 2) * S, w: COURT.paintW * S, h: COURT.paintD * S }
const ARC_PATH = `M ${COURT.cornerX * S} 0 V ${COURT.cornerY * S} A ${COURT.arc * S} ${COURT.arc * S} 0 0 0 ${(COURT.w - COURT.cornerX) * S} ${COURT.cornerY * S} V 0`
const DT = 0.05

function ballPos(s: PlaybookState): Pos {
  const f = s.ball.flying
  if (!f) return s.attackers[s.ball.holder]
  const a = s.attackers[f.from], b = s.attackers[f.to]
  return { x: a.x + (b.x - a.x) * f.progress, y: a.y + (b.y - a.y) * f.progress }
}

export function PlaybookGame({ seed, context, build, number, lang, onResolve, outcome }: MinigameProps) {
  const rng = useMemo(() => createRng(seed), [seed])
  const [st, setSt] = useState(() =>
    createPlaybook(rng, { kind: context.kind, handles: build.attributes.handles, passing: build.attributes.passing }))
  const ref = useRef(st)
  const svgRef = useRef<SVGSVGElement>(null)
  const resolved = useRef(false)
  const [landed, setLanded] = useState(false)
  // onResolve muda de identidade a cada render do pai (dispatch); fora das deps do efeito,
  // senão o cleanup mata o timer do pouso da bola (review do ciclo arcade).
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  const act = (fn: (s: PlaybookState) => PlaybookState) => { ref.current = fn(ref.current); setSt(ref.current) }

  useEffect(() => {
    if (st.phase !== 'live') return
    const id = setInterval(() => act(s => step(s, DT, rng)), DT * 1000)
    return () => clearInterval(id)
  }, [st.phase, rng])

  useEffect(() => {
    if (resolved.current || !st.result) return
    resolved.current = true
    onResolveRef.current(st.result)
    if (st.phase === 'shooting') { const id = setTimeout(() => setLanded(true), 500); return () => clearTimeout(id) }
  }, [st.result, st.phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ref.current.phase !== 'live') return
      const n = Number(e.key)
      if (n >= 1 && n <= 4) act(s => pass(s, n, rng))
      else if (e.key === ' ') { e.preventDefault(); act(s => shoot(s, 'layup')) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rng])

  const onCourt = (e: PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r || st.phase !== 'live') return
    act(s => moveTo(s, (e.clientX - r.left) / r.width * COURT.w, (e.clientY - r.top) / r.height * COURT.d))
  }

  const live = st.phase === 'live'
  const holder = st.ball.holder
  const opt = shotOptionFor(st)
  const open = st.ball.flying ? 0 : openness(st, holder)
  const target = st.moveTarget[holder]
  const ball = ballPos(st)
  const low = st.clock < 3

  // bola no arremesso: vai ao aro em 500ms; depois, obedece outcome (entra / quica pra fora)
  let ballAt = { x: ball.x * S, y: ball.y * S }
  let ballCls = 'mg-pb__ball'
  if (st.phase === 'shooting') {
    ballAt = { x: BASKET.x, y: BASKET.y }
    ballCls += ' mg-pb__ball--shot'
    if (landed && outcome && !outcome.success) { ballAt = { x: BASKET.x + 140, y: BASKET.y + 260 }; ballCls += ' mg-pb__ball--bounce' }
    else if (landed && outcome?.success) ballAt = { x: BASKET.x, y: BASKET.y + 40 }
  } else if (!st.ball.flying) ballAt = { x: ballAt.x + 26, y: ballAt.y - 26 }

  const resultText = () => {
    if (!outcome) return null
    if (outcome.injury) return [t(lang, 'mg.result.injury'), t(lang, 'option.' + outcome.optionId)]
    if (st.turnover) return [t(lang, 'mg.result.turnover'), t(lang, 'mg.pb.turnover.' + st.turnover)]
    if (outcome.success) return [t(lang, 'mg.result.hit'), t(lang, 'option.' + outcome.optionId)]
    return [t(lang, 'mg.result.miss'), t(lang, 'option.' + outcome.optionId)]
  }
  const res = resultText()
  const bad = !!outcome && (!outcome.success || outcome.injury)

  return (
    <div className="mg mg-pb">
      <div className="mg-pb__top">
        <span className={'mg-pb__clock' + (low ? ' mg-pb__clock--low' : '')}>
          <span className="mg-pb__clock-label">{t(lang, 'mg.clock')}</span> {st.clock.toFixed(1)}
        </span>
        <span className="mg-pb__open">
          <span className="mg-pb__open-label">{t(lang, 'mg.openness')}</span>
          <span className="bar"><span className={'bar__fill' + (open < 0.35 ? ' bar__fill--bad' : '')} style={{ width: `${Math.round(open * 100)}%` }} /></span>
        </span>
      </div>

      <svg ref={svgRef} className="mg-pb__board" viewBox={`0 0 ${W} ${D}`} onPointerDown={onCourt}>
        <rect width={W} height={D} className="mg-pb__floor" />
        <g className="mg-pb__lines">
          <rect x={PAINT.x} y={0} width={PAINT.w} height={PAINT.h} />
          <circle cx={BASKET.x} cy={PAINT.h} r={180} />
          <path d={ARC_PATH} />
          <line x1={BASKET.x - 90} y1={BASKET.y - 37.5} x2={BASKET.x + 90} y2={BASKET.y - 37.5} />
          <circle cx={BASKET.x} cy={BASKET.y} r={22.5} className="mg-pb__rim" />
        </g>

        {target && live && (
          <g className="mg-pb__path">
            <line x1={st.attackers[holder].x * S} y1={st.attackers[holder].y * S} x2={target.x * S} y2={target.y * S} />
            <circle cx={target.x * S} cy={target.y * S} r={10} />
          </g>
        )}

        {st.defenders.map((d, i) => <circle key={i} className="mg-pb__def" cx={d.x * S} cy={d.y * S} r={30} />)}

        {st.attackers.map((p, i) => {
          const you = i === st.you
          const mate = i !== holder && live && !st.ball.flying
          return (
            <g key={i} className={'mg-pb__att' + (mate ? ' mg-pb__att--mate' : '')}
              onPointerDown={mate ? e => { e.stopPropagation(); act(s => pass(s, i, rng)) } : undefined}>
              {mate && <circle cx={p.x * S} cy={p.y * S} r={75} className="mg-pb__hit" />}
              <circle cx={p.x * S} cy={p.y * S} r={34} className={'mg-pb__mag' + (i === holder ? ' mg-pb__mag--holder' : '')} />
              <text x={p.x * S} y={p.y * S + 12} className="mg-pb__num">{you ? (number ?? '★') : i}</text>
              {you && <text x={p.x * S} y={p.y * S + 72} className="mg-pb__tag">{t(lang, 'mg.you')}</text>}
            </g>
          )
        })}

        <circle className={ballCls} r={14} style={{ transform: `translate(${ballAt.x}px, ${ballAt.y}px)` }} />
      </svg>

      <div className="mg-row">
        {opt === 'layup-or-dunk' ? (
          <>
            <button className="mg-btn" disabled={!live} onClick={() => act(s => shoot(s, 'layup'))}>{t(lang, 'mg.type.layup')}</button>
            <button className="mg-btn mg-btn--red" disabled={!live} onClick={() => act(s => shoot(s, 'dunk'))}>{t(lang, 'mg.type.dunk')}</button>
          </>
        ) : (
          <button className={'mg-btn' + (opt === 'mgThree' ? ' mg-btn--warm' : '')} disabled={!live || !!st.ball.flying}
            onClick={() => act(s => shoot(s))}>
            {t(lang, 'mg.shoot')} <span className="mg-pb__btn-sub">{t(lang, opt === 'mgAssist' ? 'mg.type.assist' : opt === 'mgThree' ? 'mg.type.three' : 'mg.type.mid')}</span>
          </button>
        )}
      </div>

      {res && (
        <div className={'mg-result' + (bad ? ' mg-result--bad' : '')}>
          <span>{res[0]}</span>
          <span className="mg-result__sub">{res[1]}</span>
        </div>
      )}
    </div>
  )
}
