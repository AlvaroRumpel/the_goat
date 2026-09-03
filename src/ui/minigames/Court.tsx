import type { JSX } from 'react'
import { COURT } from '../../engine/minigames/playbook'

// Meia-quadra top-down da prancheta (tabuado sépia + linhas), compartilhada por JOGADA e
// MURALHA. Elementos constantes: React pula o subtree no re-render de 20Hz.
export const S = 100                                  // metros → unidades do viewBox
export const W = COURT.w * S, D = COURT.d * S         // 1524 × 1400
export const BASKET = { x: COURT.basket.x * S, y: COURT.basket.y * S }
const PAINT = { x: (COURT.basket.x - COURT.paintW / 2) * S, w: COURT.paintW * S, h: COURT.paintD * S }
const ARC_PATH = `M ${COURT.cornerX * S} 0 V ${COURT.cornerY * S} A ${COURT.arc * S} ${COURT.arc * S} 0 0 0 ${(COURT.w - COURT.cornerX) * S} ${COURT.cornerY * S} V 0`
const PLANK = 84
const JOINT = [520, 900, 260, 1120]

export const COURT_LAYERS: JSX.Element = (
  <>
    <g className="mg-pb__wood">
      {Array.from({ length: Math.ceil(W / PLANK) }, (_, i) => (
        <rect key={i} x={i * PLANK} y={0} width={PLANK} height={D} className={'mg-pb__plank' + (i % 2 ? ' mg-pb__plank--b' : '')} />
      ))}
      <g className="mg-pb__joint">
        {Array.from({ length: Math.ceil(W / PLANK) }, (_, i) => (
          <g key={i}>
            <line x1={i * PLANK} y1={0} x2={i * PLANK} y2={D} />
            <line x1={i * PLANK} y1={JOINT[i % 4]} x2={(i + 1) * PLANK} y2={JOINT[i % 4]} />
          </g>
        ))}
      </g>
    </g>
    <g className="mg-pb__lines">
      <rect x={4} y={4} width={W - 8} height={D - 8} />
      <rect x={PAINT.x} y={0} width={PAINT.w} height={PAINT.h} />
      <circle cx={BASKET.x} cy={PAINT.h} r={180} />
      <path d={ARC_PATH} />
      <line x1={BASKET.x - 90} y1={BASKET.y - 37.5} x2={BASKET.x + 90} y2={BASKET.y - 37.5} />
      <circle cx={BASKET.x} cy={BASKET.y} r={22.5} className="mg-pb__rim" />
    </g>
  </>
)
export const MAG_FILTER: JSX.Element = (
  <defs>
    <filter id="pb-mag" x="-60%" y="-60%" width="220%" height="220%">
      <feDropShadow dx="7" dy="12" stdDeviation="9" floodColor="#1C1A16" floodOpacity="0.34" />
    </filter>
  </defs>
)
