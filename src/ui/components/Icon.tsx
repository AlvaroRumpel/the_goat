import type { ReactNode } from 'react'

export type IconName =
  | 'ball' | 'goat' | 'ring' | 'trophy' | 'basket' | 'jersey' | 'training' | 'clock'
  | 'clutch' | 'contract' | 'trade' | 'injury' | 'tactics' | 'press' | 'season' | 'evolution'
  | 'streak' | 'verdict' | 'retire' | 'steal' | 'price' | 'crossroads' | 'playoffs' | 'podium'
  | 'age' | 'physical' | 'strength' | 'crowd' | 'seed' | 'restart' | 'career' | 'language' | 'sound'

// Conteúdo interno dos <svg> do quadro 12a (docs/superpowers/plans/assets/2026-07-31-icones-canvas.html), verbatim (cores parametrizadas).
const ICONS: Record<IconName, ReactNode> = {
  ball: (
    <>
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <g stroke="var(--paper)" strokeWidth="2.2">
        <path d="M16 2v28M2.5 16h27M6 6c5 5 5 15 0 20M26 6c-5 5-5 15 0 20" />
      </g>
    </>
  ),
  goat: (
    <>
      <g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
        <path d="M12.6 10.4C10 7.6 6.4 5.4 3.8 6.6c-1 .5-1 1.9 0 2.5M19.4 10.4c2.6-2.8 6.2-5 8.8-3.8 1 .5 1 1.9 0 2.5" />
      </g>
      <path d="M16 9.4c3.6 0 5.9 2.2 5.9 5.6 0 4.6-2.4 8.4-5.9 10.6-3.5-2.2-5.9-6-5.9-10.6 0-3.4 2.3-5.6 5.9-5.6Z" fill="currentColor" />
      <path d="M10.5 13c-1.9-.9-3.7-.4-4.3 1.2 1.9.9 3.7.4 4.3-1.2ZM21.5 13c1.9-.9 3.7-.4 4.3 1.2-1.9.9-3.7.4-4.3-1.2Z" fill="currentColor" />
      <path d="M14.1 25.2h3.8L16 30.6l-1.9-5.4Z" fill="currentColor" />
      <circle cx="13.4" cy="15.2" r="1.3" fill="var(--paper)" />
      <circle cx="18.6" cy="15.2" r="1.3" fill="var(--paper)" />
      <path d="M14.8 21.6h2.4" stroke="var(--paper)" strokeWidth="1.4" />
    </>
  ),
  ring: (
    <>
      <path d="M16 4.5 21 10h-10l5-5.5Z" fill="currentColor" />
      <circle cx="16" cy="20" r="8.5" stroke="currentColor" strokeWidth="3.4" />
    </>
  ),
  trophy: (
    <>
      <path d="M9 5h14v7c0 5-3.2 8.4-7 8.4S9 17 9 12V5Z" fill="currentColor" />
      <path d="M9 7H5.5v3c0 2.4 1.8 4.2 4 4.4M23 7h3.5v3c0 2.4-1.8 4.2-4 4.4" stroke="currentColor" strokeWidth="2.4" />
      <path d="M14 20.4h4V25h-4z" fill="currentColor" />
      <path d="M9.5 25h13v3.5h-13z" fill="currentColor" />
    </>
  ),
  basket: (
    <>
      <path d="M6 4h20v12H6z" fill="currentColor" />
      <path d="M10 8h12v5H10z" fill="var(--paper)" />
      <path d="M9 18h14" stroke="currentColor" strokeWidth="3" />
      <path d="M11 19.5c.6 4 2.2 7 5 8.5 2.8-1.5 4.4-4.5 5-8.5" stroke="currentColor" strokeWidth="2.2" />
    </>
  ),
  jersey: (
    <>
      <path d="M11.5 4 8 5.6 5 12l4.5 1.6V28h13V13.6L27 12l-3-6.4L20.5 4c-.7 2.6-8.3 2.6-9 0Z" fill="currentColor" />
      <text x="16" y="24" textAnchor="middle" fontFamily="'Archivo Black',sans-serif" fontSize="11" fill="var(--paper)">8</text>
    </>
  ),
  training: (
    <>
      <path d="M3 24c0-4 3.6-5.6 7-5.6l3.6-5.4 3 4.6c4.4.2 9 1.6 12 5.4V26H3v-2Z" fill="currentColor" />
      <path d="M12 18.6l2.4 2.4M16 19.4l2.4 2.4M20 20.6l2 2" stroke="var(--paper)" strokeWidth="1.8" />
    </>
  ),
  clock: (
    <>
      <path d="M13 2h6v3.5h-6z" fill="currentColor" />
      <circle cx="16" cy="18" r="11" fill="currentColor" />
      <path d="M16 11v7.5l5 3" stroke="var(--paper)" strokeWidth="2.4" />
    </>
  ),
  clutch: <path d="M18.5 2 7 18h6.5L11.5 30 25 12h-7.5L18.5 2Z" fill="currentColor" />,
  contract: (
    <>
      <path d="M7 4h18v25l-4-2.6-5 2.6-5-2.6L7 29V4Z" fill="currentColor" />
      <path d="M11 10h10M11 14.5h10M11 19h6" stroke="var(--paper)" strokeWidth="2" />
    </>
  ),
  trade: (
    <>
      <path d="M2 12h10.5l3.5-4 3.5 4H30" stroke="currentColor" strokeWidth="3" />
      <path d="M2 20h10.5l3.5 4 3.5-4H30" stroke="currentColor" strokeWidth="3" />
      <path d="M26 7l4 5-4 5M6 15l-4 5 4 5" stroke="currentColor" strokeWidth="3" />
    </>
  ),
  injury: (
    <>
      <path d="M6.5 8.5l17 17" stroke="currentColor" strokeWidth="7" />
      <path d="M11 4l4-1 14 14-1 4-4 1L10 8l1-4Z" fill="currentColor" />
      <path d="M13.5 6.5l12 12" stroke="var(--paper)" strokeWidth="2" />
    </>
  ),
  tactics: (
    <>
      <path d="M6 4h20v24H6z" fill="currentColor" />
      <path d="M12 2h8v4h-8z" fill="currentColor" />
      <path d="M10.5 11.5l5 5M15.5 11.5l-5 5" stroke="var(--paper)" strokeWidth="2" />
      <circle cx="20" cy="20" r="3.2" stroke="var(--paper)" strokeWidth="2" />
    </>
  ),
  press: (
    <>
      <rect x="11" y="2" width="10" height="16" rx="5" fill="currentColor" />
      <path d="M7 15c0 5 4 9 9 9s9-4 9-9" stroke="currentColor" strokeWidth="2.6" />
      <path d="M16 24v5M11 29h10" stroke="currentColor" strokeWidth="2.6" />
    </>
  ),
  season: (
    <>
      <path d="M4 7h24v22H4z" fill="currentColor" />
      <path d="M4 7h24v5H4z" fill="currentColor" />
      <path d="M9 3v5M23 3v5" stroke="currentColor" strokeWidth="3" />
      <path d="M8 16h5v5H8zM19 21h5v5h-5z" fill="var(--paper)" />
    </>
  ),
  evolution: <path d="M4 28h5V16H4zM13.5 28h5V10h-5zM23 28h5V4h-5z" fill="currentColor" />,
  streak: (
    <>
      <path d="M16 2c1.5 7 8 8.5 8 15 0 5-3.6 9-8 9s-8-4-8-9c0-6.5 6.5-8 8-15Z" fill="currentColor" />
      <path d="M16 14c.8 3.6 3.5 4.4 3.5 8 0 2.4-1.6 4-3.5 4s-3.5-1.6-3.5-4c0-3.6 2.7-4.4 3.5-8Z" fill="var(--paper)" />
    </>
  ),
  verdict: (
    <>
      <path d="M3 27 5.5 7l7.5 7.5L16 3l3 11.5L26.5 7 29 27H3Z" fill="currentColor" />
      <path d="M3 27h26v3H3z" fill="currentColor" />
    </>
  ),
  retire: (
    <>
      <path d="M15 2h2v5h-2z" fill="currentColor" />
      <path d="M16 7 3 15h26L16 7Z" fill="currentColor" />
      <path d="M3 15h26v2.4H3z" fill="currentColor" />
      <path d="M10 18h12l2 12H8l2-12Z" fill="currentColor" />
    </>
  ),
  steal: (
    <>
      <path d="M6 26c0-8 3.4-14 9.4-17.6l1.4 3C12.4 14.2 10 19.2 10 26Z" fill="currentColor" />
      <path d="M12.6 26c0-6.4 2.6-11.2 7.4-14.4l1.4 2.8C17.6 17 15.6 20.8 15.6 26Z" fill="currentColor" />
      <path d="M19.2 26c0-5 2-8.8 5.8-11.4l1.4 2.8c-2.8 2-4.2 4.8-4.2 8.6Z" fill="currentColor" />
      <path d="M4 27h24v3.4H4z" fill="currentColor" />
    </>
  ),
  price: <path d="M13.6 3h4.8v14.6h6.6L16 29 7 17.6h6.6z" fill="currentColor" />,
  crossroads: <path d="M14 30h4V19.4l8-8V4h-4v5.8l-6 6-6-6V4H6v7.4l8 8z" fill="currentColor" />,
  playoffs: (
    <>
      <g stroke="currentColor" strokeWidth="2.6" fill="none">
        <path d="M3 6h6v9h6M3 26h6v-9M21 15h8" />
      </g>
      <path d="M25 11l5 4-5 4z" fill="currentColor" />
    </>
  ),
  podium: <path d="M2 19h8v11H2zM12 11h8v19h-8zM22 22h8v8h-8z" fill="currentColor" />,
  age: (
    <>
      <path d="M6 2h20v6l-7 8 7 8v6H6v-6l7-8-7-8V2Z" fill="currentColor" />
      <path d="M9 5h14v2.6l-7 7.4-7-7.4Z" fill="var(--paper)" />
    </>
  ),
  physical: (
    <path d="M16 29C8 22.6 3 17.4 3 12.4 3 8.2 6.2 5 10.4 5c2.4 0 4.4 1.1 5.6 3 1.2-1.9 3.2-3 5.6-3C25.8 5 29 8.2 29 12.4c0 5-5 10.2-13 16.6Z" fill="currentColor" />
  ),
  strength: <path d="M2 11h4.5v10H2zM7.5 13h3.5v6H7.5zM12 15h8v2h-8zM21 13h3.5v6H21zM25.5 11H30v10h-4.5z" fill="currentColor" />,
  crowd: (
    <>
      <path d="M3 12h6l13-7.5v23L9 20H3z" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M25.5 11.5c1.6 2.8 1.6 6.2 0 9M28.5 8c2.6 4.4 2.6 11.6 0 16" />
      </g>
    </>
  ),
  seed: (
    <>
      <rect x="4" y="4" width="24" height="24" rx="2" fill="currentColor" />
      <g fill="var(--paper)">
        <circle cx="11" cy="11" r="2" />
        <circle cx="21" cy="11" r="2" />
        <circle cx="16" cy="16" r="2" />
        <circle cx="11" cy="21" r="2" />
        <circle cx="21" cy="21" r="2" />
      </g>
    </>
  ),
  restart: (
    <path d="M16 5V2l-7 5 7 5V9c5 0 9 4 9 9s-4 9-9 9-9-4-9-9h-4c0 7.2 5.8 13 13 13s13-5.8 13-13S23.2 5 16 5Z" fill="currentColor" />
  ),
  career: (
    <>
      <path d="M3 7h10l2.5 3.5H29V27H3z" fill="currentColor" />
      <path d="M6 14h20v3H6zM6 19h13v3H6z" fill="var(--paper)" />
    </>
  ),
  language: (
    <>
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.6" fill="none" />
      <g stroke="currentColor" strokeWidth="2.2" fill="none">
        <path d="M3 16h26M16 3c4.5 4 4.5 22 0 26M16 3c-4.5 4-4.5 22 0 26" />
      </g>
    </>
  ),
  sound: (
    <>
      <path d="M4 12h5l8-7v22l-8-7H4z" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M22 12c1.8 2.4 1.8 5.6 0 8M26 8.5c3 4 3 11 0 15" />
      </g>
    </>
  ),
}

// Variantes <24px que o canvas desenhou (faixa "Tamanhos reais"): só as existentes — não inventar.
const SMALL: Partial<Record<IconName, ReactNode>> = {
  ball: (
    <>
      <circle cx="16" cy="16" r="14" fill="currentColor" />
      <path d="M16 2v28M2.5 16h27" stroke="var(--paper)" strokeWidth="3" />
    </>
  ),
}

const TONE = { ink: 'var(--ink)', red: 'var(--red)', dim: 'var(--dim)' } as const

interface Props { name: IconName; size?: number; tone?: keyof typeof TONE | 'inherit' }

export function Icon({ name, size = 24, tone = 'ink' }: Props) {
  const content = size < 24 ? (SMALL[name] ?? ICONS[name]) : ICONS[name]
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"
      style={{ color: tone === 'inherit' ? undefined : TONE[tone], flex: 'none' }}
    >
      {content}
    </svg>
  )
}
