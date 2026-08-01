import { t, type Lang } from '../i18n'
import type { GameMode, Verdict } from '../engine/types'

export function shareText(lang: Lang, verdict: Verdict): string {
  return t(lang, 'share.text', {
    tier: t(lang, 'tier.' + verdict.tier),
    rings: verdict.counts.ring,
    mvps: verdict.counts.mvp,
    points: verdict.totals.points,
  })
}

export interface CardData {
  verdict: Verdict
  name: string
  number: number
  mode: GameMode
  teamLabel: string
  seasons: number
  yearFrom: number
  yearTo: number
  memories: { year: number; text: string }[]
  lang: Lang
}

// Tabela fixa de faixas de legado → percentil (apresentação, não fórmula travada;
// aproximada das distribuições do harness de calibração).
const PERCENTILE_BANDS: Array<[number, number]> = [
  [1950, 99], [1400, 96], [1000, 88], [700, 72], [450, 52], [250, 30], [0, 10],
]
export function percentileOf(score: number): number {
  return PERCENTILE_BANDS.find(([min]) => score >= min)![1]
}

const W = 1080
const H = 1350
const PAD = 52

const INK = '#1C1A16'
const PAPER = '#EDE6D6'
const RED = '#A8231C'
const LABEL = '#6B6455'
const CELL_BG = '#C6BCA2'
const GOLD = '#E8B24A'
const TRACKING = '4px'

function hasLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx
}

// Rótulo mono, uppercase, com tracking largo (letterSpacing nativo se disponível;
// senão espaçamento manual simples via join — cobre o design mas não é pixel-perfect).
function label(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  opts: { size: number; color: string; align?: CanvasTextAlign },
): void {
  ctx.save()
  ctx.font = `${opts.size}px "IBM Plex Mono", monospace`
  ctx.fillStyle = opts.color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  const upper = text.toUpperCase()
  if (hasLetterSpacing(ctx)) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = TRACKING
    ctx.fillText(upper, x, y)
  } else {
    ctx.fillText(upper.split('').join(' '), x, y)
  }
  ctx.restore()
}

function black(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  opts: { size: number; color: string; align?: CanvasTextAlign },
): void {
  ctx.save()
  ctx.font = `${opts.size}px "Archivo Black", sans-serif`
  ctx.fillStyle = opts.color
  ctx.textAlign = opts.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text.toUpperCase(), x, y)
  ctx.restore()
}

