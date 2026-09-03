import { StrictMode, useState, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/minigames.css'
import './styles/mg-playbook.css'
import './styles/mg-shot.css'
import './styles/mg-defense.css'
import './styles/lab.css'
import { TEAMS } from './data/teams'
import { initLeague } from './data/league'
import { computeArchetype, computeOverall } from './engine/draft'
import { SKILL_W } from './engine/moments'
import { SLOT_ORDER, type Build, type MomentOutcome, type SlotId, type WatchedGameKind } from './engine/types'
import type { MinigameKind, MinigameResult } from './engine/minigames'
import type { Lang } from './i18n'
import type { MinigameProps } from './ui/minigames/types'
import { PlaybookGame } from './ui/minigames/Playbook'
import { ShotGame } from './ui/minigames/Shot'
import { DefenseFallback } from './ui/minigames/DefenseFallback'
import { ErrorBoundary } from './ui/ErrorBoundary'

// Laboratório: monta um minigame por vez com props sintéticos. NÃO é o jogo — sem save,
// sem reducer; o `outcome` é sorteado aqui com Math.random (fora do engine) só pra animar.
const GAMES: Record<MinigameKind, ComponentType<MinigameProps>> = { playbook: PlaybookGame, shot: ShotGame, defense: DefenseFallback }
const KINDS: WatchedGameKind[] = ['rivalry', 'seedRace', 'special', 'playoff', 'finals']
const league = initLeague()
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

interface LogRow { n: number; seed: number; kind: MinigameKind; optionId: string; quality: number; turnover: boolean; success: boolean }

function Lab() {
  const [kind, setKind] = useState<MinigameKind>('playbook')
  const [seed, setSeed] = useState(1)
  const [teamId, setTeamId] = useState('bos')
  const [gameKind, setGameKind] = useState<WatchedGameKind>('rivalry')
  const [quarter, setQuarter] = useState(4)
  const [age, setAge] = useState(27)
  const [lang, setLang] = useState<Lang>('pt')
  const [attrs, setAttrs] = useState<Record<SlotId, number>>(() => Object.fromEntries(SLOT_ORDER.map(s => [s, 75])) as Record<SlotId, number>)
  const [run, setRun] = useState(1)                       // key: remonta o minigame
  const [outcome, setOutcome] = useState<MomentOutcome | null>(null)
  const [log, setLog] = useState<LogRow[]>([])

  const build: Build = { attributes: attrs, picks: [], archetype: computeArchetype(attrs), overall: computeOverall(attrs) }
  const Game = GAMES[kind]

  const onResolve = (r: MinigameResult) => {
    const p = clamp(0.5 + (r.quality - 0.5) * SKILL_W, 0.05, 0.95)
    const success = Math.random() < p && !r.turnover
    setOutcome({ momentId: 'clutch', optionId: r.optionId, success, injury: false, delta: 0, clock: '4Q 00:21' })
    setLog(l => [{ n: l.length + 1, seed, kind, optionId: r.optionId, quality: r.quality, turnover: !!r.turnover, success }, ...l].slice(0, 10))
  }
  const restart = (newSeed: number) => { setSeed(newSeed); setOutcome(null); setRun(n => n + 1) }

  return (
    <div className="lab">
      <aside className="lab__side">
        <h1 className="lab__title">LAB · MINIGAMES</h1>
        <label>Minigame
          <select value={kind} onChange={e => { setKind(e.target.value as MinigameKind); restart(seed) }}>
            <option value="playbook">JOGADA (prancheta)</option>
            <option value="shot">ARREMESSO</option>
            <option value="defense">MURALHA</option>
          </select>
        </label>
        <label>Seed <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value) || 0)} /></label>
        <label>Adversário
          <select value={teamId} onChange={e => setTeamId(e.target.value)}>
            {TEAMS.map(tm => <option key={tm.id} value={tm.id}>{tm.city} {tm.name} · {tm.strength}</option>)}
          </select>
        </label>
        <label>Tipo de jogo
          <select value={gameKind} onChange={e => setGameKind(e.target.value as WatchedGameKind)}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label>Quarto <input type="number" min={1} max={4} value={quarter} onChange={e => setQuarter(clamp(Number(e.target.value) || 1, 1, 4))} /></label>
        <label>Idade <input type="number" min={19} max={40} value={age} onChange={e => setAge(clamp(Number(e.target.value) || 27, 19, 40))} /></label>
        <label>Idioma
          <select value={lang} onChange={e => setLang(e.target.value as Lang)}><option value="pt">pt</option><option value="en">en</option></select>
        </label>
        <div className="lab__attrs">
          {SLOT_ORDER.map(s => (
            <label key={s}>{s} <b>{attrs[s]}</b>
              <input type="range" min={40} max={99} value={attrs[s]} onChange={e => setAttrs(a => ({ ...a, [s]: Number(e.target.value) }))} />
            </label>
          ))}
        </div>
        <div className="lab__row">
          <button type="button" className="mg-btn" onClick={() => restart(seed)}>DE NOVO</button>
          <button type="button" className="mg-btn mg-btn--red" onClick={() => restart(Math.floor(Math.random() * 1e9))}>NOVA SEED</button>
        </div>
        <ol className="lab__log">
          {log.map(r => <li key={r.n}>#{r.n} s{r.seed} {r.kind} · {r.optionId} · q {r.quality.toFixed(2)}{r.turnover ? ' · TO' : ''} · {r.success ? 'OK' : 'X'}</li>)}
        </ol>
      </aside>
      <main className="lab__stage">
        <ErrorBoundary>
          <div className="game-decision mg-frame lab__frame">
            <Game key={`${kind}-${run}`} seed={seed} context={{ kind: gameKind, opponentTeamId: teamId }} build={build} age={age}
              quarter={quarter} league={league} number={23} lastName="TESTE" lang={lang} onResolve={onResolve} outcome={outcome} />
          </div>
        </ErrorBoundary>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Lab /></StrictMode>)
