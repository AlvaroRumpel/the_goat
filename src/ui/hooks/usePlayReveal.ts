import { useCallback, useEffect, useRef, useState } from 'react'

// Relógio virtual do jogo: 1.8 min de jogo por segundo real — um trecho de ~14 min
// entre duas decisões passa em ~8s, o jogo inteiro em ~30s + decisões.
const GAME_MIN_PER_SEC = 1.8
const TICK_MS = 80
const CHAR_MS = 14

// Linhas do log visíveis no minuto virtual `t`: as que o relógio já passou.
export function visibleCount(ats: number[], t: number): number {
  return ats.filter(at => at <= t).length
}

// O relógio é o mestre: `t` corre continuamente de 0 até `stopAt` (o minuto do momento
// pendente; null = sem momento, corre até 48) e as linhas entram na fila quando `t`
// passa pelo `at` delas. A digitação é cosmética por cima do clock: cada linha da fila
// é escrita a CHAR_MS, e o painel de decisão só abre com o relógio parado E a fila toda
// escrita. Decidido um momento, `stopAt` sobe e o relógio volta a correr — `t` nunca
// anda pra trás.
//
// prefers-reduced-motion NÃO pula o relógio (decisão do dono): o ritmo do play-by-play
// é conteúdo, não animação decorativa — o Windows do dono roda com "efeitos de
// animação" desligado e o jogo saltava direto pro momento. Reduce segue desligando só
// o cosmético CSS (fade/cursor, media query em base.css). Pular é o tap no feed (skip).
export function usePlayReveal(input: { texts: string[]; ats: number[]; stopAt: number | null }) {
  const { texts, ats, stopAt } = input
  const target = stopAt ?? 48
  const queued = visibleCount(ats, target)      // fila final deste segmento
  const [t, setT] = useState(0)
  const [shown, setShown] = useState(0)         // linhas totalmente digitadas
  const [chars, setChars] = useState(0)
  // âncora derivada de performance.now() (sem drift de setInterval); reancorada a cada
  // salto de `t` fora do tick (skip, mudança de alvo).
  const anchor = useRef<{ at: number; t: number }>({ at: performance.now(), t: 0 })

  const skip = useCallback(() => {
    anchor.current = { at: performance.now(), t: target }
    setT(prev => Math.max(prev, target))
    setShown(queued)
    setChars(0)
  }, [target, queued])

  // relógio
  useEffect(() => {
    if (t >= target) return
    const id = setInterval(() => {
      const a = anchor.current
      const now = a.t + ((performance.now() - a.at) / 1000) * GAME_MIN_PER_SEC
      setT(prev => Math.max(prev, Math.min(now, target)))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [target, t >= target])

  // alvo subiu (decisão tomada): reancora em `t` pra não saltar o tempo parado pensando
  const tRef = useRef(0)
  tRef.current = t
  useEffect(() => {
    anchor.current = { at: performance.now(), t: tRef.current }
  }, [target])

  // digitação: escreve a fila (linhas com at <= t) uma a uma, sem pausa extra — o
  // espaçamento entre linhas é o próprio relógio.
  const inQueue = visibleCount(ats, t)
  useEffect(() => {
    if (shown >= inQueue) return
    const full = texts[shown] ?? ''
    if (chars < full.length) {
      const id = setTimeout(() => setChars(c => c + 1), CHAR_MS)
      return () => clearTimeout(id)
    }
    setShown(s => s + 1)
    setChars(0)
  }, [shown, chars, inQueue, texts[shown]])

  return {
    t,
    shown,
    typing: shown < inQueue ? (texts[shown] ?? '').slice(0, chars) : null,
    done: t >= target && shown >= queued,
    skip,
  }
}
