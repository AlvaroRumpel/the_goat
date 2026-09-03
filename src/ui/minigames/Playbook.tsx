import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { MinigameProps } from './types'
import type { Rng } from '../../engine/types'
import { createRng } from '../../engine/rng'
import { t } from '../../i18n'
import { attrMods, difficulty, opponentFive, reboundChance } from '../../engine/minigames/common'
import { skillOf } from '../../engine/minigames/shot'
import {
  applyTemplate, callScreen, createPlaybook, feint, isSettled, moveTo, openness, pass, pumpFake,
  SCHEME_SIGNAL, setRoute, shoot, shotOptionFor, startRun, step, toggleScreen,
  type PlaybookInput, type PlaybookState, type Pos, type Template,
} from '../../engine/minigames/playbook'
import { FreeThrows } from './FreeThrows'
import { BASKET, COURT_LAYERS, D, MAG_FILTER, S, W } from './Court'

// JOGADA (prancheta) — meia-quadra top-down em SVG, cesta no topo, madeira sépia e ímãs com
// sombra (spec §8, "Direção 2 · Plano refinado"). O engine (playbook.ts) é a verdade: aqui só
// entram desenho de rotas, ações ao vivo, o laço de 20Hz e o desfecho, que OBEDECE `outcome`.
// Fases: read (2s) → draw (sem relógio) → run (12s, pausa é fase de desenho: só RODAR retoma) →
// shooting/turnover/done. Rebote ofensivo é resolvido na hora dentro de shoot, sem barra.
// Falta puxada na finta de arremesso vem com `quality: -1` (sentinela): montamos FreeThrows e
// só então despachamos — o reducer NUNCA recebe -1.

const DT = 0.05                                // 20 Hz
const SAMPLE = 0.6                             // metros entre pontos amostrados do arrasto
const TAP = 0.3                                // metros: abaixo disso é toque, não arrasto
const MAX_PTS = 6                              // o engine corta em 6 (setRoute)
const HEAD_MS = 800                            // manchete
const SHOT_MS = 500                            // bola até o aro
const OVERLAY_MS = 800                         // desfecho por cima
const R_US = 56, R_THEM = 52, R_HIT = 90

const TEMPLATE_IDS: Template[] = ['pnr', 'horns', 'doubleScreen', 'iso', 'fiveOut', 'transition']
const MATE_NUM = [4, 11, 23, 33]               // camisas dos companheiros (você usa a sua)
const TURN_HEAD: Record<NonNullable<PlaybookState['turnover']>, string> = {
  intercept: 'mg.pb.head.intercept', strip: 'mg.pb.head.steal',
  charge: 'mg.pb.head.charge', clock: 'mg.pb.turnover.clock',
}
const SHOT_HEAD: Record<string, string> = {
  mgLayup: 'mg.type.layup', mgDunk: 'mg.type.dunk', mgMid: 'mg.type.mid',
  mgThree: 'mg.type.three', mgAssist: 'mg.type.assist',
}

function ballPos(s: PlaybookState): Pos {
  const f = s.ball.flying
  if (!f) return s.attackers[s.ball.holder]
  const a = s.attackers[f.from], b = s.attackers[f.to]
  return { x: a.x + (b.x - a.x) * f.progress, y: a.y + (b.y - a.y) * f.progress }
}
const pathOf = (pts: Pos[]) => pts.map((p, i) => `${i ? 'L' : 'M'} ${(p.x * S).toFixed(1)} ${(p.y * S).toFixed(1)}`).join(' ')
// marca de bloqueio: traço de 80 unidades perpendicular ao fim da rota
function screenMark(pts: Pos[]) {
  const a = pts[pts.length - 2], b = pts[pts.length - 1]
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len * 0.4, py = dx / len * 0.4
  return { x1: (b.x + px) * S, y1: (b.y + py) * S, x2: (b.x - px) * S, y2: (b.y - py) * S }
}

