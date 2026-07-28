import { t, type Lang } from '../i18n'
import type { Build, Verdict } from '../engine/types'

export function shareText(lang: Lang, verdict: Verdict): string {
  return t(lang, 'share.text', {
    tier: t(lang, 'tier.' + verdict.tier),
    rings: verdict.counts.ring,
    mvps: verdict.counts.mvp,
    points: verdict.totals.points,
  })
}

const W = 1080
const H = 1350
const CX = W / 2

// ponytail: build is part of the interface contract (brief) but the approved
// card design doesn't render anything from it. Kept unused rather than
// inventing a use for it.
export function drawShareCard(canvas: HTMLCanvasElement, verdict: Verdict, _build: Build, lang: Lang): void {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { totals, counts, tier } = verdict

  // bg
  ctx.fillStyle = '#0d0b08'
  ctx.fillRect(0, 0, W, H)

  // radial gold glow, top-center
  const glow = ctx.createRadialGradient(CX, 80, 0, CX, 80, 500)
  glow.addColorStop(0, 'rgba(212,167,60,0.22)')
  glow.addColorStop(1, 'rgba(212,167,60,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.textAlign = 'center'

  // kicker
  ctx.fillStyle = '#d4a73c'
  ctx.font = 'bold 28px "Archivo", sans-serif'
  ctx.fillText(t(lang, 'share.card.kicker'), CX, 140)

  // tier name, huge serif, gold gradient, auto-shrink to fit width
  const tierLabel = t(lang, 'tier.' + tier)
  let tierSize = 140
  ctx.font = `${tierSize}px "Marcellus", serif`
  const maxTierWidth = W - 120
  while (ctx.measureText(tierLabel).width > maxTierWidth && tierSize > 40) {
    tierSize -= 4
    ctx.font = `${tierSize}px "Marcellus", serif`
  }
  const tierY = 420
  const tierGrad = ctx.createLinearGradient(0, tierY - tierSize, 0, tierY + 20)
  tierGrad.addColorStop(0, '#efc75e')
  tierGrad.addColorStop(1, '#8a6b22')
  ctx.fillStyle = tierGrad
  ctx.fillText(tierLabel, CX, tierY)

  // thin gold rule under tier
  const ruleY = 480
  const ruleGrad = ctx.createLinearGradient(CX - 200, 0, CX + 200, 0)
  ruleGrad.addColorStop(0, 'rgba(212,167,60,0)')
  ruleGrad.addColorStop(0.5, '#d4a73c')
  ruleGrad.addColorStop(1, 'rgba(212,167,60,0)')
  ctx.fillStyle = ruleGrad
  ctx.fillRect(CX - 200, ruleY, 400, 2)

  // stat columns: rings, mvps, points
  const stats: { value: number | string; label: string; gold: boolean }[] = [
    { value: counts.ring, label: t(lang, 'verdict.rings'), gold: true },
    { value: counts.mvp, label: t(lang, 'verdict.mvps'), gold: false },
    { value: totals.points, label: t(lang, 'verdict.points'), gold: false },
  ]
  const colY = 700
  const labelY = colY + 50
  stats.forEach((s, i) => {
    const x = (W / 3) * (i + 0.5)
    ctx.font = '64px "Marcellus", serif'
    ctx.fillStyle = s.gold ? '#efc75e' : '#f1ead8'
    ctx.fillText(String(s.value), x, colY)
    ctx.font = 'bold 20px "Archivo", sans-serif'
    ctx.fillStyle = '#9c9080'
    ctx.fillText(s.label.toUpperCase(), x, labelY)
  })

  // footer
  ctx.font = '32px "Archivo", sans-serif'
  ctx.fillStyle = '#9c9080'
  ctx.fillText(t(lang, 'share.card.seasons', { n: totals.seasons, allstars: counts.allstar }), CX, 1150)
  ctx.fillText(t(lang, 'share.card.hook'), CX, 1200)

  // bottom branding
  ctx.font = 'bold 24px "Archivo", sans-serif'
  ctx.fillStyle = '#5c543f'
  ctx.fillText('THE GOAT', CX, 1300)

  // vignette
  const vignette = ctx.createRadialGradient(CX, H / 2, H * 0.35, CX, H / 2, H * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)
}
