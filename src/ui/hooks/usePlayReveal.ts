import { useCallback, useEffect, useRef, useState } from 'react'

// ~15 linhas de ambientação por jogo (cadência de 3' do engine): a digitação precisa ser
// rápida o bastante para o trecho entre dois momentos passar em ~10s, não em ~30s.
const CHAR_MS = 16
const LINE_PAUSE_MS = 320

// Quantas linhas do log podem aparecer antes de o painel de decisão abrir: todas as
// que acontecem ANTES do minuto do momento pendente. `stopAt = null` = jogo sem momento
// pendente (acabou), revela tudo.
export function revealTarget(ats: number[], stopAt: number | null): number {
  if (stopAt === null) return ats.length
  return ats.filter(at => at < stopAt).length
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function usePlayReveal(input: { texts: string[]; ats: number[]; stopAt: number | null }) {
  const { texts, ats, stopAt } = input
  const reduced = usePrefersReducedMotion()
  const target = revealTarget(ats, stopAt)
  const [shown, setShown] = useState(reduced ? target : 0)
  const [chars, setChars] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const skip = useCallback(() => { setShown(target); setChars(0) }, [target])

  // O log CRESCE quando um momento resolve, então `target` sobe e a digitação continua
  // sozinha nas linhas novas — `shown` nunca é reduzido, senão a decisão recém-tomada
  // sumiria da tela. Só o modo reduzido salta direto para o alvo.
  useEffect(() => { if (reduced) setShown(target) }, [target, reduced])

  useEffect(() => {
    if (shown >= target) return
    const full = texts[shown] ?? ''
    if (chars < full.length) {
      timer.current = setTimeout(() => setChars(c => c + 1), CHAR_MS)
    } else {
      timer.current = setTimeout(() => { setShown(s => s + 1); setChars(0) }, LINE_PAUSE_MS)
    }
    return () => clearTimeout(timer.current)
  }, [shown, chars, target, texts[shown]])

  return {
    shown,
    typing: shown < target ? (texts[shown] ?? '').slice(0, chars) : null,
    done: shown >= target,
    skip,
  }
}