export function PlaybookGame({ seed, context, build, age, quarter, league, number, lang, onResolve, outcome }: MinigameProps) {
  const five = useMemo(() => opponentFive(league, context.opponentTeamId), [league, context.opponentTeamId])
  const input = useMemo<PlaybookInput>(() => {
    const mods = attrMods(build, age, quarter)
    const sk = (tp: 'layup' | 'mid' | 'three' | 'dunk') => skillOf(build, age, tp, mods.fatigue)
    return {
      kind: context.kind, five, mods, difficulty: difficulty(context.kind, five[0].ovr),
      skill: { layup: sk('layup'), mid: sk('mid'), three: sk('three'), dunk: sk('dunk') }, reboundChance: reboundChance(mods, five),
    }
  }, [context.kind, five, build, age, quarter])

  // seed local criado UMA vez (createPlaybook consome 1 call: o sorteio do esquema)
  const boot = useRef<{ rng: Rng; s0: PlaybookState } | null>(null)
  if (!boot.current) { const rng = createRng(seed); boot.current = { rng, s0: createPlaybook(rng, input) } }
  const rng = boot.current.rng

  const [st, setSt] = useState(boot.current.s0)
  const ref = useRef(st)
  const undoRef = useRef<PlaybookState[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const resolved = useRef(false)
  const [heads, setHeads] = useState<string[]>([])
  const [draft, setDraft] = useState<{ idx: number; pts: Pos[]; cur: Pos } | null>(null)
  const [risky, setRisky] = useState(false)
  const [landed, setLanded] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [ftDone, setFtDone] = useState(false)
  const [ftReady, setFtReady] = useState(false)
  // true = a jogada corre; RODAR liga, o tick desliga sozinho quando isSettled (spec §D: pausa é fase de desenho)
  const [go, setGo] = useState(false)
  const goRef = useRef(go)
  goRef.current = go
  // onResolve muda de identidade a cada render do pai; fora das deps dos efeitos
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  // ---------- avanço de estado (porta única: enfileira as manchetes) ----------
  const commit = (next: PlaybookState) => {
    const prev = ref.current
    if (next === prev) return
    ref.current = next
    setSt(next)
    const push = (k: string) => setHeads(h => [...h, k])
    if (next.lastScreenAt !== prev.lastScreenAt) push('mg.pb.head.screen')
    if (next.turnover && !prev.turnover) push(TURN_HEAD[next.turnover])
    if (next.rebounds !== prev.rebounds) { push('mg.pb.head.rebound'); undoRef.current = [] } // 2ª posse: nada de DESFAZER pra antes dela
    if (next.phase === 'shooting' && prev.phase !== 'shooting') push(SHOT_HEAD[next.result!.optionId] ?? 'mg.shoot')
    if (next.phase === 'done' && prev.phase !== 'done') push('mg.pb.head.foul')
  }
  const act = (fn: (s: PlaybookState) => PlaybookState) => commit(fn(ref.current))
  const snapshot = () => { undoRef.current = [...undoRef.current.slice(-19), ref.current] }

  // ---------- laço de 20Hz (read conta os 2s; run roda a posse enquanto `go`) ----------
  // jogada parada (isSettled) = go desliga: relógio, defesa e pressão congelam até RODAR de novo
  useEffect(() => {
    if (st.phase !== 'read' && !(st.phase === 'run' && go)) return
    const id = setInterval(() => {
      const next = step(ref.current, DT, rng, input)
      commit(next)
      if (next.phase === 'run' && isSettled(next)) setGo(false)
    }, DT * 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, go, rng, input])

  // ---------- manchete: fila de 0.8s ----------
  useEffect(() => {
    if (heads.length === 0) return
    const id = setTimeout(() => setHeads(h => h.slice(1)), HEAD_MS)
    return () => clearTimeout(id)
  }, [heads])

  // ---------- despacho (uma vez só; a falta espera os lances livres) ----------
  const foulPending = st.result?.optionId === 'mgFreeThrow' && st.result.quality < 0
  useEffect(() => {
    if (resolved.current || !st.result || foulPending) return
    resolved.current = true
    onResolveRef.current(st.result)
    const a = setTimeout(() => setLanded(true), SHOT_MS)
    const b = setTimeout(() => setShowResult(true), OVERLAY_MS)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [st.result, foulPending])

  // falta puxada: a manchete "FALTA!" fica na tela HEAD_MS antes dos lances livres entrarem
  useEffect(() => {
    if (!foulPending) return
    const id = setTimeout(() => setFtReady(true), HEAD_MS)
    return () => clearTimeout(id)
  }, [foulPending])

  // ---------- entrada ----------
  // via CTM: no palco flexível (tela cheia) o SVG fica letterboxado — o bounding box não é o viewBox
  const toCourt = (e: RPointerEvent): Pos | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x / S, y: p.y / S }
  }

  // ímã (draw E run): começa um rascunho de rota; o pointerup decide toque × arrasto
  const onMagnet = (i: number) => (e: RPointerEvent<SVGGElement>) => {
    e.stopPropagation()
    const s = ref.current
    if (s.phase !== 'draw' && s.phase !== 'run') return
    const p = toCourt(e)
    if (!p) return
    svgRef.current?.setPointerCapture(e.pointerId)
    setDraft({ idx: i, pts: [{ ...s.attackers[i] }], cur: p })
  }

  // quadra na fase run (ao vivo): rascunho com idx -1 — toque vira moveTo, arrasto é ignorado
  const onBoardDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (ref.current.phase !== 'run' || !goRef.current) return
    const p = toCourt(e)
    if (!p) return
    svgRef.current?.setPointerCapture(e.pointerId)
    setDraft({ idx: -1, pts: [p], cur: p })
  }

  const onBoardMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!draft) return
    const p = toCourt(e)
    if (!p) return
    const last = draft.pts[draft.pts.length - 1]
    const grow = draft.idx >= 0 && draft.pts.length < MAX_PTS && Math.hypot(p.x - last.x, p.y - last.y) >= SAMPLE
    setDraft(d => d && { idx: d.idx, pts: grow ? [...d.pts, p] : d.pts, cur: p })
  }

  const onBoardUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!draft) return
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId)
    const { idx, pts, cur } = draft
    setDraft(null)
    const s = ref.current
    const dragged = pts.length >= 2 || Math.hypot(cur.x - pts[0].x, cur.y - pts[0].y) > TAP
    const route = pts.length >= 2 ? pts : [pts[0], cur]
    if (s.phase === 'run' && !goRef.current) {              // pausado: só desenho (spec D)
      if (idx < 0) return
      if (dragged) { snapshot(); return void act(x => setRoute(x, idx, route)) }
      if (s.routes[idx].points.length >= 2) { snapshot(); act(x => toggleScreen(x, idx)) }
      return
    }
    if (idx < 0) {                                    // quadra: só o toque conta (infiltração)
      if (!dragged) act(x => moveTo(x, cur.x, cur.y))
      return
    }
    if (s.phase === 'run') {
      // arrasto = redesenha a rota ao vivo (setRoute zera o routeProgress do ímã);
      // toque = passe pro companheiro
      if (dragged) return void act(x => setRoute(x, idx, route))
      const next = pass(s, idx, rng, input, risky)
      if (next !== s) setRisky(false)
      commit(next)
      return
    }
    // toque curto num ímã com rota = alterna "termina em BLOQUEIO"
    if (!dragged) {
      if (s.routes[idx].points.length >= 2) { snapshot(); act(x => toggleScreen(x, idx)) }
      return
    }
    snapshot()
    act(x => setRoute(x, idx, route))
  }

  const clearRoutes = () => {
    snapshot()
    let s = ref.current
    for (let i = 0; i < s.routes.length; i++) {
      s = setRoute(s, i, [])
      if (s.routes[i].screen) s = toggleScreen(s, i)
    }
    commit(s)
  }
  const undo = () => {
    const prev = undoRef.current.pop()
    if (!prev || prev.phase !== ref.current.phase) return   // nunca troca de fase (ex.: draw pré-RODAR)
    ref.current = prev
    setSt(prev)
  }

  const onFreeThrows = (q: number) => {
    if (resolved.current) return
    resolved.current = true
    setFtDone(true)
    onResolveRef.current({ optionId: 'mgFreeThrow', quality: q })
    setTimeout(() => setShowResult(true), OVERLAY_MS)
  }

  // falta puxada: os lances livres decidem a quality antes do despacho
  if (foulPending && ftReady && !ftDone) return <FreeThrows lang={lang} build={build} age={age} onDone={onFreeThrows} />

  // ---------- render ----------
  const phase = st.phase
  const drawing = phase === 'read' || phase === 'draw'
  const running = phase === 'run'
  const paused = running && !go
  const live = running && !st.ball.flying && go   // ações ao vivo (finta/bloqueio/passe/infiltração)
  const canShoot = running && !st.ball.flying      // ARREMESSAR funciona também na pausa
  const holder = st.ball.holder
  const opt = shotOptionFor(st)
  const open = st.ball.flying ? 0 : openness(st, holder)
  const phaseKey = phase === 'read' ? 'read' : phase === 'draw' ? 'draw' : paused ? 'paused' : 'run'
  const ball = ballPos(st)

  // bola no arremesso: vai ao aro em 500ms; depois obedece `outcome` (entra / quica pra fora)
  let ballAt = { x: ball.x * S, y: ball.y * S }
  let ballCls = 'mg-pb__ball'
  if (phase === 'shooting') {
    ballAt = { x: BASKET.x, y: BASKET.y }
    ballCls += ' mg-pb__ball--shot'
    if (landed && outcome && !outcome.success) { ballAt = { x: BASKET.x + 140, y: BASKET.y + 260 }; ballCls += ' mg-pb__ball--bounce' }
    else if (landed && outcome?.success) ballAt = { x: BASKET.x, y: BASKET.y + 40 }
  } else if (!st.ball.flying) ballAt = { x: ballAt.x + 30, y: ballAt.y - 30 }

  const resultText = () => {
    if (!outcome) return null
    if (outcome.injury) return [t(lang, 'mg.result.injury'), t(lang, 'option.' + outcome.optionId)]
    if (st.turnover) return [t(lang, 'mg.result.turnover'), t(lang, 'mg.pb.turnover.' + st.turnover)]
    return [t(lang, outcome.success ? 'mg.result.hit' : 'mg.result.miss'), t(lang, 'option.' + outcome.optionId)]
  }
  const res = showResult ? resultText() : null
  const bad = !!outcome && (!outcome.success || outcome.injury)
  const canDunk = build.attributes.physical >= 75

  return (
    <div className="mg mg-pb">
      <div className="mg-pb__top">
        <span className="mono-label mono-label--red">{t(lang, 'mg.pb.phase.' + phaseKey)}</span>
        {!drawing && (
          <span className={'mg-pb__clock' + (st.clock < 3 ? ' mg-pb__clock--low' : '')}>
            <span className="mg-pb__clock-label">{t(lang, 'mg.clock')}</span> {st.clock.toFixed(1)}
          </span>
        )}
        {!drawing && (
          <span className="mg-pb__open">
            <span className="mg-pb__open-label">{t(lang, 'mg.openness')}</span>
            <span className="bar"><span className={'bar__fill' + (open < 0.35 ? ' bar__fill--bad' : '')} style={{ width: `${Math.round(open * 100)}%` }} /></span>
          </span>
        )}
      </div>

      <div className="mg-pb__stage">
        <svg ref={svgRef} className="mg-pb__board" viewBox={`0 0 ${W} ${D}`}
          onPointerDown={onBoardDown} onPointerMove={onBoardMove} onPointerUp={onBoardUp} onPointerCancel={onBoardUp}>
          {MAG_FILTER}
          {COURT_LAYERS}

          <g className="mg-pb__routes">
            {st.routes.map((r, i) => {
              if (r.points.length < 2) return null
              const m = r.screen ? screenMark(r.points) : null
              return (
                <g key={i}>
                  <path d={pathOf(r.points)} className="mg-pb__route" />
                  {m && <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} className="mg-pb__screen" />}
                </g>
              )
            })}
            {draft && draft.idx >= 0 && (
              <path d={pathOf([...draft.pts, draft.cur])} className="mg-pb__route mg-pb__route--draft" />
            )}
          </g>

          {st.defenders.map((d, i) => (
            <g key={i} className="mg-pb__them">
              <circle cx={d.x * S} cy={d.y * S} r={R_THEM} className="mg-pb__mag mg-pb__mag--them" filter="url(#pb-mag)" />
              <text x={d.x * S} y={d.y * S + 14} className="mg-pb__num mg-pb__num--them">{(five[i].id.charCodeAt(five[i].id.length - 1) * 7) % 45}</text>
              <text x={d.x * S} y={d.y * S + R_THEM + 40} className="mg-pb__tag">{five[i].short}</text>
            </g>
          ))}

          {st.attackers.map((p, i) => (
            <g key={i} className={'mg-pb__us' + (phase === 'read' ? '' : ' mg-pb__us--live')}
              onPointerDown={phase === 'read' ? undefined : onMagnet(i)}>
              {phase !== 'read' && <circle cx={p.x * S} cy={p.y * S} r={R_HIT} className="mg-pb__hit" />}
              <circle cx={p.x * S} cy={p.y * S} r={R_US} filter="url(#pb-mag)"
                className={'mg-pb__mag' + (i === holder ? ' mg-pb__mag--holder' : '')} />
              <text x={p.x * S} y={p.y * S + 15} className="mg-pb__num">{i === st.you ? (number ?? '★') : MATE_NUM[i - 1]}</text>
              {i === st.you && <text x={p.x * S} y={p.y * S + R_US + 40} className="mg-pb__tag">{t(lang, 'mg.you')}</text>}
            </g>
          ))}

          <circle className={ballCls} r={26} style={{ transform: `translate(${ballAt.x}px, ${ballAt.y}px)` }} />
        </svg>
        {heads[0] && <div className="mg-headline">{t(lang, heads[0])}</div>}
      </div>

      {(drawing || paused) && (
        <>
          <p className="mg-pb__hint">{t(lang, paused ? 'mg.pb.pauseHint' : 'mg.pb.drawHint')}</p>
          {drawing && (
            <div className="mg-pb__chips">
              {TEMPLATE_IDS.map(tpl => (
                <button key={tpl} type="button" className="mg-btn mg-pb__chip" disabled={phase === 'read'}
                  onClick={() => { snapshot(); act(s => applyTemplate(s, tpl)) }}>
                  {t(lang, 'mg.pb.template.' + tpl)}
                </button>
              ))}
            </div>
          )}
          <div className="mg-row">
            <button type="button" className="mg-btn" disabled={phase === 'read'} onClick={clearRoutes}>{t(lang, 'mg.pb.clear')}</button>
            <button type="button" className="mg-btn" disabled={phase === 'read' || undoRef.current.length === 0} onClick={undo}>{t(lang, 'mg.pb.undo')}</button>
            <button type="button" className="mg-btn mg-btn--red" disabled={phase === 'read'} onClick={() => { undoRef.current = []; act(startRun); setGo(true) }}>{t(lang, 'mg.pb.run')}</button>
          </div>
        </>
      )}

      {running && (
        <>
          {!paused && (
            <div className="mg-row">
              <button type="button" className="mg-btn" disabled={!live} onClick={() => act(s => feint(s, rng, input))}>{t(lang, 'mg.pb.act.feint')}</button>
              <button type="button" className="mg-btn" disabled={!live} onClick={() => act(callScreen)}>{t(lang, 'mg.pb.act.screen')}</button>
              <button type="button" className="mg-btn" disabled={!live} onClick={() => act(s => pumpFake(s, rng, input))}>{t(lang, 'mg.pb.act.pump')}</button>
              <button type="button" className={'mg-btn' + (risky ? ' mg-pb__armed' : '')} aria-pressed={risky}
                disabled={!live} onClick={() => setRisky(r => !r)}>{t(lang, 'mg.pb.act.risky')}</button>
            </div>
          )}
          <div className="mg-row">
            {opt === 'layup-or-dunk' ? (
              <>
                <button type="button" className="mg-btn mg-btn--red" disabled={!canShoot} onClick={() => act(s => shoot(s, rng, input, 'layup'))}>{t(lang, 'mg.type.layup')}</button>
                <button type="button" className="mg-btn" disabled={!canShoot} onClick={() => act(s => shoot(s, rng, input, 'floater'))}>{t(lang, 'mg.shot.type.floater')}</button>
                {canDunk && <button type="button" className="mg-btn" disabled={!canShoot} onClick={() => act(s => shoot(s, rng, input, 'dunk'))}>{t(lang, 'mg.type.dunk')}</button>}
              </>
            ) : (
              <button type="button" className={'mg-btn mg-btn--red' + (opt === 'mgThree' ? ' mg-btn--warm' : '')} disabled={!canShoot}
                onClick={() => act(s => shoot(s, rng, input))}>
                {t(lang, 'mg.shoot')}
                <span className="mg-pb__btn-sub">{t(lang, opt === 'mgAssist' ? 'mg.type.assist' : opt === 'mgThree' ? 'mg.type.three' : 'mg.type.mid')}</span>
              </button>
            )}
          </div>
        </>
      )}

      {res && (
        <div className={'mg-result' + (bad ? ' mg-result--bad' : '')}>
          <span>{res[0]}</span>
          <span className="mg-result__sub">{res[1]}</span>
          <span className="mg-result__sub">{t(lang, SCHEME_SIGNAL[st.scheme])}</span>
        </div>
      )}
    </div>
  )
}
