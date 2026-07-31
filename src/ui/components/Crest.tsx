import type { ReactNode } from 'react'
import type { Motif } from '../../engine/types'
import { teamById } from '../../data/teams'

// Escudo constante do grid 12a (docs/superpowers/plans/assets/2026-07-31-icones-canvas.html).
// Motivos verbatim do asset, no espaço 32×32 próprio, cor principal parametrizada:
// #EDE6D6 → currentColor; detalhes internos em #1C1A16 → var(--ink).
const SHIELD = 'M4 3h24v15c0 6-5 10.5-12 12.5C9 28.5 4 24 4 18V3Z'

export const MOTIFS: Record<Motif, ReactNode> = {
  bolt: <path d="M18.5 2 7 18h6.5L11.5 30 25 12h-7.5Z" fill="currentColor" />,
  bull: (
    <>
      <path d="M4 8c0-3 2.4-2.4 3-.8.7 2.2 2.4 3 4.2 3h9.6c1.8 0 3.5-.8 4.2-3 .6-1.6 3-2.2 3 .8 0 3.2-2.2 5-4.4 5.6.2 5-2.4 7.8-5.4 7.8h-4.4c-3 0-5.6-2.8-5.4-7.8C6.2 13 4 11.2 4 8Z" fill="currentColor" />
      <circle cx="12.6" cy="15" r="1.4" fill="var(--ink)" />
      <circle cx="19.4" cy="15" r="1.4" fill="var(--ink)" />
    </>
  ),
  anchor: (
    <g stroke="currentColor" strokeWidth="2.6" fill="none">
      <circle cx="16" cy="6" r="2.8" />
      <path d="M16 9.5v18M10 13.5h12M8.6 20c0 6 3.6 9.4 7.4 9.4S23.4 26 23.4 20" />
    </g>
  ),
  rocket: (
    <>
      <g fill="currentColor">
        <path d="M16 3c3.4 3.2 5.2 7.2 5.2 12v6.4H10.8V15c0-4.8 1.8-8.8 5.2-12Z" />
        <path d="M10.8 16.6 7 21.6v4.4l3.8-2.8ZM21.2 16.6l3.8 5v4.4l-3.8-2.8ZM13.6 22h4.8L16 28.6Z" />
      </g>
      <circle cx="16" cy="11" r="2" fill="var(--ink)" />
    </>
  ),
  flame: (
    <>
      <path d="M18.4 2c-.6 4.6 1.2 7.4 3.6 10.2 2.6 3 4.2 5.8 4.2 9.2 0 5.2-4.4 9.2-10.2 9.2S5.8 26.6 5.8 21.4c0-3.2 1.4-5.8 3.6-7.8 1 1.6 2.4 2.2 3.8 1.8-2.2-3.8-.8-8.8 5.2-13.4Z" fill="currentColor" />
      <path d="M16.6 15.6c1.8 2.4 3.6 4.4 3.6 7 0 2.8-2 4.8-4.6 4.8s-4.6-1.8-4.6-4.4c0-2 1.2-3.6 2.8-4.8.4 1 1.2 1.6 2 1.4-.8-1.4-.4-2.8.8-4Z" fill="var(--ink)" />
    </>
  ),
  crown: <path d="M4 26 6.4 8.4l6.4 6.2L16 4l3.2 10.6 6.4-6.2L28 26Z" fill="currentColor" />,
  pine: (
    <g fill="currentColor">
      <path d="M16 3.2 22.8 12.8H9.2ZM16 9.6 24.4 20.4H7.6ZM16 16.4 28.4 29.2H3.6Z" />
      <rect x="14.2" y="28" width="3.6" height="3.6" />
    </g>
  ),
  bridge: (
    <>
      <g fill="currentColor">
        <rect x="2" y="21.6" width="28" height="3.4" />
        <rect x="8.2" y="6" width="3.2" height="15.6" />
        <rect x="20.6" y="6" width="3.2" height="15.6" />
      </g>
      <g stroke="currentColor" strokeWidth="1.8" fill="none">
        <path d="M2 15.6c3.6-6.6 6.4-8.8 7.8-8.8s4.6 2.2 6.2 8.8c1.6-6.6 4.8-8.8 6.2-8.8s4.2 2.2 7.8 8.8" />
        <path d="M4.6 18.6v3M13.4 18.8v2.8M18.6 18.8v2.8M27.4 18.6v3" />
      </g>
    </>
  ),
  leprechaun: (
    <>
      <g fill="currentColor">
        <rect x="3" y="22" width="26" height="4.4" />
        <path d="M8.4 5h15.2v17H8.4z" />
      </g>
      <rect x="8.4" y="14.4" width="15.2" height="5" fill="var(--ink)" />
      <rect x="13.6" y="14.8" width="4.8" height="4.2" fill="currentColor" />
      <rect x="15" y="16" width="2" height="1.8" fill="var(--ink)" />
    </>
  ),
  claw: (
    <g fill="currentColor">
      <path d="M5 3c4 5 6 12 6 21H7C7 15 6 9 5 3Z" />
      <path d="M13 2c4 5 6 12 6 22h-4c0-9-1-16-2-22Z" />
      <path d="M21 3c4 5 6 11 6 20h-4c0-8-1-14-2-20Z" />
    </g>
  ),
  pickaxe: (
    <g fill="currentColor">
      <path d="M4 8.6c3.8-3.6 7.8-5.4 12-5.4s8.2 1.8 12 5.4c-1 1.8-2.1 2.9-3.2 3.3-2.6-2.5-5.5-3.8-8.8-3.8s-6.2 1.3-8.8 3.8C6.1 11.5 5 10.4 4 8.6Z" />
      <rect x="14.5" y="7" width="3" height="23" />
    </g>
  ),
  deer: (
    <>
      <g stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round">
        <path d="M12 11c-1.6-3.4-2-6.6-1.2-9.4M10.8 5 7 3.4M11.4 8.4 7.6 8M20 11c1.6-3.4 2-6.6 1.2-9.4M21.2 5 25 3.4M20.6 8.4 24.4 8" />
      </g>
      <path d="M16 10.6c3.8 0 6.2 2.4 6.2 6 0 4.6-2.4 8.6-6.2 11.4-3.8-2.8-6.2-6.8-6.2-11.4 0-3.6 2.4-6 6.2-6Z" fill="currentColor" />
      <path d="M10.4 13.4c-2-1-4-.6-4.6 1.2 2 1 4 .6 4.6-1.2ZM21.6 13.4c2-1 4-.6 4.6 1.2-2 1-4 .6-4.6-1.2Z" fill="currentColor" />
      <circle cx="13.4" cy="16.4" r="1.3" fill="var(--ink)" />
      <circle cx="18.6" cy="16.4" r="1.3" fill="var(--ink)" />
    </>
  ),
  gear: (
    <>
      <g fill="currentColor">
        <rect x="13" y="2" width="6" height="28" />
        <rect x="2" y="13" width="28" height="6" />
        <g transform="rotate(45 16 16)">
          <rect x="13" y="2" width="6" height="28" />
          <rect x="2" y="13" width="28" height="6" />
        </g>
        <circle cx="16" cy="16" r="11" />
      </g>
      <circle cx="16" cy="16" r="4" fill="var(--ink)" />
    </>
  ),
  cactus: (
    <g fill="currentColor">
      <rect x="13.5" y="4" width="5" height="26" />
      <path d="M5 11h3.6v7c0 2.2 1.6 3.8 3.4 4v4c-4.2-.2-7-3.4-7-8Z" />
      <path d="M27 9h-3.6v9c0 2.2-1.6 3.8-3.4 4v4c4.2-.2 7-3.4 7-8Z" />
    </g>
  ),
  sun: (
    <>
      <circle cx="16" cy="16" r="8" fill="currentColor" />
      <g fill="currentColor">
        <rect x="14.8" y="1" width="2.4" height="5" />
        <rect x="14.8" y="26" width="2.4" height="5" />
        <rect x="1" y="14.8" width="5" height="2.4" />
        <rect x="26" y="14.8" width="5" height="2.4" />
        <g transform="rotate(45 16 16)">
          <rect x="14.8" y="1" width="2.4" height="5" />
          <rect x="14.8" y="26" width="2.4" height="5" />
          <rect x="1" y="14.8" width="5" height="2.4" />
          <rect x="26" y="14.8" width="5" height="2.4" />
        </g>
      </g>
    </>
  ),
  mountain: <path d="M2 27 12 9l6 10 4-6 8 14Z" fill="currentColor" />,
  net: (
    <>
      <rect x="3" y="7" width="26" height="3.6" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" fill="none">
        <path d="M6.4 11 9 27M25.6 11 23 27M11.6 11l1.4 17M20.4 11 19 28M16 11v17M7.4 16h17.2M8.6 21h14.8M10 26h12" />
      </g>
    </>
  ),
  star: <path d="M16 2l4.2 9.6 10.4 1-7.8 7 2.2 10.2L16 24.4 7 29.8l2.2-10.2-7.8-7 10.4-1Z" fill="currentColor" />,
  pelican: (
    <>
      <circle cx="10" cy="9" r="5.2" fill="currentColor" />
      <path d="M13.2 11 30 18.6l-3 4.2L12.6 15Z" fill="currentColor" />
      <path d="M12.4 16.4c3.8 4.4 8.6 7.4 13.8 8.4-2.8 4-9 4.6-13.4 1.2Z" fill="currentColor" />
      <path d="M12.8 14.4 28 21.4" stroke="var(--ink)" strokeWidth="1.7" />
      <circle cx="9" cy="7.8" r="1.5" fill="var(--ink)" />
    </>
  ),
  horseshoe: <path d="M16 3c7 0 12 6 12 14 0 5-2 9-5 12l-4-3c2.6-2.4 4-5.4 4-9 0-5-3-8-7-8s-7 3-7 8c0 3.6 1.4 6.6 4 9l-4 3c-3-3-5-7-5-12C4 9 9 3 16 3Z" fill="currentColor" />,
  wolf: (
    <>
      <path d="M5.6 4.4 11 10.6h10L26.4 4.4 27.6 15c0 7-4.8 12.4-11.6 15.6C9.2 27.4 4.4 22 4.4 15Z" fill="currentColor" />
      <g fill="var(--ink)">
        <path d="M9.6 14.4 14.6 16l-5 1.6ZM22.4 14.4 17.4 16l5 1.6Z" />
        <path d="M16 21.4l3.4 3-3.4 2.4-3.4-2.4Z" />
      </g>
    </>
  ),
  dino: (
    <>
      <path d="M2 16 7 10.8C10.4 7.4 15 5.8 20.6 6c5 .2 8.6 2.2 8.8 5.2.2 2.8-.8 5.2-3.2 6.8L25 19.4H9.6Z" fill="currentColor" />
      <g fill="currentColor">
        <path d="M10.2 19.4h3l-1.5 2.4ZM14.8 19.4h3l-1.5 2.4ZM19.4 19.4h3l-1.5 2.4Z" />
      </g>
      <path d="M6.8 23.2h17.6c1 0 1.6.8 1.4 1.8l-.6 2.4c-.4 1.8-1.8 2.8-3.6 2.8H11.2c-1.8 0-3.2-1-3.6-2.6l-1.2-3c-.3-1 .3-1.4 1.4-1.4Z" fill="currentColor" />
      <circle cx="21.6" cy="12.4" r="1.7" fill="var(--ink)" />
      <path d="M17.8 9.2c2.2-1.4 4.8-1.6 7 0l-.6 1.8c-1.8-1.2-4-1-5.8.2Z" fill="var(--ink)" />
      <circle cx="5.4" cy="14.6" r="1.1" fill="var(--ink)" />
    </>
  ),
  bee: (
    <>
      <g fill="currentColor">
        <path d="M6.6 8.6c2.6-2.6 7-2 9.4 1.4-3 2.4-7.4 1.8-9.4-1.4ZM25.4 8.6c-2.6-2.6-7-2-9.4 1.4 3 2.4 7.4 1.8 9.4-1.4Z" />
        <circle cx="16" cy="8.6" r="4.2" />
        <ellipse cx="16" cy="20" rx="6.8" ry="8.6" />
        <path d="M14.6 28.4h2.8L16 31.4Z" />
      </g>
      <g fill="var(--ink)">
        <rect x="9.6" y="15.6" width="12.8" height="2.4" />
        <rect x="9.4" y="21" width="13.2" height="2.4" />
      </g>
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M14 4.6 12 1.6M18 4.6 20 1.6" />
      </g>
    </>
  ),
  bell: (
    <g fill="currentColor">
      <path d="M16 4.6c5 0 8 4 8 10 0 5 1 8 3 10H5c2-2 3-5 3-10 0-6 3-10 8-10Z" />
      <circle cx="16" cy="27.4" r="2.6" />
      <rect x="14.4" y="1" width="3.2" height="3.6" />
    </g>
  ),
  spear: (
    <g fill="currentColor">
      <path d="M16 2l6.2 9.4H9.8Z" />
      <rect x="14.4" y="11" width="3.2" height="19" />
    </g>
  ),
  wheel: (
    <>
      <circle cx="16" cy="16" r="13.4" fill="currentColor" />
      <circle cx="16" cy="16" r="8.4" fill="var(--ink)" />
      <g fill="currentColor">
        <rect x="14.8" y="4" width="2.4" height="24" />
        <rect x="4" y="14.8" width="24" height="2.4" />
        <circle cx="16" cy="16" r="3" />
      </g>
    </>
  ),
  lighthouse: (
    <g fill="currentColor">
      <path d="M11 12.4h10l3 17.6H8Z" />
      <rect x="12.8" y="4" width="6.4" height="6.4" />
      <path d="M2 6l7 3-7 3ZM30 6l-7 3 7 3Z" />
    </g>
  ),
  wing: (
    <g fill="currentColor">
      <path d="M2 2c9 .6 16 4.6 21 11.4h-8C11 8.4 7 5 2 2Z" />
      <path d="M3 10c8 .6 14 4 18 10.4h-8C10 16.4 7 12.6 3 10Z" />
      <path d="M5 18c7 .6 11.6 3.6 14.6 9.4H14C11 23.4 8.4 20.4 5 18Z" />
    </g>
  ),
  wand: (
    <g fill="currentColor">
      <rect x="3.4" y="24" width="22" height="4.4" transform="rotate(-40 14.4 26.2)" />
      <path d="M24 2l1.8 4.4L30 8.2l-4.2 1.8L24 14.4l-1.8-4.4L18 8.2l4.2-1.8Z" />
      <path d="M8 4l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1ZM27 18l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1Z" />
    </g>
  ),
  palm: (
    <g fill="currentColor">
      <path d="M14.8 12h3.4c.6 6 1.8 12 3.8 18h-11c2-6 3.2-12 3.8-18Z" />
      <path d="M16 3c4.4 0 8 2.4 9.4 6-2.6-1.8-5.6-2-8.6-.6ZM16 3c-4.4 0-8 2.4-9.4 6 2.6-1.8 5.6-2 8.6-.6ZM16 3c3.4 2 5.4 5 5.6 8.6-1.6-2.6-3.6-4.2-6-5ZM16 3c-3.4 2-5.4 5-5.6 8.6 1.6-2.6 3.6-4.2 6-5Z" />
    </g>
  ),
}

export function Crest({ teamId, size = 32 }: { teamId: string; size?: number }) {
  const motif = teamById(teamId).motif
  if (size <= 24) {
    // ≤24px: só o motivo, sem escudo (variante "em contexto" do canvas), na cor do texto corrente
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
        {MOTIFS[motif]}
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flex: 'none', color: 'var(--paper)' }}>
      <path d={SHIELD} fill="var(--ink)" />
      <g transform="translate(6.7,5.4) scale(0.58)">{MOTIFS[motif]}</g>
    </svg>
  )
}
