import { useCallback, useEffect, useRef, useState } from 'react'

// Reveals JS-driven de "simulação correndo". Ritmo é CONTEÚDO (decisão 17c): nenhum
// destes hooks lê prefers-reduced-motion — o Windows do dono reporta reduce e o jogo
// tem que ser visto igual lá. Todos são curtos (≤ 1.5s) ou puláveis com tap.

// Número que sobe até `target` (rAF, ease-out). Ao mudar o alvo, parte do valor atual.
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const from = fromRef.current
    if (ms <= 0 || from === target) { fromRef.current = target; setValue(target); return }
    const start = performance.now()
    let id = 0
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / ms)
      const e = 1 - (1 - k) * (1 - k)
      const v = Math.round(from + (target - from) * e)
      setValue(v)
      if (k < 1) id = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [target, ms])
  return value
}

// Mostra `total` itens um a um, a cada `msPerItem`. `skip` mostra tudo.
export function useReveal(total: number, msPerItem: number, resetKey: unknown = total): { shown: number; done: boolean; skip: () => void } {
  const [shown, setShown] = useState(0)
  const keyRef = useRef(resetKey)
  if (keyRef.current !== resetKey) { keyRef.current = resetKey; setShown(0) }
  useEffect(() => {
    if (shown >= total) return
    const id = setTimeout(() => setShown(s => Math.min(total, s + 1)), msPerItem)
    return () => clearTimeout(id)
  }, [shown, total, msPerItem])
  const skip = useCallback(() => setShown(total), [total])
  return { shown, done: shown >= total, skip }
}

// "Roleta": cicla `alts` a cada `stepMs` durante `ms` e então crava em `final`.
// Reinicia quando `key` muda. `settled` = true quando cravou.
export function useSpin(key: unknown, final: string, alts: string[], ms = 700, stepMs = 55): { text: string; settled: boolean; skip: () => void } {
  const [i, setI] = useState(0)
  const [settled, setSettled] = useState(alts.length === 0 || ms <= 0)
  const keyRef = useRef(key)
  if (keyRef.current !== key) { keyRef.current = key; setI(0); setSettled(alts.length === 0 || ms <= 0) }
  useEffect(() => {
    if (settled) return
    const start = performance.now()
    const id = setInterval(() => {
      if (performance.now() - start >= ms) { setSettled(true); return }
      setI(n => n + 1)
    }, stepMs)
    return () => clearInterval(id)
  }, [settled, ms, stepMs, key])
  const skip = useCallback(() => setSettled(true), [])
  return { text: settled ? final : alts[i % alts.length], settled, skip }
}
