import { useCountUp } from '../hooks/useMotion'

// Número que sobe até `value` (A3). Remonta (key) pra recomeçar do zero.
export function CountUp({ value, ms = 600 }: { value: number; ms?: number }) {
  return <>{useCountUp(value, ms)}</>
}
