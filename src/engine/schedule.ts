import type { CalendarSlot, KeyGame, Rng } from './types'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const DEADLINE_GAME = 55        // pausa da encruzilhada de trade (spec §2, decisão 3)
export const CALENDAR_RNG_CALLS = 4    // 1 jitter por posição, folga fixa com 3 jogos

// Âncoras POR POSIÇÃO na saída de selectKeyGames: [rivalry, seedRace, special, rivalry extra].
// seedRace clampado a [49, 54] para nunca colidir com o deadline (55).
const ANCHORS = [12, 52, 30, 66]

export function buildCalendar(keyGames: KeyGame[], rng: Rng): { slots: CalendarSlot[]; deadlineIndex: number } {
  const slots: CalendarSlot[] = []
  for (let i = 0; i < 4; i++) {
    const jitter = rng.int(-3, 3)                       // contrato: 4 calls SEMPRE
    if (i >= keyGames.length) continue
    const raw = ANCHORS[i] + jitter
    const gameIndex = i === 1 ? clamp(raw, 49, 54) : clamp(raw, 2, 81)
    slots.push({ gameIndex, keyGame: keyGames[i] })
  }
  slots.sort((a, b) => a.gameIndex - b.gameIndex)
  return { slots, deadlineIndex: DEADLINE_GAME }
}
