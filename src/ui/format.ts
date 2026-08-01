import type { Career } from '../engine/types'

// Nome curto pra linha de retomar ("M. Vieira"); nome de uma palavra só usa o
// próprio sobrenome (career.name === career.lastName nesse caso).
export function shortName(career: Pick<Career, 'name' | 'lastName'>): string {
  if (career.name === career.lastName) return career.lastName
  return `${career.name[0]}. ${career.lastName}`
}

// Formata um delta assinado pro display. Os deltas do engine vêm ponderados por 3/n
// (engine/moments.ts momentWeight) e ficam fracionários pra n != 3, então nascem com
// ruído de ponto flutuante (0.6 não é exato em binário: -6*0.6 === -3.5999999999999996).
// Todo delta ponderado que chega na UI passa por aqui em vez de ser impresso cru.
export function formatSignedDelta(n: number, decimals = 1): string {
  const fixed = n.toFixed(decimals).replace(/\.0+$/, '')
  return (n >= 0 ? '+' : '') + fixed
}
