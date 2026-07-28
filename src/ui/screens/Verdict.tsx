import { useEffect, useRef, useState, type Dispatch } from 'react'
import type { Action, GameState } from '../../state'
import { t } from '../../i18n'
import { computeVerdict } from '../../engine/verdict'
import type { Award } from '../../engine/types'
import { drawShareCard, shareText } from '../share'

interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}

const AWARDS: Award[] = ['allstar', 'mvp', 'dpoy', 'scoring', 'fmvp', 'ring']

export function Verdict({ state, dispatch }: Props) {
  const lang = state.lang
  const verdict = computeVerdict(state.career)
  const { totals, counts, tier, score } = verdict
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const build = state.build
    if (!canvas || !build) return
    document.fonts.ready.then(() => drawShareCard(canvas, verdict, build, lang))
  }, [lang, state.build, verdict])

  async function handleShare() {
    const text = shareText(lang, verdict)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — native share below is the fallback
    }
    if (navigator.share) {
      try {
        const canvas = canvasRef.current
        const blob = canvas && await new Promise<Blob | null>(resolve => canvas.toBlob(resolve))
        if (blob) {
          const file = new File([blob], 'the-goat.png', { type: 'image/png' })
          await navigator.share({ text, files: [file] })
        }
      } catch {
        // user cancelled or share unsupported for files — clipboard already covers it
      }
    }
  }

  return (
    <div className="screen">
      <div className="screen__glow" style={{ transform: 'translateX(-50%) scale(1.4)' }} />
      <div className="grain" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }}>
        <div className="kicker">{t(lang, 'verdict.title')}</div>
        <div className="display goldtext" style={{ fontSize: 64 }}>{t(lang, 'tier.' + tier)}</div>
        <div className="hint">{t(lang, 'verdict.score', { n: score })}</div>
        <hr className="rule" style={{ width: '100%' }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.points')}</span>
            <span className="display" style={{ fontSize: 24 }}>{totals.points}</span>
          </div>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.seasons2')}</span>
            <span className="display" style={{ fontSize: 24 }}>{totals.seasons}</span>
          </div>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.rings')}</span>
            <span className="display" style={{ fontSize: 24, color: counts.ring > 0 ? 'var(--gold-hi)' : undefined }}>
              {counts.ring}
            </span>
          </div>
          <div className="totcell">
            <span className="stat-line__label">{t(lang, 'verdict.mvps')}</span>
            <span className="display" style={{ fontSize: 24, color: counts.mvp > 0 ? 'var(--gold-hi)' : undefined }}>
              {counts.mvp}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {AWARDS.filter(a => counts[a] > 0).map(a => (
            <span key={a} className="chip">{counts[a]}× {t(lang, 'award.' + a)}</span>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: '100%', maxWidth: 280, aspectRatio: '1080 / 1350',
            border: '1px solid var(--border-gold)', borderRadius: 8,
          }}
        />

        <button type="button" className="btn btn--gold" style={{ width: '100%' }} onClick={handleShare}>
          {t(lang, copied ? 'share.copied' : 'share.button')}
        </button>
        <button type="button" className="btn" style={{ width: '100%' }} onClick={() => dispatch({ type: 'RESET' })}>
          {t(lang, 'share.again')}
        </button>
      </div>
    </div>
  )
}