export function drawShareCard(canvas: HTMLCanvasElement, data: CardData): void {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { verdict, lang } = data
  const { totals, counts, tier, score } = verdict
  const fmtPoints = totals.points.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')

  // 1. fundo
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  // 2. cabeçalho
  label(ctx, t(lang, 'card.final', { from: data.yearFrom, to: data.yearTo }), PAD, 64, { size: 22, color: LABEL })
  label(ctx, t(lang, 'card.mode', { mode: t(lang, 'mode.' + data.mode + '.name') }), W - PAD, 64, { size: 22, color: LABEL, align: 'right' })

  // 3. filete duplo vermelho
  ctx.fillStyle = RED
  ctx.fillRect(PAD, 92, W - PAD * 2, 3)
  ctx.fillRect(PAD, 97, W - PAD * 2, 3)

  // 4. bloco de identidade
  label(ctx, t(lang, 'card.verdictLabel'), PAD, 150, { size: 22, color: LABEL })

  const tierLabel = t(lang, 'tier.' + tier)
  let tierSize = 168
  ctx.font = `${tierSize}px "Archivo Black", sans-serif`
  const maxTierWidth = W - 300
  while (ctx.measureText(tierLabel.toUpperCase()).width > maxTierWidth && tierSize > 40) {
    tierSize -= 4
    ctx.font = `${tierSize}px "Archivo Black", sans-serif`
  }
  black(ctx, tierLabel, PAD, 320, { size: tierSize, color: RED })

  ctx.save()
  ctx.font = '700 40px "Archivo", sans-serif'
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(data.name.toUpperCase(), PAD, 370)
  ctx.restore()

  label(ctx, t(lang, 'card.teamSeasons', { team: data.teamLabel, n: data.seasons }), PAD, 410, { size: 24, color: LABEL })

  const boxSize = 192
  const boxX = W - PAD - boxSize
  const boxY = 150
  ctx.save()
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  ctx.strokeRect(boxX + 2, boxY + 2, boxSize - 4, boxSize - 4)
  ctx.restore()
  black(ctx, String(data.number), boxX + boxSize / 2, boxY + boxSize / 2 + 36, { size: 104, color: INK, align: 'center' })

  // 5. grade de 4 números
  const gridY = 470
  const gridH = 150
  const gridW = W - PAD * 2
  const gap = 2
  const colW = (gridW - gap * 3) / 4
  ctx.fillStyle = CELL_BG
  ctx.fillRect(PAD, gridY, gridW, gridH)
  const stats: { label: string; value: string; color: string }[] = [
    { label: t(lang, 'card.points'), value: fmtPoints, color: INK },
    { label: t(lang, 'card.rings'), value: String(counts.ring), color: INK },
    { label: t(lang, 'card.mvps'), value: String(counts.mvp), color: INK },
    { label: t(lang, 'card.legacy'), value: String(score), color: RED },
  ]
  stats.forEach((s, i) => {
    const cellX = PAD + i * (colW + gap)
    ctx.fillStyle = PAPER
    ctx.fillRect(cellX, gridY, colW, gridH)
    const padding = 24
    label(ctx, s.label, cellX + padding, gridY + padding + 18, { size: 18, color: LABEL })
    black(ctx, s.value, cellX + padding, gridY + gridH - padding, { size: 48, color: s.color })
  })

  // 6. memórias
  const memY = 680
  label(ctx, t(lang, 'card.memory'), PAD, memY, { size: 22, color: LABEL })
  const rowH = 56
  data.memories.slice(0, 2).forEach((m, i) => {
    const rowY = memY + 40 + i * rowH
    if (i > 0) {
      ctx.fillStyle = '#DCD3BE'
      ctx.fillRect(PAD, rowY - rowH + 20, W - PAD * 2, 1)
    }
    ctx.save()
    ctx.font = '24px "IBM Plex Mono", monospace'
    ctx.fillStyle = RED
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(String(m.year), PAD, rowY)
    ctx.restore()

    ctx.save()
    ctx.font = '30px "Archivo", sans-serif'
    ctx.fillStyle = INK
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(m.text, PAD + 76, rowY)
    ctx.restore()
  })

  // 7. faixa de percentil
  const pctY = 900
  const pctH = 170
  ctx.fillStyle = INK
  ctx.fillRect(0, pctY, W, pctH)
  const p = percentileOf(score)
  label(ctx, t(lang, 'card.pct', { p }), PAD, pctY + 46, { size: 22, color: '#A79C86' })
  label(ctx, t(lang, 'card.tierSub.' + tier), W - PAD, pctY + 46, { size: 22, color: GOLD, align: 'right' })

  const barY = pctY + 74
  const barH = 14
  const barW = W - PAD * 2
  ctx.fillStyle = '#3D382D'
  ctx.fillRect(PAD, barY, barW, barH)
  ctx.fillStyle = GOLD
  ctx.fillRect(PAD, barY, barW * (p / 100), barH)

  const scaleKeys = ['reserva', 'titular', 'estrela', 'lenda', 'goat']
  const scaleY = barY + barH + 34
  scaleKeys.forEach((key, i) => {
    const align: CanvasTextAlign = i === 0 ? 'left' : i === scaleKeys.length - 1 ? 'right' : 'center'
    const x = PAD + (barW * i) / (scaleKeys.length - 1)
    label(ctx, t(lang, 'card.scale.' + key), x, scaleY, { size: 18, color: '#8B8171', align })
  })

  // 8. rodapé vermelho
  const footH = 90
  const footY = H - footH
  ctx.fillStyle = RED
  ctx.fillRect(0, footY, W, footH)
  black(ctx, 'THE GOAT', PAD, footY + footH / 2 + 12, { size: 30, color: '#F6F0E4' })
  label(ctx, t(lang, 'share.card.hook'), W - PAD, footY + footH / 2 + 8, { size: 22, color: '#F0C4C0', align: 'right' })
}
